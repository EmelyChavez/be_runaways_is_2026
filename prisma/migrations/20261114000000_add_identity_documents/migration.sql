CREATE TYPE "IdentityDocumentType" AS ENUM ('DUI', 'PASSPORT');
CREATE TYPE "IdentityDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "identity_document" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "document_type" "IdentityDocumentType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "document_status" "IdentityDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejection_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    CONSTRAINT "identity_document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "identity_document_profile_id_key" ON "identity_document"("profile_id");

ALTER TABLE "identity_document" ADD CONSTRAINT "identity_document_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
