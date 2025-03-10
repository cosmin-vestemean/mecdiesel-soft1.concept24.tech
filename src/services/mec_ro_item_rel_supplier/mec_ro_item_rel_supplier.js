// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'
import {
  mecRoItemRelSupplierDataValidator,
  mecRoItemRelSupplierPatchValidator,
  mecRoItemRelSupplierQueryValidator,
  mecRoItemRelSupplierResolver,
  mecRoItemRelSupplierExternalResolver,
  mecRoItemRelSupplierDataResolver,
  mecRoItemRelSupplierPatchResolver,
  mecRoItemRelSupplierQueryResolver
} from './mec_ro_item_rel_supplier.schema.js'
import { MecRoItemRelSupplierService, getOptions } from './mec_ro_item_rel_supplier.class.js'
import { mecRoItemRelSupplierPath, mecRoItemRelSupplierMethods } from './mec_ro_item_rel_supplier.shared.js'

export * from './mec_ro_item_rel_supplier.class.js'
export * from './mec_ro_item_rel_supplier.schema.js'

// A configure function that registers the service and its hooks via `app.configure`
export const mecRoItemRelSupplier = (app) => {
  // Register our service on the Feathers application
  app.use(mecRoItemRelSupplierPath, new MecRoItemRelSupplierService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: mecRoItemRelSupplierMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(mecRoItemRelSupplierPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(mecRoItemRelSupplierExternalResolver),
        schemaHooks.resolveResult(mecRoItemRelSupplierResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(mecRoItemRelSupplierQueryValidator),
        schemaHooks.resolveQuery(mecRoItemRelSupplierQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(mecRoItemRelSupplierDataValidator),
        schemaHooks.resolveData(mecRoItemRelSupplierDataResolver)
      ],
      patch: [
        schemaHooks.validateData(mecRoItemRelSupplierPatchValidator),
        schemaHooks.resolveData(mecRoItemRelSupplierPatchResolver)
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
