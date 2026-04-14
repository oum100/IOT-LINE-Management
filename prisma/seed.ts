import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const washerPrices = [
  { label: "Cold", amount: 1, durationMinutes: 30, sortOrder: 1 },
  { label: "Warm", amount: 2, durationMinutes: 60, sortOrder: 2 },
  { label: "Hot", amount: 3, durationMinutes: 90, sortOrder: 3 },
];

const dryerPrices = [
  { label: "Cold", amount: 40, durationMinutes: 60, sortOrder: 1 },
  { label: "Warm", amount: 50, durationMinutes: 75, sortOrder: 2 },
  { label: "Hot", amount: 60, durationMinutes: 90, sortOrder: 3 },
];

async function main() {
  await prisma.deviceCommand.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.machinePrice.deleteMany();
  await prisma.machine.deleteMany();

  const machines = [
    {
      code: "W01",
      name: "Washer 01",
      kind: "WASHER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนซัก A1",
      remainingMinutes: null,
    },
    {
      code: "W02",
      name: "Washer 02",
      kind: "WASHER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนซัก A2",
      remainingMinutes: null,
    },
    {
      code: "W03",
      name: "Washer 03",
      kind: "WASHER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนซัก A3",
      remainingMinutes: null,
    },
    {
      code: "W04",
      name: "Washer 04",
      kind: "WASHER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนซัก B1",
      remainingMinutes: null,
    },
    {
      code: "W05",
      name: "Washer 05",
      kind: "WASHER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนซัก B2",
      remainingMinutes: null,
    },
    {
      code: "W06",
      name: "Washer 06",
      kind: "WASHER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนซัก B3",
      remainingMinutes: null,
    },
    {
      code: "D01",
      name: "Dryer 01",
      kind: "DRYER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนอบ A1",
      remainingMinutes: null,
    },
    {
      code: "D02",
      name: "Dryer 02",
      kind: "DRYER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนอบ A2",
      remainingMinutes: null,
    },
    {
      code: "D03",
      name: "Dryer 03",
      kind: "DRYER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนอบ A3",
      remainingMinutes: null,
    },
    {
      code: "D04",
      name: "Dryer 04",
      kind: "DRYER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนอบ B1",
      remainingMinutes: null,
    },
    {
      code: "D05",
      name: "Dryer 05",
      kind: "DRYER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนอบ B2",
      remainingMinutes: null,
    },
    {
      code: "D06",
      name: "Dryer 06",
      kind: "DRYER" as const,
      status: "AVAILABLE" as const,
      locationLabel: "โซนอบ B3",
      remainingMinutes: null,
    },
  ];

  for (const machine of machines) {
    await prisma.machine.create({
      data: {
        code: machine.code,
        name: machine.name,
        kind: machine.kind,
        status: machine.status,
        locationLabel: machine.locationLabel,
        remainingMinutes: machine.remainingMinutes,
        prices: {
          create: machine.kind === "WASHER" ? washerPrices : dryerPrices,
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
