# Task: Create Beautiful Sea-Themed Login and Register Pages

Create modern, premium, professional, secure, and fully responsive **Login and Register pages** for the **Advanced CV & Cover Letter Studio** application.

Use the uploaded tropical sea image as the background for the authentication pages. The appearance must closely follow my first reference image, featuring a white authentication form panel, beautiful ocean photography, and an artistic irregular edge separating the form area from the image.

Both pages must match the existing home page color theme and connect to the Django backend and PostgreSQL database.

Implement real, working authentication rather than frontend-only demonstration forms.

---

## 1. Technology Stack

- Frontend: React + TypeScript + Vite
- Styling: Existing Tailwind CSS or project styling
- Backend: Django + Django REST Framework
- Authentication: Django authentication with secure session cookies
- Database: PostgreSQL
- Routing: React Router
- Icons: Lucide React or an existing free icon library
- Use only free and open-source technologies.

Follow the existing:

- AGENTS.md
- PROJECT.md
- ARCHITECTURE.md
- PROCESS.md
- PROGRESS.md

Read these files before making changes.

Reuse existing application architecture, components, services, and authentication functionality wherever possible.

## 2. Color Theme

Use the same colors as the home page:

| Color       | Hex Code  | Usage                                         |
| ----------- | --------- | --------------------------------------------- |
| Navy Blue   | `#0B1F3A` | Main headings, dark overlays, primary buttons |
| Light Blue  | `#EAF4FF` | Input backgrounds, decorative elements        |
| Bright Blue | `#3B82F6` | Focus states, links, highlights               |
| Black       | `#111827` | Headings and body text                        |
| White       | `#FFFFFF` | Form cards, input surfaces, button text       |

The uploaded sea image naturally contains turquoise, cyan, and ocean-blue colors. These photographic colors are permitted, but keep the UI components consistent with the defined theme.

Design requirements:

- Premium SaaS-style authentication pages
- Elegant ocean photography
- Floating white authentication card
- Artistic coastline-shaped card edge
- Rounded input fields
- Clean typography
- Subtle shadows
- Smooth transitions
- Professional icons
- Responsive layouts
- Accessible color contrast
- Attractive visual hierarchy

Avoid unnecessary gradients, excessive decoration, and distracting animations.

---

## 3. Sea Background Image — Very Important

I have provided a high-quality aerial tropical beach photograph.

Use this exact uploaded image as the background for Login, Register, Forgot Password, and Reset Password pages.

### Image Location

Save the provided image to:

`frontend/public/images/auth/tropical-sea.png`

If the image is already stored in the project, reuse it rather than creating a duplicate.

### Background Requirements

- Cover the full viewport.
- Use `background-size: cover`.
- Use `background-position: center`.
- Use `background-repeat: no-repeat`.
- Preserve the original image proportions.
- Do not stretch or distort the image.
- Keep the ocean visible around the authentication card.
- Ensure the coastline, clear water, and beach remain visually attractive.
- Adjust background positioning for different screen sizes.
- Use a very subtle navy overlay only if needed for readability.
- Do not apply heavy blur to the sea image.

Example:

```css
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  background-image: url('/images/auth/tropical-sea.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
}
```

The photograph must remain the most beautiful visual element behind the authentication card.

---

## 4. Main Authentication Card Design

Use my first reference image as the main layout inspiration.

### Desktop Layout

Create one large floating authentication card centered over the tropical sea background.

Recommended width: 1050–1150px.

Use two visual areas:

**Left side — Authentication Form**

- White background
- Approximately 45% of card width
- Login or Register form
- Navy headings
- Light-blue inputs
- Navy primary button
- Bright-blue links
- Comfortable spacing
- Professional typography

**Right side — Sea Image Panel**

- Approximately 55% of card width
- Beautiful portion of the uploaded sea photograph
- Optional subtle dark overlay
- Short promotional heading in white
- Supporting description
- Small decorative CV/document illustration if it does not obscure the scenery

### Artistic Coastline Edge

This is one of the most important design requirements.

The boundary between the white form panel and ocean panel must not be a plain straight vertical line.

Create an elegant, irregular, coastline-inspired edge, similar to the first reference image.

Recommended implementations:

- CSS `clip-path`
- SVG mask
- A reusable decorative SVG edge

Prefer a smooth, natural-looking organic shape rather than sharp triangular zigzags.

Ensure:

