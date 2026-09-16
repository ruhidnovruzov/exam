-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'KAFEDRA', 'MUELLIM');

-- CreateEnum
CREATE TYPE "Bolme" AS ENUM ('AZ', 'RU', 'EN');

-- CreateEnum
CREATE TYPE "SualTipi" AS ENUM ('TEST', 'NEZERI', 'DUSTUR', 'PRAKTIKI');

-- CreateEnum
CREATE TYPE "ChetinlikDerece" AS ENUM ('ASAN', 'ORTA', 'CETTIN');

-- CreateEnum
CREATE TYPE "TestBankStatus" AS ENUM ('GOZLEYIR', 'TESDIQLENDI', 'REDAKTEYE_GONDERILIB', 'LEGV_EDILDI');

-- CreateEnum
CREATE TYPE "TestBankBlok" AS ENUM ('ACIQDIR', 'BAGLIDIR');

-- CreateEnum
CREATE TYPE "ImtahanNovu" AS ENUM ('TEST', 'YAZILI');

-- CreateEnum
CREATE TYPE "TehsilNovu" AS ENUM ('EYANI', 'QIYABI');

-- CreateEnum
CREATE TYPE "ImtahanSecimiNovu" AS ENUM ('YENI', 'TEKRAR', 'YENI_TEKRAR');

-- CreateEnum
CREATE TYPE "ImtahanStatus" AS ENUM ('PLANLANIB', 'AKTIV', 'BITMIS', 'LEGV_EDILDI');

-- CreateEnum
CREATE TYPE "TedrisIlFesil" AS ENUM ('YAZ', 'PAYIZ');

