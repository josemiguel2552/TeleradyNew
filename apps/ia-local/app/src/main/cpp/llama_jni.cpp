// Puente JNI mínimo entre Kotlin y llama.cpp.
// Toda la inferencia ocurre en el dispositivo; no se usa red.
//
// Diseño: un único modelo/contexto global. Kotlin debe llamar a estas
// funciones siempre desde el mismo hilo (ver LlamaEngine.kt).

#include <jni.h>

#include <algorithm>
#include <string>
#include <thread>
#include <vector>

#include "ggml-backend.h"
#include "llama.h"

#ifdef __ANDROID__
#include <android/log.h>
#define LOG_TAG "ialocal-native"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#else
#include <cstdio>
#define LOGI(...) (fprintf(stderr, __VA_ARGS__), fputc('\n', stderr))
#define LOGE(...) (fprintf(stderr, __VA_ARGS__), fputc('\n', stderr))
#endif

namespace {

// Códigos de resultado compartidos con Kotlin (LlamaNative.kt).
constexpr int OK = 0;
constexpr int ERR_NO_MODEL = 1;
constexpr int ERR_TEMPLATE = 2;
constexpr int ERR_TOKENIZE = 3;
constexpr int ERR_CONTEXT_FULL = 4;
constexpr int ERR_DECODE = 5;

llama_model *g_model = nullptr;
llama_context *g_ctx = nullptr;
llama_sampler *g_sampler = nullptr;
const llama_vocab *g_vocab = nullptr;
std::string g_template;               // plantilla de chat del modelo (o "chatml")
std::vector<llama_token> g_evaluated; // tokens que ya están en la caché KV
std::string g_pending_utf8;           // bytes de un carácter UTF-8 aún incompleto
int g_generated = 0;
int g_max_new_tokens = 1024;

bool g_backends_loaded = false;

void free_all() {
    if (g_sampler) { llama_sampler_free(g_sampler); g_sampler = nullptr; }
    if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
    g_vocab = nullptr;
    g_template.clear();
    g_evaluated.clear();
    g_pending_utf8.clear();
}

std::string jstring_to_std(JNIEnv *env, jstring s) {
    if (!s) return {};
    // GetStringUTFChars devuelve "modified UTF-8", que rompe emojis.
    // Convertimos a través de String.getBytes("UTF-8").
    jclass str_cls = env->GetObjectClass(s);
    jmethodID get_bytes = env->GetMethodID(str_cls, "getBytes", "(Ljava/lang/String;)[B");
    jstring charset = env->NewStringUTF("UTF-8");
    auto bytes = (jbyteArray) env->CallObjectMethod(s, get_bytes, charset);
    env->DeleteLocalRef(charset);
    env->DeleteLocalRef(str_cls);
    if (!bytes) return {};
    jsize len = env->GetArrayLength(bytes);
    std::string out(len, '\0');
    env->GetByteArrayRegion(bytes, 0, len, reinterpret_cast<jbyte *>(out.data()));
    env->DeleteLocalRef(bytes);
    return out;
}

jbyteArray to_jbytes(JNIEnv *env, const std::string &s) {
    jbyteArray arr = env->NewByteArray((jsize) s.size());
    if (!s.empty()) {
        env->SetByteArrayRegion(arr, 0, (jsize) s.size(), reinterpret_cast<const jbyte *>(s.data()));
    }
    return arr;
}

// Longitud del prefijo de `s` formado solo por caracteres UTF-8 completos.
size_t complete_utf8_prefix(const std::string &s) {
    size_t i = s.size();
    // Retrocede como máximo 3 bytes buscando el inicio de un carácter incompleto.
    for (size_t back = 1; back <= 4 && back <= s.size(); ++back) {
        auto c = static_cast<unsigned char>(s[s.size() - back]);
        if ((c & 0xC0) == 0x80) continue; // byte de continuación
        size_t need = 1;
        if ((c & 0xE0) == 0xC0) need = 2;
        else if ((c & 0xF0) == 0xE0) need = 3;
        else if ((c & 0xF8) == 0xF0) need = 4;
        if (back < need) i = s.size() - back; // carácter incompleto
        break;
    }
    return i;
}

std::string token_to_piece(llama_token tok) {
    std::string piece(64, '\0');
    int n = llama_token_to_piece(g_vocab, tok, piece.data(), (int32_t) piece.size(), 0, false);
    if (n < 0) {
        piece.resize(-n);
        n = llama_token_to_piece(g_vocab, tok, piece.data(), (int32_t) piece.size(), 0, false);
    }
    piece.resize(std::max(0, n));
    return piece;
}

bool format_chat(const std::vector<std::string> &roles,
                 const std::vector<std::string> &contents,
                 std::string &out) {
    std::vector<llama_chat_message> msgs;
    msgs.reserve(roles.size());
    size_t total = 0;
    for (size_t i = 0; i < roles.size(); ++i) {
        msgs.push_back({roles[i].c_str(), contents[i].c_str()});
        total += contents[i].size();
    }
    std::vector<char> buf(total * 2 + 1024);
    int n = llama_chat_apply_template(g_template.c_str(), msgs.data(), msgs.size(), true,
                                      buf.data(), (int32_t) buf.size());
    if (n > (int) buf.size()) {
        buf.resize(n + 1);
        n = llama_chat_apply_template(g_template.c_str(), msgs.data(), msgs.size(), true,
                                      buf.data(), (int32_t) buf.size());
    }
    if (n < 0) return false;
    out.assign(buf.data(), n);
    return true;
}

} // namespace

