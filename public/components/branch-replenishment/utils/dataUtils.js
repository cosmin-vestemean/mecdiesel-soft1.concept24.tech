\
// Utility functions for data manipulation in Branch Replenishment component

/**
 * Determines the CSS class for stock values based on min/max limits.
 * @param {string|number} value - The stock value.
 * @param {string|number} minLimit - The minimum stock limit.
 * @param {string|number} maxLimit - The maximum stock limit.
 * @returns {string} CSS class string.
 */
export function getStockClass(value, minLimit, maxLimit) {
  const stock = parseFloat(value);
  const min = parseFloat(minLimit);
  const max = parseFloat(maxLimit);

  // Handle NaN cases
  if (isNaN(stock)) return '';

  // Critical under-stock situation (below minimum)
  if (!isNaN(min) && stock < min) {
    return 'text-danger stock-critical';
  }

  // Optimal stock level (between min and max)
  if (!isNaN(min) && !isNaN(max) && stock >= min && stock <= max) {
    return 'text-dark stock-optimal';
  }

  // Over-stock situation (above maximum)
  if (!isNaN(max) && stock > max) {
    return 'text-success stock-high';
  }

  // If min/max not defined but stock exists - use text-warning
  if (stock > 0) {
    return 'text-warning stock-undefined';
  }

  // No stock
  return 'text-muted';
}

/**
 * Determines the CSS class for numerical values (positive, negative, zero).
 * @param {string|number} value - The numerical value.
 * @returns {string} CSS class string.
 */
export function getValueClass(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num < 0 ? 'text-danger fw-bold' : (num > 0 ? 'text-success' : 'text-muted');
}

/**
 * Extracts unique destination branch names from the data.
 * @param {Array} data - The replenishment data array.
 * @returns {Array<string>} Sorted array of unique destination names.
 */
export function getUniqueDestinations(data) {
  if (!data || data.length === 0) {
    return [];
  }
  // Assuming 'Destinatie' is the correct property name based on sp_GetMtrlsData.sql
  const destinations = [...new Set(data.map(item => item.Destinatie))];
  return destinations.sort();
}

/**
 * Filters the main data array based on various criteria.
 * @param {Array} data - The raw data array.
 * @param {object} filters - An object containing filter values { searchTerm, transferFilter, destinationFilter, stockStatusFilter }.
 * @param {function} getStockClassFn - The function to determine stock class (passed to avoid circular dependencies).
 * @returns {Array} The filtered data array.
 */
export function filterData(data, filters, getStockClassFn) {
  let filtered = data;
  const { searchTerm, transferFilter, destinationFilter, stockStatusFilter } = filters;

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item =>
      (item.Cod && item.Cod.toLowerCase().includes(term)) ||
      (item.Descriere && item.Descriere.toLowerCase().includes(term))
    );
  }

  if (transferFilter !== 'all') {
    filtered = filtered.filter(item => {
      const transfer = parseFloat(item.transfer || 0);
      return transferFilter === 'positive' ? transfer > 0 : transfer === 0;
    });
  }

  if (destinationFilter !== 'all') {
    // Assuming 'Destinatie' is the correct property name
    filtered = filtered.filter(item =>
      item.Destinatie === destinationFilter
    );
  }

  if (stockStatusFilter !== 'all') {
    filtered = filtered.filter(item => {
      // Assuming 'stoc_dest', 'min_dest', 'max_dest' are correct property names
      const stockClass = getStockClassFn(item.stoc_dest, item.min_dest, item.max_dest);
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

// Note: getStockStatusCounts was imported in index.js but not found.
// If needed, it should be added here.
// export function getStockStatusCounts(data, getStockClassFn) { ... }
