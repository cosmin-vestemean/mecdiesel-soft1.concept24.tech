/**
 * Filters data based on search terms and filter selections
 * @param {Array} data - The complete data array to filter
 * @param {Object} filters - Object containing filter criteria
 * @param {string} filters.searchTerm - Text search term
 * @param {string} filters.transferFilter - Filter by transfer status ('all', 'positive', 'zero')
 * @param {string} filters.destinationFilter - Filter by destination branch
 * @param {string} filters.stockStatusFilter - Filter by stock status
 * @param {Function} getStockClass - Function to determine stock class
 * @returns {Array} Filtered data array
 */
export function filterData(data, filters, getStockClass) {
  if (!data || !Array.isArray(data)) {
    return [];
  }

  const { searchTerm, transferFilter, destinationFilter, stockStatusFilter } = filters;
  
  let filtered = [...data];

  // Apply text search filter
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item =>
      (item.Cod && item.Cod.toLowerCase().includes(term)) ||
      (item.Descriere && item.Descriere.toLowerCase().includes(term))
    );
  }

  // Apply transfer status filter
  if (transferFilter !== 'all') {
    filtered = filtered.filter(item => {
      const transfer = parseFloat(item.transfer || 0);
      return transferFilter === 'positive' ? transfer > 0 : transfer === 0;
    });
  }

  // Apply destination filter
  if (destinationFilter !== 'all') {
    filtered = filtered.filter(item =>
      item.Destinatie === destinationFilter
    );
  }

  // Apply stock status filter
  if (stockStatusFilter !== 'all') {
    filtered = filtered.filter(item => {
      const stockClass = getStockClass(item.stoc_dest, item.min_dest, item.max_dest);
      switch (stockStatusFilter) {
        case 'critical':
          return stockClass.includes('stock-critical');
        case 'optimal':
          return stockClass.includes('stock-optimal');
        case 'high':
          return stockClass.includes('stock-high');
        case 'undefined':
          return stockClass.includes('stock-undefined');
        default:
          return true;
      }
    });
  }

  return filtered;
}

/**
 * Extracts unique destination branches from data
 * @param {Array} data - The complete data array
 * @returns {Array} Sorted array of unique destination values
 */
export function getUniqueDestinations(data) {
  if (!data || data.length === 0) {
    return [];
  }

  const destinations = [...new Set(data.map(item => item.Destinatie))];
  return destinations.sort();
}

/**
 * Counts items matching each stock status category
 * @param {Array} data - Data array to analyze
 * @param {Function} getStockClass - Function to determine stock class
 * @returns {Object} Counts for each status category
 */
export function getStockStatusCounts(data, getStockClass) {
  return {
    critical: data.filter(item => 
      getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-critical')
    ).length,
    optimal: data.filter(item => 
      getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-optimal')
    ).length,
    high: data.filter(item => 
      getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-high')
    ).length,
    undefined: data.filter(item => 
      getStockClass(item.stoc_dest, item.min_dest, item.max_dest).includes('stock-undefined')
    ).length,
    all: data.length
  };
}