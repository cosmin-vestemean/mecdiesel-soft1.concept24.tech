// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'
import {
  mecItemAltrefDataValidator,
  mecItemAltrefPatchValidator,
  mecItemAltrefQueryValidator,
  mecItemAltrefResolver,
  mecItemAltrefExternalResolver,
  mecItemAltrefDataResolver,
  mecItemAltrefPatchResolver,
  mecItemAltrefQueryResolver
} from './mec_item_altref.schema.js'
import { MecItemAltrefService, getOptions } from './mec_item_altref.class.js'
import { mecItemAltrefPath, mecItemAltrefMethods } from './mec_item_altref.shared.js'

export * from './mec_item_altref.class.js'
export * from './mec_item_altref.schema.js'

// A configure function that registers the service and its hooks via `app.configure`
export const mecItemAltref = (app) => {
  // Register our service on the Feathers application
  app.use(mecItemAltrefPath, new MecItemAltrefService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: mecItemAltrefMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(mecItemAltrefPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(mecItemAltrefExternalResolver),
        schemaHooks.resolveResult(mecItemAltrefResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(mecItemAltrefQueryValidator),
        schemaHooks.resolveQuery(mecItemAltrefQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(mecItemAltrefDataValidator),
        schemaHooks.resolveData(mecItemAltrefDataResolver)
      ],
      patch: [
        schemaHooks.validateData(mecItemAltrefPatchValidator),
        schemaHooks.resolveData(mecItemAltrefPatchResolver)
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
