// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html

export const zeroMinmaxPath = 'zero-minmax'

export const zeroMinmaxMethods = [
  'initialize',      // Setup table CCCZEROMINMAX
  'initializeQueue', // Setup table CCCZEROMINMAX_QUEUE for batch processing
  'branches',        // Get active branches (excluding HQ)
  'count',           // Get count of affected articles
  'preview',         // Get preview data with pagination
  'process',         // Execute the reset operation (synchronous)
  'processBatch',    // Execute the reset operation in batches (for large datasets)
  'cancelBatch',     // Cancel a batch processing job
  'queueStatus',     // Get status of a batch processing job
  'history',         // Get reset history
  'batchDetails',    // Get detailed records for a specific batch
  'summary',         // Get reset batch summaries
  'cleanup'          // Remove old history records
]
