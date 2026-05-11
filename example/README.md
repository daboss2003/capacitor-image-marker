# Image Marker Example

A minimal Capacitor app that demonstrates `@daboss2003/capacitor-image-marker`
on Web, iOS, and Android.

## Run on Web

```bash
cd example
npm install
npm run dev
```

Open the printed URL (`http://localhost:5173`). Pick an image (or hit **Use sample**)
and tap **Mark text** or **Mark image (logo)**.

## Run on iOS

```bash
cd example
npm install
npx cap add ios
npm run ios   # builds, syncs, and opens Xcode
```

In Xcode, set your team / signing and run on a simulator or device.

## Run on Android

```bash
cd example
npm install
npx cap add android
npm run android   # builds, syncs, and opens Android Studio
```

## How it uses the plugin

The plugin is consumed as a regular npm dependency (linked via `file:..` in
`package.json`). See [`src/main.ts`](src/main.ts) for the calls — both
`ImageMarker.markText` and `ImageMarker.markImage`.

Source images can be passed as `file://`, `http(s)://`, `data:` URIs, or bare
base64; this example mostly uses `data:` URIs (from the file picker) so the
same code path works on every platform without filesystem permissions.
