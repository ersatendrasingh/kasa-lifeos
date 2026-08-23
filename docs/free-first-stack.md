# KASA free-first product stack

This is the stack baseline for the private beta. The mobile app is the primary product; the web app and API remain part of the same product.

## Product surfaces

- **Mobile:** React Native 0.86 + Expo SDK 57 + Expo Router + TypeScript in `apps/mobile`.
- **Web and API:** Next.js 16 on Vercel from the repository root.
- **Design system:** one semantic cosmic-orange palette with automatic light/dark modes. Mobile tokens live in `apps/mobile/src/constants/theme.ts`; web tokens remain CSS variables.

## Data and backend

- **Database:** PostgreSQL. Docker Compose is used locally; Neon Free is the production-beta target.
- **ORM:** Prisma remains the shared schema and migration source of truth.
- **API:** Next.js route handlers on Vercel. The Expo client must never connect directly to PostgreSQL or receive server secrets.
- **Files:** begin with object storage only when Memory Vault ships. Store encrypted metadata in PostgreSQL and private blobs behind signed URLs.

## Authentication

- Phase one: Google, email/password, and email OTP.
- Email OTP can use Resend's free allowance during a small private beta.
- Do not launch SMS OTP initially: reliable SMS delivery has a per-message cost. Phone numbers can be collected and verified later when a paid provider is approved.
- Mobile access/refresh tokens will be stored in the OS secure store; refresh tokens will be hashed server-side and revocable per device.

## AI and voice

- OpenAI runs only on the server; no API key is embedded in Expo builds.
- Smart Inbox uses deterministic local/server rules as a fallback when AI is unavailable.
- Voice capture records on-device, uploads only after user action, then uses the API for transcription and categorization.
- AI is usage-priced, so a strict per-user daily quota, input-size limit, timeout, and monthly project budget are required before public access. A truly zero-cost mode uses rules-only classification.

## Free deployment path

1. Run Expo Go during development and use the limited EAS Free plan for beta builds.
2. Deploy the Next.js web/API project to Vercel Hobby only for development or a non-commercial private beta.
3. Use Neon Free for production-beta PostgreSQL and keep local Docker for development.
4. Move to paid hosting only when KASA becomes commercial or exceeds free quotas.

Vercel Hobby is restricted to personal/non-commercial use. Public store distribution is also not permanently free: Apple charges an annual Developer Program fee and Google Play charges a one-time registration fee. These are deferred until store launch, not hidden infrastructure costs.

## Commands

```bash
npm run mobile
npm run mobile:ios
npm run mobile:android
npm run mobile:web
npm run mobile:check
```

The mobile API base URL is configured with `EXPO_PUBLIC_API_URL`; copy `apps/mobile/.env.example` to a local ignored environment file before connecting to a deployed API.
