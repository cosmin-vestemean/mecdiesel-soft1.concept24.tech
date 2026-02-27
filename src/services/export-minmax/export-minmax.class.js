import rp from 'request-promise'

const S1_BASE_URL = 'https://mecdiesel.oncloud.gr/s1services'

const request = rp.defaults({
  baseUrl: S1_BASE_URL,
  json: true,
  gzip: true
})

const makeS1Request = async (endpoint, data = {}) => {
  return await request({
    method: 'POST',
    uri: endpoint,
    body: {
      clientID: data.token,
      appId: '2002',
      JSONDATA: JSON.stringify(data.payload || {})
    }
  })
}

export class ExportMinMaxService {
  constructor(options) {
    this.options = options || {}
    this.app = null
  }

  async setup(app, path) {
    this.app = app
    console.log(`✅ ExportMinMaxService registered at /${path}`)
  }

  /**
   * Get active branches (excluding HQ 1000)
   * Reuses the same AJS endpoint as zero-minmax
   */
  async branches(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/getActiveBranches', {
        token: data.token
      })
      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ExportMinMax branches error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Export HQ min/max data with pagination
   */
  async exportHQ(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/exportHQ', {
        token: data.token,
        payload: {
          page: data.page || 1,
          pageSize: data.pageSize || 200,
          exportAll: data.exportAll || false
        }
      })
      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ExportMinMax HQ error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Export branch min/max data with pagination and branch filter
   */
  async exportBranches(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/exportBranches', {
        token: data.token,
        payload: {
          branches: data.branches,
          page: data.page || 1,
          pageSize: data.pageSize || 200,
          exportAll: data.exportAll || false
        }
      })
      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ExportMinMax branches export error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get counts for HQ and branch exports
   */
  async exportCounts(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/exportCounts', {
        token: data.token,
        payload: {
          branches: data.branches || ''
        }
      })
      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ExportMinMax counts error:', error.message)
      return { success: false, error: error.message }
    }
  }
}

export const getOptions = (app) => {
  return { app }
}
