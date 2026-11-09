ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_user_rating_range" CHECK ("user_rating" BETWEEN 1 AND 5),
    ADD CONSTRAINT "reviews_property_rating_range" CHECK (
        "property_rating" IS NULL OR "property_rating" BETWEEN 1 AND 5
    ),
    ADD CONSTRAINT "reviews_property_rating_by_type" CHECK (
        ("review_type" = 'RENTER_TO_PROPERTY' AND "property_rating" IS NOT NULL)
        OR ("review_type" = 'OWNER_TO_RENTER' AND "property_rating" IS NULL)
    );
