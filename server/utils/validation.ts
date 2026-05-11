import { z } from 'zod'

export const createOrderSchema = z.object({
  branchCode: z.string().trim().min(1),
  customerName: z.string().trim().optional().transform(value => value?.trim() || 'คุณลูกค้า'),
  lineUserId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  items: z.array(z.object({
    machineId: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    priceId: z.string().min(1)
  }).superRefine((item, ctx) => {
    if (!item.machineId && !item.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either machineId or assetId is required.'
      })
    }
  })).min(1)
})

export const verifySlipSchema = z.object({
  approved: z.boolean(),
  reviewer: z.string().min(1),
  note: z.string().optional().nullable()
})
