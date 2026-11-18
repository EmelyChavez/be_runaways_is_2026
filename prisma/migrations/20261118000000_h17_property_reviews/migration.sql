CREATE UNIQUE INDEX "reviews_reservation_id_review_type_key"
ON "reviews"("reservation_id", "review_type");
