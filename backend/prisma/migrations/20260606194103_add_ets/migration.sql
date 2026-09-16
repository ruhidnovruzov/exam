/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Fenn` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Kafedra` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Source" AS ENUM ('LOCAL', 'ETS');

-- AlterTable
ALTER TABLE "Fenn" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE "Kafedra" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'LOCAL';

-- CreateIndex
CREATE UNIQUE INDEX "Fenn_externalId_key" ON "Fenn"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Kafedra_externalId_key" ON "Kafedra"("externalId");
