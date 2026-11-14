Task: Build Your Projects Page — Advanced CV & Cover Letter Studio

Project Goal

Create a modern, professional, responsive and fully functional Your Projects page for the existing Advanced CV & Cover Letter Studio.

This page must serve as the central project management workspace for:

Advanced CVs

Template-based CVs

Cover Letters

Users must be able to create, organize, search, filter, open, rename, duplicate, favorite, archive, share and soft-delete their projects.

1. Technology Stack

React + TypeScript + Vite

Tailwind CSS or existing styling

Django + Django REST Framework

PostgreSQL

React Router

TanStack Query

Lucide React

React Hook Form + Zod

dnd-kit where drag-and-drop is appropriate

Use only free and open-source technologies.

2. Repository Instructions

Before development:

Read AGENTS.md.

Read PROJECT.md.

Read ARCHITECTURE.md.

Read PROCESS.md.

Read PROGRESS.md.

Inspect existing dashboard and navigation.

Inspect project-related models and APIs.

Reuse existing authentication and project services.

Follow the established UI design system.

Preserve the navy blue primary color #0B1F3A.

Do not create duplicate project management systems or unnecessarily modify unrelated pages.

3. Your Projects Page

Route:

/dashboard/projects

Create a professional page with:

Page title: Your Projects

Short description

New Project button

Project statistics

Search

Project type filters

Folder filters

Sorting

List/Grid view toggle

Project actions

Pagination

Empty states

Use real authenticated project data.

4. Project Statistics

Display:

Total Active Projects

Favorites

Archived Projects

Optionally include project counts by document type.

All statistics must come from the backend and remain consistent with dashboard totals.

Do not include deleted projects in the active-project count.

5. New Project Modal

Reuse the existing Dashboard New Project modal.

Provide:

Advanced CV Builder

CV Templates

Cover Letter Builder

Each action must navigate to the correct existing creation workflow.

Do not duplicate the project creation logic.

6. Projects Table

Display:

Selection checkbox

Project name

Project type

Folder

Last modified date

Favorite status

Actions menu

Support:

Pagination

Search

Sorting

Filtering

Opening projects

Multi-selection

Use clear type labels and appropriate icons.

7. Grid View

Provide an alternative project card layout.

Each card should contain:

Project name

Document type

Optional actual project thumbnail

Last modified date

Favorite action

Continue Editing action

More actions menu

Do not generate fake previews for existing documents.

Use a document-type placeholder if an actual thumbnail is unavailable.

8. Project Navigation

Open projects based on their type.

Advanced CV:
/dashboard/advanced-cv/:projectId

Template CV:
/dashboard/advanced-cv/:projectId

Cover Letter:
/dashboard/cover-letters/:projectId

Template-based CVs must preserve their saved template configuration.

Never open a project in the wrong editor.

9. Project Actions

Implement:

Rename

Allow users to change the project title.

Duplicate

Create an independent copy containing the necessary document data and authorized project assets.

Favorites

Allow users to add or remove projects from favorites.

Move to Folder

Allow users to organize projects into existing folders.

Archive

Allow users to archive projects without deleting their data.

Unarchive

Return archived projects to active project listings.

Version History

Open the existing document version history workflow.

Share

Reuse the existing secure document-sharing infrastructure where implemented.

Delete

Perform soft deletion and move the project to Deleted Files.

All operations must enforce user ownership.

10. Folder Management

Implement:

Create Folder

Create Subfolder

Rename Folder

Move Folder

Move Project

Folder Navigation

Folder Search

Folder Tree

Empty Folder State

Do not allow invalid folder hierarchies or cyclic moves.

Validate folder ownership server-side.

11. Search, Filters and Sorting

Search by project name.

Filter by:

All Types

Advanced CV

CV Template

Cover Letter

Favorites

Archived

Folder

Sort by:

Recently Modified

Recently Created

Name A–Z

Name Z–A

Project Type

Allow filters to work together.

Use URL query parameters where useful and avoid resetting filters unnecessarily.

12. Bulk Actions

Support selection of multiple projects.

Provide:

Add to Favorites

Remove from Favorites

Move to Folder

Archive

Soft Delete

Show confirmation for destructive bulk actions.

Display accurate success, failure, and partial failure feedback.

Avoid leaving frontend state inconsistent after failed requests.

