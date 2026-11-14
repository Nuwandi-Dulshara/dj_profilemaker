# Advanced CV & Cover Letter Studio

React + TypeScript + Vite frontend and planned Django REST Framework/PostgreSQL backend. Implementation follows `modules/00-home-page.md` through `modules/07-your-projects.md`; see `PROGRESS.md` for verified status. This repository is under active construction, not a production-ready application.

## Frontend development

Requires Node.js 22.16 or newer compatible release and npm.

```powershell
cd frontend
npm ci
npm run dev
```

Open the loopback URL printed by Vite. API requests under `/api` proxy to Django on `127.0.0.1:8000` when the backend is available. No authentication credentials are stored in browser localStorage.

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start Vite automatically and write screenshots/traces into ignored `frontend/test-results/`. The original authentication photograph is retained in `frontend/public/images/auth/tropical-sea.png`.

## Backend configuration

Module 01 has a Django authentication backend; database/browser verification is still pending. Use a dedicated PostgreSQL database and role. Configure the root `.env` using `.env.example`; existing `.env` files must not be overwritten. Django loads that file automatically. Generate a random `DJANGO_SECRET_KEY` of at least 32 characters and supply your dedicated database credentials. Never commit credentials or point tests at another application's database.

From the repository root:

```powershell
python -m venv .venv # only if the virtual environment does not exist
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

Verification requires PostgreSQL to be running. Django creates a separate test database; the development test role needs permission to create it. Browser tests prepare a dedicated `cv_studio_e2e` database using explicit test-only policy links and a file email backend, then start Django on port 18000 and Vite on 5173.

```powershell
$env:PGCONNECT_TIMEOUT = '3'
.\.venv\Scripts\python.exe backend/manage.py test accounts --noinput
.\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run
cd frontend
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

On this Windows host, use `npm.cmd` if PowerShell blocks `npm.ps1`. The existing ignored local cluster is PostgreSQL 17 format, but its recorded version-17 executable is currently missing. Restore compatible binaries or provision a separate dedicated database before database/browser tests. Preserve the existing data directory; do not start a different major PostgreSQL version against it.

Registration is intentionally disabled until genuine published `TERMS_URL`, `PRIVACY_URL`, and `POLICY_VERSION` are configured. Local password-reset links use the console email backend by default; this does not deliver email. Production SMTP and legal policies require deployment-owner configuration. Redis/Celery, exports and optional analysis services remain later-module work.

For local development, implemented policies are available at `/terms` and `/privacy`. To use them for local registration, set the following in your root `.env` and restart Django, then refresh the registration page:

```dotenv
TERMS_URL=http://127.0.0.1:5173/terms
PRIVACY_URL=http://127.0.0.1:5173/privacy
POLICY_VERSION=local-dev-2026-11-15
```

These pages explicitly describe development use and fictional test data. Replace them and the configuration before a public launch.

## Development rules

Read `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`, `PROCESS.md` and the relevant module specification before changes. Reuse the shared document engine and project services, and update `PROGRESS.md` with actual verification results. Do not mark planned or untested features complete.
