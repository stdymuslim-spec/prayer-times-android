package expo.modules.prayerwidget

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The app hands the widget and screensaver a JSON payload (see src/domain/widget.ts); they draw from it on their own. */
class PrayerWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PrayerWidget")

    Function("setData") { json: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      PrayerWidgetStore.save(context, json)
      PrayerWidgetRenderer.refreshAll(context)
    }

    // How long the screensaver stays lit before going black; 0 means it never does.
    Function("setScreensaverMinutes") { minutes: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      PrayerWidgetStore.saveStayMinutes(context, minutes)
    }
  }
}
