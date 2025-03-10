import { KnexService } from '@feathersjs/knex'

// By default calls the standard Knex adapter service methods but can be customized with your own functionality.
export class SiteProductChangesHistoryService extends KnexService {}

export const getOptions = (app) => {
  return {
    paginate: app.get('paginate'),
    Model: app.get('mssqlClient'),
    name: 'site_product_changes_history',
    multi: true
  }
}
