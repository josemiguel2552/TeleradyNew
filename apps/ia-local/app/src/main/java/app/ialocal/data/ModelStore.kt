package app.ialocal.data

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.content.edit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

sealed interface DownloadState {
    data object None : DownloadState
    data class Running(val downloaded: Long, val total: Long) : DownloadState
    data class Failed(val reason: String) : DownloadState
}

/** Gestiona los archivos .gguf guardados en el teléfono. */
class ModelStore(private val context: Context) {

    private val prefs = context.getSharedPreferences("ialocal", Context.MODE_PRIVATE)
    private val dm = context.getSystemService(DownloadManager::class.java)

    val dir: File = (context.getExternalFilesDir("models") ?: File(context.filesDir, "models")).apply { mkdirs() }

    fun installed(): List<File> =
        dir.listFiles { f -> f.isFile && f.name.endsWith(".gguf", ignoreCase = true) }
            ?.sortedBy { it.name.lowercase() } ?: emptyList()

    fun fileFor(fileName: String) = File(dir, fileName)

    var selectedModel: String?
        get() = prefs.getString("selected_model", null)
        set(value) = prefs.edit { putString("selected_model", value) }

    var systemPrompt: String
        get() = prefs.getString("system_prompt", null) ?: DEFAULT_SYSTEM_PROMPT
        set(value) = prefs.edit { putString("system_prompt", value) }

    // ---- Descargas (solo la primera vez, con internet) ----

    fun startDownload(model: CatalogModel) {
        File(dir, model.fileName + PARTIAL).delete()
        val request = DownloadManager.Request(Uri.parse(model.url))
            .setTitle("IA Local: ${model.name}")
            .setDescription("Descargando modelo (${model.sizeLabel})")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(context, "models", model.fileName + PARTIAL)
            .setAllowedOverMetered(true)
        val id = dm.enqueue(request)
        prefs.edit { putLong(KEY_DL + model.fileName, id) }
    }

    fun cancelDownload(model: CatalogModel) {
        val id = prefs.getLong(KEY_DL + model.fileName, -1)
        if (id >= 0) dm.remove(id)
        prefs.edit { remove(KEY_DL + model.fileName) }
        File(dir, model.fileName + PARTIAL).delete()
    }

    /** Consulta el estado y, si la descarga terminó, deja el archivo listo para usar. */
    fun downloadState(model: CatalogModel): DownloadState {
        val id = prefs.getLong(KEY_DL + model.fileName, -1)
        if (id < 0) return DownloadState.None
        dm.query(DownloadManager.Query().setFilterById(id)).use { c ->
            if (!c.moveToFirst()) {
                prefs.edit { remove(KEY_DL + model.fileName) }
                return DownloadState.None
            }
            val status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            return when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    val part = File(dir, model.fileName + PARTIAL)
                    if (part.exists()) part.renameTo(File(dir, model.fileName))
                    prefs.edit { remove(KEY_DL + model.fileName) }
                    DownloadState.None
                }
                DownloadManager.STATUS_FAILED -> {
                    prefs.edit { remove(KEY_DL + model.fileName) }
                    File(dir, model.fileName + PARTIAL).delete()
                    DownloadState.Failed("La descarga falló. Revisa la conexión y el espacio libre.")
                }
                else -> DownloadState.Running(done, total)
            }
        }
    }

    // ---- Importar un .gguf que ya está en el teléfono ----

    suspend fun import(uri: Uri, onProgress: (Long, Long) -> Unit): File = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        var name = "modelo.gguf"
        var size = -1L
        resolver.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                c.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { name = c.getString(it) ?: name }
                c.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 }?.let { size = c.getLong(it) }
            }
        }
        if (!name.endsWith(".gguf", ignoreCase = true)) {
            throw IllegalArgumentException("El archivo debe tener extensión .gguf")
        }
        val tmp = File(dir, name + PARTIAL)
        val dest = File(dir, name)
        try {
            resolver.openInputStream(uri)!!.use { input ->
                tmp.outputStream().use { out ->
                    val buf = ByteArray(1 shl 20)
                    var copied = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        copied += n
                        onProgress(copied, size)
                    }
                }
            }
            if (!tmp.renameTo(dest)) throw IllegalStateException("No se pudo guardar el modelo")
        } finally {
            tmp.delete()
        }
        dest
    }

    fun delete(file: File) {
        file.delete()
        if (selectedModel == file.name) selectedModel = null
    }

    companion object {
        private const val PARTIAL = ".part"
        private const val KEY_DL = "dl_"

        const val DEFAULT_SYSTEM_PROMPT =
            "Eres un asistente útil, amable y preciso que funciona sin conexión en el teléfono del usuario. " +
                "Responde en el idioma del usuario (normalmente español), de forma clara y concisa. " +
                "Si no sabes algo, dilo con honestidad en lugar de inventarlo."
    }
}
