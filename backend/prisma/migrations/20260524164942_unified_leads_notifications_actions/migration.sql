-- AlterEnum
ALTER TYPE "ContactType" ADD VALUE 'REFERRAL';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "convertedUserId" TEXT,
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "nextTouchpointAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SequenceStep" ADD COLUMN     "actionConfig" JSONB,
ALTER COLUMN "body" SET DEFAULT '';

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_agencyId_read_idx" ON "Notification"("agencyId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
