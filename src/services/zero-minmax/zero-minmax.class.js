// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html

import rp from 'request-promise'

// S1 API base URL - same as main app.js
const S1_BASE_URL = 'https://mecdiesel.oncloud.gr/s1services'

// Create request instance with base URL
const request = rp.defaults({
  baseUrl: S1_BASE_URL,
  json: true,
  gzip: true
})

/**
 * Helper function to make requests to S1 AJS endpoints
 */
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

  /**
   * Initialize batch processing queue table
   * POST /zero-minmax/initializeQueue
   * @param {Object} data - { token }
   */
  async initializeQueue(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/createQueueTable', {
        token: data.token
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax queue table setup error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Process zero min/max in batches with progress tracking
   * POST /zero-minmax/processBatch
   * @param {Object} data - { token, filter, branches, userId }
   */
  async processBatch(data, params) {
    const { token, filter, branches, userId } = data
    const batchId = `zero_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const chunkSize = 500

    try {
      // 1. Get total count
      const countResult = await makeS1Request('/JS/ZeroMinMax/getPreviewCount', {
        token,
        payload: { filter, branches }
      })

      const countData = typeof countResult === 'string' ? JSON.parse(countResult) : countResult
      if (!countData.success) {
        throw new Error(countData.error || 'Failed to get count')
      }

      const totalCount = countData.count || 0
      if (totalCount === 0) {
        return { success: false, error: 'No articles to process' }
      }

      // 2. Initialize queue table if needed
      await this.initializeQueue({ token }, params)

      // 3. Insert job into queue
      const branchesCSV = branches.join(',')
      const insertQueueQry = `
        INSERT INTO CCCZEROMINMAX_QUEUE (BATCHID, TOTAL_COUNT, CHUNK_SIZE, STATUS, FILTRU_FOLOSIT, BRANCHES, CREATED_BY, STARTED_AT)
        VALUES ('${batchId}', ${totalCount}, ${chunkSize}, 'processing', '${filter}', '${JSON.stringify(branches).replace(/'/g, "''")}', ${userId}, GETDATE())
      `
      // Note: We'd need a generic RUNSQL endpoint in AJS, or we use process endpoint directly
      
      // 4. Emit batch-started event
      if (this.app) {
        this.app.service('zero-minmax').emit('batch-started', {
          batchId,
          user: params.user?.email || 'Unknown',
          filter,
          branches,
          totalCount,
          startedAt: new Date().toISOString()
        })
      }

      // 5. Process in chunks
      let processedCount = 0
      const totalChunks = Math.ceil(totalCount / chunkSize)

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const offset = chunkIndex * chunkSize

        // Check if job was cancelled before processing this chunk
        const statusResult = await makeS1Request('/JS/ZeroMinMax/getQueueStatus', {
          token,
          payload: { batchId }
        })
        const statusData = typeof statusResult === 'string' ? JSON.parse(statusResult) : statusResult
        
        if (statusData.success && statusData.status === 'cancelled') {
          // Emit cancelled event
          if (this.app) {
            this.app.service('zero-minmax').emit('batch-cancelled', {
              batchId,
              processedCount,
              totalCount,
              cancelledAt: new Date().toISOString()
            })
          }
          return {
            success: false,
            cancelled: true,
            message: 'Job was cancelled by user',
            processedCount,
            totalCount
          }
        }

        // Process this chunk
        const chunkResult = await makeS1Request('/JS/ZeroMinMax/processZeroMinMaxBatch', {
          token,
          payload: {
            batchId,
            filter,
            branchesCSV,
            offset,
            chunkSize,
            userId
          }
        })

        const chunkData = typeof chunkResult === 'string' ? JSON.parse(chunkResult) : chunkResult

        if (!chunkData.success) {
          // Chunk failed - emit error event
          if (this.app) {
            this.app.service('zero-minmax').emit('batch-failed', {
              batchId,
              error: chunkData.error || 'Unknown error',
              processedCount,
              failedAt: new Date().toISOString()
            })
          }
          throw new Error(chunkData.error || 'Chunk processing failed')
        }

        processedCount += chunkData.processed || 0

        // Emit progress event after each chunk
        if (this.app) {
          this.app.service('zero-minmax').emit('batch-progress', {
            batchId,
            processed: processedCount,
            total: totalCount,
            percent: Math.round((processedCount / totalCount) * 100),
            currentChunk: chunkIndex + 1,
            totalChunks
          })
        }

        // Small delay between chunks to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 6. Mark job as completed
      // (We'd need another AJS endpoint to update queue status, or do it inline)

      // 7. Emit completed event
      if (this.app) {
        this.app.service('zero-minmax').emit('batch-completed', {
          batchId,
          totalReset: processedCount,
          completedAt: new Date().toISOString()
        })
      }

      return {
        success: true,
        batchId,
        totalCount,
        processedCount,
        message: `Successfully reset ${processedCount} records`
      }

    } catch (error) {
      console.error('❌ ZeroMinMax batch processing error:', error.message)

      // Emit error event
      if (this.app) {
        this.app.service('zero-minmax').emit('batch-failed', {
          batchId,
          error: error.message,
          failedAt: new Date().toISOString()
        })
      }

      return { success: false, error: error.message, batchId }
    }
  }

  /**
   * Cancel a batch processing job
   * POST /zero-minmax/cancelBatch
   * @param {Object} data - { token, batchId }
   */
  async cancelBatch(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/cancelQueue', {
        token: data.token,
        payload: {
          batchId: data.batchId
        }
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax cancel batch error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get status of a batch processing job
   * POST /zero-minmax/queueStatus
   * @param {Object} data - { token, batchId }
   */
  async queueStatus(data, params) {
    try {
      const result = await makeS1Request('/JS/ZeroMinMax/getQueueStatus', {
        token: data.token,
        payload: {
          batchId: data.batchId
        }
      })

      return typeof result === 'string' ? JSON.parse(result) : result
    } catch (error) {
      console.error('❌ ZeroMinMax queue status error:', error.message)
      return { success: false, error: error.message }
    }
  }
}

export const getOptions = (app) => {
  return { app }
}
