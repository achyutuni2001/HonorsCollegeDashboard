# Honors College Analytics Dashboard

Analytics platform for semester-wise Honors College reporting with role-based access, upload workflows, filters, trends, forecasting, and export support.

## What This Application Does

This app helps academic/admin teams:

- Upload semester roster files (`.csv`, `.xls`, `.xlsx`)
- Explore student records with dynamic filters
- Analyze academic and demographic distributions
- Compare trends across semesters and campuses
- View forecasting-oriented strategic metrics
- Export filtered records as CSV and charts/KPIs as PDF
- Manage access roles (`admin` / `viewer`)
- Audit upload/rename/delete activities

## Core Features

- Authentication with Better Auth:
  - Email/password sign in + sign up
  - Google sign-in
- Role-based authorization:
  - `admin`: upload, rename, delete, access management
  - `viewer`: read-only analytics access
- Dashboard sections:
  - Overview
  - Academic
  - Demographics
  - Trends
  - Forecasting
  - Semesters management
- Interactive charts and table filtering
- Bulk upload support
- Semester management table with view/delete controls
- Delete confirmation modals for destructive actions
- Dark/light themes and enhanced UI transitions

## Tech Stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Tailwind CSS
- Recharts
- Zustand (filter state)
- Better Auth
- Drizzle ORM + PostgreSQL

## Project Structure

- `app/` - routes, pages, and API handlers
- `components/` - UI and dashboard components
- `lib/` - auth, analytics services, access-control logic, utilities
- `db/` - Drizzle schema definitions
- `stores/` - Zustand state stores
- `types/` - shared TypeScript response/request types
- `public/` - static media assets

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set these values:

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAILS`

### 3. Prepare database

```bash
npm run db:push
```

Optional migration flow:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Run dev server

```bash
npm run dev
```

Open: `http://localhost:3000`

## Authentication and Access Model

- Users sign in via email/password or Google.
- Role resolution:
  - Explicit role from `platform_user_roles` table (if set)
  - Fallback from `ADMIN_EMAILS` env (default admins)
  - Otherwise default is `viewer`
- Admin-only operations are enforced in API handlers (not only in UI).

## Upload Behavior

- Supports one or multiple files per request.
- Accepted types:
  - CSV
  - XLS
  - XLSX
- Semester label defaults to filename when not explicitly provided.
- Rows are normalized via header alias mapping (`lib/roster-mapping.ts`).

### Supported header aliases (examples)

- Panther ID: `panther id`, `student id`, `pid`, `id`
- Name: `first name`, `last name`, `full name`, `student name`
- GPA: `gpa`, `overall gpa`, `cumulative gpa`, `institutional gpa`
- Campus: `campus`, `home campus`, `campus description`
- Major: `major description`, `major`, `major_desc`
- Class: `class standing`, `standing`
- Student Type: `student type`, `type`
- Dual Enrollment: `dual enrollment`, `de`, `dual enrollment indicator`

## Key API Endpoints

- `POST /api/upload` - upload one/multiple semester files
- `GET /api/datasets` - list datasets
- `PATCH /api/datasets/[datasetId]` - rename dataset (admin)
- `DELETE /api/datasets/[datasetId]` - delete dataset (admin)
- `GET /api/analytics/summary` - summary KPIs/charts
- `GET /api/analytics/records` - paginated table records
- `GET /api/analytics/records/export` - CSV export
- `GET /api/analytics/semester-trends` - cross-semester trends
- `GET /api/analytics/strategic` - strategic/forecast-oriented metrics
- `GET /api/admin/users` - list users/roles (admin)
- `PATCH /api/admin/users` - update role (admin)

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - lint checks
- `npm run db:generate` - generate Drizzle migration files
- `npm run db:migrate` - run migrations
- `npm run db:push` - push schema directly

## Deployment Notes

- Set all auth URLs to your deployed origin.
- Add production domain to `BETTER_AUTH_TRUSTED_ORIGINS`.
- Configure Google OAuth redirect URIs:
  - `https://<your-domain>/api/auth/callback/google`
- Use a strong `BETTER_AUTH_SECRET`.
- Use managed Postgres and secure network/firewall rules.

## Troubleshooting

- `ERR_CONNECTION_REFUSED`:
  - Ensure server is running: `npm run dev`
- Google login callback fails:
  - Verify `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`, and Google redirect URI
- No charts/data:
  - Confirm at least one dataset is uploaded and selected
- Viewer can’t upload/delete:
  - This is expected behavior by role policy

## Security Notes

- Authorization is enforced server-side for privileged routes.
- Avoid committing `.env` files.
- Rotate OAuth secrets and app secrets periodically.