13. Deleted Files Integration

When a project is deleted:

Verify ownership.

Mark the project as deleted.

Save its deletion timestamp.

Remove it from active-project listings.

Show it on the existing Deleted Files page.

Preserve document content, version history and associated assets.

Update dashboard statistics and project caches.

Do not permanently delete projects from Your Projects.

Permanent deletion must use the dedicated Deleted Files workflow.

14. Archive Functionality

Archived projects must remain saved.

Provide a filter or separate view for archived projects.

Users should be able to:

Open an archived project

Unarchive it

View its metadata

Move it to Deleted Files

Keep archive status separate from deletion status.

15. Backend Requirements

Implement or reuse API endpoints equivalent to:

GET /api/projects/

POST /api/projects/

GET /api/projects/:id/

PATCH /api/projects/:id/

POST /api/projects/:id/duplicate/

DELETE /api/projects/:id/

GET /api/project-folders/

POST /api/project-folders/

PATCH /api/project-folders/:id/

POST /api/projects/bulk-actions/

Follow existing REST API conventions.

Use authenticated Django REST Framework views.

Apply ownership checks to every operation.

Support server-side search, filtering, ordering and pagination.

16. Database Requirements

Reuse existing PostgreSQL models:

projects

project_folders

project_files

documents

document_versions

project_shares

activity_logs

Ensure project metadata supports:

UUID

Owner

Title

Type

Folder

Favorite status

Archive status

Deletion timestamp

Created timestamp

Updated timestamp

Create database migrations only where necessary.

Do not duplicate document storage.

17. Frontend State and Performance

Use TanStack Query for:

Project listing

Project details

Folder listing

Statistics

Mutations

Cache invalidation

Optimize by:

Debouncing search

Using server-side pagination

Avoiding unnecessary rerenders

Lazy-loading heavy project editors

Loading thumbnails only when needed

Reusing dashboard project services

Project listing must not initialize the Monaco Editor or compile CV documents.

18. Responsive Design

Desktop:

Sidebar

Statistics cards

Search and filters

Table/Grid view

Folder navigation

Tablet:

Collapsible folder navigation

Responsive project cards

Mobile:

Search

Compact filters

Project cards

Accessible actions

Mobile-friendly modals

Avoid horizontal overflow.

19. Security

Protect the route with authentication.

Verify project ownership server-side.

Prevent cross-user access.

Validate project and folder identifiers.

Restrict unauthorized sharing.

Prevent unsafe file and folder operations.

Protect destructive actions.

Use existing session and CSRF protections.

Never rely only on frontend filtering for access control.

20. Testing

Test:

Project listing

Project creation navigation

Search

Filtering

Sorting

Pagination

Grid/List switching

Rename

Duplicate

Favorites

Folder creation

Folder movement

Archive/Unarchive

Bulk actions

Soft deletion

Deleted Files integration

Project editor navigation

Ownership restrictions

API errors

Empty states

Responsive layouts

Verify projects remain accessible after refresh and sign-in.

21. Implementation Phases

Phase 1 — Foundation

Create route, layout, statistics, project listing and new project modal.

Phase 2 — Project Operations

Implement open, rename, duplicate, favorites and archive.

Phase 3 — Folders

Build folder management, folder navigation and project movement.

Phase 4 — Search and Bulk Operations

Add search, filters, sorting, pagination, multi-selection and bulk actions.

Phase 5 — Module Integration

Connect Advanced CV Builder, CV Templates, Cover Letter Builder, Dashboard and Deleted Files.

Phase 6 — Advanced Features

Integrate secure sharing, version history and storage overview where supported.

Phase 7 — Quality

Complete testing, responsive design, accessibility, security and performance optimization.

22. Completion Requirements

After implementation:

Run relevant frontend and backend tests.

Fix introduced errors.

Confirm all enabled buttons work.

Verify every project opens in the correct editor.

Confirm user-specific project isolation.

Verify Deleted Files integration.

Ensure existing application features remain intact.

Update PROGRESS.md.

Follow PROCESS.md.

Summarize implemented features, files, migrations, API changes, tests and outstanding limitations.

Do not mark unfinished features as completed.

Final Goal: Build a complete, secure and responsive project management workspace that manages every CV and cover letter in one place, using the application's existing Django backend, PostgreSQL database and shared React document infrastructure.
