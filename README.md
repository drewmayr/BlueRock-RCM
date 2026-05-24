# BlueRock RCM

**Relationship automation CRM for life insurance agencies** — recruiting & aged-lead revival, client retention, automated follow-ups, cross-selling, and referrals.

BlueRock RCM is a multi-agency SaaS built specifically for the life insurance industry. It combines a recruiting pipeline (with automatic revival of inactive/aged recruiting leads) and a long-term client relationship engine (birthdays, anniversaries, policy/renewal dates, family details, retirement goals) that automatically sends personalized outreach, surfaces cross-sell opportunities, and drives referrals.

## Architecture

| Layer | Tech | Deploys to |
|-------|------|------------|
| **Backend API** (`/backend`) | Node + Express + TypeScript, Prisma ORM, PostgreSQL, JWT auth, node-cron automation engine, Twilio (SMS) + Resend (email) | **Railway** |
| **Frontend** (`/frontend`) | Next.js (App Router) + TypeScript + Tailwind CSS | **Vercel** |

Everything is wired end-to-end against a real Postgres database and a real REST API — no mock data. The automation engine composes and schedules real messages into an outbox; SMS/email physically send the moment Twilio/Resend credentials are added (per-agency or server-wide), with zero code changes.

## Core features

- **Multi-agency tenancy** — every record scoped to an agency; roles: Owner / Manager / Agent.
- **Recruiting pipeline** — stages from New → Hired, with automatic **aged-lead detection & revival** sequences.
- **Client relationships** — life details (birthday, anniversary, family, retirement goals), policies, life events.
- **Automation sequences** — multi-step SMS/Email/Task workflows with `{{variable}}` templating and triggers: aged lead, contact created, status change, policy sold, birthday, anniversary, renewal, manual.
- **Cross-sell detection** — rules engine that surfaces opportunities from policy gaps + life events.
- **Referrals** — capture, track, and convert referrals into client leads.
- **Outbox** — every automated/manual message logged with delivery status.
- **Dashboard** — pipeline counts, active policies, annualized premium, cross-sell pipeline value, tasks, and recent activity.

## Local development

### Backend
```bash
cd backend
cp .env.example .env          # set DATABASE_URL + JWT secrets
npm install
npx prisma migrate dev        # create schema
npm run seed                  # optional: owner login + default automations
npm run dev                   # http://localhost:4000
```

### Frontend
```bash
cd frontend
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                    # http://localhost:3000
```

## Deployment

- **Backend → Railway**: provision a PostgreSQL plugin, set env vars (see `backend/.env.example`), run `prisma migrate deploy`. Start command: `npm start`.
- **Frontend → Vercel**: set `NEXT_PUBLIC_API_URL` to the Railway API URL. Root directory: `frontend`.

See `DEPLOYMENT.md` for step-by-step instructions and the live URLs.

## Messaging providers

The engine activates real delivery when these are configured (per-agency in Settings, or server-wide via env):

- **Twilio** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- **Resend** — `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`

Until then, messages are composed and parked in the outbox as `QUEUED`, and send automatically once credentials are present.
