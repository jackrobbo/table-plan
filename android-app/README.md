# Table Plan for Android (prototype)

A thin [Capacitor](https://capacitorjs.com) app. The main screen loads the live site (`server.url` in `capacitor.config.json`).
When the site is running inside the app, "Fill my Morrisons trolley" calls a native plugin (`MorrisonsPlugin`) that opens
`MorrisonsActivity`: a WebView on groceries.morrisons.com (own cookies, so a Morrisons sign-in sticks) into which we inject
`extension/morrisons.js`, the same script as the Chrome extension. It presses Add on each product page. No Morrisons API calls.

- Job state lives in the app (`SharedPreferences`) through the `TPNative` bridge; the script picks that over `chrome.storage`.
- Only morrisons.com pages stay in the view; any other link opens in the normal browser.

## Build

Needs JDK 17+ and the Android SDK (`ANDROID_HOME`, platform 35, build-tools 35).

    npm run android:build      # from the repo root; writes public/app/table-plan.apk

The apk is debug-signed. Updating over an older install only works if both were signed with the same debug key, so if an
update is refused, uninstall first. A Play Store release needs a proper keystore (and a one-off $25 developer fee).

## Install on a phone

Open `https://table-plan.co.uk/app` on the phone, download, and allow installs from the browser.

## Not yet verified on a device

Built and structurally checked, not run on hardware. First things to look at: the confirm panel fitting the screen, whether
Morrisons' cookie banner or delivery pop-up blocks the first click, and whether sign-in stays after closing the app.
