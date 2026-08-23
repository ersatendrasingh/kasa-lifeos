# KASA LifeOS Mobile

The Expo app for KASA LifeOS, sharing the same cosmic-orange identity across iOS and Android.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npm run start
   ```

Use a local development build for the complete authentication, secure storage, and notification experience.

```bash
npm run ios
npm run android
```

Before opening the app, run the LifeOS web/API server from the repository root. Configure its address in `.env.local` using `EXPO_PUBLIC_API_URL`.

## Quality checks

```bash
npm run check
```
