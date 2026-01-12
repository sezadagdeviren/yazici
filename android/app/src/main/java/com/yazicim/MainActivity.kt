package com.yazicim

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "yazicim"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Log.d("Yazicim", "onCreate called")
    handleIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    Log.d("Yazicim", "onNewIntent called")
    handleIntent(intent)
  }

  private fun handleIntent(intent: Intent?) {
    if (intent == null || intent.action != Intent.ACTION_SEND) return
    
    val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    Log.d("Yazicim", "handleIntent ACTION_SEND, URI: $uri")
    
    if (uri != null) {
      val fileName = getFileName(uri)
      
      runOnUiThread {
          Toast.makeText(this, "Dosya Hazırlanıyor: $fileName", Toast.LENGTH_SHORT).show()
      }

      // Dosyayı önbelleğe kopyala (İzin sorunlarını aşmak için en sağlam yol)
      val cachedFile = copyFileToCache(uri, fileName)
      
      if (cachedFile != null) {
          Log.d("Yazicim", "File cached to: ${cachedFile.absolutePath}")
          // JS'e önbellekteki dosya yolunu gönderiyoruz (file:// prefiksi ile)
          sendEventToJS("file://" + cachedFile.absolutePath, fileName, 0)
      } else {
          Log.e("Yazicim", "Failed to cache file")
          runOnUiThread {
              Toast.makeText(this, "Hata: Dosya kopyalanamadı", Toast.LENGTH_LONG).show()
          }
      }
    }
  }

  private fun copyFileToCache(uri: Uri, fileName: String): File? {
    try {
        val inputStream = contentResolver.openInputStream(uri) ?: return null
        val cacheFile = File(cacheDir, fileName)
        val outputStream = FileOutputStream(cacheFile)
        
        val buffer = ByteArray(1024 * 64)
        var length: Int
        while (inputStream.read(buffer).also { length = it } > 0) {
            outputStream.write(buffer, 0, length)
        }
        
        outputStream.close()
        inputStream.close()
        return cacheFile
    } catch (e: Exception) {
        Log.e("Yazicim", "copyFileToCache error: ${e.message}")
        return null
    }
  }

  private fun sendEventToJS(uri: String, fileName: String, retryCount: Int) {
    if (retryCount > 60) {
        Log.e("Yazicim", "JS'e dosya gonderilemedi (Zaman asimi)")
        return 
    }

    try {
        val app = application as ReactApplication
        val reactContext = app.reactHost?.currentReactContext
        
        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            val params = Arguments.createMap()
            params.putString("uri", uri)
            params.putString("fileName", fileName)

            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onSharedFile", params)
            Log.d("Yazicim", "Event emitted SUCCESS: $fileName")
        } else {
            Log.d("Yazicim", "JS Context not ready, retrying ($retryCount)...")
            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            handler.postDelayed({ 
                sendEventToJS(uri, fileName, retryCount + 1) 
            }, 1000)
        }
    } catch (e: Exception) {
        Log.e("Yazicim", "sendEventToJS error: ${e.message}")
        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        handler.postDelayed({ 
            sendEventToJS(uri, fileName, retryCount + 1) 
        }, 1000)
    }
  }

  private fun getFileName(uri: Uri): String {
    var result: String? = null
    try {
        if (uri.scheme == "content") {
          val cursor = contentResolver.query(uri, null, null, null, null)
          cursor?.use {
            if (it.moveToFirst()) {
              val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
              if (index != -1) result = it.getString(index)
            }
          }
        }
    } catch (e: Exception) {
        Log.e("Yazicim", "getFileName error: ${e.message}")
    }
    
    if (result == null) {
      result = uri.path?.let { p ->
        val cut = p.lastIndexOf('/')
        if (cut != -1) p.substring(cut + 1) else p
      }
    }
    return result ?: "belge.dat"
  }
}