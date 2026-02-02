// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html

import request from 'request-promise'

// S1 API base URL
const S1_BASE_URL = process.env.S1_API_URL || 'https://s1aboronline.soft1cloud.com/s1aboronline'

/**
 * Helper function to make requests to S1 AJS endpoints
 */
const makeS1Request = async (endpoint, data = {}) => {
  const uri = `${S1_BASE_URL}${endpoint}`
  
  return await request({
    method: 'POST',
    uri,
    body: {
      clientID: data.token,
      appId: '2002',
      JSONDATA: JSON.stringify(data.payload || {})
    },
    json: true,
    gzip: true
  })
}

/**
 * ZeroMinMaxService - Service for resetting CCCMINAUTO/CCCMAXAUTO values
 * 
 * This service provides methods to:
 * - Preview articles that will be affected
 * - Execute the reset operation with history tracking
 * - Manage reset history
 * - Support real-time notifications via channels
 */
export class ZeroMinMaxService {
  constructor(options) {
    this.options = options || {}
    this.app = null
    this.isInitialized = false
  }

  /**
   * Setup method called by Feathers when service is registered
   */
  async setup(app, path) {
    this.app = app
    console.log(`✅ ZeroMinMaxService registered at /${path}`)
  }

  /**
   * Initialize the CCCZEROMINMAX table
   * POST /zero-minmax/initialize
   * @param {Object} data - { token }
   */
  async initialize(data, params) {
    if (this.isInitialized) {
      return { success: true, message: 'Already initialized' }
    }

    try {
      const result = await makeS1Request('/JS/ZeroMinMax/setup', {
        token: data.token
      })

      if (result && result.success !== false) {
        this.isInitialized = true
        console.log('✅ ZeroMinMax: Table setup completed')
      }

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax setup error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get active branches (excluding HQ 1000)
   * POST /zero-minmax/branches
   * @param {Object} data - { token }
   */
  async branches(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/getActiveBranches', {
        token: data.token
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax branches error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get count of articles that will be affected
   * POST /zero-minmax/count
   * @param {Object} data - { token, filter, branches }
   */
  async count(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/getPreviewCount', {
        token: data.token,
        payload: {
          filter: data.filter,
          branches: data.branches
        }
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax count error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get preview data with pagination
   * POST /zero-minmax/preview
   * @param {Object} data - { token, filter, branches, page, pageSize }
   */
  async preview(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/getPreviewData', {
        token: data.token,
        payload: {
          filter: data.filter,
          branches: data.branches,
          page: data.page || 1,
          pageSize: data.pageSize || 50
        }
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax preview error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Execute the reset operation
   * POST /zero-minmax/process
   * @param {Object} data - { token, filter, branches, batchId, userId }
   */
  async process(data, params) {
    const startTime = Date.now()
    const batchId = data.batchId || `zero_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      // Emit 'started' event for real-time notifications
      if (this.app) {
        this.app.service('zero-minmax').emit('started', {
          batchId,
          filter: data.filter,
          branches: data.branches,
          userId: data.userId,
          startedAt: new Date().toISOString()
        })
      }

      const result = await makeS1Request('/JS/ZeroMinMax/processZeroMinMax', {
        token: data.token,
        payload: {
          filter: data.filter,
          branches: data.branches,
          batchId,
          userId: data.userId || 0
        }
      })

      const parsedResult = typeof result === 'string' ? JSON.parse(result) : result
      const duration = (Date.now() - startTime) / 1000

      // Emit 'completed' event for real-time notifications
      if (this.app) {
        this.app.service('zero-minmax').emit('completed', {
          batchId,
          affectedCount: parsedResult.affectedCount || 0,
          duration,
          completedAt: new Date().toISOString(),
          success: parsedResult.success
        })
      }

      return parsedResult
    } catch (error) {
      console.error('❌ ZeroMinMax process error:', error.message)

      // Emit 'error' event for real-time notifications
      if (this.app) {
        this.app.service('zero-minmax').emit('error', {
          batchId,
          error: error.message,
          failedAt: new Date().toISOString()
        })
      }

      return { success: false, error: error.message, batchId }
    }
  }

  /**
   * Get reset history with pagination
   * POST /zero-minmax/history
   * @param {Object} data - { token, page, pageSize, batchId }
   */
  async history(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/getResetHistory', {
        token: data.token,
        payload: {
          page: data.page || 1,
          pageSize: data.pageSize || 50,
          batchId: data.batchId || null
        }
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax history error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get reset batch summaries
   * POST /zero-minmax/summary
   * @param {Object} data - { token, limit }
   */
  async summary(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/getResetSummary', {
        token: data.token,
        payload: {
          limit: data.limit || 20
        }
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax summary error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Cleanup old history records
   * POST /zero-minmax/cleanup
   * @param {Object} data - { token, monthsOlderThan }
   */
  async cleanup(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/cleanup', {
        token: data.token,
        payload: {
          monthsOlderThan: data.monthsOlderThan || 12
        }
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax cleanup error:', error.message)
      return { success: false, error: error.message }
    }
  }
}

export const getOptions = (app) => {
  return { app }
}
