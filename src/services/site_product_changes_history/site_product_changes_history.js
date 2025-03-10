// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'
import {
  siteProductChangesHistoryDataValidator,
  siteProductChangesHistoryPatchValidator,
  siteProductChangesHistoryQueryValidator,
  siteProductChangesHistoryResolver,
  siteProductChangesHistoryExternalResolver,
  siteProductChangesHistoryDataResolver,
  siteProductChangesHistoryPatchResolver,
  siteProductChangesHistoryQueryResolver
} from './site_product_changes_history.schema.js'
import { SiteProductChangesHistoryService, getOptions } from './site_product_changes_history.class.js'
import {
  siteProductChangesHistoryPath,
  siteProductChangesHistoryMethods
} from './site_product_changes_history.shared.js'

export * from './site_product_changes_history.class.js'
export * from './site_product_changes_history.schema.js'

// A configure function that registers the service and its hooks via `app.configure`
export const siteProductChangesHistory = (app) => {
  // Register our service on the Feathers application
  app.use(siteProductChangesHistoryPath, new SiteProductChangesHistoryService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: siteProductChangesHistoryMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(siteProductChangesHistoryPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(siteProductChangesHistoryExternalResolver),
        schemaHooks.resolveResult(siteProductChangesHistoryResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(siteProductChangesHistoryQueryValidator),
        schemaHooks.resolveQuery(siteProductChangesHistoryQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(siteProductChangesHistoryDataValidator),
        schemaHooks.resolveData(siteProductChangesHistoryDataResolver)
      ],
      patch: [
        schemaHooks.validateData(siteProductChangesHistoryPatchValidator),
        schemaHooks.resolveData(siteProductChangesHistoryPatchResolver)
      ],
      remove: []
    },
    after: {
      all: []
    },
    error: {
      all: []
    }
  })
}
