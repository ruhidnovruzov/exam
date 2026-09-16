-- Additive/data-preserving migration: existing exams, questions, attempts and
-- results are never deleted or recreated.
CREATE TABLE "SeviyeImtahanSeriyasi" (
  "id" SERIAL NOT NULL,
  "ad" TEXT NOT NULL,
  "aktiv" BOOLEAN NOT NULL DEFAULT true,
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "yenilendi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeviyeImtahanSeriyasi_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SeviyeImtahani"
ADD COLUMN "seriyaId" INTEGER,
ADD COLUMN "sessiyaNo" INTEGER NOT NULL DEFAULT 1;

-- Put all existing level-exam records into one preserved series. In the usual
-- production case this is the already configured exam for tomorrow.
INSERT INTO "SeviyeImtahanSeriyasi" ("ad")
SELECT COALESCE((SELECT "ad" FROM "SeviyeImtahani" ORDER BY "yaradildi" ASC LIMIT 1), 'İngilis dili səviyyə imtahanı')
WHERE EXISTS (SELECT 1 FROM "SeviyeImtahani");

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "baslamaVaxti", "id")::INTEGER AS session_no
  FROM "SeviyeImtahani"
), only_series AS (
  SELECT "id" FROM "SeviyeImtahanSeriyasi" ORDER BY "id" LIMIT 1
)
UPDATE "SeviyeImtahani" exam
SET "seriyaId" = only_series."id", "sessiyaNo" = numbered.session_no
FROM numbered, only_series
WHERE exam."id" = numbered."id";

CREATE TABLE "SeviyeImtahanIstirak" (
  "id" SERIAL NOT NULL,
  "seriyaId" INTEGER NOT NULL,
  "etsStudentId" TEXT NOT NULL,
  "cehdId" INTEGER,
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeviyeImtahanIstirak_pkey" PRIMARY KEY ("id")
);

-- Preserve historical attempts. If old test data contains more than one
-- attempt for a student, the earliest one becomes the participation claim;
-- none of the attempts/results themselves are removed.
INSERT INTO "SeviyeImtahanIstirak" ("seriyaId", "etsStudentId", "cehdId", "yaradildi")
SELECT DISTINCT ON (exam."seriyaId", attempt."etsStudentId")
       exam."seriyaId", attempt."etsStudentId", attempt."id", attempt."yaradildi"
FROM "SeviyeCehd" attempt
JOIN "SeviyeImtahani" exam ON exam."id" = attempt."seviyeImtahanId"
WHERE exam."seriyaId" IS NOT NULL
ORDER BY exam."seriyaId", attempt."etsStudentId", attempt."yaradildi", attempt."id";

CREATE UNIQUE INDEX "SeviyeImtahanIstirak_seriyaId_etsStudentId_key"
ON "SeviyeImtahanIstirak"("seriyaId", "etsStudentId");
CREATE UNIQUE INDEX "SeviyeImtahanIstirak_cehdId_key"
ON "SeviyeImtahanIstirak"("cehdId");
CREATE UNIQUE INDEX "SeviyeImtahani_seriyaId_sessiyaNo_key"
ON "SeviyeImtahani"("seriyaId", "sessiyaNo");
CREATE INDEX "SeviyeImtahani_seriyaId_baslamaVaxti_idx"
ON "SeviyeImtahani"("seriyaId", "baslamaVaxti");

ALTER TABLE "SeviyeImtahani" ADD CONSTRAINT "SeviyeImtahani_seriyaId_fkey"
FOREIGN KEY ("seriyaId") REFERENCES "SeviyeImtahanSeriyasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeviyeImtahanIstirak" ADD CONSTRAINT "SeviyeImtahanIstirak_seriyaId_fkey"
FOREIGN KEY ("seriyaId") REFERENCES "SeviyeImtahanSeriyasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeviyeImtahanIstirak" ADD CONSTRAINT "SeviyeImtahanIstirak_cehdId_fkey"
FOREIGN KEY ("cehdId") REFERENCES "SeviyeCehd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
