-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('RENTER_TO_PROPERTY', 'OWNER_TO_RENTER');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "review_type" "ReviewType" NOT NULL,
    "property_rating" INTEGER,
    "user_rating" INTEGER NOT NULL,
    "comment" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_property_id_review_type_idx" ON "reviews"("property_id", "review_type");

-- CreateIndex
CREATE INDEX "reviews_target_user_id_review_type_idx" ON "reviews"("target_user_id", "review_type");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
