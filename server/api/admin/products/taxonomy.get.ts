import { assertAdminAccess } from '../../../utils/admin-auth'
import { listProductTaxonomy } from '../../../utils/product-taxonomy'

export default defineEventHandler(async (event) => {
  await assertAdminAccess(event)
  return listProductTaxonomy()
})
