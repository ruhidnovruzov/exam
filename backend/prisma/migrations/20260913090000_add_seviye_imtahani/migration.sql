CREATE TYPE "SeviyeSualTipi" AS ENUM ('TEST', 'LISTENING', 'READING', 'ESSAY');

CREATE TABLE "SeviyeImtahani" (
  "id" SERIAL NOT NULL,
  "ad" TEXT NOT NULL,
  "muddet" INTEGER NOT NULL DEFAULT 90,
  "baslamaVaxti" TIMESTAMP(3) NOT NULL,
  "bitmeVaxti" TIMESTAMP(3) NOT NULL,
  "aktiv" BOOLEAN NOT NULL DEFAULT false,
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "yenilendi" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeviyeImtahani_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeviyeSual" (
  "id" SERIAL NOT NULL,
  "seviyeImtahanId" INTEGER NOT NULL,
  "sualTipi" "SeviyeSualTipi" NOT NULL,
  "kateqoriya" TEXT,
  "seviye" TEXT,
  "metn" TEXT NOT NULL,
  "mediaUrl" TEXT,
  "variantlar" JSONB,
  "duzgunCavab" TEXT,
  "bal" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "sira" INTEGER NOT NULL DEFAULT 0,
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "yenilendi" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeviyeSual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeviyeCehd" (
  "id" SERIAL NOT NULL,
  "seviyeImtahanId" INTEGER NOT NULL,
  "etsStudentId" TEXT NOT NULL,
  "ad" TEXT NOT NULL,
  "soyad" TEXT NOT NULL,
  "qrup" TEXT,
  "girisVaxti" TIMESTAMP(3),
  "cixisVaxti" TIMESTAMP(3),
  "bal" DOUBLE PRECISION,
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "yenilendi" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeviyeCehd_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeviyeCavab" (
  "id" SERIAL NOT NULL,
  "cehdId" INTEGER NOT NULL,
  "sualId" INTEGER NOT NULL,
  "cavab" TEXT,
  "bal" DOUBLE PRECISION,
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "yenilendi" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeviyeCavab_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeviyeCehd_seviyeImtahanId_etsStudentId_key" ON "SeviyeCehd"("seviyeImtahanId", "etsStudentId");
CREATE UNIQUE INDEX "SeviyeCavab_cehdId_sualId_key" ON "SeviyeCavab"("cehdId", "sualId");

ALTER TABLE "SeviyeSual" ADD CONSTRAINT "SeviyeSual_seviyeImtahanId_fkey"
  FOREIGN KEY ("seviyeImtahanId") REFERENCES "SeviyeImtahani"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeCehd" ADD CONSTRAINT "SeviyeCehd_seviyeImtahanId_fkey"
  FOREIGN KEY ("seviyeImtahanId") REFERENCES "SeviyeImtahani"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeCavab" ADD CONSTRAINT "SeviyeCavab_cehdId_fkey"
  FOREIGN KEY ("cehdId") REFERENCES "SeviyeCehd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeCavab" ADD CONSTRAINT "SeviyeCavab_sualId_fkey"
  FOREIGN KEY ("sualId") REFERENCES "SeviyeSual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
