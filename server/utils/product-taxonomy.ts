import { createError } from 'h3'
import { prisma } from './prisma'

export async function assertProductTypeCode(code: string) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) throw createError({ statusCode: 400, statusMessage: 'Product type is required' })
  const found = await prisma.productType.findUnique({ where: { code: normalized }, select: { code: true, active: true } })
  if (!found || !found.active) throw createError({ statusCode: 400, statusMessage: `Invalid product type: ${normalized}` })
  return normalized
}

export async function assertServiceModeCode(code: string) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) throw createError({ statusCode: 400, statusMessage: 'Service mode is required' })
  const found = await prisma.serviceModeType.findUnique({ where: { code: normalized }, select: { code: true, active: true } })
  if (!found || !found.active) throw createError({ statusCode: 400, statusMessage: `Invalid service mode: ${normalized}` })
  return normalized
}

export async function assertServiceUnitCode(code: string) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) throw createError({ statusCode: 400, statusMessage: 'Service unit is required' })
  const found = await prisma.serviceUnitType.findUnique({ where: { code: normalized }, select: { code: true, active: true } })
  if (!found || !found.active) throw createError({ statusCode: 400, statusMessage: `Invalid service unit: ${normalized}` })
  return normalized
}

export async function listProductTaxonomy() {
  const [productTypes, serviceModes, serviceUnits] = await Promise.all([
    prisma.productType.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
    prisma.serviceModeType.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
    prisma.serviceUnitType.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
  ])
  return { productTypes, serviceModes, serviceUnits }
}
