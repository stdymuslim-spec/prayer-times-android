package expo.modules.prayerwidget

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The app hands the widget and screensaver a JSON payload (see src/domain/widget.ts); they draw from it on
 * their own. It also lets the user pick a notification sound: Android keeps a sound with each notification
 * channel and never lets an app change it afterwards, so a chosen sound gets a brand new channel.
 */
class PrayerWidgetModule : Module() {
  private var pendingPick: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PrayerWidget")

    Function("setData") { json: String ->
      PrayerWidgetStore.save(context, json)
      PrayerWidgetRenderer.refreshAll(context)
    }

    // How long the screensaver stays lit before going black; 0 means it never does.
    Function("setScreensaverMinutes") { minutes: Int ->
      PrayerWidgetStore.saveStayMinutes(context, minutes)
    }

    // Opens Android's own notification sound picker. Resolves with the choice, or null if cancelled.
    AsyncFunction("pickNotificationSound") { existing: String?, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      pendingPick?.resolve(null)
      pendingPick = promise
      val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
        putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_NOTIFICATION)
        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
        putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Choose a sound")
        if (existing != null) putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(existing))
      }
      activity.startActivityForResult(intent, PICK_REQUEST)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != PICK_REQUEST) return@OnActivityResult
      val promise = pendingPick ?: return@OnActivityResult
      pendingPick = null
      val data = payload.data
      if (payload.resultCode != Activity.RESULT_OK || data == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val uri: Uri? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
      }
      if (uri == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val title = try {
        RingtoneManager.getRingtone(context, uri)?.getTitle(context)
      } catch (e: Exception) {
        null
      }
      promise.resolve(mapOf("uri" to uri.toString(), "title" to (title ?: "Chosen sound")))
    }

    // A loud channel with the given sound, like the app's own ones.
    Function("createSoundChannel") { id: String, name: String, uri: String ->
      val channel = NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH).apply {
        setSound(
          Uri.parse(uri),
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 250, 250, 250)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    Function("deleteSoundChannel") { id: String ->
      context.getSystemService(NotificationManager::class.java).deleteNotificationChannel(id)
    }
  }

  private companion object {
    const val PICK_REQUEST = 7311
  }
}