- The white panel remains readable.
- The coastline edge does not cover form fields.
- The sea image is visible behind the irregular edge.
- The shape scales properly on desktop.
- The shape does not interfere with clicking or typing.
- The edge can be simplified or removed on mobile.

Do not copy text or branding from the reference image.

### Floating Card Styling

- White form background
- Rounded corners, approximately 18–24px
- Soft professional shadow
- Overflow handling for decorative elements
- Balanced visual spacing
- Smooth responsive transitions

The overall appearance should feel luxurious, clean, and modern.

---

## 5. Login Page

Route: `/login`

### Layout

Use the shared ocean-themed authentication layout.

**Left Form Panel**

Heading:

**Welcome Back!**

Subtitle:

"Sign in to continue creating professional CVs and cover letters."

Form fields:

1. Email Address
2. Password

Additional controls:

- Show/Hide Password
- Remember Me, only if securely supported by the authentication implementation
- Forgot Password?
- Sign In button
- Don't have an account? Create Account
- Back to Home

### Right Sea Panel

Heading:

**Your Career Journey Continues Here**

Description:

"Access your documents, improve your CV, and prepare confidently for your next opportunity."

Use white text with subtle contrast treatment.

Keep a large part of the sea photograph clearly visible.

### Login Form Design

- Large navy-blue heading
- Rounded light-blue input backgrounds
- Small professional icons inside inputs
- Bright-blue focus borders
- Navy-blue primary button
- White button text
- Smooth button hover effects
- Clear validation messages
- Comfortable form spacing

### Login Functionality

- Validate email format.
- Require password.
- Connect the form to Django authentication.
- Authenticate using email and password.
- Use secure, HttpOnly session cookies.
- Include CSRF protection.
- Show loading state during submission.
- Display clear error messages for invalid credentials.
- Do not reveal whether a specific account exists.
- Redirect successfully authenticated users to `/dashboard`.
- Maintain authentication after page refresh.
- Prevent duplicate submissions.
- Do not store passwords, authentication tokens, or session secrets in localStorage.

---

## 6. Register Page

Route: `/register`

### Layout

Use the same floating card, sea background, form styling, and coastline-inspired decorative edge as Login.

Both pages should look like one unified authentication system.

**Left Form Panel**

Heading:

**Create Your Free Account**

Subtitle:

"Start building your professional future with powerful career tools."

Form fields:

1. First Name
2. Last Name
3. Email Address
4. Password
5. Confirm Password

Additional controls:

- Show/Hide Password
- Password strength indicator
- Agree to Terms of Service and Privacy Policy checkbox
- Create Account button
- Already have an account? Sign In
- Back to Home

### Right Sea Panel

Heading:

**Build Your Future with Confidence**

Description:

"Create professional CVs, design personalized cover letters, and organize your career documents in one workspace."

Use the same beautiful sea image.

### Registration Form Styling

- Navy-blue heading
- Rounded inputs
- Light-blue field backgrounds
- White form panel
- Bright-blue focus states
- Navy registration button
- Clear validation feedback
- Consistent typography
- Compact but comfortable spacing

Arrange First Name and Last Name side by side on wider screens if space allows.

Use a single column on smaller screens.

### Registration Validation

- First name and last name are required.
- Email must have a valid format.
- Email must be unique.
- Password must follow Django's configured password validation rules.
- Confirm Password must match Password.
- Display helpful validation messages.
- Validate on both frontend and backend.
- Do not accept registration without agreement to the published Terms and Privacy Policy.
- Do not create fake Terms or Privacy pages; link only to implemented pages.

### Registration Functionality

- Connect registration to Django REST Framework.
- Store users in PostgreSQL.
- Hash passwords using Django's built-in password hashing system.
- Never store plain-text passwords.
- Prevent duplicate accounts.
- Protect registration against automated abuse with appropriate rate limiting.
- After successful registration, establish an authenticated session and redirect to `/dashboard`, unless email verification is enabled.
- If email verification is enabled, show a verification-required screen instead.

---

## 7. Forgot Password and Reset Password

Implement a functional password reset workflow.

Use the same sea background and shared authentication layout.

Routes:

- `/forgot-password`
- `/reset-password/:uid/:token`

### Forgot Password Page

Heading:

**Forgot Your Password?**

Description:

"Enter your email address and we'll help you reset your password."

Fields:

- Email Address

Buttons:

- Send Reset Link
- Back to Login

Functionality:

