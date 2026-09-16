-- Keep the database in sync with the exam controllers and generated Prisma client.

ALTER TABLE "Istifadeci" ADD COLUMN IF NOT EXISTS "etsId" TEXT;
ALTER TABLE "Imtahan" ADD COLUMN IF NOT EXISTS "subjectGroupExternalId" TEXT;
ALTER TABLE "ImtahanTelebe" ADD COLUMN IF NOT EXISTS "yoxlamaKodu" TEXT;
ALTER TABLE "ImtahanSual" ADD COLUMN IF NOT EXISTS "tipSira" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Istifadeci_etsId_key" ON "Istifadeci"("etsId");

CREATE TABLE IF NOT EXISTS "ImtahanMuellim" (
    "id" SERIAL NOT NULL,
    "imtahanId" INTEGER NOT NULL,
    "muellimId" INTEGER NOT NULL,
    "etsTeacherId" TEXT NOT NULL,
    "sualTipi" "SualTipi" NOT NULL,
    "sualBaslangic" INTEGER NOT NULL,
    "sualSon" INTEGER NOT NULL,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImtahanMuellim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImtahanMuellim_imtahanId_muellimId_sualTipi_key"
ON "ImtahanMuellim"("imtahanId", "muellimId", "sualTipi");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ImtahanMuellim_imtahanId_fkey'
  ) THEN
    ALTER TABLE "ImtahanMuellim"
    ADD CONSTRAINT "ImtahanMuellim_imtahanId_fkey"
    FOREIGN KEY ("imtahanId") REFERENCES "Imtahan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ImtahanMuellim_muellimId_fkey'
  ) THEN
    ALTER TABLE "ImtahanMuellim"
    ADD CONSTRAINT "ImtahanMuellim_muellimId_fkey"
    FOREIGN KEY ("muellimId") REFERENCES "Istifadeci"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NezeriNetic_imtahanSualId_fkey'
  ) THEN
    ALTER TABLE "NezeriNetic"
    ADD CONSTRAINT "NezeriNetic_imtahanSualId_fkey"
    FOREIGN KEY ("imtahanSualId") REFERENCES "ImtahanSual"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
