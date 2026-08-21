# Backend Testing Prompt

You are working on the Express + TypeScript backend of VeriDoc, a secure document verification system using:

* Node.js
* Express
* TypeScript
* PostgreSQL
* Prisma
* better-auth
* Vitest
* Supertest
* MSW
* UploadThing
* RSA digital signatures
* SHA-256 hashing
* QR-code-based verification

Your task is to create a comprehensive automated backend test suite using Vitest, Supertest, and MSW.

## Critical testing rule

Use the tools for their correct purposes:

### Vitest

Use Vitest for:

* test execution
* assertions
* unit tests
* controlled mocks
* isolated service tests

### Supertest

Use Supertest to test the real Express application:

request
→ middleware
→ authentication/authorization
→ route
→ controller
→ service
→ database/mock boundary

Do NOT mock the Express route being tested.

### MSW

Use MSW to mock external HTTP services.

Examples:

* UploadThing HTTP interactions
* external APIs
* third-party HTTP services

Do NOT use MSW to mock the Express API when Supertest is supposed to test that API.

## Important rules

1. Do not rewrite production code unnecessarily.
2. Do not weaken authentication or authorization merely to make tests easier.
3. Do not disable security middleware in tests unless there is a specific documented reason.
4. Do not fabricate test results.
5. Do not skip failing tests.
6. Do not test third-party internals.
7. Keep tests deterministic.
8. Use isolated test data.
9. Do not use the production database.
10. Prefer a dedicated test database or controlled database strategy.
11. Clean up test data between tests or use transactions where appropriate.
12. Never use real production credentials or real private keys.
13. Do not expose private keys in test output.
14. Do not store secrets directly in test source code.
15. Run the full test suite after implementation.

# 1. Authentication tests

Test the actual Express authentication behavior.

Cover:

* registration
* login
* logout
* authenticated request
* unauthenticated request
* invalid credentials
* invalid session
* expired/invalid authentication state where applicable

Expected behavior should match the application's actual API contract.

Do not test better-auth internals.

Test how our application responds to authenticated and unauthenticated users.

# 2. Authorization tests

This is especially important.

Test:

* OWNER can perform owner operations.
* ADMIN can perform permitted administrative operations.
* MEMBER can perform permitted member operations.
* MEMBER cannot perform owner/admin-only operations.
* Users who do not belong to an organization cannot access its resources.
* A user from Organization A cannot access Organization B's documents.
* Unauthenticated users cannot access protected management endpoints.

Explicitly test IDOR-style cases:

User A attempts:

GET /api/documents/<document-owned-by-user-B>

Expected:

401/403/404 according to the application's actual security design.

Do not assume that hiding a document in the frontend is sufficient protection.

# 3. Organization tests

Test:

* organization creation
* duplicate slug
* invalid organization data
* organization retrieval
* organization update
* membership creation
* membership retrieval
* member role handling
* unauthorized organization operations

Also verify that organization creation correctly produces:

* public key
* encrypted private key

Verify that the raw private key is NOT stored in the database.

# 4. Cryptographic service unit tests

Test the crypto service independently.

### RSA key generation

Verify:

* public key is generated
* private key is generated
* keys are valid
* public/private key pair corresponds

### SHA-256

Verify:

same input → same hash

different input → different hash

### Signing

Verify:

valid data + correct private key → valid signature

### Signature verification

Verify:

original data + correct signature + public key → true

modified data + original signature + public key → false

wrong public key + original signature → false

modified signature → false

### Private-key encryption

Verify:

private key
→ encrypt
→ decrypt
→ original private key

Also verify that tampering with the encrypted value causes decryption failure.

Do not log private keys or complete encrypted key values.

# 5. Document upload tests

Using Supertest, test the real upload endpoint.

Cover:

* authenticated PDF upload
* unauthenticated upload
* valid PDF
* unsupported file type
* missing file
* oversized file if size limits exist
* malformed upload
* organization authorization

Verify that successful upload creates the correct database record.

Verify the initial status is:

DRAFT

Do not use the real UploadThing service for every test.

Use MSW or an appropriate test abstraction at the external-service boundary.

# 6. Document signing tests

Test the complete signing endpoint.

Cover:

* authenticated authorized signer
* unauthorized signer
* nonexistent document
* nonexistent organization
* signing a DRAFT document
* attempting to sign an already ACTIVE document
* attempting to sign a REVOKED document if prohibited

Verify after successful signing:

* document hash exists
* signature exists
* verification token exists
* signed PDF URL exists
* document status becomes ACTIVE
* QR code was generated/embedded according to the application's implementation

Do not expose private keys in the response.

# 7. Digital-signature tampering test

This is one of the most important tests in the project.

Create an issued document.

