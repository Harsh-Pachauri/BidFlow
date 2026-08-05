import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { computeTotalAmount } from "../src/lib/auction-rules";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

function minutesFromNow(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

function bidCharges(freight: number, origin: number, destination: number) {
  return {
    freightCharge: freight,
    originCharge: origin,
    destinationCharge: destination,
    totalAmount: computeTotalAmount(freight, origin, destination),
  };
}

async function main() {
  const now = new Date();

  await prisma.$executeRaw`TRUNCATE TABLE "AuctionEvent", "Bid", "Rfq", "User" RESTART IDENTITY CASCADE`;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const buyerAnanya = await prisma.user.create({
    data: { name: "Ananya Rao", email: "buyer1@rfq-demo.com", passwordHash, role: "BUYER" },
  });
  const buyerRohan = await prisma.user.create({
    data: { name: "Rohan Mehta", email: "buyer2@rfq-demo.com", passwordHash, role: "BUYER" },
  });

  const vikram = await prisma.user.create({ data: { name: "Vikram Singh", email: "supplier1@rfq-demo.com", passwordHash, role: "SUPPLIER" } });
  const meera = await prisma.user.create({ data: { name: "Meera Iyer", email: "supplier2@rfq-demo.com", passwordHash, role: "SUPPLIER" } });
  const arjun = await prisma.user.create({ data: { name: "Arjun Nair", email: "supplier3@rfq-demo.com", passwordHash, role: "SUPPLIER" } });
  const kavita = await prisma.user.create({ data: { name: "Kavita Desai", email: "supplier4@rfq-demo.com", passwordHash, role: "SUPPLIER" } });
  const rahul = await prisma.user.create({ data: { name: "Rahul Kapoor", email: "supplier5@rfq-demo.com", passwordHash, role: "SUPPLIER" } });

  await prisma.rfq.create({
    data: {
      referenceId: "RFQ-2026-001",
      pickupDate: minutesFromNow(now, 10 * 24 * 60),
      bidStartAt: minutesFromNow(now, 2 * 24 * 60),
      bidCloseAt: minutesFromNow(now, 2 * 24 * 60 + 120),
      forcedCloseAt: minutesFromNow(now, 2 * 24 * 60 + 180),
      triggerWindowMin: 15,
      extensionMin: 10,
      triggerType: "ANY_BID",
      createdById: buyerAnanya.id,
    },
  });

  const rfq2 = await prisma.rfq.create({
    data: {
      referenceId: "RFQ-2026-002",
      pickupDate: minutesFromNow(now, 12 * 24 * 60),
      bidStartAt: minutesFromNow(now, -90),
      bidCloseAt: minutesFromNow(now, 20),
      forcedCloseAt: minutesFromNow(now, 180),
      triggerWindowMin: 15,
      extensionMin: 15,
      triggerType: "ANY_RANK_CHANGE",
      createdById: buyerAnanya.id,
    },
  });

  const rfq2Bid1 = await prisma.bid.create({
    data: {
      rfqId: rfq2.id, supplierId: vikram.id, carrierName: "Global Cargo Lines",
      ...bidCharges(5200, 600, 400),
      transitTime: "18 days", quoteValidityDays: 7, submittedAt: minutesFromNow(now, -80),
    },
  });
  const rfq2Bid2 = await prisma.bid.create({
    data: {
      rfqId: rfq2.id, supplierId: meera.id, carrierName: "Swift Freight Solutions",
      ...bidCharges(4900, 550, 450),
      transitTime: "16 days", quoteValidityDays: 5, submittedAt: minutesFromNow(now, -45),
    },
  });
  const rfq2Bid3 = await prisma.bid.create({
    data: {
      rfqId: rfq2.id, supplierId: arjun.id, carrierName: "Oceanic Shipping Co.",
      ...bidCharges(4750, 500, 500),
      transitTime: "17 days", quoteValidityDays: 10, submittedAt: minutesFromNow(now, -10),
    },
  });

  await prisma.auctionEvent.createMany({
    data: [
      { rfqId: rfq2.id, type: "BID_SUBMITTED", bidId: rfq2Bid1.id, reason: "Global Cargo Lines submitted a bid of 6200.", createdAt: rfq2Bid1.submittedAt },
      { rfqId: rfq2.id, type: "BID_SUBMITTED", bidId: rfq2Bid2.id, reason: "Swift Freight Solutions submitted a bid of 5900.", createdAt: rfq2Bid2.submittedAt },
      { rfqId: rfq2.id, type: "EXTENDED", bidId: rfq2Bid2.id, reason: `Supplier ranking changed within the trigger window — extended to ${minutesFromNow(now, 5).toISOString()}.`, createdAt: rfq2Bid2.submittedAt },
      { rfqId: rfq2.id, type: "BID_SUBMITTED", bidId: rfq2Bid3.id, reason: "Oceanic Shipping Co. submitted a bid of 5750.", createdAt: rfq2Bid3.submittedAt },
      { rfqId: rfq2.id, type: "EXTENDED", bidId: rfq2Bid3.id, reason: `Supplier ranking changed within the trigger window — extended to ${minutesFromNow(now, 20).toISOString()}.`, createdAt: rfq2Bid3.submittedAt },
    ],
  });

  await prisma.rfq.create({
    data: {
      referenceId: "RFQ-2026-003",
      pickupDate: minutesFromNow(now, 15 * 24 * 60),
      bidStartAt: minutesFromNow(now, -30),
      bidCloseAt: minutesFromNow(now, 120),
      forcedCloseAt: minutesFromNow(now, 240),
      triggerWindowMin: 10,
      extensionMin: 5,
      triggerType: "L1_CHANGE_ONLY",
      createdById: buyerRohan.id,
    },
  });

  const rfq4 = await prisma.rfq.create({
    data: {
      referenceId: "RFQ-2026-004",
      pickupDate: minutesFromNow(now, 3 * 24 * 60),
      bidStartAt: minutesFromNow(now, -2 * 24 * 60),
      bidCloseAt: minutesFromNow(now, -1 * 24 * 60),
      forcedCloseAt: minutesFromNow(now, -1 * 24 * 60 + 240),
      triggerWindowMin: 15,
      extensionMin: 10,
      triggerType: "ANY_BID",
      createdById: buyerRohan.id,
    },
  });

  const rfq4Bid1 = await prisma.bid.create({
    data: {
      rfqId: rfq4.id, supplierId: kavita.id, carrierName: "TransWorld Logistics",
      ...bidCharges(3200, 300, 300),
      transitTime: "12 days", quoteValidityDays: 7, submittedAt: minutesFromNow(now, -2 * 24 * 60 + 60),
    },
  });
  const rfq4Bid2 = await prisma.bid.create({
    data: {
      rfqId: rfq4.id, supplierId: rahul.id, carrierName: "Horizon Freight Services",
      ...bidCharges(3050, 280, 320),
      transitTime: "13 days", quoteValidityDays: 5, submittedAt: minutesFromNow(now, -2 * 24 * 60 + 200),
    },
  });

  await prisma.auctionEvent.createMany({
    data: [
      { rfqId: rfq4.id, type: "BID_SUBMITTED", bidId: rfq4Bid1.id, reason: "TransWorld Logistics submitted a bid of 3800.", createdAt: rfq4Bid1.submittedAt },
      { rfqId: rfq4.id, type: "BID_SUBMITTED", bidId: rfq4Bid2.id, reason: "Horizon Freight Services submitted a bid of 3650.", createdAt: rfq4Bid2.submittedAt },
    ],
  });

  const rfq5ForcedClose = minutesFromNow(now, -1 * 24 * 60);
  const rfq5 = await prisma.rfq.create({
    data: {
      referenceId: "RFQ-2026-005",
      pickupDate: minutesFromNow(now, 4 * 24 * 60),
      bidStartAt: minutesFromNow(now, -2 * 24 * 60),
      bidCloseAt: rfq5ForcedClose,
      forcedCloseAt: rfq5ForcedClose,
      triggerWindowMin: 10,
      extensionMin: 10,
      triggerType: "ANY_BID",
      createdById: buyerAnanya.id,
    },
  });

  const rfq5Bid1 = await prisma.bid.create({
    data: {
      rfqId: rfq5.id, supplierId: vikram.id, carrierName: "Global Cargo Lines",
      ...bidCharges(4500, 400, 300),
      transitTime: "20 days", quoteValidityDays: 7, submittedAt: minutesFromNow(rfq5ForcedClose, -180),
    },
  });
  const rfq5Bid2 = await prisma.bid.create({
    data: {
      rfqId: rfq5.id, supplierId: meera.id, carrierName: "Swift Freight Solutions",
      ...bidCharges(4250, 380, 320),
      transitTime: "19 days", quoteValidityDays: 5, submittedAt: minutesFromNow(rfq5ForcedClose, -120),
    },
  });
  const rfq5Bid3 = await prisma.bid.create({
    data: {
      rfqId: rfq5.id, supplierId: arjun.id, carrierName: "Oceanic Shipping Co.",
      ...bidCharges(4050, 350, 350),
      transitTime: "18 days", quoteValidityDays: 10, submittedAt: minutesFromNow(rfq5ForcedClose, -45),
    },
  });
  const rfq5Bid4 = await prisma.bid.create({
    data: {
      rfqId: rfq5.id, supplierId: kavita.id, carrierName: "TransWorld Logistics",
      ...bidCharges(3900, 340, 310),
      transitTime: "17 days", quoteValidityDays: 5, submittedAt: minutesFromNow(rfq5ForcedClose, -5),
    },
  });

  await prisma.auctionEvent.createMany({
    data: [
      { rfqId: rfq5.id, type: "BID_SUBMITTED", bidId: rfq5Bid1.id, reason: "Global Cargo Lines submitted a bid of 5200.", createdAt: rfq5Bid1.submittedAt },
      { rfqId: rfq5.id, type: "BID_SUBMITTED", bidId: rfq5Bid2.id, reason: "Swift Freight Solutions submitted a bid of 4950.", createdAt: rfq5Bid2.submittedAt },
      { rfqId: rfq5.id, type: "EXTENDED", bidId: rfq5Bid2.id, reason: `New bid received within the trigger window — extended to ${minutesFromNow(rfq5ForcedClose, -110).toISOString()}.`, createdAt: rfq5Bid2.submittedAt },
      { rfqId: rfq5.id, type: "BID_SUBMITTED", bidId: rfq5Bid3.id, reason: "Oceanic Shipping Co. submitted a bid of 4750.", createdAt: rfq5Bid3.submittedAt },
      { rfqId: rfq5.id, type: "EXTENDED", bidId: rfq5Bid3.id, reason: `New bid received within the trigger window — extended to ${minutesFromNow(rfq5ForcedClose, -35).toISOString()}.`, createdAt: rfq5Bid3.submittedAt },
      { rfqId: rfq5.id, type: "BID_SUBMITTED", bidId: rfq5Bid4.id, reason: "TransWorld Logistics submitted a bid of 4550.", createdAt: rfq5Bid4.submittedAt },
      { rfqId: rfq5.id, type: "EXTENDED", bidId: rfq5Bid4.id, reason: `New bid received within the trigger window — extended to ${rfq5ForcedClose.toISOString()} (forced close ceiling reached).`, createdAt: rfq5Bid4.submittedAt },
    ],
  });

  console.log("Seed complete.");
  console.log(`  Buyers:    ${buyerAnanya.email}, ${buyerRohan.email}`);
  console.log(`  Suppliers: ${[vikram, meera, arjun, kavita, rahul].map((s) => s.email).join(", ")}`);
  console.log(`  Password (all users): ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
