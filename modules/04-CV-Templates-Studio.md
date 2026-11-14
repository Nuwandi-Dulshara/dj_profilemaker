04 — CV Templates Studio

Task

Build a modern, professional, responsive, and fully functional CV Templates Studio for Advanced CV & Cover Letter Studio.

Users must be able to browse, preview, select, customize, save, switch, and export React-based CV templates.

1. Technology Stack

Frontend: React + TypeScript + Vite

Styling: Tailwind CSS

Backend: Django REST Framework

Database: PostgreSQL

Routing: React Router

API: TanStack Query

Forms: React Hook Form + Zod

Drag & Drop: dnd-kit

Export: Playwright, Chromium, docx

Icons: Lucide React

Use only free and open-source technologies.

Follow AGENTS.md, PROJECT.md, ARCHITECTURE.md, PROCESS.md, and PROGRESS.md.

Reuse the existing shared React document engine, authentication, APIs, and models.

2. Design

Premium SaaS-style template gallery.

Primary color: Navy Blue #0B1F3A.

Match existing home, dashboard, and Advanced CV Builder designs.

Responsive template cards and professional previews.

Fast loading, accessible controls, and smooth interactions.

3. Pages and Routes

/dashboard/cv-templates — Template Gallery

/dashboard/cv-templates/:templateId — Template Preview

My Templates — Saved custom templates within the existing dashboard routing structure

Protect user-specific pages and actions.

4. CV Template Gallery

Include:

Template search

Category and career filters

Layout and ATS risk filters

Template preview cards

Favorites

Recently Used Templates

My Templates

Use Template button

Each card displays the template name, description, category, layout, ATS risk, and preview.

Use only real working templates.

5. Initial Template Library

Create 12 original React CV templates:

ATS-Friendly

Classic ATS

Simple Professional

Clean Graduate

Executive Standard

Modern

Modern Navy

Minimal Green

Contemporary Professional

Technical Developer

Creative

Creative Sidebar

Elegant Portfolio

Specialized

Academic Research CV

Teacher Professional CV

All templates must be functional React components, not static images.

6. Template Categories

Support filtering by:

ATS-Friendly

Professional

Modern

Minimalist

Creative

Academic

Career filters:

Fresh Graduate

Software Engineer

Business Analyst

Teacher

Accountant

Designer

Researcher

Executive

Layout filters:

Single Column

Two Column

Sidebar

Multi-page

Search, filters, and sorting must work together.

7. Template Preview

Include:

Full-size live React preview

Template details

Zoom controls

A4 / US Letter

Sample Data / My Career Data

ATS compatibility notes

Use Template button

Clearly label sample data.

8. Create CV from Template

When selecting a template:

Choose a template.

Import Career Profile information or start blank.

Enter a project name.

Create a new CV project.

Save the template and design configuration.

Open the existing CV Editor.

Prevent duplicate projects from repeated requests.

9. Template Customization

Allow users to change:

Fonts and font sizes

Text and accent colors

Margins and spacing

Page size

Column layouts

Section headings

Section order

Show/hide sections

Page breaks

Update the live preview immediately using validated settings.

10. CV Content Editing

Reuse Advanced CV Builder forms for:

Personal Information

Professional Summary

Work Experience

Education

Skills

Projects

Certifications

Achievements

Research and Publications

Languages

Volunteering

References

Custom Sections

Support multiple entries and drag-and-drop ordering.

11. Template Switching

Change templates without re-entering information.

Preview before applying.

Preserve all CV content.

Preserve versions and project ownership.

Warn about unsupported sections.

Allow restoration of the previous design.

Never silently delete user content.

12. My Templates

Allow users to:

Save customized templates

Name and preview templates

Rename

Duplicate

Delete

Reuse saved templates

Store validated design configurations, not executable user code.

13. ATS Compatibility

Display estimated ATS risk based on:

Reading order

Columns and tables

Font readability

Heading structure

Text extraction

Graphics and symbols

Link to the existing ATS Checker.

Do not guarantee ATS compatibility.

14. Career Profile Vault

Allow users to import:

Personal Details

Experience

Education

Skills

Projects

Certifications

Never overwrite existing CV information without user approval.

15. Advanced CV Builder Integration

Add Open in Advanced Builder.

Use the same project, structured CV data, React components, and live preview system.

Do not create another independent CV editor or rendering engine.

16. Matching Cover Letter

Add Create Matching Cover Letter.

Reuse compatible design settings and approved career information.

Open the existing Cover Letter Builder when available. Otherwise, display a planned state.

17. Export

Reuse the shared export system:

PDF: A4/Letter, selectable text, working links.

DOCX: Editable Word document.

ZIP: React source, styles, CV data, and assets.

Do not duplicate export services.

18. Backend APIs

Create or reuse:

GET /api/templates/

GET /api/templates/:id/

POST /api/projects/

GET /api/my-templates/

POST /api/my-templates/

PATCH /api/my-templates/:id/

DELETE /api/my-templates/:id/

Requirements:

Authentication for user-owned operations

Strict ownership permissions

Template validation

Pagination

Secure file handling

No unnecessary migrations

19. Performance and Security

Lazy-load template components.

Cache template metadata.

Debounce search.

Load previews only when needed.

Avoid unnecessary re-rendering.

Do not load Monaco Editor in the gallery.

Prevent arbitrary code execution.

Protect private user information.

Support keyboard and mobile accessibility.

20. Testing

Test:

Template listing and filtering

Live previews

Template selection

CV project creation

Customization and switching

Career Profile import

My Templates

PDF and DOCX exports

User permissions

Responsive layouts

Loading and error states

21. Implementation Order

Template Gallery and filters

Build 12 React CV templates

Live preview and selection

CV project creation

Customization and switching

My Templates

Career Profile integration

Advanced Builder and Cover Letter integration

ATS guidance and exports

Testing and optimization

22. Final Instructions

Inspect the existing repository before coding.

Preserve home, authentication, dashboard, and Advanced CV Builder pages.

Reuse shared React document architecture.

Ensure all enabled buttons and features work.

Never use fake templates or user records.

Keep unimplemented features clearly disabled.

Run frontend and backend tests.

Fix introduced errors.

Update PROGRESS.md.

Update PROCESS.md only if necessary.

Summarize changed files, endpoints, migrations, tests, and remaining work.

Important: CV Templates must use the same shared React-based creation, editing, rendering, live preview, version history, and export architecture as the Advanced CV Builder. Never create duplicate document engines.
