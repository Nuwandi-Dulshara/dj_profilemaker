# Advanced CV & Cover Letter Studio implementation design

Status: approved by the user on 2026-11-14; implementation is in progress.

## Authority and intended outcome

AGENTS.md, PROJECT.md, ARCHITECTURE.md, PROCESS.md and all eight module specifications are authoritative. This design adds implementation decisions; it does not replace or reduce their requirements. Build a private career-document workspace with real session authentication, persisted projects, React document editing, analysis, exports and recovery. No fake user data, success messages, statistics or nonfunctional enabled actions.

## Existing state

The repository contains instructions, module specifications and the supplied tropical-sea.png. No existing application source, package manifests or migrations were found. Preserve these files and the original photograph. Node 22.16.0, Python 3.11.9 and PostgreSQL tools are installed. PostgreSQL responds on the default port; credentials and permission to create a dedicated application/test database are not yet verified. Docker is installed but its daemon is unavailable to this session. Do not depend on Docker for local development.

## Approach

Use the explicitly requested modular monolith: React + TypeScript + Vite + Tailwind, Django REST Framework, PostgreSQL and Django secure sessions. A separate application for each editor would duplicate projects and exports; a frontend-only prototype would not meet persistence and security requirements. Neither is proposed. Preserve the selected architecture and deliver sequentially by module.

Shared backend services needed by an earlier module are implemented and tested as that module's dependencies. Later modules reuse them. This resolves the dashboard's dependency on projects, notifications, profile summaries and deletion without building unrelated later screens. Cross-module workflows receive final integration tests after their destination modules exist. A module with pending required integrations remains explicitly incomplete.

## Source organization

- frontend/src/app: routing, providers, session bootstrap and protected routes.
- frontend/src/features: home, auth, dashboard, projects, cv, templates, letters, profile and deleted-files.
- frontend/src/components and services: accessible controls, forms, dialogs, dashboard shell, API client and shared query keys.
- frontend/src/document-engine: typed content/design schemas, React document components, pagination, print layout and export serialization. All document pages render through React.
- backend/config: environment-based settings, URLs, ASGI/WSGI and Celery configuration.
- backend/apps: accounts, profiles, projects, documents, templates, analysis, exports and notifications. Keep business operations in shared services rather than duplicating them in views.
- tests and deployment documentation: reproducible setup, database-backed backend tests, component tests and browser integration tests.

## Shared data and API contracts

Establish an email-based user model before initial migrations. Normalize email and enforce uniqueness in the database. Profile, preferences and career-vault records belong to the user. Career data uses a validated versioned schema with stable entry identifiers and ordering; imports explicitly select entries and copy data into a document snapshot.

Projects use UUIDs, owner, title, document type, folder, favorite/archive flags, deletion timestamp and timestamps. One associated document stores schema version, structured content, validated design configuration and revision counter. Source files and private assets are separate project-owned records. Versions snapshot content, design and required source-file references. Shared project services implement creation, duplication, folders, archives, soft deletion and permanent cleanup.

Folders validate ownership and prevent cycles. Duplication copies authorized assets independently. All object lookups scope to the authenticated owner or an explicit sharing permission. Bulk operations have documented transaction semantics and accurate failure feedback. Database transactions protect mutations; unique constraints and idempotency keys prevent duplicate creation.

Implement the equivalent endpoint groups specified in every module. Server-side search, filtering, ordering and bounded pagination serve lists. Autosave requires an expected revision and returns conflict responses for stale writes. Version restoration creates a new revision and retains history. API errors include useful field errors without exposing private records.

## Frontend and document behavior

Use the specified navy/light-blue/bright-blue/black/white interface palette, accessible focus states, reduced-motion support and responsive navigation. Reuse the exact sea image and one coastline-edge authentication layout across all four auth screens. Build the home illustration with React/CSS and label sample template data.

TanStack Query manages server state and mutation invalidation. React Hook Form and Zod validate forms; the backend independently validates all input. Lazy-load Monaco, Tiptap and heavy previews. Dashboard and project lists do not initialize editors. Shared dialogs handle confirmation, focus trapping and return focus. Search is debounced and project filters persist in URL parameters.

The React document engine separates typed CV/letter content from design. Guided and visual editing share that content; arbitrary source edits are never silently rewritten. Support A4/Letter, page boundaries, explicit breaks and multi-page layout. Create the twelve CV templates and six letter templates listed in their specifications as original React designs using shared primitives. Template switching preserves all content and warns about unsupported presentation.

Code editing supports project files, tabs, formatting, diagnostics, undo/redo and search. Custom source compilation/preview requires a separate isolated execution context with no application credentials, restricted imports, network denial, time/resource limits and validated message exchange. Never evaluate user source in the authenticated application or Django worker. Keep execution disabled until isolation tests pass, and record it as incomplete until then.

## Authentication, private storage and exports

Use HttpOnly session cookies, production HTTPS/Secure settings and appropriate SameSite configuration. CSRF applies to anonymous login/registration and authenticated mutations. Add rate limits backed by shared storage. Password validation, hashing, reset tokens and session invalidation use Django. Development reset messages explicitly describe the development email backend. Published terms/privacy content and production SMTP settings require deployment-owner review; do not fabricate legal acceptance claims.

