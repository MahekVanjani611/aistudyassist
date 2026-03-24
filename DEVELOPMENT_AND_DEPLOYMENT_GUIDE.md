# StudentsAI: Local Development Setup + Deployment Guide

This guide gives you a practical path to:
1. **Run the project locally for development**
2. **Deploy backend + frontend to production**

It is tailored to the current codebase structure (`backend/` + `frontend/`) and current runtime assumptions.

---

## Part 1 — Local Development Setup (Detailed)

## 0) Prerequisites

Install these first:
- **Git**
- **Python 3.11+** (recommended for backend)
- **Node.js 18+** (Next.js frontend)
- **npm** (comes with Node)
- **PostgreSQL 14+**
- (Optional) **Redis** for enhanced rate limiting path

You can run PostgreSQL either natively or via Docker.

---

## 1) Clone the repository

```bash
git clone <your-repo-url> studentsai
cd studentsai
```

---

## 2) Start PostgreSQL locally

## Option A: Native PostgreSQL
Create a DB and user (example):
```sql
CREATE DATABASE studentsai_db;
CREATE USER studentsai_user WITH PASSWORD 'admin';
GRANT ALL PRIVILEGES ON DATABASE studentsai_db TO studentsai_user;
```

## Option B: Docker (quickest)
```bash
docker run --name studentsai-postgres \
  -e POSTGRES_DB=studentsai_db \
  -e POSTGRES_USER=studentsai_user \
  -e POSTGRES_PASSWORD=studentsai_pass \
  -p 5432:5432 -d postgres:14
```

Connection string for both examples:
```text
postgresql://studentsai_user:studentsai_pass@localhost:5432/studentsai_db
```

---

## 3) Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3.1) Create backend environment file
Create `backend/.env` with at least:

```env
# Core
DATABASE_URL=postgresql://studentsai_user:admin@localhost:5432/studentsai_db
SECRET_KEY=change-this-in-real-env
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ENVIRONMENT=development
DEBUG=true
HOST=0.0.0.0
PORT=8000

# Frontend URL (used in email links)
FRONTEND_URL=http://localhost:3000

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# AI
OPENAI_API_KEY=your-openai-key
AI_REQUESTS_PER_HOUR=100
DAILY_AI_REQUEST_LIMIT=100

# Email / SendGrid
MAIL_FROM=your-email@example.com
SENDGRID_API_KEY=your-sendgrid-key
VERIFICATION_TOKEN_EXPIRE_MINUTES=1440

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Optional Redis
REDIS_URL=redis://localhost:6379/0
```

> Notes:
> - `GOOGLE_REDIRECT_URI` should be the backend callback route, not frontend.
> - If you skip OpenAI/SendGrid for first run, some features will fail gracefully, but app can still boot.

## 3.2) Run database migrations
From `backend/`:
```bash
alembic upgrade head
```

(Startup also calls `create_tables()`, but use Alembic as the source of truth.)

## 3.3) Start backend server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Check health:
- `http://localhost:8000/health`
- `http://localhost:8000/docs` (when `DEBUG=true`)

---

## 4) Frontend setup

Open new terminal:
```bash
cd frontend
npm install
```

## 4.1) Create frontend env file
Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
# Optional alias used by API client:
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

## 4.2) Start frontend
```bash
npm run dev
```

Open:
- `http://localhost:3000`

---

## 5) First local smoke test flow

1. Open landing/auth page.
2. Register a user.
3. If email is configured, verify via link.
4. Login.
5. Create a note.
6. Generate summary and flashcards.
7. Open graph/profile/settings pages.

If you don’t configure SendGrid, verification-dependent flows will block password login unless you mark user as verified in DB manually during local testing.

---

## 6) Useful local dev commands

### Backend
```bash
cd backend
source .venv/bin/activate
pytest
```

### Frontend
```bash
cd frontend
npm run lint
npm run build
```

---

## 7) Common local issues

## Port conflicts
- Backend must be reachable at `:8000`
- Frontend at `:3000`

## CORS failures
- Ensure backend `ALLOWED_ORIGINS`/`BACKEND_CORS_ORIGINS` include your frontend URL.

## OAuth callback mismatch
- Google OAuth redirect URI in Google Console must exactly match `GOOGLE_REDIRECT_URI`.

## DB migration errors
- Ensure `DATABASE_URL` is correct and Postgres is running.
- Re-run: `alembic upgrade head`.

---

## Part 2 — Deployment Guide (Backend + Frontend)

