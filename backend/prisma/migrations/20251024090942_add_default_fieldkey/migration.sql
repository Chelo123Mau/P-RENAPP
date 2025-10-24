/*
  Warnings:

  - You are about to drop the column `scope` on the `HistoryEntry` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `HistoryEntry` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."HistoryEntry" DROP CONSTRAINT "HistoryEntry_userId_fkey";

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "fieldKey" TEXT NOT NULL DEFAULT 'sin_definir';

-- AlterTable
ALTER TABLE "HistoryEntry" DROP COLUMN "scope",
DROP COLUMN "userId",
ADD COLUMN     "byUserId" TEXT;
