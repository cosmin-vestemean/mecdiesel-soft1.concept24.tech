// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import {
  hooks as schemaHooks
} from '@feathersjs/schema'
import {
  mecItemDataValidator,
  mecItemPatchValidator,
  mecItemQueryValidator,
  mecItemResolver,
  mecItemExternalResolver,
  mecItemDataResolver,
  mecItemPatchResolver,
  mecItemQueryResolver
} from './mec_item.schema.js'
import {
  MecItemService,
  getOptions
} from './mec_item.class.js'
import {
  mecItemPath,
  mecItemMethods
} from './mec_item.shared.js'

export * from './mec_item.class.js'
export * from './mec_item.schema.js'

// A configure function that registers the service and its hooks via `app.configure`
export const mecItem = (app) => {
  // Register our service on the Feathers application
  app.use(mecItemPath, new MecItemService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: mecItemMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(mecItemPath).hooks({
    around: {
      all: [schemaHooks.resolveExternal(mecItemExternalResolver), schemaHooks.resolveResult(mecItemResolver)]
    },
    before: {
      all: [schemaHooks.validateQuery(mecItemQueryValidator), schemaHooks.resolveQuery(mecItemQueryResolver)],
      find: [],
      get: [],
      create: [schemaHooks.validateData(mecItemDataValidator), schemaHooks.resolveData(mecItemDataResolver)],
      patch: [schemaHooks.validateData(mecItemPatchValidator), schemaHooks.resolveData(mecItemPatchResolver)],
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