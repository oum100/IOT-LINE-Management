import { createError } from 'h3'
import { resolveBranchByCode } from './branch-resolver'

export async function assertOrderBranchScope(orderBranchId: string | null | undefined, branchCode?: string | null) {
  const code = String(branchCode || '').trim()
  if (!code) return
  const branch = await resolveBranchByCode(code)
  if (!orderBranchId || orderBranchId !== branch.id) {
    throw createError({ statusCode: 403, statusMessage: 'Order does not belong to the requested branch scope' })
  }
}

