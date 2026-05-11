package com.daboss2003.capacitor.imagemarker

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import android.graphics.Typeface
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan

object ImageMarker {

    private const val DEFAULT_POSITION_MARGIN = 20f
    private const val DEFAULT_FONT_SIZE = 14f
    private const val DEFAULT_TEXT_COLOR = Color.BLACK
    private const val DEFAULT_MAX_SIZE = 2048

    enum class SaveFormat { PNG, JPG, BASE64 }
    enum class TextBgShape { STRETCH_X, STRETCH_Y, FIT }
    enum class MarkerPos { TL, TC, TR, BL, BC, BR, CENTER }

    class MarkerException(msg: String) : RuntimeException(msg)

    // ---- Entry points ---------------------------------------------------------

    fun markText(context: Context, options: Map<String, Any?>): String {
        val bgOpts = options["backgroundImage"].asMap() ?: throw MarkerException("please set image!")
        val src = bgOpts["src"].asString() ?: throw MarkerException("please set image!")
        val maxSize = options["maxSize"].asInt(DEFAULT_MAX_SIZE)
        val bg = ImageLoader.load(context, src, maxSize)

        val canvas = newCanvasFor(bg)
        drawBaseBitmap(canvas.canvas, bg, bgOpts, canvas.bitmap)

        val texts = options["watermarkTexts"].asList()?.filterIsInstance<Map<String, Any?>>() ?: emptyList()
        for (text in texts) {
            drawWatermarkText(canvas.canvas, text, canvas.bitmap.width, canvas.bitmap.height)
        }
        bg.safeRecycle()

        val finalBmp = rotated(canvas.bitmap, bgOpts["rotate"].asDouble(0.0).toFloat())
        return export(context,
            finalBmp,
            saveFormatFrom(options["saveFormat"].asString()),
            options["quality"].asInt(100),
            options["filename"].asString())
    }

    fun markImage(context: Context, options: Map<String, Any?>): String {
        val bgOpts = options["backgroundImage"].asMap() ?: throw MarkerException("please set image!")
        val src = bgOpts["src"].asString() ?: throw MarkerException("please set image!")
        val markers = collectWatermarks(options)
        if (markers.isEmpty() || markers.any { it["src"].asString().isNullOrEmpty() }) {
            throw MarkerException("please set mark image!")
        }

        val maxSize = options["maxSize"].asInt(DEFAULT_MAX_SIZE)
        val bg = ImageLoader.load(context, src, maxSize)
        val markerBitmaps = markers.map { ImageLoader.load(context, it["src"].asString()!!, maxSize) }

        val canvas = newCanvasFor(bg)
        drawBaseBitmap(canvas.canvas, bg, bgOpts, canvas.bitmap)

        markers.forEachIndexed { idx, opts ->
            drawWatermarkImage(canvas.canvas, markerBitmaps[idx], opts, canvas.bitmap.width, canvas.bitmap.height)
            markerBitmaps[idx].safeRecycle()
        }
        bg.safeRecycle()

        val finalBmp = rotated(canvas.bitmap, bgOpts["rotate"].asDouble(0.0).toFloat())
        return export(context,
            finalBmp,
            saveFormatFrom(options["saveFormat"].asString()),
            options["quality"].asInt(100),
            options["filename"].asString())
    }

    /**
     * Combines the deprecated singular `watermarkImage` (paired with
     * `watermarkPositions`) with the plural `watermarkImages` array. The
     * singular entry, when present, is rendered first.
     */
    private fun collectWatermarks(options: Map<String, Any?>): List<Map<String, Any?>> {
        val result = mutableListOf<Map<String, Any?>>()
        options["watermarkImage"].asMap()?.let { single ->
            if (!single["src"].asString().isNullOrEmpty()) {
                val merged = single.toMutableMap()
                options["watermarkPositions"].asMap()?.let { merged["position"] = it }
                result += merged
            }
        }
        options["watermarkImages"].asList()
            ?.filterIsInstance<Map<String, Any?>>()
            ?.let { result += it }
        return result
    }

    // ---- Canvas plumbing ------------------------------------------------------

    private data class CanvasPair(val bitmap: Bitmap, val canvas: Canvas)

