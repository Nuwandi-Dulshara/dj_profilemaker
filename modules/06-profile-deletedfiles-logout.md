# 06 — User Profile, Deleted Files & Secure Logout

## Task
Build three fully functional modules for **Advanced CV & Cover Letter Studio**:
1. User Profile and Career Profile Vault
2. Deleted Files / Recycle Bin
3. Secure Logout

Integrate them with the Dashboard, Your Projects, Advanced CV Builder, CV Templates, and Cover Letter Builder.

## 1. Technology Stack
- Frontend: React + TypeScript + Vite, Tailwind CSS
- Backend: Django REST Framework, PostgreSQL
- Routing: React Router
- API: TanStack Query
- Forms: React Hook Form + Zod
- Icons: Lucide React

Use only free and open-source resources. Read `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`, `PROCESS.md`, and `PROGRESS.md` first. Reuse existing models, authentication, APIs, and components.

## 2. Design and Routes
- Match the existing dashboard design; primary color: `#0B1F3A`.
- Responsive layouts, accessible controls, loading states, and clear feedback.
- `/dashboard/profile` — User Profile and Career Profile Vault
- `/dashboard/deleted-files` — Deleted Files
- `/login` — Redirect destination after successful logout

## 3. User Profile
Create four sections:

### Personal Information
- Profile picture, name, display name, verified email change, phone, country, professional title, bio, LinkedIn, GitHub, and portfolio.
- Edit, save, cancel, validation, and success/error feedback.

### Career Profile Vault
- Personal details, summary, experience, education, technical/soft skills, projects, certifications, achievements, publications, research, volunteering, languages, awards, references, and custom sections.
- Add, edit, remove, reorder, and manage multiple entries; show profile completeness.
- Allow selective import into CVs and cover letters.
- Never silently overwrite existing documents when the master profile changes.

### Security
- Change password, email verification status, and supported session management.
- Offer 2FA only when fully implemented.
- Account deletion requires confirmation and appropriate reauthentication.

### Preferences
- Theme, CV page size, region, date format, editor settings, notifications, and default document settings.
- Save and apply preferences across the application.

## 4. Deleted Files / Recycle Bin
- Search, document filters, sorting, deleted dates, original folders, and responsive table/cards.
- Single and bulk restore or permanent delete.
- Soft-delete projects using `deleted_at` (and `deleted_by` if needed); preserve associated documents, files, and versions.
- Exclude deleted projects from active lists and include them in Deleted Files.
- Restore only owned projects; handle missing folders and refresh related dashboard counts/caches.
- Confirm permanent deletion and consistently clean up associated records/files; handle failures safely.
- Show actual retention rules only if implemented.
- Never show fake records or allow cross-user access.

## 5. Secure Logout
- Provide Logout in the sidebar footer and profile dropdown.
- Call the existing Django logout endpoint and invalidate the server-side session.
- After confirmed success, clear user-specific TanStack Query caches and sensitive client state; redirect to `/login`.
- Protect all dashboard routes from unauthenticated access.
- Preserve CSRF protections and existing secure cookie authentication when used.
- Handle logout errors honestly; never delete saved projects or career data during logout.

## 6. Backend APIs
Create or reuse equivalent endpoints following current conventions:

**Profile**
- `GET/PATCH /api/profile/`
- `POST /api/profile/avatar/`
- `GET/PATCH /api/career-profile/`
- `GET/PATCH /api/preferences/`

**Deleted Files**
- `GET /api/deleted-files/`
- `POST /api/deleted-files/:id/restore/`
- `DELETE /api/deleted-files/:id/permanent/`
- `POST /api/deleted-files/bulk-restore/`
- `POST /api/deleted-files/bulk-delete/`

**Authentication**
- `POST /api/auth/logout/`

Implement additional secure actions for career entries, password changes, and email verification as required. Enforce authentication, ownership, validation, and correct HTTP errors.

## 7. Database and Security
- Reuse existing users, profiles, career entries, projects, files, versions, notifications, and activity logs.
- Add database migrations only for genuinely missing fields or models.
- Validate avatar uploads, sensitive profile changes, and deletion permissions server-side.
- Use secure password handling, CSRF protection, and strict user data isolation.

## 8. Frontend Requirements
- Reuse `DashboardLayout`, shared forms, dialogs, and API clients.
- Use TanStack Query caching and invalidate affected queries after mutations.
- Add confirmation dialogs for destructive actions, loading/empty/error states, and success toasts only after confirmed completion.
- Ensure keyboard accessibility and mobile responsiveness.

## 9. Testing
Test profile editing and validation, career entry CRUD and imports, preference persistence, soft deletion, restore/permanent deletion, bulk operations, dashboard count updates, secure logout, protected routes, permissions, cross-user isolation, and API errors.

## 10. Implementation Order
1. User Profile, security settings, and preferences.
2. Career Profile Vault and document integrations.
3. Deleted Files and recovery/permanent deletion.
4. Secure Logout and route protection.
5. Accessibility, responsiveness, and testing.

## 11. Final Instructions
1. Inspect the existing repository; preserve unrelated features.
2. Reuse existing architecture; avoid duplicates and unnecessary migrations.
3. Make every enabled action functional; clearly label unavailable features.
4. Run frontend and backend tests and fix introduced errors.
5. Update `PROGRESS.md`; update `PROCESS.md` only if the workflow changes.
6. Summarize changed files, endpoints, migrations, tests, and remaining tasks.

**Important:** Career Profile Vault must remain the shared career-data source for CVs and cover letters without automatically overwriting existing documents. Deleted Files must support safe recovery, and logout must invalidate authentication server-side.
