package com.glydexstudio.novistudio.node

/** JNI bridge to the bundled Node.js Mobile shared library. */
object NodeNative {
    private var loaded = false

    @Synchronized
    fun load() {
        if (loaded) return
        System.loadLibrary("node")
        System.loadLibrary("novi-node-bridge")
        loaded = true
    }

    @JvmStatic
    external fun startNodeWithArguments(arguments: Array<String>): Int
}
