-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('ANY_BID', 'ANY_RANK_CHANGE', 'L1_CHANGE_ONLY');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BID_SUBMITTED', 'EXTENDED', 'CLOSED', 'FORCE_CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" SERIAL NOT NULL,
    "referenceId" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "bidStartAt" TIMESTAMP(3) NOT NULL,
    "bidCloseAt" TIMESTAMP(3) NOT NULL,
    "forcedCloseAt" TIMESTAMP(3) NOT NULL,
    "triggerWindowMin" INTEGER NOT NULL,
    "extensionMin" INTEGER NOT NULL,
    "triggerType" "TriggerType" NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "carrierName" TEXT NOT NULL,
    "freightCharge" DECIMAL(12,2) NOT NULL,
    "originCharge" DECIMAL(12,2) NOT NULL,
    "destinationCharge" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "transitTime" TEXT NOT NULL,
    "quoteValidityDays" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionEvent" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "type" "EventType" NOT NULL,
    "bidId" INTEGER,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_referenceId_key" ON "Rfq"("referenceId");

-- CreateIndex
CREATE INDEX "Rfq_bidCloseAt_idx" ON "Rfq"("bidCloseAt");

-- CreateIndex
CREATE INDEX "Bid_rfqId_supplierId_submittedAt_idx" ON "Bid"("rfqId", "supplierId", "submittedAt");

-- CreateIndex
CREATE INDEX "Bid_rfqId_totalAmount_idx" ON "Bid"("rfqId", "totalAmount");

-- CreateIndex
CREATE INDEX "AuctionEvent_rfqId_createdAt_idx" ON "AuctionEvent"("rfqId", "createdAt");

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionEvent" ADD CONSTRAINT "AuctionEvent_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionEvent" ADD CONSTRAINT "AuctionEvent_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
