package com.daboss2003.capacitor.imagemarker

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "ImageMarker"

@CapacitorPlugin(name = "ImageMarker")
class ImageMarkerPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @PluginMethod
    fun markText(call: PluginCall) {
        scope.launch {
            try {
                val uri = withContext(Dispatchers.IO) {
                    ImageMarker.markText(context, call.data.toMap())
                }
                call.resolve(JSObject().put("uri", uri))
            } catch (e: Throwable) {
                Log.e(TAG, "markText failed", e)
                call.reject(e.message ?: "markText failed", e)
            }
        }
    }

    @PluginMethod
    fun markImage(call: PluginCall) {
        scope.launch {
            try {
                val uri = withContext(Dispatchers.IO) {
                    ImageMarker.markImage(context, call.data.toMap())
                }
                call.resolve(JSObject().put("uri", uri))
            } catch (e: Throwable) {
                Log.e(TAG, "markImage failed", e)
                call.reject(e.message ?: "markImage failed", e)
            }
        }
    }
}
