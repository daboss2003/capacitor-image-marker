package com.daboss2003.capacitor.imagemarker

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

object ImageLoader {
    /**
     * Decodes a bitmap from one of: `file://` path, plain absolute path,
     * `http(s)://` URL, `content://` URI, `data:image/...;base64,...`,
     * or a bare base64 PNG/JPEG payload.
     *
     * The result is downscaled so neither dimension exceeds `maxSize` pixels.
     */
    @Throws(IOException::class)
    fun load(context: Context, src: String, maxSize: Int): Bitmap {
        val bytes = readBytes(context, src)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val opts = BitmapFactory.Options().apply {
            inSampleSize = computeSampleSize(bounds.outWidth, bounds.outHeight, maxSize)
        }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
            ?: throw IOException("Failed to decode image: $src")
    }

    private fun readBytes(context: Context, src: String): ByteArray {
        return when {
            src.startsWith("data:") -> decodeDataUri(src)
            src.startsWith("http://") || src.startsWith("https://") -> downloadHttp(src)
            src.startsWith("content://") -> openContent(context, src)
            src.startsWith("file://") -> openFileUri(context, src)
            src.startsWith("/") -> openFileUri(context, "file://$src")
            else -> Base64.decode(stripWhitespace(src), Base64.DEFAULT)
        }
    }

    private fun decodeDataUri(uri: String): ByteArray {
        val comma = uri.indexOf(',')
        if (comma < 0) throw IOException("Malformed data URI")
        return Base64.decode(stripWhitespace(uri.substring(comma + 1)), Base64.DEFAULT)
    }

    private fun openFileUri(context: Context, uri: String): ByteArray {
        return useStream(context.contentResolver.openInputStream(Uri.parse(uri))
            ?: throw IOException("Cannot open $uri"))
    }

    private fun openContent(context: Context, uri: String): ByteArray {
        return useStream(context.contentResolver.openInputStream(Uri.parse(uri))
            ?: throw IOException("Cannot open $uri"))
    }

    private fun downloadHttp(src: String): ByteArray {
        val url = URL(src)
        val connection = url.openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 15_000
        connection.instanceFollowRedirects = true
        try {
            return useStream(connection.inputStream)
        } finally {
            connection.disconnect()
        }
    }

    private fun useStream(stream: InputStream): ByteArray {
        return stream.use { it.readBytes() }
    }

    private fun stripWhitespace(s: String): String =
        s.replace("\n", "").replace("\r", "").replace(" ", "")

    /** Picks a power-of-two sample size that keeps both sides below `maxSize`. */
    private fun computeSampleSize(width: Int, height: Int, maxSize: Int): Int {
        if (maxSize <= 0 || width <= 0 || height <= 0) return 1
        var sample = 1
        var w = width
        var h = height
        while (w / 2 >= maxSize || h / 2 >= maxSize) {
            sample *= 2
            w /= 2
            h /= 2
        }
        return sample
    }
}
