// For more information about this file see https://dove.feathersjs.com/guides/cli/client.html
import { feathers } from '@feathersjs/feathers'
import authenticationClient from '@feathersjs/authentication-client'
import { mecRoItemRelSupplierClient } from './services/mec_ro_item_rel_supplier/mec_ro_item_rel_supplier.shared.js'

import { mecItemAltrefClient } from './services/mec_item_altref/mec_item_altref.shared.js'

import { siteProductFrequentChangesClient } from './services/site_product_frequent_changes/site_product_frequent_changes.shared.js'

import { siteProductChangesHistoryClient } from './services/site_product_changes_history/site_product_changes_history.shared.js'

import { mecItemProducerRelationClient } from './services/mec_item_producer_relation/mec_item_producer_relation.shared.js'

import { mecItemClient } from './services/mec_item/mec_item.shared.js'

/**
 * Returns a  client for the ItalySync app.
 *
 * @param connection The REST or Socket.io Feathers client connection
 * @param authenticationOptions Additional settings for the authentication client
 * @see https://dove.feathersjs.com/api/client.html
 * @returns The Feathers client application
 */
export const createClient = (connection, authenticationOptions = {}) => {
  const client = feathers()

  client.configure(connection)
  client.configure(authenticationClient(authenticationOptions))
  client.set('connection', connection)

  client.configure(mecItemClient)

  client.configure(mecItemProducerRelationClient)

  client.configure(siteProductChangesHistoryClient)

  client.configure(siteProductFrequentChangesClient)

  client.configure(mecItemAltrefClient)

  client.configure(mecRoItemRelSupplierClient)

  return client
}
