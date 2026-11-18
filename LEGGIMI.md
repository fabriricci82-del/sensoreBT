# Datalogger9 - app Android (Capacitor)

Stessa app della versione web, ma installabile come APK e indipendente da Claude.

## Strada 1: costruire l'APK nel cloud (senza installare nulla)
1. Crea un account gratuito su github.com e un nuovo repository.
2. Carica il contenuto di questa cartella (compresa la cartella .github).
3. Nel repository: scheda Actions, "Costruisci APK", Run workflow.
4. Al termine scarica l'artefatto "Datalogger9-apk" (contiene app-debug.apk), copialo sul telefono e aprilo
   (consenti "installa app sconosciute"). Puoi inviarlo ad altri telefoni Android.

## Strada 2: sul tuo computer
Servono Node.js 22 e Android Studio.
1. npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor-community/bluetooth-le @capacitor/filesystem @capacitor/share
2. npm install --save-dev vite
3. npx cap add android
4. Aggiungi i permessi Bluetooth a android/app/src/main/AndroidManifest.xml (vedi il file .github/workflows/apk.yml)
5. npm run build, poi npx cap sync android, poi npx cap open android
6. In Android Studio: Build > Build APK(s). Il file e' in android/app/build/outputs/apk/debug/app-debug.apk

Nota: non l'ho potuto compilare qui. Se un passaggio da' errore, mandamelo.
