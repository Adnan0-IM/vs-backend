/*
  Warnings:

  - You are about to drop the column `pdfUrl` on the `SignedDocument` table. All the data in the column will be lost.
  - You are about to drop the column `signatureHash` on the `SignedDocument` table. All the data in the column will be lost.
  - You are about to drop the column `verificationId` on the `SignedDocument` table. All the data in the column will be lost.
  - The `role` column on the `invitation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[verificationToken]` on the table `SignedDocument` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `digitalSignature` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentHash` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileSize` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUrl` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalFilename` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verificationToken` to the `SignedDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `privateKeyEncrypted` to the `organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicKey` to the `organization` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('QR_SCAN', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('VERIFIED', 'TAMPERED', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member');

-- DropForeignKey
ALTER TABLE "SignedDocument" DROP CONSTRAINT "SignedDocument_organizationId_fkey";

-- DropIndex
DROP INDEX "SignedDocument_verificationId_key";

-- AlterTable
ALTER TABLE "SignedDocument" DROP COLUMN "pdfUrl",
DROP COLUMN "signatureHash",
DROP COLUMN "verificationId",
ADD COLUMN     "digitalSignature" TEXT NOT NULL,
ADD COLUMN     "documentHash" TEXT NOT NULL,
ADD COLUMN     "fileSize" INTEGER NOT NULL,
ADD COLUMN     "fileUrl" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "originalFilename" TEXT NOT NULL,
ADD COLUMN     "signedPdf" TEXT,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verificationToken" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "invitation" DROP COLUMN "role",
ADD COLUMN     "role" "MemberRole";

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "privateKeyEncrypted" TEXT NOT NULL,
ADD COLUMN     "publicKey" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "verificationType" "VerificationType" NOT NULL,
    "verificationResult" "VerificationResult" NOT NULL,
    "verifiedByUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "verificationTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationLog_documentId_idx" ON "VerificationLog"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "SignedDocument_verificationToken_key" ON "SignedDocument"("verificationToken");

-- AddForeignKey
ALTER TABLE "SignedDocument" ADD CONSTRAINT "SignedDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SignedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
