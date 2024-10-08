-- AlterTable
ALTER TABLE "ModeratedChannel" ADD COLUMN     "castRuleSet" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "disableBannedList" INTEGER NOT NULL DEFAULT 0;
