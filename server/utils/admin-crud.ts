import { z } from 'zod'

export const pagingQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
})

export function withPaging(input: unknown) {
  const parsed = pagingQuerySchema.parse(input || {})
  const skip = (parsed.page - 1) * parsed.pageSize
  return {
    ...parsed,
    skip,
    take: parsed.pageSize
  }
}
