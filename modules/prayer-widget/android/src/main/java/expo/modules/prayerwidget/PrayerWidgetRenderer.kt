package expo.modules.prayerwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.widget.RemoteViews

/** Draws the home-screen widget from the saved payload and keeps its alarms. */
object PrayerWidgetRenderer {
  const val ACTION_TICK = "expo.modules.prayerwidget.TICK"
  private const val MINUTE_TICK = 1

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun tickIntent(context: Context, requestCode: Int = 0): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      requestCode,
      Intent(context, PrayerWidgetProvider::class.java).setAction(ACTION_TICK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun idsOf(manager: AppWidgetManager, context: Context, cls: Class<*>): IntArray =
    manager.getAppWidgetIds(ComponentName(context, cls))

  /** Redraws every widget instance and arms the alarms for the next change. */
  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val smallIds = idsOf(manager, context, PrayerWidgetProvider::class.java)
    val largeIds = idsOf(manager, context, PrayerKeyDatesWidgetProvider::class.java)
    if (smallIds.isEmpty() && largeIds.isEmpty()) {
      cancelAlarms(context)
      return
    }
    val now = System.currentTimeMillis()
    val state = PrayerWidgetStore.state(context, now)
    for (id in smallIds) manager.updateAppWidget(id, renderSmall(context, state, now))
    for (id in largeIds) manager.updateAppWidget(id, renderLarge(context, state, now))
    scheduleTick(context, state.nextRefreshAtMillis)
    scheduleMinuteTick(context, state, now)
  }

  fun cancelAlarms(context: Context) {
    alarmManager(context).cancel(tickIntent(context))
    alarmManager(context).cancel(tickIntent(context, MINUTE_TICK))
  }

  /** Minutes left as the Mac menu bar shows them, rounded up: 536 -> 8h 56m. */
  fun countdownText(prayer: String, remainingMillis: Long): String {
    val minutes = maxOf(0L, (remainingMillis + 59_999) / 60_000)
    val span = if (minutes >= 60) "${minutes / 60}h ${minutes % 60}m" else "${minutes}m"
    return "$prayer in $span"
  }

  fun whenLabel(days: Long): String = when {
    days <= 0L -> "Today"
    days == 1L -> "Tomorrow"
    else -> "in $days days"
  }

  private fun exactAllowed(alarms: AlarmManager) =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()

  private fun scheduleTick(context: Context, atMillis: Long) {
    val alarms = alarmManager(context)
    val pending = tickIntent(context)
    // A second after the boundary, so the new prayer or day is definitely current.
    val at = atMillis + 1_000
    if (exactAllowed(alarms)) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
    else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
  }

  /**
   * Redraws when the displayed minute changes. Not a waking alarm: while the
   * phone sleeps nothing runs, and the widget catches up the moment it wakes.
   */
  private fun scheduleMinuteTick(context: Context, state: WidgetState, now: Long) {
    val alarms = alarmManager(context)
    val pending = tickIntent(context, MINUTE_TICK)
    val at = state.prayerAtMillis
    if (at == null) {
      alarms.cancel(pending)
      return
    }
    val shown = (at - now + 59_999) / 60_000
    val nextChange = at - (shown - 1) * 60_000 + 500
    if (exactAllowed(alarms)) alarms.setExact(AlarmManager.RTC, nextChange, pending)
    else alarms.set(AlarmManager.RTC, nextChange, pending)
  }

  private fun fillTopRow(views: RemoteViews, state: WidgetState, now: Long) {
    views.setTextViewText(R.id.widget_gregorian, state.gregorian)
    views.setTextViewText(R.id.widget_hijri, state.hijri)
    val text = if (state.prayer != null && state.prayerAtMillis != null) {
      countdownText(state.prayer, state.prayerAtMillis - now)
    } else {
      "No prayer times"
    }
    views.setTextViewText(R.id.widget_countdown, text)
  }

  private fun openAppOnTap(context: Context, views: RemoteViews) {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    views.setOnClickPendingIntent(
      R.id.widget_root,
      PendingIntent.getActivity(context, 1, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
    )
  }

  private fun renderSmall(context: Context, state: WidgetState, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.prayer_widget)
    fillTopRow(views, state, now)
    openAppOnTap(context, views)
    return views
  }

  private fun renderLarge(context: Context, state: WidgetState, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.prayer_keydates_widget)
    fillTopRow(views, state, now)

    val names = intArrayOf(R.id.event1_name, R.id.event2_name)
    val details = intArrayOf(R.id.event1_detail, R.id.event2_detail)
    val whens = intArrayOf(R.id.event1_when, R.id.event2_when)
    val rows = intArrayOf(R.id.event1_row, R.id.event2_row)
    for (i in rows.indices) {
      val event = state.events.getOrNull(i)
      if (event == null) {
        views.setViewVisibility(rows[i], View.GONE)
      } else {
        views.setViewVisibility(rows[i], View.VISIBLE)
        views.setTextViewText(names[i], event.name)
        views.setTextViewText(details[i], event.hijri)
        views.setTextViewText(whens[i], "${event.gregorian} · ${whenLabel(event.daysAway)}")
      }
    }
    openAppOnTap(context, views)
    return views
  }
}
