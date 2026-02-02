import { mecRoItemRelSupplier } from './mec_ro_item_rel_supplier/mec_ro_item_rel_supplier.js'

import { mecItemAltref } from './mec_item_altref/mec_item_altref.js'

import { siteProductFrequentChanges } from './site_product_frequent_changes/site_product_frequent_changes.js'

import { siteProductChangesHistory } from './site_product_changes_history/site_product_changes_history.js'

import { mecItemProducerRelation } from './mec_item_producer_relation/mec_item_producer_relation.js'

import { mecItem } from './mec_item/mec_item.js'

import { zeroMinmax } from './zero-minmax/zero-minmax.js'

export const services = (app) => {
  app.configure(mecRoItemRelSupplier)

  app.configure(mecItemAltref)

  app.configure(siteProductFrequentChanges)

  app.configure(siteProductChangesHistory)

  app.configure(mecItemProducerRelation)

  app.configure(mecItem)

  app.configure(zeroMinmax)

  // All services will be registered here
}
