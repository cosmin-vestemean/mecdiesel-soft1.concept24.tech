// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { ZeroMinMaxService, getOptions } from './zero-minmax.class.js'
import { zeroMinmaxPath, zeroMinmaxMethods } from './zero-minmax.shared.js'

export * from './zero-minmax.class.js'
export * from './zero-minmax.shared.js'

/**
 * Configure function that registers the zero-minmax service and its hooks
 * @param {Application} app - Feathers application
 */
export const zeroMinmax = (app) => {
  // Register our service on the Feathers application
  app.use(zeroMinmaxPath, new ZeroMinMaxService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: zeroMinmaxMethods,
    // Custom events for real-time notifications
    events: [
      'started', 
      'completed', 
      'error', 
      'progress',
      'batch-started',
      'batch-progress',
      'batch-completed',
      'batch-cancelled',
      'batch-failed'
    ]
  })

  // Get the registered service
  const service = app.service(zeroMinmaxPath)

  // Initialize hooks (can add authentication, validation, etc. later)
  service.hooks({
    around: {
      all: []
    },
    before: {
      all: [],
      initialize: [],
      initializeQueue: [],
      branches: [],
      count: [],
      preview: [],
      process: [],
      processBatch: [],
      cancelBatch: [],
      queueStatus: [],
      history: [],
      summary: [],
      cleanup: []
    },
    after: {
      all: [],
      process: [
        // Log successful process operations
        async (context) => {
          if (context.result && context.result.success) {
            console.log(`✅ ZeroMinMax process completed: ${context.result.affectedCount} records reset`)
          }
          return context
        }
      ],
      processBatch: [
        // Log successful batch process operations
        async (context) => {
          if (context.result && context.result.success) {
            console.log(`✅ ZeroMinMax batch process completed: ${context.result.processedCount} records reset`)
          }
          return context
        }
      ]
    },
    error: {
      all: [
        async (context) => {
          console.error(`❌ ZeroMinMax error in ${context.method}:`, context.error?.message)
          return context
        }
      ]
    }
  })

  // Configure channel publishing for real-time events
  service.publish('started', (data, context) => {
    // Publish to all authenticated users
    return app.channel('authenticated')
  })

  service.publish('completed', (data, context) => {
    return app.channel('authenticated')
  })

  service.publish('error', (data, context) => {
    return app.channel('authenticated')
  })

  service.publish('progress', (data, context) => {
    return app.channel('authenticated')
  })

  // Batch processing events
  service.publish('batch-started', (data, context) => {
    return app.channel('authenticated')
  })

  service.publish('batch-progress', (data, context) => {
    return app.channel('authenticated')
  })

  service.publish('batch-completed', (data, context) => {
    return app.channel('authenticated')
  })

  service.publish('batch-cancelled', (data, context) => {
    return app.channel('authenticated')
  })

  service.publish('batch-failed', (data, context) => {
    return app.channel('authenticated')
  })

  console.log('📦 ZeroMinMax service configured with real-time events (including batch processing)')
}
