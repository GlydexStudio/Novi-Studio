package com.glydexstudio.novistudio

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.widget.FrameLayout
import com.glydexstudio.novistudio.bridge.NoviBridge
import com.glydexstudio.novistudio.filesystem.SafFileSystem
import com.glydexstudio.novistudio.project.ProjectManager
import com.glydexstudio.novistudio.runtime.NoviRuntimeEngine

class MainActivity : Activity() {
    private lateinit var ui: WebView
    private lateinit var runtime: NoviRuntimeEngine
    private lateinit var bridge: NoviBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setup()
    }

    private fun setup() {
        val frame = FrameLayout(this)

        ui = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.allowUniversalAccessFromFileURLs = false
            settings.allowFileAccessFromFileURLs = false
            settings.cacheMode = WebSettings.LOAD_NO_CACHE

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val uri = request?.url ?: return true

                    if (uri.host == "novi.local") {
                        return false
                    }

                    return try {
                        startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                uri
                            )
                        )
                        true
                    } catch (_: Exception) {
                        true
                    }
                }

                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    return request?.url?.let {
                        interceptAsset(it.path ?: "")
                    }
                }

                override fun shouldInterceptRequest(
                    view: WebView?,
                    url: String?
                ): WebResourceResponse? {
                    return url?.let {
                        interceptAsset(
                            Uri.parse(it).path ?: ""
                        )
                    }
                }
            }

            webChromeClient = WebChromeClient()
        }

        runtime = NoviRuntimeEngine(this)
        runtime.initialize()

        bridge = NoviBridge(
            this,
            ui,
            SafFileSystem(this),
            ProjectManager(this, SafFileSystem(this)),
            runtime
        )

        ui.addJavascriptInterface(
            bridge,
            "NoviNative"
        )

        frame.addView(
            ui,
            FrameLayout.LayoutParams(-1, -1)
        )

        setContentView(frame)

        ui.loadUrl("https://novi.local/web/index.html")

        intent?.data?.let { uri ->
            window.decorView.postDelayed(
                {
                    bridge.onActivityResult(
                        1002,
                        RESULT_OK,
                        Intent().setData(uri)
                    )
                },
                800
            )
        }
    }

    private fun interceptAsset(
        path: String
    ): WebResourceResponse? {
        if (
            !(
                path.startsWith("/web/") ||
                path.startsWith("/branding/")
            )
        ) {
            return null
        }

        val assetPath = path.removePrefix("/")

        return try {
            val mime = when {
                assetPath.endsWith(".html") ->
                    "text/html"

                assetPath.endsWith(".css") ->
                    "text/css"

                assetPath.endsWith(".js") ->
                    "application/javascript"

                assetPath.endsWith(".json") ->
                    "application/json"

                assetPath.endsWith(".png") ->
                    "image/png"

                else ->
                    "text/plain"
            }

            WebResourceResponse(
                mime,
                "UTF-8",
                assets.open(assetPath)
            )
        } catch (_: Exception) {
            null
        }
    }

    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        super.onActivityResult(
            requestCode,
            resultCode,
            data
        )

        bridge.onActivityResult(
            requestCode,
            resultCode,
            data
        )
    }

    override fun onDestroy() {
        bridge.dispose()
        ui.destroy()
        super.onDestroy()
    }
}