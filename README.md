# VeriDoc backend

This directory contains the Express API for VeriDoc, a document signing and
verification platform. The API handles authentication, organizations,
document signing, QR-code verification, file uploads, and verification logs.

## Run locally

The frontend and backend are separate applications. Start the backend first,
then start the frontend in a second terminal.

### Prerequisites

- [Bun](https://bun.sh/) (the project uses Bun scripts and `bun.lock`)
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose, for local
  PostgreSQL
- A modern browser
- Internet access for UploadThing file storage and Resend email delivery

### 1. Install dependencies

From this directory:

```bash
bun install
```

### 2. Start PostgreSQL

The Compose file starts only the database; the API itself runs with Bun:

```bash
docker compose up -d db
```

PostgreSQL is exposed on `localhost:5432` with these local development
credentials:

```text
database: app
user: postgres
password: postgres
```

To stop the database later:

```bash
docker compose down
```

The database data is stored in the `db-data` Docker volume. Remove that volume
only if you intentionally want to delete the local database.

### 3. Configure environment variables

Create `vs-backend/.env` and set these values. Do not commit `.env` or share
real credentials.

```dotenv
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public
UPLOADTHING_TOKEN=your-uploadthing-token
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=invitations@example.com
FRONTEND_URL=http://localhost:5173
```

`UPLOADTHING_TOKEN` is required for document uploads. `RESEND_API_KEY` and
`EMAIL_FROM` are required for invitation emails. For a local-only setup, use
the hosted service credentials from your team rather than committing
credentials to the repository.

### 4. Apply the database migrations

Run this after PostgreSQL is available and whenever a new migration is added:

```bash
bunx prisma migrate deploy
```

### 5. Start the API

```bash
bun run dev
```

The API listens on [http://localhost:3000](http://localhost:3000). Check that
it is running with:

```bash
curl http://localhost:3000/healthz
```

The expected response contains `"status":"ok"`.

## Run the frontend

In a second terminal:

```bash
cd ../vs-frontend
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite development
proxy and the frontend API client use `http://localhost:3000` by default. To
use another API URL, set `VITE_API_URL` in `vs-frontend/.env`, including the
`/api` path, for example:

```dotenv
VITE_API_URL=http://localhost:3000/api
VITE_AUTH_ORIGIN=http://localhost:5173
```

## Useful commands

```bash
bun run build          # Generate Prisma Client and compile TypeScript
bun run test           # Run the backend tests
bun run test:coverage  # Run tests with coverage
bunx prisma studio    # Inspect the local database
```

## API routes

### Public routes

- `GET /healthz` — health check
- `GET /api/documents/verify/:token` — verify a document by token
- `POST /api/documents/verify-file` — verify an uploaded document

### Authenticated routes

- `POST /api/organization/generate-keys`
- `GET /api/organization/dashboard-stats`
- `POST /api/documents/upload-and-sign`
- `GET /api/documents/list`
- `POST /api/documents/revoke`
- `GET /api/documents/verification-logs`

## Project structure

- `src/index.ts` — Express app entry point and API setup
- `src/routes/organizationRoutes.ts` — organization routes
- `src/routes/documentRoutes.ts` — document routes
- `src/controllers/organizationController.ts` — organization logic and stats
- `src/controllers/documentController.ts` — signing, verification, and logs
- `src/lib/auth.ts` — Better Auth configuration
- `src/middlewares/authMiddleware.ts` — authentication middleware
- `src/services/cryptoService.ts` — RSA and hashing utilities
- `src/services/emailService.ts` — invitation email logic
- `prisma/schema.prisma` — database schema

## Production

For production, provide production values for all environment variables,
especially `BETTER_AUTH_URL`, `DATABASE_URL`, and `FRONTEND_URL`. Apply
migrations with `bunx prisma migrate deploy`, then build and start the
compiled API using the deployment platform's configured start command.

