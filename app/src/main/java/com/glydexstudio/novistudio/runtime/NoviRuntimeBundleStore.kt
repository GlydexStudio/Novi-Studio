package com.glydexstudio.novistudio.runtime

import android.content.Context
import java.io.File

class NoviRuntimeBundleStore(private val context: Context) {
    private val dir = File(context.filesDir, "novi-runtime")
    private val active = File(dir, "runtime.bundle.js")
    private val version = File(dir, "version.txt")
    private val backup = File(dir, "runtime.bundle.js.backup")
    private val versionBackup = File(dir, "version.txt.backup")

    init { dir.mkdirs() }

    fun activeBundle(): String {
        if (active.isFile) return active.readText()
        return context.assets.open("runtime/runtime.bundle.js").bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    fun activeVersion(): String = if (version.isFile) version.readText().trim() else "0.1.1"

    fun stage(bundle: String, newVersion: String) {
        File(dir, "runtime.bundle.js.stage").writeText(bundle)
        File(dir, "version.txt.stage").writeText(newVersion)
    }

    fun activate() {
        val staged = File(dir, "runtime.bundle.js.stage")
        val stagedVersion = File(dir, "version.txt.stage")
        require(staged.isFile && stagedVersion.isFile) { "No staged runtime available" }
        if (active.isFile) active.copyTo(backup, overwrite = true)
        if (version.isFile) version.copyTo(versionBackup, overwrite = true)
        staged.copyTo(active, overwrite = true)
        stagedVersion.copyTo(version, overwrite = true)
        staged.delete(); stagedVersion.delete()
    }

    fun confirmActivation() { backup.delete(); versionBackup.delete() }

    fun rollback() {
        if (backup.isFile) { backup.copyTo(active, overwrite = true); backup.delete() }
        if (versionBackup.isFile) { versionBackup.copyTo(version, overwrite = true); versionBackup.delete() }
        File(dir, "runtime.bundle.js.stage").delete()
        File(dir, "version.txt.stage").delete()
    }
}
