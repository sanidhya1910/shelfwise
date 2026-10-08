# Shelfwise

An expiry tracker for the things in your fridge, cupboard and medicine drawer. Point the camera at a
printed expiry date and it reads it; photograph a product and it works out what it is. Everything is
stored on the device.

Built with Expo SDK 57 (React Native 0.86) and TypeScript.

---

## How scanning works

Three modes share one camera screen.

**Barcode** → `expo-camera` reads EAN/UPC codes continuously, checks a local cache, then falls back to
[Open Food Facts](https://world.openfoodfacts.org) for name, brand and category. Cached results mean
a rebought jar resolves instantly and offline.

**Date** → Google ML Kit reads the label on the device, and [`dateParser.ts`](src/vision/dateParser.ts)
ranks every date it finds. That ranking is the interesting part:

- proximity to an expiry keyword (`BEST BEFORE`, `USE BY`, `EXP`, …) pushes a date up
- proximity to a manufacture keyword (`MFD`, `PKD`, `PROD`, …) pushes it down
- a date in the future beats one in the past
- physically larger text wins, because printed expiry dates are usually the boldest thing in
  their corner of the pack
- `03/04/27` is resolved with your date-order setting; `25/03/27` resolves itself

If the best candidate is still below the confidence bar, and you have saved a Mistral key, the photo
goes to Mistral's OCR model — and the text that comes back is fed through **the same local parser**,
so the AI can never invent a date that was not printed.

**Product** → the photo goes to a Mistral vision model, which returns a name, brand, category hint and
a typical shelf life. Any dates it claims to have read are re-parsed locally before being offered.

No key is required for any of this except product recognition; the on-device path is free and works
with no signal.

---

## Running it

Requires the Android SDK and JDK 17+. On this machine:

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot"
```

Then:

```bash
npx expo run:android
```

The first build compiles native code for four ABIs and takes a while. To cut that roughly in half for
day-to-day work, add this to `android/gradle.properties`:

```
reactNativeArchitectures=arm64-v8a,x86_64
```

Once installed, `npx expo start` is enough — only native dependency changes need another build.

ML Kit needs Google Play services, so use a physical device or a Play-enabled emulator image.

### A standalone APK

A debug build fetches its JavaScript from Metro, so it will not run on its own. For an APK you can
install and actually use:

```bash
cd android && ./gradlew assembleRelease
```

The result is `android/app/build/outputs/apk/release/app-release.apk`. It is signed with the
template's debug keystore, which is fine for your own phone but not for distribution — generate a
real keystore before sharing it.

### Web

```bash
npx expo start --web
```

The browser build is a **viewer**, not the whole app. It opens a backup file the phone exported, into
IndexedDB, and lets you browse, filter, edit and download an updated copy. There is no camera, no OCR
and no reminders on web — browsers cannot reliably wake a closed tab to deliver one, and pretending
otherwise would be worse than saying so.

`npx expo export --platform web` produces a static site. Serve it from a host that rewrites clean
URLs to the matching `.html` (Vercel, Cloudflare Pages, EAS Hosting all do); a bare static file
server will 404 on `/scan` because the export writes `scan.html`.

### Checks

```bash
npm test          # date parser regression suite
npm run typecheck
npm run lint
```

---

## Layout

```
src/
  app/            Expo Router routes (tabs, item detail, add, settings)
  db/             repository interface + SQLite (native) and IndexedDB (web) drivers
  domain/         items, categories, locations, freshness, stats, settings
  vision/         OCR, date parser, Mistral client, barcode lookup
  notifications/  local reminder scheduling
  store/          the single Zustand store
  ui/             theme tokens and components
  utils/          dates, backup, haptics, secure storage
```

`foo.native.ts` / `foo.web.ts` pairs are how the web bundle drops native-only code — Metro picks the
right one, so ML Kit and the notification scheduler never reach the browser build.

> One trap worth knowing: a `.web.ts` file must **not** re-export runtime values from its own base
> specifier. Inside `scheduler.web.ts`, `export { scheduler } from './scheduler'` resolves back to
> `scheduler.web.ts` itself, and the module imports itself until the stack overflows. Import the
> *type* from the base file and define the implementation inline. (Type-only imports are erased, so
> those are safe.)

The store keeps every item in memory and filters there. A household inventory is hundreds of rows,
not millions, so SQLite is used as durable storage rather than a query engine — which is also what
lets the two drivers stay thin and behave identically.

---

## Data and privacy

- Items, categories, the shopping list and settings live in a local SQLite database.
- The Mistral API key is kept in the Android keystore via `expo-secure-store`. It is never written to
  the database and never included in a backup.
- Photos leave the device only when an AI scan runs, and are downscaled to 1280px first.
- Consumed and binned items are kept rather than deleted — they are what the stats read.

## What has been verified

Checked end to end on an Android 16 emulator:

- adding, editing, deleting; data surviving a cold restart (SQLite)
- **on-device OCR**: a printed label with a decoy `MFD 01/2025`, a lot number and a price — ML Kit
  read it and the parser correctly picked `12.03.27`
- swipe-to-consume / swipe-to-bin, long-press multi-select and its bulk actions
- a local reminder actually firing on the device
- light, dark, and the in-app appearance override
- export → open in the browser build → browse → edit, and the resulting file re-importing cleanly

Verified separately: the Open Food Facts response shape and category mapping, against the live API.

**Not yet exercised on a device**, because they need inputs I did not have:

- the barcode camera path (the emulator has no barcode to point at; the lookup and mapping below it
  are covered by tests and a live API check)
- both Mistral paths — the OCR fallback and product photo recognition — which need an API key. The
  code, error handling and JSON contracts are written; add a key in Settings to try them.

## Known limits

- Open Food Facts covers food well and medicine or cosmetics poorly; those lean on photo recognition
  and manual entry.
- Reminders are scheduled per item. A dynamic daily digest would need a background task, so the app
  shows the digest as a banner on open instead.
- The APK is large — ML Kit bundles its recognition models, and a multi-ABI build multiplies the
  native libraries. Building for one architecture
  (`-PreactNativeArchitectures=arm64-v8a`) roughly quarters it.
