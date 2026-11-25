# Advanced CV & Cover Letter Studio

A modern, professional CV and cover letter builder built with React, TypeScript, Django, and PostgreSQL. Create, customize, and manage your career documents with ease.

## Features

- **Advanced CV Builder** - Build and customize CVs with code, visual, and guided editing
- **CV Templates** - Browse ATS-friendly, modern, and creative templates
- **Cover Letter Builder** - Create job-targeted cover letters aligned with your CV
- **Project Management** - Organize projects in folders, favorites, and archives
- **User Profile** - Manage personal information, security, and preferences
- **Deleted Files** - Soft-delete and restore projects safely
- **Secure Authentication** - Session-based auth with CSRF protection

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router
- **Backend**: Django 5, Django REST Framework, PostgreSQL
- **Document Engine**: Shared React components for CV and cover letter rendering
- **Export**: PDF and DOCX generation

## Quick Start

### Frontend Development

Requires Node.js 22.16 or newer compatible release and npm.

```powershell
cd frontend
npm ci
npm run dev
```

Open the loopback URL printed by Vite. API requests under `/api` proxy to Django on `127.0.0.1:8000` when the backend is available.

### Backend Setup

Use a dedicated PostgreSQL database and role. Configure the root `.env` using `.env.example`; existing `.env` files must not be overwritten. Django loads that file automatically. Generate a random `DJANGO_SECRET_KEY` of at least 32 characters and supply your dedicated database credentials.

From the repository root:

```powershell
python -m venv .venv # only if the virtual environment does not exist
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

### Testing

```powershell
# Frontend tests
cd frontend
npm test
npm run build

# Backend tests
.\.venv\Scripts\python.exe backend/manage.py test accounts --noinput
.\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run
```

## Project Structure

```
├── backend/          # Django REST API
│   ├── accounts/     # Authentication and user management
│   ├── workspace/    # Projects, documents, and folders
│   └── config/       # Django settings
├── frontend/         # React TypeScript application
│   ├── src/
│   │   ├── app/      # Main app routing
│   │   ├── features/ # Feature modules (auth, cv, cover-letter, dashboard, profile)
│   │   └── services/ # API services
│   └── public/       # Static assets
└── README.md         # This file
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

- `DJANGO_SECRET_KEY` - Random secret key (32+ characters)
- `DATABASE_URL` - PostgreSQL connection string
- `TERMS_URL` - Terms of service URL
- `PRIVACY_URL` - Privacy policy URL
- `POLICY_VERSION` - Policy version identifier

### Local Development

For local development, implemented policies are available at `/terms` and `/privacy`. To use them for local registration, set the following in your root `.env` and restart Django:

```dotenv
TERMS_URL=http://127.0.0.1:5173/terms
PRIVACY_URL=http://127.0.0.1:5173/privacy
POLICY_VERSION=local-dev-2026-11-15
```

## License

This project is for educational and portfolio purposes. All rights reserved.
