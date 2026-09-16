-- The expiry worker scans only started, unfinished attempts every ten seconds.
CREATE INDEX "SeviyeCehd_open_started_idx"
ON "SeviyeCehd" ("girisVaxti")
WHERE "girisVaxti" IS NOT NULL AND "cixisVaxti" IS NULL;
