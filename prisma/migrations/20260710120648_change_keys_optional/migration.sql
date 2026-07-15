-- AlterTable
ALTER TABLE "organization" ALTER COLUMN "privateKeyEncrypted" DROP NOT NULL,
ALTER COLUMN "publicKey" DROP NOT NULL;
