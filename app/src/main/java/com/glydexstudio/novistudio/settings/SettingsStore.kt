package com.glydexstudio.novistudio.settings

import android.content.Context

class SettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("novi_studio", Context.MODE_PRIVATE)

    var rootUri: String?
        get() = prefs.getString("root_uri", null)
        set(value) { prefs.edit().putString("root_uri", value).apply() }

    var fontSize: Int
        get() = prefs.getInt("font_size", 14)
        set(value) { prefs.edit().putInt("font_size", value.coerceIn(10, 24)).apply() }

    var tabSize: Int
        get() = prefs.getInt("tab_size", 4)
        set(value) { prefs.edit().putInt("tab_size", value.coerceIn(2, 8)).apply() }

    var wordWrap: Boolean
        get() = prefs.getBoolean("word_wrap", false)
        set(value) { prefs.edit().putBoolean("word_wrap", value).apply() }

    var autoIndent: Boolean
        get() = prefs.getBoolean("auto_indent", true)
        set(value) { prefs.edit().putBoolean("auto_indent", value).apply() }

    var autosave: Boolean
        get() = prefs.getBoolean("autosave", true)
        set(value) { prefs.edit().putBoolean("autosave", value).apply() }

    var animations: Boolean
        get() = prefs.getBoolean("animations", true)
        set(value) { prefs.edit().putBoolean("animations", value).apply() }

    var density: String
        get() = prefs.getString("density", "comfortable") ?: "comfortable"
        set(value) { prefs.edit().putString("density", value).apply() }

    fun getRecentProjects(): List<String> = prefs.getStringSet("recent_projects", emptySet())?.toList() ?: emptyList()

    fun addRecentProject(uri: String) {
        val old = getRecentProjects().filter { it != uri }.toMutableList()
        old.add(0, uri)
        prefs.edit().putStringSet("recent_projects", old.take(10).toSet()).apply()
    }
}
