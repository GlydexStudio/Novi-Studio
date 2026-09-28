package com.glydexstudio.novistudio.npm

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Base64
import java.util.zip.GZIPInputStream
import org.json.JSONObject

class NpmManager(private val context: Context) {
    data class Latest(val name: String, val version: String, val tarball: String, val integrity: String?)

    fun fetchLatest(): Latest {
        val c = URL("https://registry.npmjs.org/novi-language/latest").openConnection() as HttpURLConnection
        c.connectTimeout=10000; c.readTimeout=20000; c.requestMethod="GET"
        c.inputStream.use { input ->
            val o=JSONObject(input.bufferedReader(Charsets.UTF_8).readText())
            return Latest(o.getString("name"),o.getString("version"),o.getJSONObject("dist").getString("tarball"),o.getJSONObject("dist").optString("integrity",null))
        }
    }

    fun download(url:String, expectedIntegrity:String?): ByteArray {
        val c=URL(url).openConnection() as HttpURLConnection; c.connectTimeout=10000; c.readTimeout=30000
        val data=c.inputStream.use { it.readBytes() }
        if(expectedIntegrity!=null && expectedIntegrity.startsWith("sha512-")) {
            val digest=MessageDigest.getInstance("SHA-512").digest(data)
            val actual=Base64.getEncoder().encodeToString(digest)
            require(actual == expectedIntegrity.removePrefix("sha512-")) { "npm integrity verification failed" }
        }
        return data
    }
}
