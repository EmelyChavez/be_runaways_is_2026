-- CreateTable
CREATE TABLE "no_availabilities" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "no_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "no_availabilities_property_id_start_date_end_date_idx" ON "no_availabilities"("property_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "no_availabilities" ADD CONSTRAINT "no_availabilities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