#define JNI_FN(name) Java_app_ialocal_llm_LlamaNative_##name

extern "C" {

JNIEXPORT void JNICALL JNI_FN(nativeInit)(JNIEnv *env, jobject, jstring jlib_dir) {
    if (g_backends_loaded) return;
    std::string dir = jstring_to_std(env, jlib_dir);
    // Carga las variantes de CPU (NEON, dotprod, i8mm, SVE...) y elige la mejor.
    if (!dir.empty()) ggml_backend_load_all_from_path(dir.c_str());
    else ggml_backend_load_all();
    llama_backend_init();
    g_backends_loaded = true;
    LOGI("backends cargados: %zu", ggml_backend_reg_count());
}

JNIEXPORT jint JNICALL JNI_FN(nativeLoad)(JNIEnv *env, jobject, jstring jpath, jint n_ctx, jint n_threads) {
    free_all();
    std::string path = jstring_to_std(env, jpath);

    llama_model_params mparams = llama_model_default_params();
    g_model = llama_model_load_from_file(path.c_str(), mparams);
    if (!g_model) {
        LOGE("no se pudo cargar el modelo: %s", path.c_str());
        return ERR_NO_MODEL;
    }
    g_vocab = llama_model_get_vocab(g_model);

    int threads = n_threads > 0 ? n_threads
                                : std::clamp((int) std::thread::hardware_concurrency() - 2, 2, 6);
    int ctx_train = llama_model_n_ctx_train(g_model);
    int ctx = n_ctx;
    if (ctx_train > 0) ctx = std::min(ctx, ctx_train);

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = ctx;
    cparams.n_batch = 512;
    cparams.n_ubatch = 512;
    cparams.n_threads = threads;
    cparams.n_threads_batch = threads;
    g_ctx = llama_init_from_model(g_model, cparams);
    if (!g_ctx) {
        LOGE("no se pudo crear el contexto");
        free_all();
        return ERR_NO_MODEL;
    }

    const char *tmpl = llama_model_chat_template(g_model, nullptr);
    g_template = tmpl ? tmpl : "chatml";
    // Si la plantilla del modelo no es reconocida, usamos chatml como reserva.
    llama_chat_message probe{"user", "hola"};
    char probe_buf[256];
    if (llama_chat_apply_template(g_template.c_str(), &probe, 1, true, probe_buf, sizeof(probe_buf)) < 0) {
        LOGI("plantilla no reconocida; usando chatml");
        g_template = "chatml";
    }

    auto sparams = llama_sampler_chain_default_params();
    g_sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(g_sampler, llama_sampler_init_penalties(llama_vocab_n_tokens(g_vocab), 64, 1.1f, 0.0f, 0.0f));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_top_k(40));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_top_p(0.95f, 1));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_min_p(0.05f, 1));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    LOGI("modelo cargado: ctx=%d hilos=%d", ctx, threads);
    return OK;
}

JNIEXPORT void JNICALL JNI_FN(nativeUnload)(JNIEnv *, jobject) {
    free_all();
}

JNIEXPORT jint JNICALL JNI_FN(nativeContextSize)(JNIEnv *, jobject) {
    return g_ctx ? (jint) llama_n_ctx(g_ctx) : 0;
}

