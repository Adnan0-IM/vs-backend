# Secure Document Verification system Using Digital Signatures and QR-Codes (Veridoc) Backend

This repository contains the backend API for a document signing and verification platform.

## Note

Internet connectivity is required for the app to function, as it relies on uploadthing for file uploads and resend for email notifications. The app is designed to be used in a modern browser with JavaScript enabled.

```bash
docker compose up -d db
```

it will pull the postgres db image and start the container

check `.env` and `.env.production` or simply visit to hosted site on https://vs.adnanilyas.dev or https://vs.adnanilyas.com

## Overview

This app is designed for organizations to issue signed documents, verify their authenticity, and track verification activity. It provides an API for authentication, organization management, document signing, QR-based verification, and audit logging.

The backend is built with:
- Express
- TypeScript
- Prisma + PostgreSQL
- Better Auth
- UploadThing for file storage
- RSA cryptography for document signing
- QR code generation for verification links

## Main functionality

### 1. Authentication and organization management
The backend supports user authentication and organization-aware access control. Users can belong to organizations and have roles such as:
- owner
- admin
- member

Organizations can also generate RSA key pairs used for signing documents.

### 2. Document signing
Authenticated organization members can upload a document, then the backend:
- downloads the original file
- embeds a QR code that links to a verification page
- hashes the signed PDF content
- decrypts the organization’s private key
- signs the hash using RSA
- uploads the signed version back to storage
- saves the metadata and signature in the database

This creates a verifiable document record tied to the issuing organization.

### 3. Verification by QR code or uploaded file
Anyone can verify a signed document through the API:
- by scanning a verification token in the QR code
- or by uploading a file to compare against known signed documents

The verification flow checks:
- whether the file hash matches the original signed document
- whether the digital signature is valid using the organization public key
- whether the document has been revoked or is otherwise invalid

### 4. Verification logging and dashboard data
The app records verification attempts and supports organization dashboard stats such as:
- total documents
- active documents
- revoked documents
- total verifications
- verification success rate
- recent document activity
- recent verification logs

## Project structure

- src/index.ts — Express app entry point and API setup
- src/routes/organizationRoutes.ts — organization-related routes
- src/routes/documentRoutes.ts — document-related routes
- src/controllers/organizationController.ts — organization logic and stats
- src/controllers/documentController.ts — signing, verification, and log logic
- src/lib/auth.ts — Better Auth configuration
- src/middlewares/authMiddleware.ts — auth middleware
- src/services/cryptoService.ts — RSA and hashing utilities
- src/services/emailService.ts — invitation and email sending logic
- prisma/schema.prisma — database schema
- public/ — static assets

## Key routes

### Public routes
- GET /healthz — health check
- GET /api/documents/verify/:token — verify document by token
- POST /api/documents/verify-file — verify document by uploaded file content

### Authenticated routes
- POST /api/organization/generate-keys
- GET /api/organization/dashboard-stats
- POST /api/documents/upload-and-sign
- GET /api/documents/list
- POST /api/documents/revoke
- GET /api/documents/verification-logs

## Database model

The application stores the following core entities:
- User
- Organization
- Member
- Invitation
- SignedDocument
- VerificationLog

Signed documents include:
- title
- original filename
- file URL
- document hash
- digital signature
- verification token
- status
- signer and organization references

## Notes

This repository is the backend API layer. It does not appear to include a frontend web app in the same workspace; instead, it is meant to power a client application that interacts with these endpoints.


## Intended use

This backend is best suited for scenarios where an organization needs to:
- issue verifiable documents
- prove authenticity with cryptographic signatures
- provide a secure verification workflow for recipients or auditors
- monitor document trust and verification history
