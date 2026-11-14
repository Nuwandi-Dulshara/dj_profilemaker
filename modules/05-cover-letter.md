05 — Cover Letter Builder

Task

Build a modern, professional, responsive, and fully functional Cover Letter Builder for Advanced CV & Cover Letter Studio.

Users must be able to create, edit, customize, analyze, save, and export professional, job-targeted cover letters.

1. Technology Stack

Frontend: React + TypeScript + Vite

Styling: Tailwind CSS

Backend: Django REST Framework

Database: PostgreSQL

Routing: React Router

API: TanStack Query

Rich Text: Tiptap

Code Editor: Monaco Editor

Forms: React Hook Form + Zod

Export: Playwright, Chromium, docx

Icons: Lucide React

Optional Local AI: Ollama

Use only free and open-source technologies.

Follow AGENTS.md, PROJECT.md, ARCHITECTURE.md, PROCESS.md, and PROGRESS.md.

Reuse existing authentication, project management, APIs, and the shared React document engine.

2. Design

Premium SaaS-style interface.

Primary color: Navy Blue #0B1F3A.

Match existing dashboard and CV Builder designs.

Professional typography and document formatting.

Responsive desktop, tablet, and mobile layouts.

Fast editing, saving, and live preview.

3. Pages and Routes

/dashboard/cover-letters — Cover Letter Landing Page

/dashboard/cover-letters/new — Create Cover Letter

/dashboard/cover-letters/:projectId — Cover Letter Editor

Require authentication.

4. Cover Letter Landing Page

Include:

Create New Cover Letter

Recent Cover Letters

Saved Drafts

Search and Filters

Cover Letter Templates

Linked CV

Last Modified Date

Continue Editing

Project actions:

Rename

Duplicate

Favorite

Archive

Move to Deleted Files

Use actual user data.

5. Create New Cover Letter

Provide four options:

Start from Blank

Choose Cover Letter Template

Create from Existing CV

Duplicate Previous Cover Letter

Create projects using the existing document infrastructure.

6. Cover Letter Workspace

Header

Back to Projects

Project Name

Save Status

Undo / Redo

Save Version

Export

More Actions

Left Panel

Job Details

Linked CV

Job Description

Letter Sections

Writing Assistant

Templates

Design Settings

Middle Panel

Guided Editor

Visual Editor

Advanced React Code Editor

Right Panel

Live React Preview

A4 / US Letter

Zoom Controls

Full Screen

PDF Preview

Support collapsible panels and mobile tabs.

7. Cover Letter Content

Include:

Applicant Details

Name

Email

Phone

Location

LinkedIn

Portfolio

Job Details

Company Name

Hiring Manager

Job Title

Department

Job Reference

Application Date

Letter Sections

Greeting

Opening Paragraph

Relevant Experience

Skills and Achievements

Why This Company

Value Proposition

Closing Paragraph

Sign-off

Signature

Allow users to edit, add, remove, and reorder supported sections.

8. Editing Modes

Guided Editor

Create cover letters using structured forms with validation.

Visual Editor

Support:

Bold, Italic, Lists

Text Alignment

Fonts and Colors

Margins and Spacing

Undo / Redo

React Code Editor

Allow advanced TSX/CSS customization using Monaco.

Reuse the secure isolated preview from Advanced CV Builder. Disable arbitrary code execution until secure isolation is implemented.

9. Shared React Document Engine

Use reusable components for:

Letter Header

Applicant Details

Recipient Details

Greeting

Paragraphs

Closing

Signature

Keep content separate from design.

Do not create another document engine.

10. Cover Letter Templates

Create six original React templates:

Classic Professional

Modern Navy

Minimalist

Academic

Creative

Matching CV Design

Allow users to preview, customize, and switch templates without losing content.

11. Existing CV Integration

Select an existing CV.

Import relevant experience and skills.

Link CV to Cover Letter.

View linked CV.

Change linked CV with confirmation.

Preserve manually written content.

Enforce document ownership permissions.

12. Career Profile Vault

Allow importing:

Personal Details

Experience

Education