- User enters their registered email.
- Django generates a secure, time-limited reset token.
- Send a reset link using the configured email service.
- Show the same generic confirmation whether the account exists or not.
- Do not expose sensitive user information.

### Reset Password Page

Heading:

**Create a New Password**

Fields:

- New Password
- Confirm New Password

Additional controls:

- Show/Hide Password
- Password strength indicator
- Reset Password button

Functionality:

- Validate the reset token on the backend.
- Allow the user to enter and confirm a new password.
- Enforce Django password validation.
- Invalidate the token after successful password change according to Django's reset-token behavior.
- Redirect the user to Login after successful reset.

Use a development email backend for local testing if a real email service is not configured.

Do not claim an email was delivered when only a development backend is used.

---

## 8. Django Authentication Backend

Create or reuse an accounts module.

Required backend functionality:

- User registration
- User login
- User logout
- Get current authenticated user
- CSRF cookie initialization
- Password reset request
- Password reset confirmation

Suggested API routes:

| Method | Endpoint                            |
| ------ | ----------------------------------- |
| POST   | `/api/auth/register/`               |
| POST   | `/api/auth/login/`                  |
| POST   | `/api/auth/logout/`                 |
| GET    | `/api/auth/me/`                     |
| GET    | `/api/auth/csrf/`                   |
| POST   | `/api/auth/password-reset/`         |
| POST   | `/api/auth/password-reset/confirm/` |

Use Django's authentication framework.

If a custom email-based User model is needed, establish the correct model before initial migrations.

If the existing project already has migrations or user records, do not replace its User model destructively.

Use secure cookie settings for production with HTTPS, appropriate SameSite configuration, and credentialed requests only to trusted origins.

Configure CSRF correctly.

Never disable CSRF protection as a shortcut.

---

## 9. Authentication Navigation

Public routes:

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password/:uid/:token`

Protected route:

- `/dashboard`

Navigation rules:

- Home → Login
- Home → Register
- Login → Register
- Register → Login
- Login → Forgot Password
- Forgot Password → Reset Password through valid token link
- Successful Login → Dashboard
- Successful Registration → Dashboard when verification is not required
- Logout → Home or Login
- Unauthenticated user accessing Dashboard → Login
- Authenticated user accessing Login/Register → Dashboard

Do not redirect users before the authentication status has been checked.

Use React Router for navigation without unnecessary full-page reloads.

---

## 10. Responsive Design

### Desktop — 1024px and Above

- Full-screen tropical sea background
- Large centered floating card
- White form panel on the left
- Sea image panel on the right
- Artistic coastline edge
- Attractive promotional heading
- Spacious professional layout

### Tablet — 768px to 1023px

- Reduce card width.
- Adjust internal padding.
- Maintain readable forms.
- Keep the sea image visible.
- Simplify the decorative edge if necessary.

### Mobile — Below 768px

- Full-screen sea background
- Centered white form card
- Single-column form
- Smaller headings
- Comfortable input sizes
- Hide or significantly reduce the separate promotional image panel
- Remove complicated coastline masking if it affects readability
- Keep the main ocean image visible around the card
- Allow scrolling for long registration forms
- Ensure the keyboard does not obstruct input fields

The registration form must work correctly on narrow phones without overflowing horizontally.

Use responsive CSS and avoid fixed-height forms.

---

## 11. Form User Experience

Implement:

- Real-time validation
- Clear error messages
- Password visibility toggle
- Password strength indicator on registration/reset
- Loading indicators
- Disabled submit button during API calls
- Keyboard accessibility
- Proper input labels
- Browser autocomplete support
- Focus states
- Mobile-friendly input spacing
- Success notifications
- Graceful handling of network errors

Use appropriate autocomplete attributes:

- `given-name`
- `family-name`
- `email`
- `current-password`
- `new-password`

Keep error messages simple and understandable.

### Button Styling

Primary buttons:

- Navy blue background
- White text
- Rounded corners
- Smooth hover effect
- Bright-blue focus ring

Secondary links:

- Bright blue
- Underline on hover
- Accessible focus state

Do not use decorative social-login buttons unless real OAuth authentication is implemented.

---

## 12. Security Requirements

Implement:

- Password hashing through Django
- Secure session-based authentication
- CSRF protection
- Backend validation
- Rate limiting for Login and Register
- Secure password reset tokens
- Proper session invalidation on Logout
- Authentication and ownership checks on protected APIs
- No hardcoded credentials
- No sensitive information in frontend logs
- Avoid storing confidential authentication data in browser storage

Use HTTPS in production.

Do not expose session cookies to JavaScript.

Do not use mock authentication or hardcoded users.

---

## 13. Recommended Frontend Structure

```text
frontend/
├── public/
│   └── images/
│       └── auth/
│           └── tropical-sea.png
│
└── src/
    ├── pages/
    │   └── Auth/
    │       ├── Login.tsx
    │       ├── Register.tsx
    │       ├── ForgotPassword.tsx
    │       └── ResetPassword.tsx
    │
    ├── components/
    │   └── auth/
    │       ├── AuthLayout.tsx
    │       ├── AuthSeaPanel.tsx
    │       ├── AuthInput.tsx
    │       ├── PasswordInput.tsx
    │       ├── PasswordStrength.tsx
    │       └── CoastlineDivider.tsx
    │
    ├── styles/
    │   └── auth.css
    │
    ├── services/
    │   └── authService.ts
    │
    ├── hooks/
    │   └── useAuth.ts
    │
    └── routes/
        └── ProtectedRoute.tsx
