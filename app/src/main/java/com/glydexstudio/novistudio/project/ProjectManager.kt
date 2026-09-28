package com.glydexstudio.novistudio.project

import android.content.Context
import android.net.Uri
import com.glydexstudio.novistudio.filesystem.SafFileSystem
import org.json.JSONObject

class ProjectManager(private val context: Context, private val fs: SafFileSystem) {
    data class ProjectInfo(val rootUri: Uri, val name: String, val version: Int, val entry: String)

    fun create(rootParent: Uri, name: String): ProjectInfo {
        require(name.matches(Regex("[A-Za-z0-9._-]{1,64}"))) { "Project name contains unsupported characters" }
        val root = fs.createFolder(rootParent, name)
        val projectFile = fs.createFile(root, "novi.project", "application/json")
        fs.createFolder(root, "src")
        fs.createFolder(root, "assets")
        val main = fs.createFile(root, "main.novi", "text/plain")
        fs.write(main, "name = "Novi";
say "Hello from Novi Studio";
")
        val meta = JSONObject().put("schema", 1).put("name", name).put("entry", "main.novi").put("language", "novi-language").put("minimumNoviVersion", "0.1.1")
        fs.write(projectFile, meta.toString(2))
        val result = ProjectInfo(root, name, 1, "main.novi")
        remember(root)
        return result
    }

    fun open(root: Uri): ProjectInfo {
        val project = fs.list(root).firstOrNull { it.name == "novi.project" }
            ?: throw IllegalArgumentException("Selected folder is not a Novi project (novi.project missing)")
        val json = JSONObject(fs.read(Uri.parse(project.uri)))
        val name = json.optString("name", root.lastPathSegment ?: "Novi Project")
        val entry = json.optString("entry", "main.novi")
        val result = ProjectInfo(root, name, json.optInt("schema", 1), entry)
        remember(root)
        return result
    }

    private fun remember(root: Uri) {
        context.getSharedPreferences("novi_studio", Context.MODE_PRIVATE).edit().putString("root_uri", root.toString()).apply()
    }
}
