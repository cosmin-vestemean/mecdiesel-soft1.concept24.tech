import { ExportMinMaxService, getOptions } from './export-minmax.class.js'
import { exportMinmaxPath, exportMinmaxMethods } from './export-minmax.shared.js'

export * from './export-minmax.class.js'
export * from './export-minmax.shared.js'

export const exportMinmax = (app) => {
  app.use(exportMinmaxPath, new ExportMinMaxService(getOptions(app)), {
    methods: exportMinmaxMethods,
    events: []
  })

  const service = app.service(exportMinmaxPath)

  service.hooks({
    around: { all: [] },
    before: {
      all: [],
      branches: [],
      exportHQ: [],
      exportBranches: [],
      exportCounts: []
    },
    after: {
      all: [],
      exportHQ: [
        async (context) => {
          if (context.result && context.result.success) {
            console.log(`✅ ExportMinMax HQ: returned ${context.result.count} records (total: ${context.result.totalCount})`)
          }
          return context
        }
      ],
      exportBranches: [
        async (context) => {
          if (context.result && context.result.success) {
            console.log(`✅ ExportMinMax Branches: returned ${context.result.count} records (total: ${context.result.totalCount})`)
          }
          return context
        }
      ]
    },
    error: {
      all: [
        async (context) => {
          console.error(`❌ ExportMinMax error in ${context.method}:`, context.error?.message)
          return context
        }
      ]
    }
  })

  console.log('📦 ExportMinMax service configured')
}
