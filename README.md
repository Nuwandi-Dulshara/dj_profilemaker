# Profile Studio

A Django REST API and React/TypeScript application for building public professional profiles and editable CVs.

## Features and structure

- Profile editing, portfolio templates, public sharing, QR codes and professional A4 resume downloads.
- HTML/CSS CV editing with isolated previews, optional cropped profile photos and photo-free export mode.
- Google Drive source storage, PDF download/sharing, and Google Drive/OneDrive PDF exports.
- Document imports, deterministic CV/job-description analysis and optional AI suggestions that require review.

| Directory | Responsibility |
|---|---|
| `backend/accounts/` | Authentication and account APIs |
| `backend/profiles/` | Profiles, public sharing and resume PDFs |
| `backend/cvbuilder/` | CV rendering, cloud storage, imports and analysis |
| `backend/config/` | Django configuration and isolated test settings |
| `frontend/src/` | React pages, components and CV workspace |
| `frontend/tests/` | Frontend unit tests and browser fixture |

## Local development

The existing environment uses Python 3.11 and Node 22. Use MySQL for normal development; automated tests use isolated SQLite. Install MySQL client build prerequisites if required by your operating system.

PowerShell, from the repository root:

```powershell
cd backend
python -m venv venv
venv/Scripts/python.exe -m pip install -r requirements.txt
# For a new checkout only; preserve any existing .env.
Copy-Item .env.example .env
# Edit .env: set a unique SECRET_KEY and your MySQL connection details.
# Create the database named by DB_NAME in MySQL before migrating.
venv/Scripts/python.exe manage.py migrate
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.playwright"
venv/Scripts/python.exe -m playwright install chromium
venv/Scripts/python.exe manage.py runserver
```

In a second terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/media` to Django on port 8000. On Unix, use `venv/bin/python`, `npm`, and the equivalent environment-variable syntax. Keep `PLAYWRIGHT_BROWSERS_PATH` set to the same absolute installation directory when launching the backend.

See [backend/.env.example](backend/.env.example) for OAuth, token encryption, OCR, optional AI, and upload settings. Basic profile editing does not require cloud accounts. CV source saving and its saved-version exports require Google Drive configuration.

## Testing and maintenance

```powershell
cd backend
venv/Scripts/python.exe -m pip install -r requirements-test.txt
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.playwright"
# Optional: isolate the browser suite from another local Vite process.
$env:CV_BROWSER_TEST_PORT = "5188"
venv/Scripts/python.exe manage.py test accounts profiles cvbuilder --settings=config.test_settings --noinput
venv/Scripts/python.exe manage.py makemigrations --check --dry-run --settings=config.test_settings
venv/Scripts/python.exe -m cvbuilder.benchmark
venv/Scripts/python.exe -m profiles.check_resume_sample
```

From `frontend`, run `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run lint`. The build type-checks the frontend. Browser tests need installed frontend dependencies and Chromium; cloud/AI transport is mocked. Generated screenshots, PDF samples and benchmark output belong in the ignored `artifacts/` directory and can be regenerated.

`backend/test_e2e.py` is a separate legacy live-server smoke script. It requires seeded test credentials and changes account/profile data; use only against a disposable development database. It is retained alongside the isolated automated suites.

Repository-wide ESLint currently reports existing issues in account/context/dashboard code and Builder typing. Vite reports a large CV/editor bundle. Neither warning should be represented as a clean lint or bundle-size result.

## Deployment and limitations

Build the frontend with `npm.cmd ci` and `npm.cmd run build`; deploy `frontend/dist/` with SPA fallback routing. Proxy `/api` and `/media` to Django. Configure a production WSGI/ASGI server, MySQL, HTTPS, `DEBUG=False`, `ALLOWED_HOSTS`, `FRONTEND_URL`, secure secrets, media/static storage and exact OAuth callback URLs. Provision matching Chromium and, if needed, Tesseract. Review migrations and backups before applying them to a real database. No turnkey production deployment configuration is included.

CV analysis scores are deterministic heuristics, not an ATS emulator; imported layouts can be approximations, and AI output requires factual review. Real OAuth permissions, OCR quality and configured AI providers require environment-specific smoke tests. Photo-free mode excludes the photo managed by the photo controls; arbitrary images in authored HTML remain the author's responsibility.

## Development provenance

This project has used AI-assisted development, including Codex assistance with CV enhancements, resume PDF output, photo controls and repository maintenance. The implementation builds on the existing Django/React application and third-party libraries. Git commits, authorship, migrations, tests and source history have not been rewritten.
