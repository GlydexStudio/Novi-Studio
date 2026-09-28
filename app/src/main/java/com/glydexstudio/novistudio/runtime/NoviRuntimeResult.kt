package com.glydexstudio.novistudio.runtime

import org.json.JSONObject

data class NoviDiagnostic(val severity: String, val message: String, val line: Int, val column: Int, val kind: String?)
data class NoviExecutionResult(val ok: Boolean, val version: String?, val output: List<String>, val error: String?, val line: Int?, val column: Int?, val kind: String?) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("ok", ok); put("version", version); put("output", org.json.JSONArray(output));
        if (error != null) put("error", error); if (line != null) put("line", line); if (column != null) put("column", column); if (kind != null) put("kind", kind)
    }
}
