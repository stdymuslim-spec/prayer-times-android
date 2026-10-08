package expo.modules.prayerwidget

import android.content.Context
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/** What the widgets show right now, worked out from the saved payload. */
data class WidgetState(
  val gregorian: String,
  val hijri: String,
  val prayer: String?,
  val prayerClock: String?,
  val prayerAtMillis: Long?,
  /** A key Islamic date that falls today, if any. */
  val todayEvent: String?,
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
      ?: return WidgetState("", "Open Prayer Times", null, null, null, null, midnight)

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
      val list = root.optJSONArray("events")
      if (list != null) {
        for (i in 0 until list.length()) {
          val e = list.getJSONArray(i)
          if (LocalDate.parse(e.getString(0)) == today) {
            todayEvent = e.getString(1)
            break
          }
        }
      }
      WidgetState(gregorian, hijri, name, clock, at, todayEvent, if (at != null) minOf(at, midnight) else midnight)
    } catch (e: Exception) {
      WidgetState("", "Open Prayer Times", null, null, null, null, midnight)
    }
  }
}
