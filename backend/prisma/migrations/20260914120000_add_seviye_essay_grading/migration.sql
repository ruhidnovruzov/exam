CREATE TABLE "SeviyeImtahanMuellim" (
  "id" SERIAL NOT NULL,
  "seviyeImtahanId" INTEGER NOT NULL,
  "muellimId" INTEGER NOT NULL,
  "etsTeacherId" TEXT NOT NULL,
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeviyeImtahanMuellim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeviyeEssayYoxlama" (
  "id" SERIAL NOT NULL,
  "cehdId" INTEGER NOT NULL,
  "sualId" INTEGER NOT NULL,
  "cavabId" INTEGER NOT NULL,
  "muellimId" INTEGER NOT NULL,
  "bal" DOUBLE PRECISION,
  "qeyd" TEXT,
  "yoxlanildi" TIMESTAMP(3),
  "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "yenilendi" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeviyeEssayYoxlama_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeviyeImtahanMuellim_seviyeImtahanId_muellimId_key" ON "SeviyeImtahanMuellim"("seviyeImtahanId", "muellimId");
CREATE UNIQUE INDEX "SeviyeEssayYoxlama_cavabId_key" ON "SeviyeEssayYoxlama"("cavabId");
CREATE UNIQUE INDEX "SeviyeEssayYoxlama_cehdId_sualId_key" ON "SeviyeEssayYoxlama"("cehdId", "sualId");
CREATE INDEX "SeviyeEssayYoxlama_muellimId_yoxlanildi_idx" ON "SeviyeEssayYoxlama"("muellimId", "yoxlanildi");

ALTER TABLE "SeviyeImtahanMuellim" ADD CONSTRAINT "SeviyeImtahanMuellim_seviyeImtahanId_fkey" FOREIGN KEY ("seviyeImtahanId") REFERENCES "SeviyeImtahani"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeImtahanMuellim" ADD CONSTRAINT "SeviyeImtahanMuellim_muellimId_fkey" FOREIGN KEY ("muellimId") REFERENCES "Istifadeci"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeEssayYoxlama" ADD CONSTRAINT "SeviyeEssayYoxlama_cehdId_fkey" FOREIGN KEY ("cehdId") REFERENCES "SeviyeCehd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeEssayYoxlama" ADD CONSTRAINT "SeviyeEssayYoxlama_sualId_fkey" FOREIGN KEY ("sualId") REFERENCES "SeviyeSual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeEssayYoxlama" ADD CONSTRAINT "SeviyeEssayYoxlama_cavabId_fkey" FOREIGN KEY ("cavabId") REFERENCES "SeviyeCavab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeviyeEssayYoxlama" ADD CONSTRAINT "SeviyeEssayYoxlama_muellimId_fkey" FOREIGN KEY ("muellimId") REFERENCES "Istifadeci"("id") ON DELETE CASCADE ON UPDATE CASCADE;
