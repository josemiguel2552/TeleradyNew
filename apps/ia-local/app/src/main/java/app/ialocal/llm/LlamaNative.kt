package app.ialocal.llm

/** Enlace directo a llama_jni.cpp. Usar solo a través de [LlamaEngine]. */
internal object LlamaNative {
    const val OK = 0
    const val ERR_NO_MODEL = 1
    const val ERR_TEMPLATE = 2
    const val ERR_TOKENIZE = 3
    const val ERR_CONTEXT_FULL = 4
    const val ERR_DECODE = 5

    init {
        System.loadLibrary("ialocal")
    }

    external fun nativeInit(libDir: String)
    external fun nativeLoad(path: String, nCtx: Int, nThreads: Int): Int
    external fun nativeUnload()
    external fun nativeContextSize(): Int
    external fun nativeStartTurn(roles: Array<String>, contents: Array<String>, maxNewTokens: Int): Int
    external fun nativeNextToken(): ByteArray?
    external fun nativeModelInfo(): String
    external fun nativeSystemInfo(): String
}
