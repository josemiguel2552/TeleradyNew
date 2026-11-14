package app.ialocal.ui

import android.app.ActivityManager
import android.app.Application
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.ialocal.data.CatalogModel
import app.ialocal.data.DownloadState
import app.ialocal.data.ModelCatalog
import app.ialocal.data.ModelStore
import app.ialocal.llm.ChatTurn
import app.ialocal.llm.LlamaEngine
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File

data class UiMessage(val id: Long, val role: String, val text: String, val isError: Boolean = false)

enum class Screen { Chat, Models }

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val store = ModelStore(app)
    private val engine by lazy { LlamaEngine.get(app) }

    val messages = mutableStateListOf<UiMessage>()
    var screen by mutableStateOf(Screen.Chat)
    var isGenerating by mutableStateOf(false)
        private set
    var loadingModel by mutableStateOf(false)
        private set
    var activeModel by mutableStateOf<String?>(null)
        private set
    var installed by mutableStateOf<List<File>>(emptyList())
        private set
    val downloads = mutableStateMapOf<String, DownloadState>()
    var importProgress by mutableStateOf<Float?>(null)
        private set
    var notice by mutableStateOf<String?>(null)
    var systemPrompt by mutableStateOf(store.systemPrompt)
        private set

    val totalRamGb: Int = run {
        val am = app.getSystemService(ActivityManager::class.java)
        val info = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        Math.round(info.totalMem / 1_073_741_824.0).toInt()
    }

    private var generationJob: Job? = null
    private var nextId = 0L
    private var generation = 0

    init {
        refreshInstalled()
        pollDownloads()
        val selected = store.selectedModel?.let { store.fileFor(it) }
        when {
            selected != null && selected.exists() -> loadModel(selected)
            installed.isNotEmpty() -> loadModel(installed.first())
            else -> screen = Screen.Models
        }
    }

    fun refreshInstalled() {
        installed = store.installed()
    }

    // ---- Modelos ----

    fun loadModel(file: File) {
        if (loadingModel) return
        stopGeneration()
        viewModelScope.launch {
            loadingModel = true
            try {
                engine.load(file.absolutePath)
                activeModel = file.name
                store.selectedModel = file.name
                screen = Screen.Chat
            } catch (e: Exception) {
                activeModel = null
                notice = e.message ?: "No se pudo cargar el modelo"
            } finally {
                loadingModel = false
            }
        }
    }

    fun deleteModel(file: File) {
        viewModelScope.launch {
            if (activeModel == file.name) {
                stopGeneration()
                engine.unload()
                activeModel = null
            }
            store.delete(file)
            refreshInstalled()
        }
    }

    fun download(model: CatalogModel) {
        try {
            store.startDownload(model)
            downloads[model.fileName] = DownloadState.Running(0, -1)
        } catch (e: Exception) {
            notice = "No se pudo iniciar la descarga: ${e.message}"
        }
    }

    fun cancelDownload(model: CatalogModel) {
        store.cancelDownload(model)
        downloads.remove(model.fileName)
    }

    private fun pollDownloads() {
        viewModelScope.launch {
            while (isActive) {
                for (m in ModelCatalog.models) {
                    when (val s = store.downloadState(m)) {
                        DownloadState.None -> {
                            if (downloads.remove(m.fileName) != null) {
                                refreshInstalled()
                                if (activeModel == null && store.fileFor(m.fileName).exists()) {
                                    loadModel(store.fileFor(m.fileName))
                                }
                            }
                        }
                        is DownloadState.Failed -> {
                            downloads.remove(m.fileName)
                            notice = s.reason
                        }
                        is DownloadState.Running -> downloads[m.fileName] = s
                    }
                }
                delay(1000)
            }
        }
    }

    fun import(uri: Uri) {
        viewModelScope.launch {
            importProgress = 0f
            try {
                val file = store.import(uri) { done, total ->
                    if (total > 0) importProgress = done.toFloat() / total
                }
                refreshInstalled()
                loadModel(file)
            } catch (e: Exception) {
                notice = e.message ?: "No se pudo importar el archivo"
            } finally {
                importProgress = null
            }
        }
    }

    fun updateSystemPrompt(text: String) {
        systemPrompt = text
        store.systemPrompt = text
    }

    // ---- Chat ----

    fun newChat() {
        stopGeneration()
        messages.clear()
    }

    fun send(text: String) {
        val prompt = text.trim()
        if (prompt.isEmpty() || isGenerating) return
        if (activeModel == null) {
            notice = "Primero elige o descarga un modelo"
            screen = Screen.Models
            return
        }
        messages += UiMessage(nextId++, "user", prompt)
        respond()
    }

    /** Vuelve a generar la última respuesta del asistente. */
    fun regenerate() {
        if (isGenerating) return
        if (messages.lastOrNull()?.role == "assistant") messages.removeAt(messages.lastIndex)
        if (messages.lastOrNull()?.role == "user") respond()
    }

    private fun respond() {
        val history = buildList {
            if (systemPrompt.isNotBlank()) add(ChatTurn("system", systemPrompt))
            messages.filter { !it.isError && it.text.isNotBlank() }.forEach { add(ChatTurn(it.role, it.text)) }
        }
        val replyId = nextId++
        messages += UiMessage(replyId, "assistant", "")
        isGenerating = true
        val gen = ++generation
        generationJob = viewModelScope.launch {
            val sb = StringBuilder()
            try {
                engine.generate(history).collect { piece ->
                    sb.append(piece)
                    updateMessage(replyId) { it.copy(text = sb.toString().trimStart()) }
                }
                if (sb.isBlank()) updateMessage(replyId) { it.copy(text = "(sin respuesta)") }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                updateMessage(replyId) { it.copy(text = e.message ?: "Error", isError = true) }
            } finally {
                if (generation == gen) isGenerating = false
            }
        }
    }

    fun stopGeneration() {
        generation++
        generationJob?.cancel()
        generationJob = null
        isGenerating = false
    }

    private fun updateMessage(id: Long, f: (UiMessage) -> UiMessage) {
        val i = messages.indexOfLast { it.id == id }
        if (i >= 0) messages[i] = f(messages[i])
    }
}
