package com.glydexstudio.novistudio.runtime

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

class NoviRuntimeEngine(
    private val context: Context
) {

    private val main = Handler(Looper.getMainLooper())
    private val queue = ConcurrentLinkedQueue<() -> Unit>()

    private var webView: WebView? = null
    private var ready = false
    private var loading = false

    private val store =
        NoviRuntimeBundleStore(context)

    fun initialize() {
        main.post {
            if (webView != null || loading) {
                return@post
            }

            loading = true

            webView = WebView(context).apply {

                alpha = 0f

                settings.javaScriptEnabled = true
                settings.domStorageEnabled = false
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                settings.allowUniversalAccessFromFileURLs = false
                settings.allowFileAccessFromFileURLs = false
                settings.blockNetworkLoads = true

                webViewClient = object : WebViewClient() {

                    override fun onPageFinished(
                        view: WebView?,
                        url: String?
                    ) {
                        ready = true
                        loading = false
                        flush()
                    }
                }

                webChromeClient = WebChromeClient()

                val runtimeHtml = """
                    <!doctype html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                    </head>
                    <body>
                    <script>
                    ${store.activeBundle()}
                    </script>
                    </body>
                    </html>
                """.trimIndent()

                loadDataWithBaseURL(
                    "https://novi-runtime.local/",
                    runtimeHtml,
                    "text/html",
                    "UTF-8",
                    null
                )
            }
        }
    }

    fun version(): String =
        store.activeVersion()

    fun execute(
        source: String,
        filename: String,
        callback: (NoviExecutionResult) -> Unit
    ) {

        initialize()

        enqueue {
            evaluate(
                "window.NoviRuntime.execute(" +
                    "${JSONObject.quote(source)}, " +
                    "${JSONObject.quote(filename)})"
            ) { json ->
                callback(
                    parseExecution(json)
                )
            }
        }
    }

    fun diagnose(
        source: String,
        filename: String,
        callback: (List<NoviDiagnostic>) -> Unit
    ) {

        initialize()

        enqueue {
            evaluate(
                "window.NoviRuntime.diagnose(" +
                    "${JSONObject.quote(source)}, " +
                    "${JSONObject.quote(filename)})"
            ) { raw ->

                try {
                    val o = JSONObject(raw)

                    val a =
                        o.optJSONArray("diagnostics")
                            ?: org.json.JSONArray()

                    val list =
                        mutableListOf<NoviDiagnostic>()

                    for (i in 0 until a.length()) {

                        val d =
                            a.getJSONObject(i)

                        list += NoviDiagnostic(
                            severity = d.optString("severity"),
                            message = d.optString("message"),
                            line = d.optInt("line", 1),
                            column = d.optInt("column", 1),
                            kind = d.optString(
                                "kind",
                                null
                            )
                        )
                    }

                    callback(list)

                } catch (_: Exception) {

                    callback(
                        listOf(
                            NoviDiagnostic(
                                "error",
                                "Could not decode diagnostics",
                                1,
                                1,
                                "NoviStudio"
                            )
                        )
                    )
                }
            }
        }
    }

    fun format(
        source: String,
        filename: String,
        callback: (
            Boolean,
            String?,
            String?
        ) -> Unit
    ) {

        initialize()

        enqueue {

            evaluate(
                "window.NoviRuntime.format(" +
                    "${JSONObject.quote(source)}, " +
                    "${JSONObject.quote(filename)})"
            ) { raw ->

                try {
                    val o = JSONObject(raw)

                    if (o.optBoolean("ok")) {

                        callback(
                            true,
                            o.optString("source"),
                            null
                        )

                    } else {

                        callback(
                            false,
                            null,
                            o.optString(
                                "error",
                                "Formatter failed"
                            )
                        )
                    }

                } catch (_: Exception) {

                    callback(
                        false,
                        null,
                        "Could not decode formatter result"
                    )
                }
            }
        }
    }

    fun stageValidateAndActivate(
        bundle: String,
        expectedVersion: String,
        callback: (
            Boolean,
            String?
        ) -> Unit
    ) {

        main.post {

            try {

                store.stage(
                    bundle,
                    expectedVersion
                )

                store.activate()

                ready = false

                webView?.destroy()
                webView = null

                loading = false

                initialize()

                execute(
                    "say \"Novi runtime validation\";",
                    "<runtime-validation>"
                ) { result ->

                    if (
                        result.ok &&
                        result.version == expectedVersion
                    ) {

                        store.confirmActivation()

                        callback(
                            true,
                            null
                        )

                    } else {

                        store.rollback()

                        ready = false

                        webView?.destroy()
                        webView = null

                        loading = false

                        initialize()

                        callback(
                            false,
                            result.error
                                ?: "Runtime validation failed"
                        )
                    }
                }

            } catch (e: Exception) {

                store.rollback()

                callback(
                    false,
                    e.message
                        ?: "Activation failed"
                )
            }
        }
    }

    private fun enqueue(
        task: () -> Unit
    ) {

        queue.add(task)
        flush()
    }

    private fun flush() {

        main.post {

            if (!ready) {
                return@post
            }

            while (true) {

                val task =
                    queue.poll()
                        ?: break

                task()
            }
        }
    }

    private fun evaluate(
        script: String,
        callback: (String) -> Unit
    ) {

        main.post {

            webView?.evaluateJavascript(
                script,
                callback
            ) ?: callback("{}")
        }
    }

    private fun parseExecution(
        raw: String
    ): NoviExecutionResult {

        return try {

            val jsonString =
                org.json.JSONTokener(raw)
                    .nextValue() as? String
                    ?: raw

            val o = JSONObject(jsonString)

            val arr =
                o.optJSONArray("output")
                    ?: org.json.JSONArray()

            val out =
                mutableListOf<String>()

            for (i in 0 until arr.length()) {
                out += arr.optString(i)
            }

            val location =
                o.optJSONObject("location")

            NoviExecutionResult(
                ok = o.optBoolean("ok"),
                version = o.optString(
                    "version",
                    null
                ),
                output = out,
                error = o.optString(
                    "error",
                    null
                ),
                line =
                    location?.optInt("line")
                        ?: o.optInt(
                            "line",
                            0
                        ).takeIf { it > 0 },
                column =
                    location?.optInt("column")
                        ?: o.optInt(
                            "column",
                            0
                        ).takeIf { it > 0 },
                kind = o.optString(
                    "kind",
                    null
                )
            )

        } catch (e: Exception) {

            NoviExecutionResult(
                ok = false,
                version = version(),
                output = emptyList(),
                error =
                    "Runtime bridge decode failed: ${e.message}",
                line = null,
                column = null,
                kind = "NoviStudioRuntime"
            )
        }
    }
}