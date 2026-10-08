package expo.modules.prayerwidget

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The app hands the widget a JSON payload (see src/domain/widget.ts); the widget draws from it on its own. */
class PrayerWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PrayerWidget")

    Function("setData") { json: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      PrayerWidgetStore.save(context, json)
      PrayerWidgetProvider.refreshAll(context)
    }
  }
}