// Prepara un turno: aplica la plantilla a toda la conversación, reutiliza
// el prefijo que ya está en la caché KV y evalúa solo lo nuevo.
JNIEXPORT jint JNICALL JNI_FN(nativeStartTurn)(JNIEnv *env, jobject, jobjectArray jroles,
                                               jobjectArray jcontents, jint max_new_tokens) {
    if (!g_ctx) return ERR_NO_MODEL;

    jsize n = env->GetArrayLength(jroles);
    std::vector<std::string> roles(n), contents(n);
    for (jsize i = 0; i < n; ++i) {
        auto r = (jstring) env->GetObjectArrayElement(jroles, i);
        auto c = (jstring) env->GetObjectArrayElement(jcontents, i);
        roles[i] = jstring_to_std(env, r);
        contents[i] = jstring_to_std(env, c);
        env->DeleteLocalRef(r);
        env->DeleteLocalRef(c);
    }

    std::string prompt;
    if (!format_chat(roles, contents, prompt)) return ERR_TEMPLATE;

    int n_tok = -llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, true, true);
    if (n_tok <= 0) return ERR_TOKENIZE;
    std::vector<llama_token> tokens(n_tok);
    if (llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), tokens.data(), n_tok, true, true) < 0) {
        return ERR_TOKENIZE;
    }

    const int n_ctx = (int) llama_n_ctx(g_ctx);
    // Hay que dejar sitio para la respuesta.
    const int reserve = std::min(512, n_ctx / 4);
    if ((int) tokens.size() + reserve > n_ctx) return ERR_CONTEXT_FULL;

    // Prefijo común con lo que ya está evaluado.
    size_t common = 0;
    while (common < g_evaluated.size() && common < tokens.size() && g_evaluated[common] == tokens[common]) {
        ++common;
    }
    // Necesitamos evaluar al menos un token para obtener logits.
    if (common == tokens.size()) --common;

    llama_memory_t mem = llama_get_memory(g_ctx);
    if (!llama_memory_seq_rm(mem, 0, (llama_pos) common, -1)) {
        // Si no se puede recortar, empezamos de cero.
        llama_memory_clear(mem, true);
        common = 0;
    }
    g_evaluated.resize(common);

    const int n_batch = (int) llama_n_batch(g_ctx);
    for (size_t i = common; i < tokens.size(); i += n_batch) {
        int len = (int) std::min<size_t>(n_batch, tokens.size() - i);
        llama_batch batch = llama_batch_get_one(tokens.data() + i, len);
        if (llama_decode(g_ctx, batch) != 0) {
            llama_memory_clear(mem, true);
            g_evaluated.clear();
            return ERR_DECODE;
        }
        g_evaluated.insert(g_evaluated.end(), tokens.begin() + i, tokens.begin() + i + len);
    }

    llama_sampler_reset(g_sampler);
    g_pending_utf8.clear();
    g_generated = 0;
    g_max_new_tokens = max_new_tokens > 0 ? max_new_tokens : 1024;
    return OK;
}

// Genera el siguiente fragmento. Devuelve bytes UTF-8 (posiblemente vacíos
// si el carácter aún está incompleto) o null cuando la respuesta terminó.
JNIEXPORT jbyteArray JNICALL JNI_FN(nativeNextToken)(JNIEnv *env, jobject) {
    if (!g_ctx) return nullptr;

    if (g_generated >= g_max_new_tokens ||
        (int) g_evaluated.size() >= (int) llama_n_ctx(g_ctx) - 1) {
        return nullptr;
    }

    llama_token tok = llama_sampler_sample(g_sampler, g_ctx, -1);
    if (llama_vocab_is_eog(g_vocab, tok)) {
        if (!g_pending_utf8.empty()) {
            std::string rest;
            rest.swap(g_pending_utf8);
            return to_jbytes(env, rest);
        }
        return nullptr;
    }

    llama_batch batch = llama_batch_get_one(&tok, 1);
    if (llama_decode(g_ctx, batch) != 0) return nullptr;
    g_evaluated.push_back(tok);
    ++g_generated;

    g_pending_utf8 += token_to_piece(tok);
    size_t ok = complete_utf8_prefix(g_pending_utf8);
    std::string out = g_pending_utf8.substr(0, ok);
    g_pending_utf8.erase(0, ok);
    return to_jbytes(env, out);
}

JNIEXPORT jstring JNICALL JNI_FN(nativeModelInfo)(JNIEnv *env, jobject) {
    if (!g_model) return env->NewStringUTF("");
    char buf[256];
    llama_model_desc(g_model, buf, sizeof(buf));
    return env->NewStringUTF(buf);
}

JNIEXPORT jstring JNICALL JNI_FN(nativeSystemInfo)(JNIEnv *env, jobject) {
    return env->NewStringUTF(llama_print_system_info());
}

} // extern "C"
