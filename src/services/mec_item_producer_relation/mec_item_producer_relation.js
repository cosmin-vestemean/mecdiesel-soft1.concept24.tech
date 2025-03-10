// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'
import {
  mecItemProducerRelationDataValidator,
  mecItemProducerRelationPatchValidator,
  mecItemProducerRelationQueryValidator,
  mecItemProducerRelationResolver,
  mecItemProducerRelationExternalResolver,
  mecItemProducerRelationDataResolver,
  mecItemProducerRelationPatchResolver,
  mecItemProducerRelationQueryResolver
} from './mec_item_producer_relation.schema.js'
import { MecItemProducerRelationService, getOptions } from './mec_item_producer_relation.class.js'
import {
  mecItemProducerRelationPath,
  mecItemProducerRelationMethods
} from './mec_item_producer_relation.shared.js'

export * from './mec_item_producer_relation.class.js'
export * from './mec_item_producer_relation.schema.js'

// A configure function that registers the service and its hooks via `app.configure`
export const mecItemProducerRelation = (app) => {
  // Register our service on the Feathers application
  app.use(mecItemProducerRelationPath, new MecItemProducerRelationService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: mecItemProducerRelationMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(mecItemProducerRelationPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(mecItemProducerRelationExternalResolver),
        schemaHooks.resolveResult(mecItemProducerRelationResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(mecItemProducerRelationQueryValidator),
        schemaHooks.resolveQuery(mecItemProducerRelationQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(mecItemProducerRelationDataValidator),
        schemaHooks.resolveData(mecItemProducerRelationDataResolver)
      ],
      patch: [
        schemaHooks.validateData(mecItemProducerRelationPatchValidator),
        schemaHooks.resolveData(mecItemProducerRelationPatchResolver)
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
