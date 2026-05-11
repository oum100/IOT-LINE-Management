import { assertPermission } from '../../../utils/rbac'
import { listProductTaxonomy } from '../../../utils/product-taxonomy'

export default defineEventHandler(async (event) => {
  await assertPermission(event, 'portal.asset.manage')
  return listProductTaxonomy()
})
