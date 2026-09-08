// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { authenticate } from '@feathersjs/authentication'
import { MinmaxEngineService, getOptions } from './minmax-engine.class.js'
import { minmaxEnginePath, minmaxEngineMethods } from './minmax-engine.shared.js'
import { requireRole } from './authorize.js'
import { ROLE_READ, ROLE_EDIT } from './roles.js'

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
      // §12.8: fiecare metoda cere un JWT valid + rol minmax.read; saveParams
      // cere in plus minmax.edit (verificat DUPA minmax.read, din acelasi token).
      // runEngine/abandonRun/purgeRun sunt gardate identic — cine scrie
      // parametrii poate si lansa/opri/purja o sesiune (FAZA6_CONTRACT.md §8).
      all: [authenticate('jwt'), requireRole(ROLE_READ)],
      abandonRun: [requireRole(ROLE_EDIT)],
      purgeRun: [requireRole(ROLE_EDIT)],
      runEngine: [requireRole(ROLE_EDIT)],
      saveParams: [requireRole(ROLE_EDIT)]
    }
  })
}
