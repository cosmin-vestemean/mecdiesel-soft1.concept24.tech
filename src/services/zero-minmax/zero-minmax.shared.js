// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html

export const zeroMinmaxPath = 'zero-minmax'

export const zeroMinmaxMethods = [
  'initialize',   // Setup table CCCZEROMINMAX
  'branches',     // Get active branches (excluding HQ)
  'count',        // Get count of affected articles
  'preview',      // Get preview data with pagination
  'process',      // Execute the reset operation
  'history',      // Get reset history
  'summary',      // Get reset batch summaries
  'cleanup'       // Remove old history records
]
