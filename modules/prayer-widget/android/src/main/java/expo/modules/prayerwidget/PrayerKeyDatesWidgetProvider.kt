package expo.modules.prayerwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

/** The larger (4x2) home-screen widget: the usual top row plus the next two key Islamic dates. */
class PrayerKeyDatesWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) =
    PrayerWidgetRenderer.refreshAll(context)

  override fun onEnabled(context: Context) = PrayerWidgetRenderer.refreshAll(context)

  override fun onDisabled(context: Context) = PrayerWidgetRenderer.refreshAll(context)
}
