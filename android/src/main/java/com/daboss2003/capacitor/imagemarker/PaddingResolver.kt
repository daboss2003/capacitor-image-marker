package com.daboss2003.capacitor.imagemarker

data class ResolvedInsets(
    val left: Float = 0f,
    val top: Float = 0f,
    val right: Float = 0f,
    val bottom: Float = 0f,
)

sealed class SpreadValue {
    data class Px(val value: Float) : SpreadValue()
    data class Percent(val value: Float) : SpreadValue()

    fun resolve(relativeTo: Float): Float = when (this) {
        is Px -> value
        is Percent -> value / 100f * relativeTo
    }

    companion object {
        fun parse(raw: Any?): SpreadValue? {
            return when (raw) {
                is Number -> Px(raw.toFloat())
                is String -> {
                    val trimmed = raw.trim()
                    if (trimmed.endsWith("%")) {
                        trimmed.dropLast(1).toFloatOrNull()?.let { Percent(it) }
                    } else {
                        trimmed.toFloatOrNull()?.let { Px(it) }
                    }
                }
                else -> null
            }
        }
    }
}

object PaddingResolver {
    fun resolve(source: Map<String, Any?>?, width: Float, height: Float): ResolvedInsets {
        if (source == null) return ResolvedInsets()

        var top: SpreadValue = SpreadValue.Px(0f)
        var right: SpreadValue = SpreadValue.Px(0f)
        var bottom: SpreadValue = SpreadValue.Px(0f)
        var left: SpreadValue = SpreadValue.Px(0f)

        source["padding"]?.let { raw ->
            val tokens = parseShorthand(raw)
            val expanded = expand(tokens)
            top = expanded[0]; right = expanded[1]; bottom = expanded[2]; left = expanded[3]
        }
        (source["paddingHorizontal"] ?: source["paddingX"])?.let { v ->
            SpreadValue.parse(v)?.let { left = it; right = it }
        }
        (source["paddingVertical"] ?: source["paddingY"])?.let { v ->
            SpreadValue.parse(v)?.let { top = it; bottom = it }
        }
        SpreadValue.parse(source["paddingLeft"])?.let { left = it }
        SpreadValue.parse(source["paddingRight"])?.let { right = it }
        SpreadValue.parse(source["paddingTop"])?.let { top = it }
        SpreadValue.parse(source["paddingBottom"])?.let { bottom = it }

        return ResolvedInsets(
            left = left.resolve(width),
            top = top.resolve(height),
            right = right.resolve(width),
            bottom = bottom.resolve(height),
        )
    }

    private fun parseShorthand(raw: Any): List<SpreadValue> {
        if (raw is Number) return listOf(SpreadValue.Px(raw.toFloat()))
        val str = raw as? String ?: return emptyList()
        return str.trim().split(Regex("\\s+")).mapNotNull { SpreadValue.parse(it) }
    }

    private fun expand(parts: List<SpreadValue>): List<SpreadValue> {
        val zero = SpreadValue.Px(0f)
        return when (parts.size) {
            0 -> listOf(zero, zero, zero, zero)
            1 -> listOf(parts[0], parts[0], parts[0], parts[0])
            2 -> listOf(parts[0], parts[1], parts[0], parts[1])
            3 -> listOf(parts[0], parts[1], parts[2], parts[1])
            else -> listOf(parts[0], parts[1], parts[2], parts[3])
        }
    }
}
