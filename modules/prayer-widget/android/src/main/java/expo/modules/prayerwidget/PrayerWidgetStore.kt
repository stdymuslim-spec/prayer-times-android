package expo.modules.prayerwidget

import android.content.Context
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/** A key Islamic date shown on the larger widget. */
data class EventLine(
  val name: String,
  val hijri: String,
  val gregorian: String,
  val daysAway: Long,
)

/** What the widgets show right now, worked out from the saved payload. */
data class WidgetState(
  val gregorian: String,
  val hijri: String,
  val prayer: String?,
  val prayerClock: String?,
  val prayerAtMillis: Long?,
  /** A key Islamic date that falls today, if any. */
  val todayEvent: String?,
  /** The next two key Islamic dates from today on. */
  val events: List<EventLine>,
  /** When to redraw next: the next prayer, or midnight when the date changes. */
  val nextRefreshAtMillis: Long,
)

object PrayerWidgetStore {
  private const val PREFS = "prayer_widget"
  private const val KEY = "payload"

  fun save(context: Context, json: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
  }

  private const val STAY_KEY = "screensaver_minutes"

  fun saveStayMinutes(context: Context, minutes: Int) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(STAY_KEY, minutes).apply()
  }

  fun stayMinutes(context: Context): Int =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(STAY_KEY, 10)

  fun state(context: Context, nowMillis: Long): WidgetState {
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    val midnight = today.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      ?: return WidgetState("", "Open Prayer Times", null, null, null, null, emptyList(), midnight)

    return try {
      val root = JSONObject(raw)
      val day = root.getJSONObject("days").optJSONArray(today.toString())
      val gregorian = day?.getString(0) ?: ""
      val hijri = day?.getString(1) ?: "Open Prayer Times to refresh"

      val prayers = root.getJSONArray("prayers")
      var name: String? = null
      var clock: String? = null
      var at: Long? = null
      for (i in 0 until prayers.length()) {
        val p = prayers.getJSONArray(i)
        if (p.getLong(1) > nowMillis) {
          name = p.getString(0)
          at = p.getLong(1)
          clock = p.getString(2)
          break
        }
      }

      var todayEvent: String? = null
      val upcoming = ArrayList<EventLine>()
      val list = root.optJSONArray("events")
      if (list != null) {
        for (i in 0 until list.length()) {
          val e = list.getJSONArray(i)
          val date = LocalDate.parse(e.getString(0))
          if (date == today && todayEvent == null) todayEvent = e.getString(1)
          val days = ChronoUnit.DAYS.between(today, date)
          if (days >= 0 && upcoming.size < 2 && e.length() >= 4) {
            upcoming.add(EventLine(e.getString(1), e.getString(2), e.getString(3), days))
          }
        }
      }
      WidgetState(gregorian, hijri, name, clock, at, todayEvent, upcoming, if (at != null) minOf(at, midnight) else midnight)
    } catch (e: Exception) {
      WidgetState("", "Open Prayer Times", null, null, null, null, emptyList(), midnight)
    }
  }
}
