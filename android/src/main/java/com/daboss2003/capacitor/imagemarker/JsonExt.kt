package com.daboss2003.capacitor.imagemarker

import org.json.JSONArray
import org.json.JSONObject

internal fun JSONObject.toMap(): Map<String, Any?> {
    val result = HashMap<String, Any?>(length())
    for (key in keys()) {
        result[key] = unwrap(opt(key))
    }
    return result
}

internal fun JSONArray.toList(): List<Any?> {
    val result = ArrayList<Any?>(length())
    for (i in 0 until length()) {
        result.add(unwrap(opt(i)))
    }
    return result
}

private fun unwrap(value: Any?): Any? = when (value) {
    null, JSONObject.NULL -> null
    is JSONObject -> value.toMap()
    is JSONArray -> value.toList()
    else -> value
}

/** Read a nested string from a loose options map. */
internal fun Any?.asString(): String? = when (this) {
    is String -> this
    is Number -> toString()
    else -> null
}

/** Read a nested number, falling back to a default. */
internal fun Any?.asDouble(default: Double = 0.0): Double = when (this) {
    is Number -> toDouble()
    is String -> toDoubleOrNull() ?: default
    else -> default
}

internal fun Any?.asInt(default: Int = 0): Int = asDouble(default.toDouble()).toInt()

internal fun Any?.asBool(default: Boolean = false): Boolean = when (this) {
    is Boolean -> this
    is Number -> toInt() != 0
    is String -> when (lowercase()) {
        "true", "1", "yes" -> true
        "false", "0", "no" -> false
        else -> default
    }
    else -> default
}

@Suppress("UNCHECKED_CAST")
internal fun Any?.asMap(): Map<String, Any?>? = this as? Map<String, Any?>

@Suppress("UNCHECKED_CAST")
internal fun Any?.asList(): List<Any?>? = this as? List<Any?>
