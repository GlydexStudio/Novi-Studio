package com.glydexstudio.novistudio.filesystem

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import java.io.FileNotFoundException

class SafFileSystem(private val context: Context) {
    private val resolver: ContentResolver = context.contentResolver

    data class Entry(
        val uri: String,
        val name: String,
        val isDirectory: Boolean,
        val size: Long,
        val modified: Long
    )

    fun rootUri(): Uri? =
        context.getSharedPreferences("novi_studio", Context.MODE_PRIVATE)
            .getString("root_uri", null)
            ?.let(Uri::parse)

    fun setRoot(uri: Uri) {
        val flags =
            android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION or
                android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION

        try {
            resolver.takePersistableUriPermission(uri, flags)
        } catch (_: Exception) {
        }

        context.getSharedPreferences("novi_studio", Context.MODE_PRIVATE)
            .edit()
            .putString("root_uri", uri.toString())
            .apply()
    }

    fun ensureAccessible(uri: Uri) {
        if (uri.scheme != "content") {
            throw SecurityException("Only content:// document URIs are supported")
        }

        val root = rootUri()
            ?: throw SecurityException("No project folder selected")

        if (!isInTree(root, uri)) {
            throw SecurityException("URI is outside the selected project tree")
        }
    }

    fun list(parent: Uri): List<Entry> {
        ensureAccessible(parent)

        val docId = DocumentsContract.getDocumentId(parent)

        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            parent,
            docId
        )

        val out = mutableListOf<Entry>()

        resolver.query(
            childrenUri,
            arrayOf(
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED
            ),
            null,
            null,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME + " COLLATE NOCASE"
        )?.use { cursor ->

            while (cursor.moveToNext()) {
                val id = cursor.getString(0)
                val name = cursor.getString(1) ?: "Unnamed"
                val mime = cursor.getString(2) ?: "application/octet-stream"
                val size = if (cursor.isNull(3)) 0L else cursor.getLong(3)
                val modified = if (cursor.isNull(4)) 0L else cursor.getLong(4)

                val child = DocumentsContract.buildDocumentUriUsingTree(
                    parent,
                    id
                )

                out += Entry(
                    uri = child.toString(),
                    name = name,
                    isDirectory = mime == DocumentsContract.Document.MIME_TYPE_DIR,
                    size = size,
                    modified = modified
                )
            }
        }

        return out
    }

    fun read(uri: Uri): String {
        ensureAccessible(uri)

        resolver.openInputStream(uri)?.use { input ->
            return input.bufferedReader(Charsets.UTF_8).readText()
        }

        throw FileNotFoundException(uri.toString())
    }

    fun write(uri: Uri, content: String) {
        ensureAccessible(uri)

        resolver.openFileDescriptor(uri, "wt")?.use { fd ->
            ParcelFileDescriptor.AutoCloseOutputStream(fd).use { output ->
                output.bufferedWriter(Charsets.UTF_8).use { writer ->
                    writer.write(content)
                }
            }
        } ?: throw FileNotFoundException(uri.toString())
    }

    fun createFile(
        parent: Uri,
        name: String,
        mime: String
    ): Uri {
        ensureAccessible(parent)
        validateName(name)

        return DocumentsContract.createDocument(
            resolver,
            parent,
            mime,
            name
        ) ?: throw IllegalStateException("Could not create file")
    }

    fun createFolder(parent: Uri, name: String): Uri =
        createFile(
            parent,
            name,
            DocumentsContract.Document.MIME_TYPE_DIR
        )

    fun rename(uri: Uri, newName: String): Uri {
        ensureAccessible(uri)
        validateName(newName)

        return DocumentsContract.renameDocument(
            resolver,
            uri,
            newName
        ) ?: throw IllegalStateException("Rename failed")
    }

    fun delete(uri: Uri) {
        ensureAccessible(uri)

        if (!DocumentsContract.deleteDocument(resolver, uri)) {
            throw IllegalStateException("Delete failed")
        }
    }

    fun copyItem(
        source: Uri,
        parent: Uri,
        name: String
    ): Uri {
        ensureAccessible(source)
        ensureAccessible(parent)
        validateName(name)

        val mime =
            resolver.getType(source)
                ?: "application/octet-stream"

        if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
            val target = createFolder(parent, name)

            for (entry in list(source)) {
                copyItem(
                    Uri.parse(entry.uri),
                    target,
                    entry.name
                )
            }

            return target
        }

        val target = createFile(parent, name, mime)

        resolver.openInputStream(source)?.use { input ->
            resolver.openFileDescriptor(target, "wt")?.use { fd ->
                ParcelFileDescriptor.AutoCloseOutputStream(fd).use { output ->
                    input.copyTo(output)
                }
            }
        } ?: throw FileNotFoundException(source.toString())

        return target
    }

    private fun validateName(name: String) {
        require(name.isNotBlank()) {
            "Name cannot be empty"
        }

        require(name != "." && name != "..") {
            "Invalid name"
        }

        require(!name.contains('/') && !name.contains('\\')) {
            "Path separators are not allowed"
        }
    }

    companion object {
        fun isInTree(
            treeUri: Uri,
            childUri: Uri
        ): Boolean {
            return try {
                val rootId =
                    DocumentsContract.getTreeDocumentId(treeUri)

                val childId =
                    DocumentsContract.getDocumentId(childUri)

                childId == rootId ||
                    childId.startsWith(
                        rootId.trimEnd('/') + "/"
                    )
            } catch (_: Exception) {
                false
            }
        }
    }
}
