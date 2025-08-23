# 🌿 Sniffle

Breathe better. Live clearer.

Sniffle is an intelligent allergy companion that helps you stay one step ahead of the air around you.

<img src="assets/login.PNG" alt="Sniffle Demo" width="300"/>

## Quickstart

### Frontend (Expo)
1. Install deps:
   - Node.js LTS
   - Android Studio (SDK + emulator)
2. Install packages:
   ```bash
   npm install
   ```
3. Create a `.env` by copying `.env.example` and filling values.
4. Start Metro and launch on Android emulator:
   ```bash
   npm run android
   ```

If you need to open in Android Studio: run `npx expo prebuild -p android` once, then open the `android/` folder in Android Studio and run.

### Backend (Flask)
1. Create and activate venv:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```
2. Install deps:
   ```bash
   pip install -r backend\requirements.txt
   ```
3. Run API:
   ```bash
   python backend\app.py
   ```

Default API base (Android emulator): `http://10.0.2.2:5000`

## Environment
Create `.env` in project root (used by `react-native-dotenv`):
```
API_URL=http://10.0.2.2:5000
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
```

More coming soon.
