-- AlterTable
ALTER TABLE "Movzu" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'LOCAL';

-- CreateIndex
CREATE UNIQUE INDEX "Movzu_externalId_key" ON "Movzu"("externalId");
