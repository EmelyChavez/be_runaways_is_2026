-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CHARGE');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "verified_only" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "transaction_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_history_booking_id_created_at_idx" ON "transaction_history"("booking_id", "created_at");

-- AddForeignKey
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
