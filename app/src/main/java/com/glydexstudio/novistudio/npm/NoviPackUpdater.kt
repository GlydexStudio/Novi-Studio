package com.glydexstudio.novistudio.npm

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.util.zip.GZIPInputStream
import org.json.JSONObject

class NoviPackUpdater(
    private val context: Context,
    private val npm: NpmManager
) {
    data class UpdateResult(
        val ok: Boolean,
        val version: String?,
        val bundle: String?,
        val message: String?,
        val error: String?
    )

    private val staging =
        File(
            context.filesDir,
            "novi-pack-staging"
        )

    fun update(
        currentVersion: String,
        callback: (UpdateResult) -> Unit
    ) {
        Thread {
            try {
                val latest = npm.fetchLatest()

                if (
                    compareVersions(
                        latest.version,
                        currentVersion
                    ) <= 0
                ) {
                    callback(
                        UpdateResult(
                            true,
                            currentVersion,
                            null,
                            "Novi Pack is already up to date",
                            null
                        )
                    )
                    return@Thread
                }

                val tgz = npm.download(
                    latest.tarball,
                    latest.integrity
                )

                deleteTree(staging)
                staging.mkdirs()

                extractTarGz(
                    tgz,
                    staging
                )

                val pkgFile =
                    File(
                        staging,
                        "package/package.json"
                    )

                require(pkgFile.isFile) {
                    "novi-language package.json missing from npm tarball"
                }

                val pkg =
                    JSONObject(
                        pkgFile.readText()
                    )

                require(
                    pkg.optString("name") ==
                        "novi-language"
                ) {
                    "Downloaded package is not novi-language"
                }

                require(
                    pkg.optString("version") ==
                        latest.version
                ) {
                    "Downloaded package version mismatch"
                }

                val dist =
                    File(
                        staging,
                        "package/dist"
                    )

                require(dist.isDirectory) {
                    "novi-language package has no dist directory"
                }

                val adapter =
                    context.assets
                        .open(
                            "runtime/runtime-adapter.js"
                        )
                        .bufferedReader(
                            Charsets.UTF_8
                        )
                        .use {
                            it.readText()
                        }

                val bundle =
                    bundle(
                        dist,
                        adapter
                    )

                require(
                    bundle.contains(
                        "window.NoviRuntime"
                    )
                ) {
                    "Generated runtime bundle is invalid"
                }

                callback(
                    UpdateResult(
                        true,
                        latest.version,
                        bundle,
                        null,
                        null
                    )
                )
            } catch (e: Exception) {
                callback(
                    UpdateResult(
                        false,
                        null,
                        null,
                        null,
                        e.message
                            ?: "Novi Pack update failed"
                    )
                )
            }
        }.start()
    }

    private fun bundle(
        dist: File,
        adapter: String
    ): String {
        val modules =
            linkedMapOf<String, String>()

        fun walk(
            dir: File,
            base: String = ""
        ) {
            dir.listFiles()
                ?.sortedBy { it.name }
                ?.forEach { f ->
                    val rel =
                        if (base.isEmpty()) {
                            f.name
                        } else {
                            "$base/${f.name}"
                        }

                    if (f.isDirectory) {
                        walk(
                            f,
                            rel
                        )
                    } else if (
                        f.name.endsWith(".js")
                    ) {
                        modules[rel] =
                            f.readText()
                    }
                }
        }

        walk(dist)

        require(
            modules.containsKey("index.js")
        ) {
            "novi-language dist/index.js missing"
        }

        val entries =
            modules.entries.joinToString(
                ",\n"
            ) { (k, v) ->
                JSONObject.quote(k) +
                    ": function(module, exports, require) {\n" +
                    v +
                    "\n}"
            }

        return """
(function(){
const __noviModules={
$entries
};
const __noviCache={};
function __norm(id){const parts=id.replaceAll('\\\\','/').split('/');const out=[];for(const part of parts){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(part)}return out.join('/')}
function __resolve(req,parent){if(!req.startsWith('.'))throw new Error('Novi runtime attempted to load a non-local module: '+req);const base=parent.includes('/')?parent.slice(0,parent.lastIndexOf('/')+1):'';let target=__norm(base+req);if(!target.endsWith('.js'))target+='.js';if(__noviModules[target])return target;throw new Error('Novi runtime module not found: '+target)}
function __noviRequire(id,parent){const key=id.endsWith('.js')?id:__resolve(id,parent);if(__noviCache[key])return __noviCache[key].exports;const module={exports:{}};__noviCache[key]=module;const localRequire=(req)=>__noviRequire(__resolve(req,key),key);__noviModules[key](module,module.exports,localRequire);return module.exports}
$adapter
})();
"""
    }

    private fun extractTarGz(
        data: ByteArray,
        destination: File
    ) {
        GZIPInputStream(
            data.inputStream()
        ).use { input ->
            val b = ByteArray(512)

            while (true) {
                readFully(
                    input,
                    b
                )

                if (
                    b.all {
                        it.toInt() == 0
                    }
                ) {
                    break
                }

                val name =
                    String(
                        b,
                        0,
                        100,
                        Charsets.UTF_8
                    )
                        .trim('\u0000')
                        .trim()

                val size =
                    tarOctal(
                        b,
                        124,
                        12
                    )

                val type =
                    b[156]
                        .toInt()
                        .toChar()

                validateTarPath(name)

                val target =
                    File(
                        destination,
                        name
                    )

                if (type == '5') {
                    target.mkdirs()
                } else if (
                    type == '0' ||
                    type == '\u0000'
                ) {
                    target.parentFile?.mkdirs()

                    FileOutputStream(
                        target
                    ).use { out ->
                        copyExactly(
                            input,
                            out,
                            size
                        )
                    }
                } else {
                    skipExactly(
                        input,
                        size
                    )
                }

                skipExactly(
                    input,
                    (512 - (size % 512)) % 512
                )
            }
        }
    }

    private fun validateTarPath(
        name: String
    ) {
        require(
            name.isNotBlank() &&
                !name.startsWith("/") &&
                !name.split('/').contains("..")
        ) {
            "Unsafe npm archive path"
        }
    }

    private fun tarOctal(
        b: ByteArray,
        off: Int,
        len: Int
    ): Long {
        val s =
            String(
                b,
                off,
                len,
                Charsets.US_ASCII
            )
                .trim('\u0000', ' ')

        return if (s.isBlank()) {
            0
        } else {
            s.toLong(8)
        }
    }

    private fun readFully(
        input: java.io.InputStream,
        b: ByteArray
    ) {
        var p = 0

        while (p < b.size) {
            val n =
                input.read(
                    b,
                    p,
                    b.size - p
                )

            if (n < 0) {
                throw IllegalStateException(
                    "Truncated npm archive"
                )
            }

            p += n
        }
    }

    private fun copyExactly(
        input: java.io.InputStream,
        out: FileOutputStream,
        count: Long
    ) {
        var left = count
        val buf = ByteArray(8192)

        while (left > 0) {
            val n =
                input.read(
                    buf,
                    0,
                    minOf(
                        left,
                        buf.size.toLong()
                    ).toInt()
                )

            if (n < 0) {
                throw IllegalStateException(
                    "Truncated npm archive"
                )
            }

            out.write(
                buf,
                0,
                n
            )

            left -= n
        }
    }

    private fun skipExactly(
        input: java.io.InputStream,
        count: Long
    ) {
        var left = count
        val buf = ByteArray(8192)

        while (left > 0) {
            val n =
                input.read(
                    buf,
                    0,
                    minOf(
                        left,
                        buf.size.toLong()
                    ).toInt()
                )

            if (n < 0) {
                throw IllegalStateException(
                    "Truncated npm archive"
                )
            }

            left -= n
        }
    }

    private fun deleteTree(
        file: File
    ) {
        if (!file.exists()) {
            return
        }

        if (file.isDirectory) {
            file.listFiles()
                ?.forEach(::deleteTree)
        }

        file.delete()
    }

    private fun compareVersions(
        a: String,
        b: String
    ): Int {
        fun parts(
            version: String
        ): List<Int> {
            return version
                .removePrefix("v")
                .split('.')
                .map { part ->
                    part
                        .takeWhile { character ->
                            character in '0'..'9'
                        }
                        .toIntOrNull()
                        ?: 0
                }
        }

        val left = parts(a)
        val right = parts(b)
        val count =
            maxOf(
                left.size,
                right.size
            )

        for (index in 0 until count) {
            val difference =
                left.getOrElse(index) { 0 } -
                    right.getOrElse(index) { 0 }

            if (difference != 0) {
                return difference
            }
        }

        return 0
    }
}