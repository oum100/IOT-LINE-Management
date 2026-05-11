import { prisma } from "./prisma"

export function normalizeMachineKind(input: string) {
  return String(input || "").trim().toUpperCase()
}

export async function assertMachineKindExists(kindCode: string) {
  const code = normalizeMachineKind(kindCode)
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: "machine kind is required" })
  }

  const kind = await prisma.machineKind.findUnique({
    where: { code },
    select: { code: true, active: true },
  })

  if (!kind || !kind.active) {
    throw createError({ statusCode: 400, statusMessage: `Unknown machine kind: ${code}` })
  }

  return code
}
