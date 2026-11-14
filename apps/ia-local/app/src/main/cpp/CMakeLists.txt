cmake_minimum_required(VERSION 3.22.1)
project("ialocal" C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --------------------------------------------------------------------------
# llama.cpp: se usa una copia local si se pasa -DLLAMA_SRC_DIR=...,
# si no, se descarga la versión fijada (solo hace falta red al compilar,
# nunca en el teléfono).
# --------------------------------------------------------------------------
set(LLAMA_CPP_TAG "b12300" CACHE STRING "Versión de llama.cpp")
set(LLAMA_SRC_DIR "" CACHE PATH "Ruta a un checkout local de llama.cpp")

if(DEFINED ANDROID_ABI)
    if(ANDROID_ABI STREQUAL "arm64-v8a")
        set(GGML_SYSTEM_ARCH "ARM" CACHE STRING "" FORCE)
        set(GGML_CPU_KLEIDIAI ON CACHE BOOL "" FORCE)
        set(GGML_OPENMP ON CACHE BOOL "" FORCE)
    elseif(ANDROID_ABI STREQUAL "x86_64")
        set(GGML_SYSTEM_ARCH "x86" CACHE STRING "" FORCE)
        set(GGML_CPU_KLEIDIAI OFF CACHE BOOL "" FORCE)
        set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
    endif()
endif()

if(LLAMA_SRC_DIR)
    add_subdirectory(${LLAMA_SRC_DIR} build-llama)
else()
    include(FetchContent)
    FetchContent_Declare(llama_cpp
        URL https://github.com/ggml-org/llama.cpp/archive/refs/tags/${LLAMA_CPP_TAG}.tar.gz
        DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
    FetchContent_MakeAvailable(llama_cpp)
endif()

add_library(ialocal SHARED llama_jni.cpp)

target_link_libraries(ialocal PRIVATE llama ggml)
if(ANDROID)
    target_link_libraries(ialocal PRIVATE android log)
endif()
