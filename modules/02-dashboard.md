# 02 — Dashboard Page

## Task

Build a modern, professional, responsive, and fully functional dashboard for **Advanced CV & Cover Letter Studio**.

## 1. Technology Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Backend: Django REST Framework
- Database: PostgreSQL
- API: TanStack Query
- Routing: React Router
- Icons: Lucide React
- Use only free and open-source tools.

Follow `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`, `PROCESS.md`, and `PROGRESS.md`.

Reuse existing authentication, components, APIs, and models. Do not duplicate features.

## 2. Design

- Premium SaaS dashboard with a clean, light theme.
- Primary color: Navy Blue `#0B1F3A`.
- Match the existing home page design.
- Rounded cards, subtle shadows, and professional typography.
- Fully responsive for desktop, tablet, and mobile.
- Fast loading and accessible navigation.

## 3. Dashboard Layout

### Sidebar

Include these navigation items in order:

1. Dashboard
2. Your Projects
3. Advanced CV Builder
4. CV Templates
5. Cover Letter Builder
6. User Profile
7. Deleted Files
8. Logout

Support active highlighting, icons, desktop collapse/expand, and a mobile drawer.

### Header

- Current page title
- Project search
- Notifications with unread count
- User avatar and actual username
- Profile dropdown and logout

## 4. Dashboard Features

### Welcome Section

- Display: "Welcome back, [User Name]!"
- Subtitle: "Your career documents, projects, and opportunities — all in one place."
- **+ New Project** button.

### Statistics Cards

Display real user-specific counts:

- Total Projects
- Advanced CVs
- Template-Based CVs
- Cover Letters
- Deleted Files

### Quick Actions

- Create Advanced CV
- Choose CV Template
- Create Cover Letter

Navigate to the existing creation workflows.

### Recent Projects

Show recently edited projects with:

- Title, type, modified date, and favorite status
- Continue Editing
- Rename, duplicate, favorite, move to folder, archive, and delete
- View All Projects

### New Project Modal

Provide three options:

- Advanced CV Builder
- CV Templates
- Cover Letter Builder

Reuse existing creation logic.

### Recent Activity

Display actual project activities with timestamps. Show an empty state if no activity exists.

### Career Profile Vault

Display profile completion using:

- Personal Details
- Professional Summary
- Experience
- Education
- Skills
- Projects
- Certifications

Include an Edit Career Profile button. Existing documents must not be automatically overwritten when the master profile changes.

### Notifications

Support export completion, failed autosaves, comments, feedback, and important events. Include mark-as-read functionality.

### Storage

Display actual storage usage and configured quota (if available).

## 5. Backend APIs

Create or reuse:

- `GET /api/dashboard/summary/`
- `GET /api/dashboard/recent-projects/`
- `GET /api/dashboard/activity/`
- `GET /api/dashboard/storage/`
- `GET /api/notifications/`

Add or reuse secure endpoints for project actions and notification updates.

Requirements:

- Authentication required
- Strict user data isolation
- Optimized queries and pagination
- Proper permissions and error handling
- No unnecessary migrations

## 6. Frontend Requirements

- React Router navigation and protected routes
- TanStack Query for API data and caching
- Loading skeletons and empty states
- Search with debounce
- Accessible modals and dropdowns
- Working project actions
- Delete confirmations
- Toast notifications after successful operations
- Consistent date formatting
- Reusable components

## 7. Performance and Security

- Lazy-load heavy CV editors.
- Do not initialize Monaco Editor on the dashboard.
- Keep API responses lightweight.
- Avoid unnecessary requests and re-renders.
- Protect all user data and project operations.
- Use secure authentication handling.
- Never execute arbitrary user React code.

## 8. Testing

Test:

- Authentication and protected routes
- Dashboard statistics
- User data isolation
- Project actions and navigation
- Modal functionality
- Responsive layouts
- Loading, empty, and error states
- API permissions

## 9. Final Instructions

1. Inspect the existing project before coding.
2. Preserve the existing home, login, and registration pages.
3. Build reusable dashboard components.
4. Connect all features to real Django APIs.
5. Never display fake user records.
6. Do not create duplicate pages, APIs, or project workflows.
7. Keep unimplemented features honestly disabled.
8. Run tests and fix errors.
9. Update `PROGRESS.md` with completed and pending work.
10. Update `PROCESS.md` only if the workflow changes.
11. Summarize changed files, APIs, migrations, tests, and remaining tasks.

**Important:** All Advanced CVs, CV Templates, and Cover Letters must use the existing shared React-based document creation, editing, rendering, and live preview architecture.
