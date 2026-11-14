package app.ialocal.llm

import android.content.Context
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.newSingleThreadContext
import kotlinx.coroutines.withContext
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

data class ChatTurn(val role: String, val content: String)

class LlamaException(message: String) : Exception(message)

/**
 * Motor de IA local. Todas las llamadas nativas pasan por un único hilo,
 * porque llama.cpp no es seguro para usar desde varios hilos a la vez.
 */
class LlamaEngine private constructor(libDir: String) {

    @OptIn(ExperimentalCoroutinesApi::class, kotlinx.coroutines.DelicateCoroutinesApi::class)
    private val llamaThread = newSingleThreadContext("llama")

    var loadedPath: String? = null
        private set

    init {
        LlamaNative.nativeInit(libDir)
    }

    suspend fun load(path: String, contextSize: Int = 4096) = withContext(llamaThread) {
        if (loadedPath == path) return@withContext
        loadedPath = null
        val rc = LlamaNative.nativeLoad(path, contextSize, 0)
        if (rc != LlamaNative.OK) {
            throw LlamaException("No se pudo cargar el modelo. ¿Es un archivo .gguf válido y hay memoria suficiente?")
        }
        loadedPath = path
    }

    suspend fun unload() = withContext(llamaThread) {
        LlamaNative.nativeUnload()
        loadedPath = null
    }

    /**
     * Genera la respuesta del asistente a la conversación, fragmento a fragmento.
     * Si la conversación no cabe en el contexto, se descartan los mensajes más
     * antiguos (conservando el mensaje de sistema).
     */
    fun generate(history: List<ChatTurn>, maxNewTokens: Int = 1024): Flow<String> = flow {
        var turns = history
        while (true) {
            val rc = LlamaNative.nativeStartTurn(
                turns.map { it.role }.toTypedArray(),
                turns.map { it.content }.toTypedArray(),
                maxNewTokens,
            )
            when (rc) {
                LlamaNative.OK -> break
                LlamaNative.ERR_CONTEXT_FULL -> {
                    val trimmed = trimOldest(turns)
                    if (trimmed == null) throw LlamaException("El mensaje es demasiado largo para la memoria del modelo.")
                    turns = trimmed
                }
                LlamaNative.ERR_NO_MODEL -> throw LlamaException("No hay ningún modelo cargado.")
                else -> throw LlamaException("Error interno del motor (código $rc).")
            }
        }
        while (true) {
            currentCoroutineContext().ensureActive()
            val bytes = LlamaNative.nativeNextToken() ?: break
            if (bytes.isNotEmpty()) emit(String(bytes, Charsets.UTF_8))
        }
    }.flowOn(llamaThread)

    private fun trimOldest(turns: List<ChatTurn>): List<ChatTurn>? {
        val system = turns.takeWhile { it.role == "system" }
        val rest = turns.drop(system.size)
        // Siempre debe quedar al menos el último mensaje del usuario.
        if (rest.size <= 1) return null
        // Quitamos el par más antiguo (usuario + asistente).
        return system + rest.drop(minOf(2, rest.size - 1))
    }

    suspend fun modelInfo(): String = withContext(llamaThread) { LlamaNative.nativeModelInfo() }

    companion object {
        @Volatile private var instance: LlamaEngine? = null

        fun get(context: Context): LlamaEngine =
            instance ?: synchronized(this) {
                instance ?: LlamaEngine(context.applicationInfo.nativeLibraryDir).also { instance = it }
            }
    }
}
