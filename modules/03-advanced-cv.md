03 — Advanced CV Builder

Task

Build a modern, professional, fully responsive Advanced CV Builder for the Advanced CV & Cover Letter Studio.

Create an Overleaf-style React workspace with code editing, visual editing, guided forms, and live CV preview.

1. Technology Stack

Frontend: React + TypeScript + Vite

Styling: Tailwind CSS

Backend: Django REST Framework

Database: PostgreSQL

Routing: React Router

API: TanStack Query

Code Editor: Monaco Editor

Rich Text: Tiptap

Drag & Drop: dnd-kit

Forms: React Hook Form + Zod

Export: Playwright, Chromium, docx

Icons: Lucide React

Use only free and open-source technologies.

Follow AGENTS.md, PROJECT.md, ARCHITECTURE.md, PROCESS.md, and PROGRESS.md.

Reuse existing components, authentication, APIs, and database models.

2. Design

Modern Overleaf-inspired workspace.

Primary color: Navy Blue #0B1F3A.

Match the existing home page and dashboard.

Clean typography and professional controls.

Responsive desktop, tablet, and mobile layouts.

Fast editing, saving, and preview.

3. Pages and Routes

/dashboard/advanced-cv — Advanced CV landing page

/dashboard/advanced-cv/new — Create CV

/dashboard/advanced-cv/:projectId — CV Editor

Reuse existing routes if already implemented. All routes require authentication.

4. Advanced CV Landing Page

Include:

Create New CV

Open Existing CV

Recent Advanced CV Projects

Blank CV

Start from Template

Guided CV Builder

Display only real user projects.

5. Create New CV

Provide three options:

Blank React CV

Create an editable React CV project with:

CV.tsx

style.css

cv.json

Assets folder

React CV Template

Browse and preview templates.

Select and customize templates.

Create a new CV project.

Guided CV Builder

Enter career information using forms.

Import information from Career Profile Vault.

Generate an editable React CV.

6. CV Editor Workspace

Left Panel — File Explorer

Create, upload, rename, duplicate, and delete files.

Create folders.

File search and folder navigation.

File context menus.

Middle Panel — Code Editor

Monaco Editor

React TSX, JSX, CSS, JSON, Markdown

Multiple file tabs

Syntax highlighting

Find and replace

Undo/redo

Code formatting

Error detection

Right Panel — Live Preview

Live React CV rendering

A4 and US Letter

Zoom controls

Page boundaries

Multi-page preview

Full-screen mode

PDF preview

Export controls

Support resizable panels and mobile tabs.

7. Workspace Toolbar

Include:

Back to Projects

Editable Project Name

Save Status

File, Edit, View, Help menus

Undo / Redo

Save Version

ATS Checker

Content Analyzer

Job Matcher

Export PDF / DOCX / ZIP

Every enabled action must work.

8. Editing Modes

Code Editing

Edit React components, styles, and project files using Monaco.

Visual Editing

Edit CV content.

Add, remove, and reorder sections.

Customize fonts, colors, margins, and spacing.

Change supported layouts.

Adjust page settings.

Guided Editing

Provide forms for:

Personal Information

Professional Summary

Work Experience

Education

Technical and Soft Skills

Projects

Certifications

Achievements

Research and Publications

Languages

Volunteering

References

Custom Sections

Use one shared structured data model for guided and visual editing. Do not automatically rewrite arbitrary React code.

9. React Document Engine

All CVs must use reusable React components for creation, editing, rendering, and preview.

Separate CV data from design wherever possible.

Use the same document engine for blank CVs, templates, and guided CVs.

Never generate CV pages as static images.

10. ATS Checker

Analyze:

Layout and columns

Tables and graphics

Reading order

Fonts and symbols

Contact information

Section headings

Missing sections

PDF text extraction

Keywords

Provide warnings, explanations, and suggested improvements. Do not guarantee ATS acceptance.

11. CV Content Analyzer

Check:

Summary quality

Grammar and spelling

Weak action verbs

Repeated words

Missing information

Experience descriptions

Measurable achievements

Readability and formatting

Allow users to review suggestions before applying them.

12. Job Description Matcher

Paste or upload job descriptions.

Extract required skills and keywords.

Compare job requirements with CV content.

Identify matching and missing skills.

Suggest improvements.

Create a targeted CV as a separate project.

Never overwrite the original CV.

13. Career Profile Vault

Allow importing saved:

Personal Details

Experience

Education

Skills

Projects

Certifications

Changes to the master profile must not automatically overwrite existing CVs.

14. Save and Version History

Automatic and manual saving

Save status

Failed-save recovery

Named versions

Version history

Restore previous version

Unsaved changes warning

Prevent outdated requests from overwriting newer changes.

15. Export

Support:

PDF: Print-ready, selectable text using Chromium.

DOCX: Editable Word document using structured content.

ZIP: Project source code, styles, data, and assets.

PDF Preview: Open generated PDF in a separate tab.

Handle unsupported export formatting honestly.

16. Backend

Create or reuse APIs for:

CV project CRUD

Project file management

Asset uploads

Autosave

Version history

ATS analysis

Content analysis

Job matching

Document exports

Requirements:

Authentication

User ownership validation

Secure uploads

Proper error handling

Optimized PostgreSQL queries

No unnecessary migrations

17. Security

Never execute arbitrary React code inside the authenticated application.

Use genuinely isolated code compilation and preview.

Restrict imports, network access, and resource usage.

Protect authentication tokens.

Disable custom code execution until a secure sandbox is available.

18. Performance

Lazy-load Monaco Editor.

Debounce code compilation.

Keep autosave independent of preview.

Cache API requests.

Avoid unnecessary renders.

Process heavy exports asynchronously.

Maintain responsive editing and navigation.

19. Testing

Test:

Project creation and loading

File operations

Editing and preview

Autosave and versions

ATS and content analysis

Job matching

Export functionality

Authentication and permissions

Mobile responsiveness

API errors

Untrusted code isolation

20. Implementation Order

Landing page and project creation

Workspace layout and file explorer

Shared React CV engine

Guided and visual editing

Monaco Editor and secure preview

Autosave and version history

PDF, DOCX, and ZIP exports

ATS Checker and Content Analyzer

Job Matcher and Career Profile integration

Testing and performance optimization

21. Final Instructions

Inspect the existing repository before coding.

Preserve home, authentication, and dashboard pages.

Reuse existing APIs, models, and components.

Ensure all visible enabled actions work.

Use real user data, not fictional records.

Keep unimplemented features disabled.

Run frontend and backend tests.

Fix introduced errors.

Update PROGRESS.md.

Update PROCESS.md only when necessary.

Summarize completed files, APIs, migrations, tests, and remaining work.

Important: The Advanced CV Builder must use the shared React-based document architecture and integrate correctly with Your Projects, CV Templates, Cover Letter Builder, and Career Profile Vault.
