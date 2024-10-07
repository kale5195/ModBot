/*
  Warnings:

  - You are about to drop the column `replyCount` on the `CastLog` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `CastLog` table. All the data in the column will be lost.
  - The `status` column on the `CastLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `authorFid` to the `CastLog` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `createdAt` on the `CastLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "CastLog" DROP COLUMN "replyCount",
DROP COLUMN "updatedAt",
ADD COLUMN     "authorFid" INTEGER NOT NULL,
ADD COLUMN     "data" TEXT NOT NULL DEFAULT '{}',
DROP COLUMN "createdAt",
ADD COLUMN     "createdAt" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" INTEGER NOT NULL DEFAULT 0;
