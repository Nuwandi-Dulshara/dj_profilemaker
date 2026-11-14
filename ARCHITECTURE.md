# ARCHITECTURE.md

## Technology Stack

- Frontend: React.js + TypeScript + Vite
- Styling: Tailwind CSS
- Backend: Django + Django REST Framework
- Database: PostgreSQL
- Authentication: Django authentication with secure sessions
- Code Editor: Monaco Editor
- Document Editor: Tiptap
- PDF Export: Playwright / Chromium
- DOCX Export: docx library
- Local AI: Optional Ollama
- Background Tasks: Celery + Redis

## Architecture

- Modular monolith
- React frontend communicates with Django REST APIs.
- Django manages authentication, permissions, projects, and data.
- PostgreSQL stores structured application data.
- Shared React Document Engine handles all CVs, CV templates, and cover letters.
- User-written React code must run in an isolated sandbox.
- Project files and uploads use private storage.
- Every user can access only authorized documents.
