# IA Local

Asistente de IA de uso general para Android que funciona **sin internet**.
El modelo de lenguaje se ejecuta en el propio teléfono con [llama.cpp](https://github.com/ggml-org/llama.cpp).

## Cómo funciona

1. Instalas la app (APK).
2. La primera vez descargas un modelo (con Wi-Fi) o importas un archivo `.gguf` que ya tengas.
3. A partir de ahí, chateas en modo avión: nada sale del teléfono.

Modelos incluidos en el catálogo (cuantizados Q4_K_M):

| Modelo | Tamaño | RAM recomendada |
|---|---|---|
| Qwen 2.5 · 0.5B | 0,4 GB | 3 GB |
| Qwen 2.5 · 1.5B (recomendado) | 1,1 GB | 4 GB |
| Llama 3.2 · 3B | 2,0 GB | 6 GB |
| Qwen 2.5 · 3B | 2,1 GB | 6 GB |

Puedes importar cualquier otro modelo `.gguf` que soporte llama.cpp.

## Conseguir el APK

Cada vez que se sube un cambio a `apps/ia-local/`, GitHub Actions compila el APK:

- **Releases** → `ia-local-latest` → descarga `IA-Local-N.apk` desde el móvil, o
- **Actions** → *IA Local (Android APK)* → artefacto `IA-Local-apk`.

En el teléfono permite "instalar apps de origen desconocido" para tu navegador o gestor de archivos.

Requisitos: Android 9+ con procesador de 64 bits (arm64), que son prácticamente todos los teléfonos desde 2018.

## Compilar en tu ordenador

Con Android Studio (SDK 36, NDK y CMake instalados):

```bash
cd apps/ia-local
./gradlew assembleRelease
# APK en app/build/outputs/apk/release/app-release.apk
```

CMake descarga llama.cpp (versión fijada en `app/src/main/cpp/CMakeLists.txt`).
Para usar una copia local: `LLAMA_SRC_DIR=/ruta/a/llama.cpp ./gradlew assembleRelease`.

## Estructura

- `app/src/main/cpp/llama_jni.cpp` — puente JNI con llama.cpp: carga del modelo, plantilla de chat,
  reutilización de la caché entre turnos y generación token a token.
- `app/src/main/java/app/ialocal/llm/` — motor en Kotlin (hilo dedicado, recorte de contexto).
- `app/src/main/java/app/ialocal/data/` — catálogo, descargas e importación de modelos.
- `app/src/main/java/app/ialocal/ui/` — interfaz en Jetpack Compose.
