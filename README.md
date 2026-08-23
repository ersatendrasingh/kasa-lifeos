# LifeOS

LifeOS is a personal operating system for understanding and maintaining the
daily activities that shape a person's life.

## Foundation

- Next.js 16 App Router with TypeScript and React Compiler
- Root-level `app/` directory (no `src/`)
- Tailwind CSS v4 and the complete shadcn/ui component registry
- PostgreSQL 17 and Prisma ORM
- Auth.js / NextAuth v5 with Prisma-backed database sessions
- Google and GitHub OAuth provider foundations
- ESLint, Prettier, strict TypeScript, and production build checks

## Local setup

1. Copy `.env.example` to `.env` and set a secure `AUTH_SECRET`.
2. Start PostgreSQL with `npm run db:up`.
3. Apply the committed initial migration with `npm run db:deploy`.
4. Start LifeOS with `npm run dev`.

The app runs at [http://localhost:3000](http://localhost:3000). OAuth callback
URLs use `/api/auth/callback/google` and `/api/auth/callback/github`.

## Useful commands

```bash
npm run dev
npm run check
npm run build
npm run db:generate
npm run db:migrate
npm run db:studio
```

Generated Prisma Client code lives in `app/generated/prisma` and is excluded
from Git. It is regenerated automatically after dependency installation.