    private fun newCanvasFor(source: Bitmap): CanvasPair {
        val bmp = Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
        return CanvasPair(bmp, Canvas(bmp))
    }

    private fun drawBaseBitmap(canvas: Canvas, source: Bitmap, opts: Map<String, Any?>, target: Bitmap) {
        val alpha = clamp(opts["alpha"].asDouble(1.0).toFloat(), 0f, 1f)
        val scale = max(0f, opts["scale"].asDouble(1.0).toFloat())
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            this.alpha = (alpha * 255).toInt()
        }
        canvas.save()
        if (scale != 1f) {
            val cx = target.width / 2f
            val cy = target.height / 2f
            canvas.translate(cx, cy)
            canvas.scale(scale, scale)
            canvas.translate(-cx, -cy)
        }
        val dst = RectF(0f, 0f, target.width.toFloat(), target.height.toFloat())
        canvas.drawBitmap(source, null, dst, paint)
        canvas.restore()
    }

    // ---- Watermarks -----------------------------------------------------------

    private fun drawWatermarkImage(
        canvas: Canvas,
        bitmap: Bitmap,
        opts: Map<String, Any?>,
        containerW: Int,
        containerH: Int,
    ) {
        val scale = max(0f, opts["scale"].asDouble(1.0).toFloat())
        val alpha = clamp(opts["alpha"].asDouble(1.0).toFloat(), 0f, 1f)
        val rotation = opts["rotate"].asDouble(0.0).toFloat()

        val drawW = bitmap.width * scale
        val drawH = bitmap.height * scale
        val anchor = resolveAnchor(opts["position"].asMap(), drawW, drawH, containerW.toFloat(), containerH.toFloat())

        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            this.alpha = (alpha * 255).toInt()
        }
        canvas.save()
        if (rotation != 0f) {
            canvas.rotate(rotation, anchor.x + drawW / 2f, anchor.y + drawH / 2f)
        }
        val dst = RectF(anchor.x, anchor.y, anchor.x + drawW, anchor.y + drawH)
        canvas.drawBitmap(bitmap, null, dst, paint)
        canvas.restore()
    }

    private fun drawWatermarkText(
        canvas: Canvas,
        opts: Map<String, Any?>,
        containerW: Int,
        containerH: Int,
    ) {
        val text = opts["text"].asString() ?: ""
        val style = opts["style"].asMap() ?: emptyMap()
        val position = opts["position"].asMap() ?: opts["positionOptions"].asMap()

        val fontSize = style["fontSize"].asDouble(DEFAULT_FONT_SIZE.toDouble()).toFloat()
        val bold = style["bold"].asBool()
        val italic = style["italic"].asBool()
        val skewX = style["skewX"].asDouble(0.0).toFloat()
        val rotation = style["rotate"].asDouble(0.0).toFloat()
        val align = textAlign(style["textAlign"].asString())

        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
            color = parseColor(style["color"].asString(), DEFAULT_TEXT_COLOR)
            textSize = fontSize
            typeface = resolveTypeface(style["fontName"].asString(), bold, italic)
            isUnderlineText = style["underline"].asBool()
            isStrikeThruText = style["strikeThrough"].asBool()
            textAlign = align
            if (skewX != 0f) {
                textSkewX = -tan(skewX.toDouble() * Math.PI / 180.0).toFloat()
            }
            style["shadowStyle"].asMap()?.let { shadow ->
                setShadowLayer(
                    shadow["radius"].asDouble(0.0).toFloat(),
                    shadow["dx"].asDouble(0.0).toFloat(),
                    shadow["dy"].asDouble(0.0).toFloat(),
                    parseColor(shadow["color"].asString(), Color.TRANSPARENT),
                )
            }
        }

        val lines = text.split('\n')
        val lineHeight = paint.fontMetrics.let { it.descent - it.ascent + it.leading }
        val textHeight = lineHeight * lines.size
        val measuredWidths = lines.map { paint.measureText(it) }
        val textWidth = (measuredWidths.maxOrNull() ?: 0f)

        val anchor = resolveAnchor(position, textWidth, textHeight, containerW.toFloat(), containerH.toFloat())

        canvas.save()
        canvas.translate(anchor.x, anchor.y)
        if (rotation != 0f) {
            canvas.rotate(rotation, textWidth / 2f, textHeight / 2f)
        }

        style["textBackgroundStyle"].asMap()?.let { bgStyle ->
            drawTextBackground(canvas, bgStyle, textWidth, textHeight, anchor, containerW.toFloat(), containerH.toFloat())
        }

        var y = -paint.fontMetrics.ascent
        lines.forEachIndexed { i, line ->
            val x = when (align) {
                Paint.Align.CENTER -> textWidth / 2f
                Paint.Align.RIGHT -> textWidth
                else -> 0f
            }
            canvas.drawText(line, x, y, paint)
            if (i < lines.size - 1) y += lineHeight
        }
        canvas.restore()
    }

    private fun drawTextBackground(
        canvas: Canvas,
        bgStyle: Map<String, Any?>,
        textWidth: Float,
        textHeight: Float,
        anchor: PointF,
        containerW: Float,
        containerH: Float,
    ) {
        val insets = PaddingResolver.resolve(bgStyle, containerW, containerH)
        val shape = textBgShape(bgStyle["type"].asString())
        val rect = when (shape) {
            TextBgShape.STRETCH_X -> RectF(
                -anchor.x, -insets.top,
                -anchor.x + containerW, textHeight + insets.bottom,
            )
            TextBgShape.STRETCH_Y -> RectF(
                -insets.left, -anchor.y,
                textWidth + insets.right, -anchor.y + containerH,
            )
            TextBgShape.FIT -> RectF(
                -insets.left, -insets.top,
                textWidth + insets.right, textHeight + insets.bottom,
            )
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = parseColor(bgStyle["color"].asString(), Color.TRANSPARENT)
            style = Paint.Style.FILL
        }
        val corners = bgStyle["cornerRadius"].asMap()
        if (corners == null) {
            canvas.drawRect(rect, paint)
        } else {
            canvas.drawPath(buildRoundedPath(rect, corners, containerW, containerH), paint)
        }
    }

    private fun buildRoundedPath(
        rect: RectF,
        corners: Map<String, Any?>,
        containerW: Float,
        containerH: Float,
    ): Path {
        fun radii(key: String): Pair<Float, Float> {
            val node = (corners[key].asMap() ?: corners["all"].asMap()) ?: emptyMap()
            val x = SpreadValue.parse(node["x"])?.resolve(containerW) ?: 0f
            val y = SpreadValue.parse(node["y"])?.resolve(containerH) ?: 0f
            return x to y
        }
        val (tlx, tly) = radii("topLeft")
        val (trx, tryR) = radii("topRight")
        val (brx, bry) = radii("bottomRight")
        val (blx, bly) = radii("bottomLeft")

        val path = Path()
        path.moveTo(rect.left + tlx, rect.top)
        path.lineTo(rect.right - trx, rect.top)
        path.quadTo(rect.right, rect.top, rect.right, rect.top + tryR)
        path.lineTo(rect.right, rect.bottom - bry)
        path.quadTo(rect.right, rect.bottom, rect.right - brx, rect.bottom)
        path.lineTo(rect.left + blx, rect.bottom)
        path.quadTo(rect.left, rect.bottom, rect.left, rect.bottom - bly)
        path.lineTo(rect.left, rect.top + tly)
        path.quadTo(rect.left, rect.top, rect.left + tlx, rect.top)
        path.close()
        return path
    }

    // ---- Position / parsing helpers ------------------------------------------

    private fun resolveAnchor(
        position: Map<String, Any?>?,
        contentW: Float,
        contentH: Float,
        containerW: Float,
        containerH: Float,
    ): PointF {
        val margin = DEFAULT_POSITION_MARGIN
        if (position == null) return PointF(0f, 0f)
        position["position"].asString()?.let { raw ->
            return when (raw) {
                "topLeft" -> PointF(margin, margin)
                "topCenter" -> PointF((containerW - contentW) / 2f, margin)
                "topRight" -> PointF(containerW - contentW - margin, margin)
                "center" -> PointF((containerW - contentW) / 2f, (containerH - contentH) / 2f)
                "bottomLeft" -> PointF(margin, containerH - contentH - margin)
                "bottomCenter" -> PointF((containerW - contentW) / 2f, containerH - contentH - margin)
                "bottomRight" -> PointF(containerW - contentW - margin, containerH - contentH - margin)
                else -> PointF(margin, margin)
            }
        }
        val x = SpreadValue.parse(position["X"])?.resolve(containerW) ?: 0f
        val y = SpreadValue.parse(position["Y"])?.resolve(containerH) ?: 0f
        return PointF(x, y)
    }

    private fun textAlign(raw: String?): Paint.Align = when (raw) {
        "center" -> Paint.Align.CENTER
        "right" -> Paint.Align.RIGHT
        else -> Paint.Align.LEFT
    }

    private fun resolveTypeface(name: String?, bold: Boolean, italic: Boolean): Typeface {
        val styleFlag = when {
            bold && italic -> Typeface.BOLD_ITALIC
            bold -> Typeface.BOLD
            italic -> Typeface.ITALIC
            else -> Typeface.NORMAL
        }
        val base: Typeface = if (!name.isNullOrEmpty()) {
            runCatching { Typeface.create(name, styleFlag) }.getOrNull() ?: Typeface.DEFAULT
        } else {
            Typeface.DEFAULT
        }
        return base
    }

    private fun parseColor(hex: String?, fallback: Int): Int {
        if (hex.isNullOrBlank()) return fallback
        var s = hex.trim()
        if (s.startsWith("#")) s = s.substring(1)
        if (s.length == 3 || s.length == 4) {
            s = s.map { "$it$it" }.joinToString("")
        }
        if (s.length != 6 && s.length != 8) return fallback
        return try {
            val value = s.toLong(16)
            if (s.length == 8) {
                val r = ((value shr 24) and 0xFF).toInt()
                val g = ((value shr 16) and 0xFF).toInt()
                val b = ((value shr 8) and 0xFF).toInt()
                val a = (value and 0xFF).toInt()
                Color.argb(a, r, g, b)
            } else {
                val r = ((value shr 16) and 0xFF).toInt()
                val g = ((value shr 8) and 0xFF).toInt()
                val b = (value and 0xFF).toInt()
                Color.rgb(r, g, b)
            }
        } catch (_: NumberFormatException) {
            fallback
        }
    }

    private fun textBgShape(raw: String?): TextBgShape = when (raw) {
        "stretchX" -> TextBgShape.STRETCH_X
        "stretchY" -> TextBgShape.STRETCH_Y
        else -> TextBgShape.FIT
    }

    // ---- Rotation + export ----------------------------------------------------

    private fun rotated(bitmap: Bitmap, degrees: Float): Bitmap {
        if (degrees == 0f || degrees % 360f == 0f) return bitmap
        val matrix = Matrix().apply { postRotate(degrees) }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated != bitmap) bitmap.safeRecycle()
        return rotated
    }

    private fun export(
        context: Context,
        bitmap: Bitmap,
        format: SaveFormat,
        quality: Int,
        filename: String?,
    ): String {
        val clampedQuality = clamp(quality, 0, 100)
        if (format == SaveFormat.BASE64) {
            val baos = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, clampedQuality, baos)
            val encoded = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            return "data:image/png;base64,$encoded"
        }
        val ext = if (format == SaveFormat.PNG) "png" else "jpg"
        val resolved = filename?.let {
            if (it.endsWith(".png") || it.endsWith(".jpg")) it else "$it.$ext"
        } ?: "${UUID.randomUUID()}_image_marker.$ext"
        val file = File(context.cacheDir, resolved)
        FileOutputStream(file).use { out ->
            val compress = if (format == SaveFormat.PNG) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG
            bitmap.compress(compress, clampedQuality, out)
        }
        return "file://${file.absolutePath}"
    }

    private fun saveFormatFrom(raw: String?): SaveFormat = when (raw?.lowercase(Locale.ROOT)) {
        "png" -> SaveFormat.PNG
        "base64" -> SaveFormat.BASE64
        else -> SaveFormat.JPG
    }

    // ---- Tiny utilities -------------------------------------------------------

    private fun Bitmap?.safeRecycle() {
        this?.takeIf { !it.isRecycled }?.recycle()
    }

    private fun clamp(value: Float, lo: Float, hi: Float) = min(hi, max(lo, value))
    private fun clamp(value: Int, lo: Int, hi: Int) = min(hi, max(lo, value))
}