Skills

Projects

Certifications

Achievements

Never automatically overwrite existing letters.

13. Job Description Matcher

Paste or upload PDF, DOCX, or TXT job descriptions.

Extract job requirements.

Identify relevant skills.

Compare qualifications with requirements.

Detect missing keywords.

Suggest improvements.

Reuse the existing job matching infrastructure.

14. Writing Assistant

Provide free writing assistance for:

Opening Paragraph

Professional Tone

Grammar and Spelling

Weak Sentences

Repeated Words

Job Keywords

Closing Paragraph

Letter Length

Optional local AI using Ollama.

Never invent qualifications or achievements. Require user approval before applying suggestions.

15. Cover Letter Analyzer

Analyze:

Letter Structure

Job Relevance

Company Name Accuracy

Job Title Accuracy

CV Consistency

Skills Alignment

Grammar

Tone

Repetition

Readability

Formatting and Page Overflow

Display findings, explanations, and recommended fixes.

16. Smart Personalization

Generate relevant writing suggestions using:

Linked CV

Career Profile

Job Description

Target Position

User-provided Company Information

Use verified information only.

17. Design Customization

Allow changes to:

Font Family and Size

Text and Accent Colors

Margins

Line and Paragraph Spacing

Header Style

Page Size

Alignment

Signature

Page Breaks

Update the React preview immediately.

18. Email Application Assistant

Include:

Generate Email Subject

Generate Email Body

Professional / Concise Tone

Reference Attachments

Copy Subject

Copy Email Body

Do not claim emails have been sent.

19. Save and Version History

Autosave

Manual Save

Save Status

Failed Save Recovery

Named Versions

Restore Version

Duplicate Letter

Last Modified Date

Reuse existing saving and version history services.

20. Export

Support:

PDF: Printable document with selectable text.

DOCX: Editable Word document.

TXT: Plain text cover letter.

Copy Letter Text

Open PDF Preview

Reuse the shared export infrastructure.

21. Job Application Tracker

If the existing tracker is available, allow linking:

Company

Job Title

Job Description

CV

Cover Letter

Application Date

Application Status

Do not create a duplicate tracker.

22. Backend APIs

Create or reuse endpoints for:

Cover Letter CRUD

Template Listing

Linked CV

Job Description

Writing Analysis

Version History

Autosave

PDF / DOCX / TXT Export

Requirements:

Authentication

User ownership checks

Secure uploads

Proper validation

Efficient database queries

No unnecessary migrations

23. Performance and Security

Lazy-load editors.

Cache API data.

Debounce preview processing.

Keep autosave independent.

Avoid unnecessary re-renders.

Process large exports asynchronously.

Protect private career data.

Never run untrusted React code in the main application.

Support keyboard accessibility.

24. Testing

Test:

Cover Letter Creation

Guided and Visual Editing

Template Switching

Linked CV Integration

Career Profile Import

Job Description Upload

Writing Analysis

Autosave and Version History

PDF / DOCX / TXT Export

Authentication and User Permissions

Responsive Layouts

API Error Handling

25. Implementation Order

Landing Page and Creation Flow

Cover Letter Workspace

Shared React Letter Components

Guided and Visual Editors

Templates and Customization

Existing CV and Career Profile Integration

Job Description Matching

Autosave and Version History

Export System

Writing Assistant and Quality Analyzer

Email Assistant and Optional Advanced Features

Testing and Optimization

26. Final Instructions

Inspect the existing repository before coding.

Preserve all existing pages and features.

Reuse the shared React document engine.

Ensure all enabled buttons and actions work.

Use real authenticated user data.

Keep unavailable features clearly disabled.

Run frontend and backend tests.

Fix introduced errors.

Update PROGRESS.md.

Update PROCESS.md only if necessary.

Summarize files, APIs, migrations, tests, and remaining work.

Important: The Cover Letter Builder must integrate with the Dashboard, Your Projects, Advanced CV Builder, CV Templates, Career Profile Vault, Job Matcher, Version History, and shared Export System. Never duplicate existing document engines or project workflows.
