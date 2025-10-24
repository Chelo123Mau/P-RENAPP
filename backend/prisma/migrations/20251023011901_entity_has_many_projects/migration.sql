/*
  Warnings:

  - You are about to drop the column `message` on the `InboxItem` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `InboxItem` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `User` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[userId]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `HistoryEntry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `scopeId` on table `InboxItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `entityId` on table `Project` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."HistoryEntry" DROP CONSTRAINT "HistoryEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Project" DROP CONSTRAINT "Project_entityId_fkey";

-- AlterTable
ALTER TABLE "HistoryEntry" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InboxItem" DROP COLUMN "message",
DROP COLUMN "read",
ALTER COLUMN "scopeId" SET NOT NULL,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "fullName",
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE UNIQUE INDEX "Entity_userId_key" ON "Entity"("userId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