Private uploads validate size, type, content and safe filenames. Do not serve private media through a public directory. Archive extraction, if needed, rejects traversal and decompression bombs. Sensitive changes require reauthentication; email changes require verification. Logout clears user-specific client caches only after server confirmation.

Celery + Redis process exports. Chromium prints the shared React rendering with selectable text and links; it must not load arbitrary remote URLs. DOCX uses the open-source docx library with an explicit structured-content mapping and formatting limitations. ZIP contains authorized source, styles, data and assets. Letters also support TXT. Jobs expose ownership-checked status and private downloads; completion notifications reflect actual results. Temporary files are cleaned up and failed exports remain retryable.

Sharing uses explicit access grants or revocable, expiring, hashed capability tokens, with least-privilege read/comment permissions and ownership checks. Private content is not made public by default. Version history and comments reuse document identity. Collaborative updates use revision conflict protection; realtime simultaneous editing is not presumed necessary by the current specifications.

## Analysis and optional services

ATS checks report evidence-based formatting/parsing risks, including actual exported PDF text extraction; never guarantee acceptance. Job matching reports matching/missing terms and transparent scoring. Content checks cover required structure, repeated/weak wording, achievements and readability. Use a free local grammar/spelling service where needed and report service unavailability honestly. Suggested edits require approval and must not invent qualifications.

Ollama is optional and configured by the operator. No document content is sent to a paid or external AI service. The email assistant produces copyable subject/body text and never sends mail. The job tracker is conditional on an existing tracker; none exists, so do not introduce a duplicate or pretend it exists. Optional 2FA remains unavailable unless fully implemented.

## Sequential delivery and acceptance gates

0. Foundation and module 00: establish frontend tooling and test harness, shared theme/router and all seven public-home sections. Validate keyboard/mobile navigation, copy, links, reduced motion and TypeScript. Auth destinations are an explicit integration dependency until module 01, not fake forms.
1. Module 01: Django configuration, PostgreSQL, initial account migration, CSRF/session APIs and real ocean-themed registration/login/reset screens. Test duplicate emails, credential errors, throttling, CSRF, reset expiry/reuse, session persistence and protected routing. Close module 00 auth-link integration checks.
2. Module 02: shared projects/profile-summary/activity/notifications services and dashboard shell, counts, recent projects, storage and project actions. Test ownership and query efficiency. Creation/editor destinations remain tracked dependencies until implemented.
3. Module 03: CV creation, file operations, shared engine, guided/visual/code editing, isolated preview, revision-safe autosave, versions, exports, analyzers and selective career import. Test malicious source isolation and export artifacts as well as editing. Do not declare complete while required services remain unavailable.
4. Module 04: twelve templates, gallery filters, live previews, creation, customization/switching and My Templates. Verify no lost content, persisted design and export fidelity. Track matching-letter destination until module 05.
5. Module 05: six letter designs, creation flows, guided/visual/code workspace, CV linking/import, analysis, job uploads, export and copyable email assistance. Verify preserved manual content and authorized source documents.
6. Module 06: full profile/security/preferences UI, career-vault editing, recycle bin and secure logout. Test bulk restore/delete, missing folders, file cleanup, changed preferences and cross-user isolation. Re-run document import integrations.
7. Module 07: complete project-management page, folders/tree, filtering, views, bulk actions, secure sharing and version entry points using existing services. Test editor routing, refresh persistence and dashboard/recycle-bin count consistency.
8. Final integration: full user journey, production build, migration consistency, deployment security, browser responsiveness/accessibility and worker/export recovery.

For every module, expand its source specification into a requirement checklist before coding. Implement one feature at a time, run relevant frontend/backend tests, fix failures, then update PROGRESS.md with files, APIs, migrations, exact test results, unfinished integrations and blockers. Do not advance a module as complete while its required tests fail or are unrun. Dependencies can be introduced to close a gate; later page development stays sequential.

## Validation and operational prerequisites

Use a dedicated PostgreSQL development database and isolated test database; never repurpose an existing database. Obtain configuration through environment variables, with a non-secret example file. Test against PostgreSQL, not a SQLite substitute. Redis, Chromium and local analysis services must be provisioned before their integration tests can pass. Docker may be documented as an optional deployment path, but local setup must work without it.

Run TypeScript checks, frontend production builds, component/integration tests and Django tests at the applicable gates. Browser checks cover desktop/tablet/mobile widths, keyboard flows, network errors and loading/empty states. Export tests inspect PDF extracted text, DOCX content and ZIP paths. Security tests cover every cross-user object operation, CSRF, upload paths, expired sharing/reset links, concurrent autosaves and sandbox isolation.

Builder-owned choices: dependency patch versions compatible with available runtimes, exact component names, spacing, typography, pagination sizes, and test organization. Select maintained free/open-source dependencies and record lockfiles/licenses. Deployment ownership, domain, SMTP credentials, legal policy approval and database credentials are operational inputs; do not invent them or silently mark their verification complete.
