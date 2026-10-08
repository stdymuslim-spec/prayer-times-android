# Prayer Times SG

An Android app for Singapore's prayer times. It counts down to the next prayer, reminds you ten minutes
before and at each prayer, shows the Hijri date, and points to the Qibla. It is the Android companion to
[Prayer Times for Mac](https://github.com/stdymuslim-spec/prayer-times-mac).

- **Countdown:** "Subuh in 8h 56m", like the Mac menu bar. Today's six times, with the next one in bold.
- **Two notifications per prayer:** "10 minutes to Asar" with a soft chime, then "It's time for Asar." with the
  call to prayer. They are set with Android's alarm system, so they arrive with the app closed.
- **Silent and Pause:** Silent keeps the pop-ups but drops the sound. Pause stops notifications completely.
  Test buttons check both notifications.
- **Your own sounds:** choose any notification sound for the reminder and for the call to prayer, or add your own
  audio file, from the **Sounds** buttons in the app. They open Android's own sound settings.
- **Official times in Singapore, calculated times elsewhere:** the official MUIS prayer timetable for 2026 and
  2027 is built in. Anywhere else, or after 2027, times are calculated for where you are.
- **Asks before changing place:** when you open the app it checks where you are. If that differs from the saved
  place it asks whether to switch, and never switches silently.
- **Hijri date:** follows the MUIS Islamic calendar for 2026 and 2027.
- **Home-screen widget:** one transparent row with the Gregorian date, the Hijri date and the countdown.
- **Screen saver:** the dates, the key Islamic date on its day, a large clock and the countdown, while the phone
  charges. It goes black after a time you choose and lights again when you lift the phone.
- **Qibla compass:** finds where you are, then points to the Kaaba.

Everything stays on the phone. There are no accounts, no ads and no analytics. Your location is used on the
device to choose the prayer times and the Qibla direction, and is never sent to this project. Android's own
location service may look up the place name.

## Install

1. Open the [latest release](../../releases/latest) on your phone and download the `.apk` file.
2. Tap it. If Android asks, allow your browser or Files app to **Install unknown apps**.
3. Open **Prayer Times SG**, allow notifications and location when asked.
4. To use the screen saver, open Settings → Display and touch → Screen saver, and choose **Prayer Times SG**.

Android 8.0 or later. If reminders arrive late, set the app to **Unrestricted** in its battery settings.

The app does not come with a chime or a call to prayer. It uses Android's default notification sound until you
pick one. Open **Sounds** in the app and choose the sound you want for each.

## Build from source

You need Node 20 or later, JDK 17 and the Android SDK. To bundle sounds of your own, put them in `assets/audio/`
as `reminder.mp3` (the reminder) and `call_to_prayer.mp3` (the call to prayer) before building. They are ignored
by Git, and the build works without them.

```bash
npm install
npm test            # unit tests, no phone needed
npm run typecheck
npx expo run:android   # builds and installs on a connected phone
```

Tagging a release (for example `v1.0.0`) runs the **Build APK** workflow, which tests the code, builds the APK
and attaches it to a GitHub release. To sign it with your own key, add these repository secrets:
`KEYSTORE_BASE64` (the keystore file, base64 encoded), `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`.
Without them the APK is signed with the public debug key, which is fine for trying it out but not for sharing.

## Updating the data

The timetable and calendar cover 1 January 2026 to 31 December 2027. After that the app falls back to calculated
prayer times and estimated Hijri dates. To extend them, download the new yearly files from
[muis.gov.sg/resources/islamic-calendar](https://www.muis.gov.sg/resources/islamic-calendar/):

| File | Where it goes |
|---|---|
| Prayer timetable PDF | `src/domain/timetable.json`, converted with `tools/parse_timetable.py` in [Prayer Times for Mac](https://github.com/stdymuslim-spec/prayer-times-mac) |
| Islamic calendar PDF | the month starts in `src/domain/hijri.ts` (check them against the PDF with `tests/hijri.test.ts`) |
| Key Islamic dates PDF | `src/domain/keyDates.ts` |

## Project layout

| Path | What it is |
|---|---|
| `App.tsx`, `src/ui/` | the screens |
| `src/domain/` | prayer times, Hijri calendar, Qibla and planning: plain TypeScript with tests |
| `src/services/` | notifications, location and storage |
| `modules/prayer-widget/` | the Android widget and screen saver (Kotlin) |
| `tools/make_icon.py` | draws the app icon |
| `app.config.js` | adds the sound files to the build only if they are present |

## Credits

- **Prayer times, Islamic calendar and key dates:** published by MUIS (Majlis Ugama Islam Singapura) at
  [muis.gov.sg](https://www.muis.gov.sg/resources/islamic-calendar/). This project is not affiliated with or
  endorsed by MUIS. Please check the official publications if a time matters.
- **Calculated times:** [adhan](https://github.com/batoulapps/adhan-js) (MIT).

This repository contains no audio files.

The Qibla direction is the great-circle bearing to the Kaaba (21.4225° N, 39.8262° E). A phone compass is good to a
few degrees, so use it as a guide.

## Licence

Prayer Times SG is free software: you can redistribute it and modify it under the terms of the
[GNU General Public License](LICENSE) as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version. It is distributed in the hope that it will be useful, but without
any warranty. The MUIS data is excluded, as described above.
