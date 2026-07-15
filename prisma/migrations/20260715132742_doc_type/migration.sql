-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Certificate', 'Transcript', 'Letter', 'Diploma', 'Other');

-- AlterTable
ALTER TABLE "SignedDocument" ADD COLUMN     "type" "DocumentType" NOT NULL DEFAULT 'Other';