-- CreateTable
CREATE TABLE "Kafedra" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kafedra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fenn" (
    "id" SERIAL NOT NULL,
    "kafedraId" INTEGER NOT NULL,
    "fennKodu" TEXT NOT NULL,
    "fennAdi" TEXT NOT NULL,
    "bolme" "Bolme" NOT NULL,
    "elavEden" INTEGER NOT NULL,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fenn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movzu" (
    "id" SERIAL NOT NULL,
    "fennId" INTEGER NOT NULL,
    "ad" TEXT NOT NULL,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movzu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestBanki" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "fennId" INTEGER NOT NULL,
    "kafedraId" INTEGER NOT NULL,
    "elavEdenId" INTEGER NOT NULL,
    "status" "TestBankStatus" NOT NULL DEFAULT 'GOZLEYIR',
    "blok" "TestBankBlok" NOT NULL DEFAULT 'BAGLIDIR',
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestBanki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sual" (
    "id" SERIAL NOT NULL,
    "testBankiId" INTEGER NOT NULL,
    "movzuId" INTEGER NOT NULL,
    "sualTipi" "SualTipi" NOT NULL,
    "chetinlik" "ChetinlikDerece" NOT NULL,
    "metn" TEXT NOT NULL,
    "sekil" TEXT,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cavab" (
    "id" SERIAL NOT NULL,
    "sualId" INTEGER NOT NULL,
    "metn" TEXT NOT NULL,
    "sekil" TEXT,
    "duzgundur" BOOLEAN NOT NULL DEFAULT false,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cavab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Istifadeci" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "parol" TEXT NOT NULL,
    "rol" "Role" NOT NULL,
    "kafedraId" INTEGER,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Istifadeci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuellimFenn" (
    "id" SERIAL NOT NULL,
    "muellimId" INTEGER NOT NULL,
    "fennId" INTEGER NOT NULL,

    CONSTRAINT "MuellimFenn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TedrisIl" (
    "id" SERIAL NOT NULL,
    "il" INTEGER NOT NULL,
    "fesil" "TedrisIlFesil" NOT NULL,
    "label" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TedrisIl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Imtahan" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "fennId" INTEGER NOT NULL,
    "tedrisIlId" INTEGER NOT NULL,
    "imtahanNovu" "ImtahanNovu" NOT NULL,
    "tehsilNovu" "TehsilNovu" NOT NULL,
    "muddet" INTEGER NOT NULL,
    "kecidBali" DOUBLE PRECISION NOT NULL,
    "imtahanSecimi" "ImtahanSecimiNovu" NOT NULL,
    "baslamaVaxti" TIMESTAMP(3) NOT NULL,
    "bitmeVaxti" TIMESTAMP(3) NOT NULL,
    "status" "ImtahanStatus" NOT NULL DEFAULT 'PLANLANIB',
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Imtahan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtahanTestBanki" (
    "id" SERIAL NOT NULL,
    "imtahanId" INTEGER NOT NULL,
    "testBankiId" INTEGER NOT NULL,

    CONSTRAINT "ImtahanTestBanki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtahanMovzu" (
    "id" SERIAL NOT NULL,
    "imtahanId" INTEGER NOT NULL,
    "movzuId" INTEGER NOT NULL,

    CONSTRAINT "ImtahanMovzu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtahanTerkib" (
    "id" SERIAL NOT NULL,
    "imtahanId" INTEGER NOT NULL,
    "sualTipi" "SualTipi" NOT NULL,
    "sualSayi" INTEGER NOT NULL DEFAULT 0,
    "balPerSual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yoxlamaMuddeti" INTEGER,

    CONSTRAINT "ImtahanTerkib_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Telebe" (
    "id" SERIAL NOT NULL,
    "etsId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "ata" TEXT,
    "qrup" TEXT,
    "ixtisas" TEXT,
    "kurs" INTEGER,
    "email" TEXT,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yenilendi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Telebe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtahanTelebe" (
    "id" SERIAL NOT NULL,
    "imtahanId" INTEGER NOT NULL,
    "telebeId" INTEGER NOT NULL,
    "girisVaxti" TIMESTAMP(3),
    "cixisVaxti" TIMESTAMP(3),
    "bal" DOUBLE PRECISION,
    "kecdi" BOOLEAN,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImtahanTelebe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImtahanSual" (
    "id" SERIAL NOT NULL,
    "imtahanId" INTEGER NOT NULL,
    "telebeId" INTEGER NOT NULL,
    "sualId" INTEGER NOT NULL,
    "sira" INTEGER NOT NULL,
    "secilenCavabId" INTEGER,
    "yaziliCavab" TEXT,
    "bal" DOUBLE PRECISION,
    "duzgundur" BOOLEAN,
    "yaradildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImtahanSual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NezeriNetic" (
    "id" SERIAL NOT NULL,
    "telebeId" INTEGER NOT NULL,
    "imtahanSualId" INTEGER NOT NULL,
    "yoxlayanId" INTEGER NOT NULL,
    "verileBal" DOUBLE PRECISION NOT NULL,
    "qeyd" TEXT,
    "yoxlanildi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NezeriNetic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kafedra_kod_key" ON "Kafedra"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "Fenn_fennKodu_key" ON "Fenn"("fennKodu");

-- CreateIndex
CREATE UNIQUE INDEX "Istifadeci_username_key" ON "Istifadeci"("username");

-- CreateIndex
CREATE UNIQUE INDEX "MuellimFenn_muellimId_fennId_key" ON "MuellimFenn"("muellimId", "fennId");

-- CreateIndex
CREATE UNIQUE INDEX "TedrisIl_il_fesil_key" ON "TedrisIl"("il", "fesil");

-- CreateIndex
CREATE UNIQUE INDEX "ImtahanTestBanki_imtahanId_testBankiId_key" ON "ImtahanTestBanki"("imtahanId", "testBankiId");

-- CreateIndex
CREATE UNIQUE INDEX "ImtahanMovzu_imtahanId_movzuId_key" ON "ImtahanMovzu"("imtahanId", "movzuId");

-- CreateIndex
CREATE UNIQUE INDEX "ImtahanTerkib_imtahanId_sualTipi_key" ON "ImtahanTerkib"("imtahanId", "sualTipi");

-- CreateIndex
CREATE UNIQUE INDEX "Telebe_etsId_key" ON "Telebe"("etsId");

-- CreateIndex
CREATE UNIQUE INDEX "ImtahanTelebe_imtahanId_telebeId_key" ON "ImtahanTelebe"("imtahanId", "telebeId");

-- CreateIndex
CREATE UNIQUE INDEX "ImtahanSual_imtahanId_telebeId_sualId_key" ON "ImtahanSual"("imtahanId", "telebeId", "sualId");

-- CreateIndex
CREATE UNIQUE INDEX "NezeriNetic_imtahanSualId_key" ON "NezeriNetic"("imtahanSualId");

-- AddForeignKey
ALTER TABLE "Fenn" ADD CONSTRAINT "Fenn_kafedraId_fkey" FOREIGN KEY ("kafedraId") REFERENCES "Kafedra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fenn" ADD CONSTRAINT "Fenn_elavEden_fkey" FOREIGN KEY ("elavEden") REFERENCES "Istifadeci"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movzu" ADD CONSTRAINT "Movzu_fennId_fkey" FOREIGN KEY ("fennId") REFERENCES "Fenn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestBanki" ADD CONSTRAINT "TestBanki_fennId_fkey" FOREIGN KEY ("fennId") REFERENCES "Fenn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestBanki" ADD CONSTRAINT "TestBanki_kafedraId_fkey" FOREIGN KEY ("kafedraId") REFERENCES "Kafedra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestBanki" ADD CONSTRAINT "TestBanki_elavEdenId_fkey" FOREIGN KEY ("elavEdenId") REFERENCES "Istifadeci"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sual" ADD CONSTRAINT "Sual_testBankiId_fkey" FOREIGN KEY ("testBankiId") REFERENCES "TestBanki"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sual" ADD CONSTRAINT "Sual_movzuId_fkey" FOREIGN KEY ("movzuId") REFERENCES "Movzu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cavab" ADD CONSTRAINT "Cavab_sualId_fkey" FOREIGN KEY ("sualId") REFERENCES "Sual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Istifadeci" ADD CONSTRAINT "Istifadeci_kafedraId_fkey" FOREIGN KEY ("kafedraId") REFERENCES "Kafedra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuellimFenn" ADD CONSTRAINT "MuellimFenn_muellimId_fkey" FOREIGN KEY ("muellimId") REFERENCES "Istifadeci"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuellimFenn" ADD CONSTRAINT "MuellimFenn_fennId_fkey" FOREIGN KEY ("fennId") REFERENCES "Fenn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imtahan" ADD CONSTRAINT "Imtahan_fennId_fkey" FOREIGN KEY ("fennId") REFERENCES "Fenn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imtahan" ADD CONSTRAINT "Imtahan_tedrisIlId_fkey" FOREIGN KEY ("tedrisIlId") REFERENCES "TedrisIl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanTestBanki" ADD CONSTRAINT "ImtahanTestBanki_imtahanId_fkey" FOREIGN KEY ("imtahanId") REFERENCES "Imtahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanTestBanki" ADD CONSTRAINT "ImtahanTestBanki_testBankiId_fkey" FOREIGN KEY ("testBankiId") REFERENCES "TestBanki"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanMovzu" ADD CONSTRAINT "ImtahanMovzu_imtahanId_fkey" FOREIGN KEY ("imtahanId") REFERENCES "Imtahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanMovzu" ADD CONSTRAINT "ImtahanMovzu_movzuId_fkey" FOREIGN KEY ("movzuId") REFERENCES "Movzu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanTerkib" ADD CONSTRAINT "ImtahanTerkib_imtahanId_fkey" FOREIGN KEY ("imtahanId") REFERENCES "Imtahan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanTelebe" ADD CONSTRAINT "ImtahanTelebe_imtahanId_fkey" FOREIGN KEY ("imtahanId") REFERENCES "Imtahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanTelebe" ADD CONSTRAINT "ImtahanTelebe_telebeId_fkey" FOREIGN KEY ("telebeId") REFERENCES "Telebe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanSual" ADD CONSTRAINT "ImtahanSual_imtahanId_fkey" FOREIGN KEY ("imtahanId") REFERENCES "Imtahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanSual" ADD CONSTRAINT "ImtahanSual_telebeId_fkey" FOREIGN KEY ("telebeId") REFERENCES "Telebe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImtahanSual" ADD CONSTRAINT "ImtahanSual_sualId_fkey" FOREIGN KEY ("sualId") REFERENCES "Sual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NezeriNetic" ADD CONSTRAINT "NezeriNetic_telebeId_fkey" FOREIGN KEY ("telebeId") REFERENCES "Telebe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NezeriNetic" ADD CONSTRAINT "NezeriNetic_yoxlayanId_fkey" FOREIGN KEY ("yoxlayanId") REFERENCES "Istifadeci"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
