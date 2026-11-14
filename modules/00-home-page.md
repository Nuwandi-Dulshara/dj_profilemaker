Task
Create a modern, professional, fully responsive public home page for Advanced CV & Cover Letter Studio.
Technology

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS or existing project styles
- Backend: Django + Django REST Framework (do not change for this task)
- Database: PostgreSQL (do not change for this task)
- Resources: Free and open-source only
  Follow existing AGENTS.md, PROJECT.md, ARCHITECTURE.md, PROCESS.md, and PROGRESS.md where available.
  Color Theme
  Color Hex Usage
  Navy Blue #0B1F3A Header, footer, primary buttons
  Light Blue #EAF4FF Backgrounds and cards
  Bright Blue #3B82F6 Highlights, icons, hover effects
  Black #111827 Headings and body text
  White #FFFFFF Main backgrounds, button text

Use generous whitespace, rounded corners, subtle shadows, and smooth, respectful animations. Do not introduce other main theme colors.
Page Sections

1. Sticky Navigation Bar

- Left: Logo and Advanced CV & Cover Letter Studio.
- Center: Home, Features, How It Works, About.
- Right: Outlined Login and solid navy Register buttons.
- Responsive hamburger menu on mobile with accessible keyboard interactions.
- Home and section links navigate to the correct page sections.

2. Hero Section
   Use a two-column layout on desktop, stacked on mobile.

Heading: Build Professional CVs & Cover Letters with Confidence

Description: Create, customize, analyze, and manage professional CVs and cover letters in one powerful workspace. Design with React, improve ATS compatibility, and prepare job-specific applications.

Buttons:

- Get Started Free → /register
- Login → /login
  Highlights:
- Free & Open-Source Tools
- ATS Compatibility Analysis
- Live Document Preview
  Right-side visual: Build a polished product mockup using React components and CSS (no paid images). Represent a sample CV document, code/visual editing interface, live preview, ATS analysis, and customizable templates. This is an illustration only—not a functioning editor.

3. Main Features
   Heading: Everything You Need to Build Your Career Documents

Display six consistent feature cards, each with an icon, short description, and subtle hover animation:

1. Advanced CV Builder — Create and customize CVs using React components with live preview and advanced editing tools.
2. Professional CV Templates — Choose ATS-friendly, modern, or creative templates and customize them.
3. Cover Letter Builder — Create professional, job-specific cover letters that match your CV.
4. ATS Compatibility Checker — Identify potential formatting and parsing problems and receive suggestions.
5. Job Description Matching — Compare CV content with job requirements and identify missing or relevant skills.
6. Project Management — Organize CVs, cover letters, folders, versions, and saved projects in one workspace.
7. How It Works
   Present four steps horizontally on desktop and vertically on mobile:
8. Create an Account — Register and access your personal workspace.
9. Choose a Tool — Select Advanced CV Builder, CV Templates, or Cover Letter Builder.
10. Customize Your Document — Edit content, select designs, preview changes, and review suggestions.
11. Save & Download — Save your projects and export supported document formats.
12. Career Profile Highlight
    Heading: One Workspace. Multiple Career Opportunities.

Explain how users can save career details once and reuse them across multiple targeted CVs and cover letters. Show a lightweight React/CSS diagram connecting a Master Career Profile to several career documents. 6. Call to Action
Use a navy blue background with readable white text.

Heading: Ready to Build Your Next Professional CV?

Description: Start creating professional career documents with powerful editing tools and customizable templates.

Buttons:

- Create Free Account → /register
- Already Have an Account? Login → /login

7. Footer
   Navy blue background and white text. Include:

- Application name and short description
- Links to Home, Features, About, Login, and Register
- Copyright with a dynamic year
  Do not add fake testimonials, user statistics, or unsupported claims.
  Routing and Authentication
  Use React Router:
- / → Home
- /login → Login
- /register → Register
  Reuse existing Login and Register pages; do not create duplicates. If authentication already exists, redirect authenticated users away from auth pages to the dashboard where appropriate. All buttons and navigation links must work.
  Responsiveness and Accessibility
- Support desktop, laptop, tablet, and mobile.
- Ensure smooth scrolling and mobile-friendly layouts.
- Provide semantic landmarks, accessible labels, clear typography, sufficient contrast, and visible keyboard focus.
- Mobile menu must open and close reliably and support keyboard navigation.
- Use responsive card grids and buttons.
- Keep loading fast; respect prefers-reduced-motion.
  Development Rules

1. Use reusable React components and a clean folder structure.
2. Avoid unnecessary dependencies.
3. Do not modify unrelated pages, Django APIs, database models, or migrations.
4. Do not build the functional CV editor, ATS analyzer, or other dashboard modules now; only show their features on the public home page.
5. Preserve existing styling conventions where compatible with this theme.
6. Verify Login/Register navigation.
7. Check TypeScript errors and test desktop/mobile layouts.
8. Update PROGRESS.md only after work is actually completed.
   Acceptance Checklist

- [ ] Home page includes all seven sections.
- [ ] Theme uses the five specified colors.
- [ ] Sticky desktop navbar and usable mobile menu.
- [ ] Hero includes accurate copy, working CTA links, and React/CSS product mockup.
- [ ] Six feature cards and four process steps display responsively.
- [ ] Master Career Profile diagram is visible.
- [ ] Footer includes working links and dynamic year.
- [ ] /, /login, and /register work using React Router.
- [ ] Existing authentication and auth pages are reused.
- [ ] Accessibility, reduced motion, and keyboard navigation checked.
- [ ] TypeScript checks and responsive tests pass.
- [ ] PROGRESS.md updated with verified results.
      Expected Result
      A premium-looking, accessible, fast, responsive landing page for Advanced CV & Cover Letter Studio, using navy blue, light blue, bright blue, black, and white, with working Login and Register navigation.

Status: Not Started
