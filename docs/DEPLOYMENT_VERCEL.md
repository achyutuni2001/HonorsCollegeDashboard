# Vercel Deployment Notes

## 1. Prerequisites
- PostgreSQL database (Neon, Supabase, RDS, etc.)
- `DATABASE_URL` set in Vercel project environment variables

## 2. Environment Variables
Set the following in Vercel (Production / Preview as needed):

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_NAME` (optional)

## 3. Build Settings
- Framework preset: `Next.js`
- Install command: `npm install`
- Build command: `npm run build`

## 4. Drizzle on Vercel
Use one of these patterns:

- Recommended: run Drizzle migrations in CI/CD before deploy (`npm run db:migrate`)
- Alternative (quick setup): run `npm run db:push` from local/CI for schema sync

Suggested `package.json` postinstall if desired (if you generate SQL/migrations in CI):

```json
{
  "scripts": {
    "postinstall": "echo no-postinstall-needed"
  }
}
```

## 5. Create Tables / Indexes
From local or CI:

```bash
npm install
npm run db:push
# or use generated migrations:
npm run db:generate
npm run db:migrate
```

## 6. Upload Limits
- Vercel serverless request body limits may affect very large roster uploads.
- For larger files, consider:
  - Vercel Blob / S3 direct upload
  - background ingest job (queue)
  - chunked import pipeline

## 7. Runtime Notes
- The upload route uses Node.js runtime (`app/api/upload/route.ts`)
- Summary and records APIs are dataset-scoped and support filter-driven refetches

## 8. Performance Guidance
- Keep the Drizzle indexes from `db/schema.ts`
- Paginate records endpoint (already implemented)
- Avoid client-side full dataset fetches (dashboard uses summary + paginated records APIs)
