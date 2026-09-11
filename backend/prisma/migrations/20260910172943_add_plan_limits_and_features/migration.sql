-- AlterTable
ALTER TABLE "BillingPackage" ADD COLUMN     "hasAutoOverage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasRecording" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxParticipantsPerSession" INTEGER NOT NULL DEFAULT 10;
