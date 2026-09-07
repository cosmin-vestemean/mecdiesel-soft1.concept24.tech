// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { MinmaxEngineService, getOptions } from './minmax-engine.class.js'
import { minmaxEnginePath, minmaxEngineMethods } from './minmax-engine.shared.js'

export * from './minmax-engine.class.js'
export * from './minmax-engine.shared.js'

/**
 * Configure function that registers the minmax-engine service and its hooks
 * @param {Application} app - Feathers application
 */
export const minmaxEngine = (app) => {
  app.use(minmaxEnginePath, new MinmaxEngineService(getOptions(app)), {
    methods: minmaxEngineMethods
  })

  const service = app.service(minmaxEnginePath)

  service.hooks({
    around: {
      all: []
    }
  })
}
