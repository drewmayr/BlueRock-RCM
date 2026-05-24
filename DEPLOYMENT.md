# BlueRock RCM — Deployment Guide

Monorepo: backend → **Railway**, frontend → **Vercel**. Both are connected to GitHub (`drewmayr/BlueRock-RCM`, branch `main`) and auto-deploy on push. Because it's a monorepo, **each platform must point at the correct subfolder.**

---

## 1. Backend → Railway

**Service settings**
- **Root Directory:** `backend`  ← required (build fails without it)
- Build/Start/Healthcheck come from `backend/railway.json` (leave the override fields empty).

**Add a database:** Project canvas → **+ New → Database → PostgreSQL**.

**Variables** (backend service → Variables):
| Key | Value |
|-----|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `NODE_ENV` | `production` |
| `JWT_ACCESS_SECRET` | (64-char random hex) |
| `JWT_REFRESH_SECRET` | (64-char random hex, different) |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://blue-rock-rcm.vercel.app` |
| `EMAIL_FROM_NAME` | `BlueRock RCM` |

> `PORT` is injected by Railway automatically. Messaging keys (`TWILIO_*`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`) are optional and can also be set per-agency in the app's Settings → Providers.

**Deploy & domain:** it deploys on push. On start it runs `prisma migrate deploy` (creates all tables) then boots the API. Then **Settings → Networking → Generate Domain** to get a public URL like `https://bluerock-rcm-production.up.railway.app`.

**Verify:** `GET https://<railway-domain>/health` → `{"status":"ok"}`.

---

## 2. Frontend → Vercel

**Project settings → General**
- **Root Directory:** `frontend`  ← required (404s without it)
- Framework preset: Next.js (auto-detected).

**Environment Variables** (Settings → Environment Variables):
| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | your Railway backend URL, e.g. `https://bluerock-rcm-production.up.railway.app` |

> `NEXT_PUBLIC_*` vars are baked in at build time — set it, then **redeploy**.

**Deploy:** push or **Redeploy**. Visit `https://blue-rock-rcm.vercel.app`.

---

## 3. Wire the two together
1. Deploy backend → copy its Railway domain.
2. Set Vercel `NEXT_PUBLIC_API_URL` = that domain → redeploy frontend.
3. Set Railway `CORS_ORIGINS` = the Vercel domain → redeploy backend.

## 4. First login
Register an agency at `/register` (creates the owner + default automations), or run the seed (`npm run seed` in `backend` with `DATABASE_URL` set) for a starter owner login.

## 5. Go live with messaging
In the app: **Settings → Providers** → add Twilio (SMS) and/or Resend (email) credentials. Queued messages then send automatically — no redeploy needed.
