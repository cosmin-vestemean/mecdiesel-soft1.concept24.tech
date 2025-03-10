// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'
import {
  siteProductFrequentChangesDataValidator,
  siteProductFrequentChangesPatchValidator,
  siteProductFrequentChangesQueryValidator,
  siteProductFrequentChangesResolver,
  siteProductFrequentChangesExternalResolver,
  siteProductFrequentChangesDataResolver,
  siteProductFrequentChangesPatchResolver,
  siteProductFrequentChangesQueryResolver
} from './site_product_frequent_changes.schema.js'
import { SiteProductFrequentChangesService, getOptions } from './site_product_frequent_changes.class.js'
import {
  siteProductFrequentChangesPath,
  siteProductFrequentChangesMethods
} from './site_product_frequent_changes.shared.js'

export * from './site_product_frequent_changes.class.js'
export * from './site_product_frequent_changes.schema.js'

// A configure function that registers the service and its hooks via `app.configure`
export const siteProductFrequentChanges = (app) => {
  // Register our service on the Feathers application
  app.use(siteProductFrequentChangesPath, new SiteProductFrequentChangesService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: siteProductFrequentChangesMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(siteProductFrequentChangesPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(siteProductFrequentChangesExternalResolver),
        schemaHooks.resolveResult(siteProductFrequentChangesResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(siteProductFrequentChangesQueryValidator),
        schemaHooks.resolveQuery(siteProductFrequentChangesQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(siteProductFrequentChangesDataValidator),
        schemaHooks.resolveData(siteProductFrequentChangesDataResolver)
      ],
      patch: [
        schemaHooks.validateData(siteProductFrequentChangesPatchValidator),
        schemaHooks.resolveData(siteProductFrequentChangesPatchResolver)
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
