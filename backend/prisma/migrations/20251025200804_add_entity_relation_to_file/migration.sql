-- AlterTable
ALTER TABLE "File" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "draftKey" TEXT,
ADD COLUMN     "entityName" TEXT,
ALTER COLUMN "size" DROP NOT NULL,
ALTER COLUMN "mime" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "File_entityId_idx" ON "File"("entityId");

-- CreateIndex
CREATE INDEX "File_draftKey_idx" ON "File"("draftKey");

-- CreateIndex
CREATE INDEX "File_createdByUserId_idx" ON "File"("createdByUserId");
