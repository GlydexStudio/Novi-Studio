package com.glydexstudio.novistudio.node

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Owns the embedded Node.js Mobile runtime.
 *
 * Node.js Mobile is a shared library rather than a standalone executable, so
 * terminal commands are routed through the local control server hosted by the
 * embedded Node instance.
 */
class NodeRuntimeManager(private val context: Context) {
    data class Status(
        val provisioned: Boolean,
        val running: Boolean,
        val version: String?,
        val abi: String,
        val reason: String?
    )

    data class CommandResult(
        val exitCode: Int,
        val stdout: String,
        val stderr: String,
        val durationMs: Long
    )

    private val lock = Any()
    private val running = AtomicBoolean(false)
    private val root = File(context.filesDir, "nodejs-project")
    private val readyFile = File(root, ".novi-node-ready.json")
    private val tokenFile = File(root, ".novi-node-token")
    private var port: Int = -1
    private var token: String? = null
    private var nodeThread: Thread? = null

    private val abi: String
        get() = Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"

    private val bundledVersion = "18.20.4"

    fun status(): Status {
        val lib = bundledLibrary()
        if (!lib.isFile) {
            return Status(false, false, null, abi, "Bundled libnode.so is missing for ABI '$abi'.")
        }

        if (!running.get()) {
            return Status(true, false, bundledVersion, abi, null)
        }

        return try {
            val response = request("/health", "GET", null, 3000)
            val json = JSONObject(response)
            Status(
                provisioned = true,
                running = json.optBoolean("ready", false),
                version = json.optString("version", bundledVersion),
                abi = abi,
                reason = null
            )
        } catch (e: Exception) {
            Status(true, false, bundledVersion, abi, e.message)
        }
    }

    @Synchronized
    fun start(): Result<Unit> = runCatching {
        if (running.get()) return@runCatching

        ensureNodeProject()
        bundledLibrary().takeIf { it.isFile }
            ?: error("Node.js Mobile library is not packaged for ABI '$abi'.")

        NodeNative.load()

        readyFile.delete()
        token = UUID.randomUUID().toString().replace("-", "")
        tokenFile.writeText(token!!, Charsets.UTF_8)

        val mainJs = File(root, "main.js")
        val args = arrayOf(
            "node",
            mainJs.absolutePath,
            "--port", "0",
            "--token", token!!,
            "--ready", readyFile.absolutePath,
            "--root", root.absolutePath
        )

        running.set(true)
        nodeThread = Thread {
            try {
                NodeNative.startNodeWithArguments(args)
            } finally {
                running.set(false)
            }
        }.apply {
            name = "NoviStudio-Node-18"
            isDaemon = true
            start()
        }

        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(12)
        var lastError: String? = null
        while (System.nanoTime() < deadline) {
            if (readyFile.isFile) {
                try {
                    val ready = JSONObject(readyFile.readText(Charsets.UTF_8))
                    port = ready.getInt("port")
                    if (ready.optBoolean("ready", false)) {
                        return@runCatching
                    }
                } catch (e: Exception) {
                    lastError = e.message
                }
            }

            if (!running.get()) {
                break
            }
            Thread.sleep(50)
        }

        running.set(false)
        error(lastError ?: "Embedded Node.js did not become ready.")
    }

    fun stop() {
        synchronized(lock) {
            if (!running.get()) return
            try {
                request("/shutdown", "POST", "{}", 2000)
            } catch (_: Exception) {
                // Best effort. The daemon thread will exit when node::Start returns.
            } finally {
                running.set(false)
                port = -1
                token = null
                nodeThread = null
                readyFile.delete()
                tokenFile.delete()
            }
        }
    }

    fun execute(args: List<String>, cwd: File, timeoutMs: Long = 60000): CommandResult {
        start().getOrThrow()
        val started = System.nanoTime()

        val payload = JSONObject()
            .put("command", "node")
            .put("args", org.json.JSONArray(args))
            .put("cwd", sanitizeCwd(cwd))

        val response = request("/command", "POST", payload.toString(), timeoutMs)
        val json = JSONObject(response)
        return CommandResult(
            exitCode = json.optInt("exitCode", 1),
            stdout = json.optString("stdout", ""),
            stderr = json.optString("stderr", ""),
            durationMs = json.optLong("durationMs", (System.nanoTime() - started) / 1_000_000)
        )
    }

    private fun sanitizeCwd(cwd: File): String {
        val rootPath = root.canonicalFile.toPath()
        return try {
            val candidate = cwd.canonicalFile.toPath()
            if (candidate.startsWith(rootPath)) {
                rootPath.relativize(candidate).toString()
            } else {
                "."
            }
        } catch (_: Exception) {
            "."
        }
    }

    private fun request(path: String, method: String, body: String?, timeoutMs: Long): String {
        check(port > 0) { "Node.js control server is not ready" }
        val connection = (URL("http://127.0.0.1:$port$path").openConnection() as HttpURLConnection)
        connection.requestMethod = method
        connection.connectTimeout = timeoutMs.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        connection.readTimeout = timeoutMs.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        connection.useCaches = false
        connection.setRequestProperty("Accept", "application/json")
        token?.let { connection.setRequestProperty("X-Novi-Token", it) }

        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
        }

        val code = connection.responseCode
        val input = if (code in 200..299) connection.inputStream else connection.errorStream
        val text = input?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        connection.disconnect()

        if (code !in 200..299) {
            throw IllegalStateException("Node control request failed ($code): $text")
        }
        return text
    }

    private fun bundledLibrary(): File {
        val abiName = when (abi) {
            "arm64-v8a", "armeabi-v7a", "x86_64" -> abi
            else -> return File(context.filesDir, "nodejs-mobile-unsupported")
        }
        return File(context.applicationInfo.nativeLibraryDir, "libnode.so").takeIf { it.isFile }
            ?: File(context.filesDir, "../libnode/bin/$abiName/libnode.so")
    }

    private fun ensureNodeProject() {
        val currentMarker = File(root, ".novi-node-project-version")
        val expected = "2"
        if (currentMarker.isFile && currentMarker.readText(Charsets.UTF_8).trim() == expected && File(root, "main.js").isFile) {
            return
        }

        if (root.exists()) root.deleteRecursively()
        root.mkdirs()
        copyAssetTree("nodejs-project", root)
        currentMarker.writeText(expected, Charsets.UTF_8)
    }

    private fun copyAssetTree(assetPath: String, target: File) {
        val children = context.assets.list(assetPath).orEmpty()
        if (children.isEmpty()) {
            context.assets.open(assetPath).use { input -> target.outputStream().use { input.copyTo(it) } }
            return
        }

        target.mkdirs()
        for (child in children) {
            val childAsset = "$assetPath/$child"
            val childTarget = File(target, child)
            if (context.assets.list(childAsset).orEmpty().isEmpty()) {
                context.assets.open(childAsset).use { input -> childTarget.outputStream().use { input.copyTo(it) } }
            } else {
                copyAssetTree(childAsset, childTarget)
            }
        }
    }
}
