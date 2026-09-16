-- Application code deactivates the previous exam before activating another one.
-- This partial index also protects that invariant under concurrent admin requests.
CREATE UNIQUE INDEX "SeviyeImtahani_single_active_key"
ON "SeviyeImtahani" ("aktiv")
WHERE "aktiv" = true;
