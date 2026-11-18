UPDATE properties SET verified_only = TRUE WHERE verified_only = FALSE;
ALTER TABLE properties ALTER COLUMN verified_only SET DEFAULT TRUE;
ALTER TABLE properties ADD CONSTRAINT properties_verified_only_required CHECK (verified_only = TRUE);
