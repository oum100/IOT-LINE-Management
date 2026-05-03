import { getRouterParam } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { assertAdminAccess } from '../../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Product id is required' })

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      prices: {
        where: { active: true },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          amount: true,
          durationMinutes: true,
          serviceMode: true,
          serviceUnit: true,
          quantity: true,
          updatedAt: true,
          asset: {
            select: {
              id: true,
              code: true,
              name: true,
              branch: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  merchantAccount: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      tenant: {
                        select: {
                          id: true,
                          code: true,
                          name: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  return product
})

