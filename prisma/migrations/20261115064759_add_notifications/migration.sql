-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "OriginModule" AS ENUM ('RESERVATIONS', 'PAYMENTS', 'MESSAGING', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('RESERVATION_CREATED', 'PAYMENT_CONFIRMED', 'RESERVATION_CANCELED_EXPIRED', 'RESERVATION_FINISHED', 'MESSAGE_NEW', 'DEPOSIT_RETURNED', 'DEPOSIT_RETURNED_AUTO', 'DEPOSIT_RETAINED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "event_type" "NotificationEventType" NOT NULL,
    "origin_module" "OriginModule" NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "message" VARCHAR(250) NOT NULL,
    "reference_id" UUID,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_status_idx" ON "notifications"("recipient_id", "status");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