```

Reuse existing project components and structures where possible.

### Shared Component Requirement

Build one reusable `AuthLayout` component.

Use it for:

- Login
- Register
- Forgot Password
- Reset Password

The background image, floating card, coastline decoration, and visual branding must remain consistent across all four pages.

Do not duplicate large blocks of JSX and CSS.

---

## 14. Performance Requirements

- Optimize the sea image for web delivery while preserving visual quality.
- Use a WebP or AVIF derivative if appropriate, retaining the original image.
- Avoid layout shifts during page loading.
- Avoid unnecessary React re-renders.
- Minimize JavaScript dependencies.
- Use CSS for simple transitions.
- Respect `prefers-reduced-motion`.
- Ensure background images load efficiently.
- Keep form interactions responsive.

Use the supplied local image rather than fetching a random remote image.

---

## 15. Testing

Test the following:

### Authentication

- Successful registration
- Duplicate email rejection
- Incorrect login credentials
- Successful login and redirect
- Session persistence after refresh
- Protected route access
- Successful logout
- Password reset flow
- Expired and invalid reset tokens

### Forms

- Password visibility toggle
- Form validation
- Password confirmation
- Password strength feedback
- Required fields
- Invalid email addresses
- CSRF protection
- Network failure handling
- Repeated submission prevention

### UI and Responsiveness

- Correct sea image rendering
- Correct image positioning
- Coastline divider rendering
- No distorted images
- No horizontal overflow
- Mobile responsiveness
- Tablet responsiveness
- Desktop responsiveness
- Accessible navigation
- Readable text on sea background
- Working Back to Home and Login/Register links

---

## 16. Important Development Rules

- Do not redesign the existing Home page.
- Maintain the same colors and typography.
- Use my uploaded tropical sea image.
- Keep the white form panel and irregular coastline-style edge.
- Do not create duplicate authentication systems.
- Reuse existing Django authentication functionality where possible.
- Do not change unrelated application modules.
- Avoid unnecessary libraries and dependencies.
- Ensure all buttons and links work.
- Keep code modular, readable, and maintainable.
- Do not replace existing database migrations without necessity.
- Do not add fake OAuth functionality.
- Do not use placeholders instead of real authentication.
- Run frontend type checking and applicable automated tests.
- Update PROGRESS.md after completing and testing the task.

---

## 17. Expected Final Result

Create four professional sea-themed authentication pages:

1. **Login** — Beautiful ocean background, floating white form, secure login.
2. **Register** — Matching design, registration form, password validation, working backend.
3. **Forgot Password** — Same design, functional reset request.
4. **Reset Password** — Same design, secure password update.

### Visual Priorities

1. The supplied beautiful tropical ocean image must be clearly visible.
2. The form should be placed inside an elegant white floating card.
3. Create a natural, coastline-inspired irregular edge between the form and the ocean panel.
4. Use navy blue, light blue, bright blue, black, and white consistently.
5. Ensure professional spacing, shadows, typography, and responsive behavior.
6. Keep the original Home page unchanged.
7. Ensure the authentication functionality is real, secure, and integrated with Django and PostgreSQL.

**Final design goal:** A beautiful, premium coastal-themed authentication experience resembling the supplied reference, while preserving the professional identity of Advanced CV & Cover Letter Studio.