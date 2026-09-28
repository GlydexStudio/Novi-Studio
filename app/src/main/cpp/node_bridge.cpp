#include <jni.h>
#include <cstdlib>
#include <cstring>

#include "node.h"

extern "C"
JNIEXPORT jint JNICALL
Java_com_glydexstudio_novistudio_node_NodeNative_startNodeWithArguments(
        JNIEnv* env,
        jobject,
        jobjectArray arguments) {
    const jsize argument_count = env->GetArrayLength(arguments);
    if (argument_count <= 0) {
        return static_cast<jint>(-1);
    }

    int buffer_size = 0;
    for (jsize i = 0; i < argument_count; ++i) {
        jstring value = static_cast<jstring>(
                env->GetObjectArrayElement(arguments, i));
        if (value == nullptr) {
            return static_cast<jint>(-2);
        }

        const char* text = env->GetStringUTFChars(value, nullptr);
        if (text == nullptr) {
            env->DeleteLocalRef(value);
            return static_cast<jint>(-3);
        }

        buffer_size += static_cast<int>(std::strlen(text)) + 1;
        env->ReleaseStringUTFChars(value, text);
        env->DeleteLocalRef(value);
    }

    char* args_buffer = static_cast<char*>(
            std::calloc(static_cast<size_t>(buffer_size), sizeof(char)));
    char** argv = static_cast<char**>(
            std::calloc(static_cast<size_t>(argument_count), sizeof(char*)));

    if (args_buffer == nullptr || argv == nullptr) {
        std::free(args_buffer);
        std::free(argv);
        return static_cast<jint>(-4);
    }

    char* current_position = args_buffer;

    for (jsize i = 0; i < argument_count; ++i) {
        jstring value = static_cast<jstring>(
                env->GetObjectArrayElement(arguments, i));
        const char* text = env->GetStringUTFChars(value, nullptr);

        const size_t length = std::strlen(text);
        std::memcpy(current_position, text, length);
        current_position[length] = '\0';
        argv[i] = current_position;
        current_position += length + 1;

        env->ReleaseStringUTFChars(value, text);
        env->DeleteLocalRef(value);
    }

    const jint result = static_cast<jint>(
            node::Start(static_cast<int>(argument_count), argv));

    std::free(argv);
    std::free(args_buffer);
    return result;
}
