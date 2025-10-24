/*
  Warnings:

  - You are about to drop the column `pdfUrl` on the `HistoryEntry` table. All the data in the column will be lost.
  - The `status` column on the `HistoryEntry` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `address` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `UserProfile` table. All the data in the column will be lost.
  - The `status` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `message` to the `InboxItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."HistoryEntry" DROP CONSTRAINT "HistoryEntry_userId_fkey";

-- AlterTable
ALTER TABLE "HistoryEntry" DROP COLUMN "pdfUrl",
ALTER COLUMN "userId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "InboxItem" ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "address",
DROP COLUMN "phone",
ADD COLUMN     "apellidos" TEXT,
ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "fechaNacimiento" TEXT,
ADD COLUMN     "institucion" TEXT,
ADD COLUMN     "nombres" TEXT,
ADD COLUMN     "nroDocumento" TEXT,
ADD COLUMN     "pais" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "tipoDocumento" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'BORRADOR';

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
