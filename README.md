# BrewAnalytics

BrewAnalytics is a Next.js frontend backed by an Express API and PostgreSQL
database managed with Prisma. The backend imports sales CSV/Excel files and
related workbook data, then provides dataset validation and analytics.

## Requirements

- Node.js and npm versions supported by the installed Next.js and Prisma packages.
- PostgreSQL. Neon is supported through `DATABASE_URL`.
- The frontend and backend must use matching API origin/CORS settings.

## Local setup

Configure the backend without committing credentials:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Set the values in `backend/.env` for `DATABASE_URL`, `JWT_SECRET`, `PORT`,
`FRONTEND_URL`, and `NODE_ENV`. To create or update the administrator account,
also set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. The seed script
upserts that account and replaces its password hash when run; use it only when
that is intended:

```powershell
npx prisma generate
npx prisma migrate status
```

`npm run dev` starts the API on `PORT` (8000 by default). Before applying
migrations, verify the target database and review the pending migration files.
For a disposable local development database, apply migrations with
`npx prisma migrate dev`. For an existing or deployment database, take a
backup and apply only reviewed migrations with `npx prisma migrate deploy`.
Never reset a database containing data that must be preserved. After the
required migrations have been applied, provision the administrator if needed
and start the API:

```powershell
npx tsx prisma/seed.ts
npm run dev
```

In another terminal, configure and start the frontend:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
```

Set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` to the backend origin
(for example, `http://localhost:8000`), then run:

```powershell
npm run dev
```

Open `http://localhost:3000`. Sign in with the administrator account configured
for the backend.

## Imports and analytics

- CSV and single-sheet sales workbooks can create a dataset.
- Excel workbook preview lists sheets, headers, sample rows, row counts, and
  structural warnings. Multi-sheet workbooks do not create a dataset through
  the legacy sales upload.
- After creating a dataset, its details page supports imports for Products and
  Customers, Sales Transactions, and Marketing Campaigns worksheets.
- Uploads are limited to 10 MB and accept `.csv`, `.xlsx`, and `.xls`; Excel
  preview and supplementary worksheet imports accept Excel files only.
- Dataset validation is read-only. Campaign comparisons are period-based
  observations, not proof of campaign attribution or effectiveness.

## Checks

Backend commands:

```powershell
cd backend
npm test
npm run build
npx prisma validate
npx prisma migrate status
```

Database-backed integration tests require `DATABASE_URL_TEST` to point to a
local PostgreSQL test database. Those tests are skipped when it is not set and
reject non-local database hosts. Never point this variable at production.

Frontend commands:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run build
```

There is currently no frontend test script or backend lint script configured.

## Production deployment

1. Configure backend `DATABASE_URL`, a unique high-entropy `JWT_SECRET`,
   `FRONTEND_URL` (the exact HTTPS frontend origin), `PORT`, and
   `NODE_ENV=production` in the deployment environment. Set administrator
   credentials through a secure secret mechanism only if provisioning an
   account.
2. Review pending Prisma migrations and take a database backup according to
   the hosting provider's procedure. Apply only reviewed migrations using
   `npx prisma migrate deploy`; do not use `migrate reset`.
3. Build and start the backend:

   ```powershell
   cd backend
   npm ci
   npx prisma generate
   npm run build
   npm start
   ```

4. Set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend origin before
   building the frontend. This variable is public and must not contain
   credentials or secrets.
5. Build and start the frontend:

   ```powershell
   cd frontend
   npm ci
   npm run build
   npm start
   ```

6. Verify `/api/health`, sign-in, dataset import, and analytics in the deployed
   environment. The API uses credentialed CORS and an HttpOnly authentication
   cookie; production uses the secure-cookie setting.

Environment files are ignored by Git. Never commit `.env`, `.env.local`,
database URLs, administrator passwords, or JWT secrets. No Docker deployment
configuration is currently included.
