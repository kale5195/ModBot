/*
  Warnings:

  - You are about to drop the column `banThreshold` on the `ModeratedChannel` table. All the data in the column will be lost.
  - You are about to drop the column `slowModeHours` on the `ModeratedChannel` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ModeratedChannel" DROP COLUMN "banThreshold",
DROP COLUMN "slowModeHours";
