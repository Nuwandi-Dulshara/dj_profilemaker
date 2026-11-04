# Profile Studio Pro — Full Stack Web Application

A modern, production-grade digital profile and portfolio builder built with **React 19 + TypeScript + Vite** on the frontend and **Django 5.2 + Django REST Framework + MySQL** on the backend.

---

## 🚀 Features

- **Authentication & Security**: Token-based user authentication (Register, Login, Me, Logout) with password hashing and role validation.
- **Dynamic Profile Builder**:
  - Live split-screen real-time preview.
  - 4 customizable design templates: `Professional`, `Creative`, `Minimal`, `Modern`.
  - Personal details, biography, contact information, and profile photo upload.
  - Interactive skill level editor with 0–100% progress visualization.
  - Social / portfolio link manager with platform selection and validation.
- **Personal Workspace & Dashboard**:
  - View all user-created profiles with live search and filtering.
  - Edit existing profiles with prefilled data from MySQL.
  - Delete profiles with confirmation dialog and database cascade cleanup.
- **Public Profile Showcase**:
  - SEO-friendly, unique slug-based URLs: `/p/:slug`.
  - Accessible globally without authentication.
- **Relational MySQL Database**:
  - Normalized schema with UUID primary keys and cascading foreign keys.
  - Auto-generated collision-resistant URL slugs.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, React Router 7, Lucide React, Vanilla CSS.
- **Backend**: Python 3.11, Django 5.2, Django REST Framework (DRF), django-cors-headers, Pillow.
- **Database**: MySQL 8.0+ / MariaDB (`profile_studio_db`).

---

## 📁 Project Architecture

```
dj_profilemaker/
├── backend/
│   ├── accounts/              # User authentication app
│   │   ├── models.py
│   │   ├── serializers.py     # Register, Login, User serializers
│   │   ├── views.py           # RegisterView, LoginView, LogoutView, MeView
│   │   ├── urls.py            # /api/auth/*
│   │   └── tests.py           # Unit tests
│   ├── profiles/              # Profiles app
│   │   ├── models.py          # Profile, Skill, SocialLink models
│   │   ├── serializers.py     # ProfileSerializer (nested), Base64ImageField
│   │   ├── views.py           # ProfileViewSet, PublicProfileView, DashboardStatsView
│   │   ├── urls.py            # /api/profiles/* and /api/public/*
│   │   ├── tests.py           # Unit tests
│   │   └── management/
│   │       └── commands/
│   │           └── seed_data.py  # Database seeding command
│   ├── config/                # Django project settings & root URLs
│   │   ├── settings.py
│   │   └── urls.py
│   ├── media/                 # Uploaded profile photos
│   ├── .env                   # Environment configurations
│   ├── .env.example
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── api/               # API clients (auth, profiles, client)
│   │   ├── components/        # ProfileForm, ProfilePreview, ProtectedRoute
│   │   ├── context/           # AuthContext & AuthProvider
│   │   ├── data/              # Template definitions & types
│   │   ├── pages/             # Home, Auth, Dashboard, Builder, PublicProfile
│   │   ├── App.tsx            # Routes and layout
│   │   └── index.css          # Core design system
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 🗄️ Database Schema (MySQL)

### 1. `auth_user`
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `username` VARCHAR(150) UNIQUE
- `email` VARCHAR(254) UNIQUE
- `first_name` VARCHAR(150)
- `password` VARCHAR(128)
- `date_joined` DATETIME

### 2. `profiles_profile`
- `id` CHAR(36) (UUID) PRIMARY KEY
- `user_id` INT FOREIGN KEY REFERENCES `auth_user(id)` ON DELETE CASCADE
- `name` VARCHAR(255)
- `title` VARCHAR(255)
- `bio` TEXT
- `email` VARCHAR(254)
- `phone` VARCHAR(50)
- `location` VARCHAR(255)
- `photo` VARCHAR(255) (ImageField)
- `template_id` VARCHAR(50) (professional, creative, minimal, modern)
- `slug` VARCHAR(255) UNIQUE (Indexed)
- `created_at` DATETIME(6)
- `updated_at` DATETIME(6)

### 3. `profiles_skill`
- `id` CHAR(36) (UUID) PRIMARY KEY
- `profile_id` CHAR(36) FOREIGN KEY REFERENCES `profiles_profile(id)` ON DELETE CASCADE
- `name` VARCHAR(150)
- `level` SMALLINT (0 to 100)
- `order` INT

### 4. `profiles_sociallink`
- `id` CHAR(36) (UUID) PRIMARY KEY
- `profile_id` CHAR(36) FOREIGN KEY REFERENCES `profiles_profile(id)` ON DELETE CASCADE
- `platform` VARCHAR(50) (GitHub, LinkedIn, Portfolio, Instagram, Other)
- `url` VARCHAR(500)
- `order` INT

---

## 🌐 API Endpoints

### Authentication (`/api/auth/`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/` | Register new user account | No |
| `POST` | `/api/auth/login/` | Log in and receive Token | No |
| `POST` | `/api/auth/logout/` | Invalidate current auth token | Yes (Token) |
| `GET` | `/api/auth/me/` | Fetch current user details | Yes (Token) |

### Profiles (`/api/profiles/`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profiles/` | List all profiles owned by user (supports `?search=`) | Yes (Token) |
| `POST` | `/api/profiles/` | Create a new profile with nested skills & links | Yes (Token) |
| `GET` | `/api/profiles/<id>/` | Retrieve profile by UUID | Yes (Token) |
| `PUT` | `/api/profiles/<id>/` | Update profile with nested skills & links | Yes (Token) |
| `DELETE` | `/api/profiles/<id>/` | Delete profile and all linked records | Yes (Token) |
| `GET` | `/api/profiles/dashboard/stats/` | Get statistics for user workspace | Yes (Token) |

### Public Profiles (`/api/public/`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/public/p/<slug>/` | View public profile by slug | No |

---

## ⚙️ Setup and Installation Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- MySQL Server 8.0+ running on `127.0.0.1:3306`

### 1. Database Setup
Ensure MySQL is running and the database exists:
```sql
CREATE DATABASE IF NOT EXISTS profile_studio_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup
```bash
cd backend

# Create & activate virtual environment (if not already created)
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux/Mac

# Install dependencies
pip install django djangorestframework django-cors-headers mysqlclient pillow python-dotenv

# Configure environment variables in backend/.env
# Copy from .env.example if needed

# Apply database migrations
python manage.py migrate

# Seed initial demo user and demo profile
python manage.py seed_data

# Run Django unit tests
python manage.py test

# Start the Django development server
python manage.py runserver 127.0.0.1:8000
```

**Default Demo Credentials:**
- Email: `alex@example.com`
- Password: `password123`

### 3. Frontend Setup
```bash
cd frontend

# Install npm packages
npm install

# Build verification
npm run build

# Start the Vite development server
npm run dev
```

The frontend will run at `http://localhost:5173/` (or next available port).

---

## 🧪 Testing and Verification

Run backend unit tests:
```bash
cd backend
venv\Scripts\python.exe manage.py test
```

Run end-to-end integration verification:
```bash
cd backend
venv\Scripts\python.exe test_e2e.py
```
