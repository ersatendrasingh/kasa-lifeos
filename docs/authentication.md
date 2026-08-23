# KASA authentication

## Supported entry methods

- Google OAuth is the only social provider.
- Email or Indian mobile number with a password.
- Email or Indian mobile number with a six-digit one-time code.

All `/app` routes are protected by the server layout. Server Actions must still
authorize the session independently before reading or writing user data.

## Session and credential storage

- Auth.js owns the signed JWT session.
- Prisma owns users, OAuth accounts, and OTP challenges.
- Passwords use Node's `scrypt` with a unique random salt.
- OTP values are HMAC-hashed with `AUTH_SECRET`; plaintext codes are never
  stored.
- Codes expire after 10 minutes, allow at most five verification attempts, and
  are single-use.
- Requests are limited to one per minute and five per identifier per hour.

## OTP delivery

### Local development

The delivery adapter returns a development-only preview code. Production never
returns an OTP to the browser.

### Email production

Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM`. The adapter sends transactional OTP
email through Resend's HTTPS API.

### Phone production

SMS delivery is provider-neutral. Set `AUTH_SMS_WEBHOOK_URL` and
`AUTH_SMS_WEBHOOK_SECRET`. KASA sends this JSON payload to the configured
webhook:

```json
{
  "to": "+919876543210",
  "code": "123456",
  "purpose": "SIGN_IN",
  "brand": "KASA"
}
```

The webhook can later be backed by Firebase Phone Auth, MSG91, Twilio Verify,
or another India-compliant OTP provider without changing the UI or database.

## Production hardening before public launch

- Add IP/device rate limiting through Redis or the hosting edge platform.
- Add CAPTCHA after suspicious or repeated OTP requests.
- Add verified password reset and account recovery flows.
- Require email/phone verification for password-created accounts.
- Configure SMS templates and DLT registration for Indian transactional SMS.
- Add security-event audit records and user session management.
