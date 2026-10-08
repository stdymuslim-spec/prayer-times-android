package expo.modules.prayerwidget

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.service.dreams.DreamService
import android.view.View
import android.widget.TextView
import kotlin.math.sqrt

/**
 * The Prayer Times screensaver, shown while the phone charges: dates, the key
 * Islamic date if today is one, a large clock and the countdown. After the chosen
 * time it goes fully black (OLED pixels off), and comes back when the phone moves.
 */
class PrayerDreamService : DreamService(), SensorEventListener {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var panel: View
  private lateinit var gregorian: TextView
  private lateinit var hijri: TextView
  private lateinit var event: TextView
  private lateinit var countdown: TextView

  private var blank = false
  private var litUntil = 0L
  private var lastMinute = -1L
  private var last = FloatArray(3)
  private var hasLast = false

  private val tick = object : Runnable {
    override fun run() {
      val stay = PrayerWidgetStore.stayMinutes(this@PrayerDreamService)
      if (!blank && stay > 0 && SystemClock.elapsedRealtime() >= litUntil) setBlank(true)
      if (!blank) {
        val minute = System.currentTimeMillis() / 60_000
        if (minute != lastMinute) {
          lastMinute = minute
          refreshText()
          drift(minute)
        }
      }
      handler.postDelayed(this, 1_000)
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    isInteractive = false
    isFullscreen = true
    isScreenBright = false
    setContentView(R.layout.prayer_dream)
    panel = findViewById(R.id.dream_content)
    gregorian = findViewById(R.id.dream_gregorian)
    hijri = findViewById(R.id.dream_hijri)
    event = findViewById(R.id.dream_event)
    countdown = findViewById(R.id.dream_countdown)
  }

  override fun onDreamingStarted() {
    super.onDreamingStarted()
    wake()
    val sensors = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let {
      sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
    }
    handler.post(tick)
  }

  override fun onDreamingStopped() {
    handler.removeCallbacks(tick)
    (getSystemService(Context.SENSOR_SERVICE) as SensorManager).unregisterListener(this)
    super.onDreamingStopped()
  }

  /** Shows the content and restarts the time it stays lit. */
  private fun wake() {
    litUntil = SystemClock.elapsedRealtime() + PrayerWidgetStore.stayMinutes(this) * 60_000L
    lastMinute = -1
    if (blank) setBlank(false)
    else {
      refreshText()
      drift(System.currentTimeMillis() / 60_000)
    }
  }

  private fun setBlank(value: Boolean) {
    blank = value
    panel.visibility = if (value) View.INVISIBLE else View.VISIBLE
    if (!value) {
      lastMinute = -1
      refreshText()
    }
  }

  private fun refreshText() {
    val now = System.currentTimeMillis()
    val state = PrayerWidgetStore.state(this, now)
    gregorian.text = state.gregorian
    hijri.text = state.hijri
    if (state.todayEvent != null) {
      event.text = state.todayEvent
      event.visibility = View.VISIBLE
    } else {
      event.visibility = View.GONE
    }
    countdown.text = if (state.prayer != null && state.prayerAtMillis != null) {
      PrayerWidgetRenderer.countdownText(state.prayer, state.prayerAtMillis - now)
    } else {
      ""
    }
  }

  /** Nudges the layout a little each minute so no pixel stays lit in one place. */
  private fun drift(minute: Long) {
    val density = resources.displayMetrics.density
    panel.translationX = (((minute * 13) % 41) - 20) * density
    panel.translationY = (((minute * 29) % 41) - 20) * density
  }

  override fun onSensorChanged(e: SensorEvent) {
    if (hasLast) {
      val dx = e.values[0] - last[0]
      val dy = e.values[1] - last[1]
      val dz = e.values[2] - last[2]
      // A phone resting on a charger barely changes; picking it up changes a lot.
      if (sqrt(dx * dx + dy * dy + dz * dz) > 1.5f) wake()
    }
    last = e.values.clone()
    hasLast = true
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
