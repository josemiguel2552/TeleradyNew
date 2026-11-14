package app.ialocal.data

/** Modelo recomendado que se puede descargar una vez y usar sin internet. */
data class CatalogModel(
    val id: String,
    val name: String,
    val description: String,
    val sizeLabel: String,
    val minRamGb: Int,
    val fileName: String,
    val url: String,
)

object ModelCatalog {
    val models = listOf(
        CatalogModel(
            id = "qwen2.5-1.5b",
            name = "Qwen 2.5 · 1.5B",
            description = "Rápido y ligero. Buen español. Recomendado para empezar.",
            sizeLabel = "1,1 GB",
            minRamGb = 4,
            fileName = "qwen2.5-1.5b-instruct-q4_k_m.gguf",
            url = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        ),
        CatalogModel(
            id = "qwen2.5-3b",
            name = "Qwen 2.5 · 3B",
            description = "Más inteligente, algo más lento. Para teléfonos de gama alta.",
            sizeLabel = "2,1 GB",
            minRamGb = 6,
            fileName = "qwen2.5-3b-instruct-q4_k_m.gguf",
            url = "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
        ),
        CatalogModel(
            id = "llama3.2-3b",
            name = "Llama 3.2 · 3B",
            description = "Modelo de Meta. Bueno en conversación general.",
            sizeLabel = "2,0 GB",
            minRamGb = 6,
            fileName = "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
            url = "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        ),
        CatalogModel(
            id = "qwen2.5-0.5b",
            name = "Qwen 2.5 · 0.5B",
            description = "Muy pequeño. Para teléfonos con poca memoria; respuestas más simples.",
            sizeLabel = "0,4 GB",
            minRamGb = 3,
            fileName = "qwen2.5-0.5b-instruct-q4_k_m.gguf",
            url = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        ),
    )

    fun byFileName(fileName: String) = models.firstOrNull { it.fileName == fileName }
}