Verify:

original issued document
→ VALID

Then modify the document.

Verify:

modified document
→ INVALID_SIGNATURE

Also test:

original document

* wrong organization's public key
  → INVALID_SIGNATURE

These tests directly demonstrate the security objective of the project.

# 8. QR verification tests

Test:

GET /api/verification/:token

Cover:

* valid token
* nonexistent token
* revoked document
* invalid signature
* valid signature
* malformed token
* repeated verification

Verify that every verification attempt creates the appropriate VerificationLog.

Test that public verification works without authentication if that is part of the approved system design.

# 9. PDF verification tests

Test the PDF verification endpoint.

Cover:

* valid issued PDF
* modified issued PDF
* nonexistent/unknown document
* revoked document
* malformed PDF
* unsupported file
* missing file

Expected results should match the application's defined verification enum.

For example:

VALID
INVALID_SIGNATURE
REVOKED
NOT_FOUND

# 10. Revocation tests

Test:

* authorized administrator revokes ACTIVE document
* unauthorized member cannot revoke
* nonexistent document
* already revoked document
* revocation reason is stored
* revokedAt is stored
* status changes to REVOKED

Then verify:

revoked document
→ verification
→ REVOKED

# 11. Verification logging tests

Verify that verification creates a log containing:

* documentId
* verificationType
* verificationResult
* verifiedBy where applicable
* verificationTimestamp

Test both:

QR_CODE

and

PDF_UPLOAD

verification.

# 12. Security boundary tests

Explicitly test:

### Authentication boundary

No session → protected endpoint rejected.

### Authorization boundary

Wrong role → operation rejected.

### Organization boundary

User from Organization A → cannot access Organization B resources.

### Document boundary

User without document permission → cannot sign/revoke/access restricted resource.

### Cryptographic boundary

Wrong key → signature invalid.

### Tampering boundary

Modified PDF → signature invalid.

### Secret boundary

Private key → never appears in API response.

Private key → never appears in application logs.

# 13. API error handling

Test that expected failures return the correct HTTP status and structured response.

Cover at least:

* 400 Bad Request
* 401 Unauthorized
* 403 Forbidden
* 404 Not Found
* 409 Conflict where applicable
* 500 Internal Server Error where applicable

Do not force every error into the same response.

Follow the application's existing error contract.

# 14. Database testing

Use a dedicated test database.

Do not run destructive tests against the development/production database.

Verify important database constraints, including:

* unique organization slug
* unique verification token
* organization membership uniqueness
* foreign-key relationships
* document status
* cascading behavior where intentionally configured

# 15. External service mocking

Use MSW for external HTTP calls.

At minimum, test:

### UploadThing success

External storage accepts upload.

Expected application behavior:

document processing continues successfully.

### UploadThing failure

External storage returns an error.

Expected application behavior:

document should not incorrectly become ACTIVE.

This is important.

A storage failure must not result in a database state that falsely says the document was successfully issued.

# 16. Integration workflow tests

Create at least one end-to-end backend workflow:

## Successful issuance

registration/authentication
→ organization
→ PDF upload
→ DRAFT
→ signing
→ QR embedding
→ UploadThing
→ ACTIVE
→ QR verification
→ VALID

And one failure workflow:

PDF upload
→ DRAFT
→ signing
→ modified PDF
→ verification
→ INVALID_SIGNATURE

And:

ACTIVE
→ revoke
→ verification
→ REVOKED

These workflows are particularly useful evidence for the final project.

# 17. Test isolation

Tests must not depend on execution order.

Each test should establish the state it requires.

Avoid:

test A creates organization
↓
test B assumes organization still exists

Instead, each test should create its own required data or use controlled fixtures.

# 18. Coverage

Run Vitest coverage.

Prioritize:

* authentication middleware
* authorization middleware
* organization service
* document service
* cryptographic service
* signing service
* verification service
* revocation service
* important API routes

Do not chase 100% coverage merely for the number.

Prioritize security-critical and business-critical code.

# 19. Final commands

Use the project's existing scripts where possible.

For example:

npm test

and:

npm run test:coverage

If these scripts don't exist, inspect package.json and use the project's configured Vitest commands rather than blindly changing the project configuration.

# 20. Final report

After implementation, provide an actual report containing:

* total test count
* passed tests
* failed tests
* skipped tests
* coverage
* security tests performed
* any bugs discovered
* any tests that could not be automated and why

Do not claim a test passed unless it actually passed.

If production bugs are discovered, explain them separately and fix them only after identifying the cause.

Before writing any tests, inspect the existing backend codebase and determine the actual API contract and implementation flow. Treat the source code as the source of truth. Do not invent routes, response values, database fields, enums, or behaviors that are not present in the code.