Recommended stack (aligned with project docs/history):
- **Backend:** Railway
- **Frontend:** Vercel
- **Database:** Railway PostgreSQL (or external managed Postgres)

---

## 1) Deploy backend to Railway

## 1.1) Create Railway project
1. Go to Railway and create a new project from GitHub repo.
2. Configure service root to `backend/`.

## 1.2) Add PostgreSQL service
1. Add PostgreSQL plugin/service in Railway project.
2. Use generated `DATABASE_URL` in backend service env vars.

## 1.3) Set backend environment variables
Set all required vars in Railway backend service:

```env
DATABASE_URL=<railway-postgres-url>
SECRET_KEY=<strong-random-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
VERIFICATION_TOKEN_EXPIRE_MINUTES=1440

ENVIRONMENT=production
DEBUG=false
HOST=0.0.0.0
PORT=8000

FRONTEND_URL=https://<your-frontend-domain>
BACKEND_CORS_ORIGINS=["https://<your-frontend-domain>"]
ALLOWED_ORIGINS=https://<your-frontend-domain>

OPENAI_API_KEY=<prod-openai-key>
AI_REQUESTS_PER_HOUR=100
DAILY_AI_REQUEST_LIMIT=100

SENDGRID_API_KEY=<sendgrid-key>
MAIL_FROM=<verified-sender@domain.com>

GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=https://<your-backend-domain>/auth/google/callback

REDIS_URL=<optional-redis-url>
```

## 1.4) Start command
Use:
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## 1.5) Run migrations in production
After first deploy, run:
```bash
alembic upgrade head
```

Run this via Railway shell/one-off command for backend service.

## 1.6) Validate backend
- `GET https://<backend-domain>/health`
- `DEBUG=false` should hide `/docs` and `/redoc`

---

## 2) Deploy frontend to Vercel

## 2.1) Import project
1. Import GitHub repo in Vercel.
2. Set **Root Directory** to `frontend/`.

## 2.2) Set environment variables
In Vercel project settings:

```env
NEXT_PUBLIC_API_URL=https://<your-backend-domain>
NEXT_PUBLIC_API_BASE=https://<your-backend-domain>
```

## 2.3) Build settings
Defaults usually work:
- Install: `npm install`
- Build: `npm run build`
- Output: Next.js standard

## 2.4) Deploy and validate
- Open frontend domain
- Test auth + note CRUD + AI + flashcards + graph

---

## 3) Configure Google OAuth in production

In Google Cloud Console:
1. Add authorized JavaScript origins:
   - `https://<your-frontend-domain>`
   - (optional) `https://<your-backend-domain>`
2. Add authorized redirect URI:
   - `https://<your-backend-domain>/auth/google/callback`

Keep this in sync with `GOOGLE_REDIRECT_URI` on Railway.

---

## 4) Configure email sender (SendGrid)

1. Verify sender/domain in SendGrid.
2. Set `SENDGRID_API_KEY` and `MAIL_FROM` on backend.
3. Test with backend endpoint(s) or real signup flow.

---

## 5) Production hardening checklist

- [ ] `DEBUG=false`
- [ ] Strong `SECRET_KEY`
- [ ] CORS restricted to frontend domain only
- [ ] HTTPS-only public URLs
- [ ] DB migrations applied
- [ ] SendGrid sender verified
- [ ] Google OAuth redirect URI exact
- [ ] Monitoring/logging enabled
- [ ] Backup strategy for PostgreSQL

---

## 6) Image upload strategy in production

Current app stores uploads on backend filesystem (`/uploads`), which is usually **not durable** on many PaaS environments.

For durable production, implement S3/R2 presigned uploads.
See existing plan in:
- `docs/image-upload-production.md`

---

## 7) Suggested production architecture

- Frontend (Vercel) → Backend API (Railway)
- Backend API ↔ PostgreSQL (Railway)
- Backend API → OpenAI + SendGrid + (optional Redis)
- Optional object storage for uploads (S3/R2)

---

## 8) Quick deploy order (recommended)

1. Deploy backend service + DB.
2. Set backend env vars.
3. Run `alembic upgrade head`.
4. Deploy frontend with backend URL env.
5. Update backend `FRONTEND_URL` and CORS to real frontend URL.
6. Configure Google OAuth + SendGrid.
7. End-to-end smoke test.

---

If you want, next step I can create ready-to-copy `backend/.env.example` and `frontend/.env.example` files in this repo so onboarding becomes one-command setup.