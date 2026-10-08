package expo.modules.prayerwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent

/** The one-row (4x1) home-screen widget. It also receives the alarm that redraws it. */
class PrayerWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = refreshAll(context)

  override fun onEnabled(context: Context) = refreshAll(context)

  override fun onDisabled(context: Context) = refreshAll(context)

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == PrayerWidgetRenderer.ACTION_TICK) refreshAll(context)
  }

  companion object {
    fun refreshAll(context: Context) = PrayerWidgetRenderer.refreshAll(context)
  }
}
