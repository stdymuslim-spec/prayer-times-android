package expo.modules.prayerwidget

import android.content.Context
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/** What the widget shows right now, worked out from the saved payload. */
data class WidgetState(
  val gregorian: String,
  val hijri: String,
  val prayer: String?,
  val prayerClock: String?,
  val prayerAtMillis: Long?,
  /** When to redraw next: the next prayer, or midnight when the date changes. */
  val nextRefreshAtMillis: Long,
)

object PrayerWidgetStore {
  private const val PREFS = "prayer_widget"
  private const val KEY = "payload"

  fun save(context: Context, json: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
  }

  fun state(context: Context, nowMillis: Long): WidgetState {
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    val midnight = today.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      ?: return WidgetState("", "Open Prayer Times", null, null, null, midnight)

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
      WidgetState(gregorian, hijri, name, clock, at, if (at != null) minOf(at, midnight) else midnight)
    } catch (e: Exception) {
      WidgetState("", "Open Prayer Times", null, null, null, midnight)
    }
  }
}
