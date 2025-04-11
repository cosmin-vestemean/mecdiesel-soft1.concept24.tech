/**
 * Determines the CSS class for a stock value based on min/max limits
 * @param {string|number} value - The stock value
 * @param {string|number} minLimit - Minimum stock limit
 * @param {string|number} maxLimit - Maximum stock limit
 * @returns {string} CSS class name for styling
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
    return 'stock-optimal';
  }
  
  // Over-stock situation (above maximum)
  if (!isNaN(max) && stock > max) {
    return 'stock-high';
  }
  
  // If min/max not defined but stock exists - use text-warning
  if (stock > 0) {
    return 'stock-undefined';
  }
  
  // No stock
  return 'text-muted';
}

/**
 * Determines the CSS class for a numeric value (positive/negative highlighting)
 * @param {string|number} value - The numeric value to style
 * @returns {string} CSS class name for styling
 */
export function getValueClass(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num < 0 ? 'text-danger fw-bold' : (num > 0 ? 'text-success' : 'text-muted');
}

/**
 * Wraps a stock value in a styled span element based on stock status
 * @param {string|number} value - The stock value
 * @param {string|number} minLimit - Minimum stock limit
 * @param {string|number} maxLimit - Maximum stock limit
 * @param {Function} html - The lit-html template function
 * @returns {Function} Lit HTML template function for rendering the stock value
 */
export function renderStockValue(value, minLimit, maxLimit, html) {
  const stockClass = getStockClass(value, minLimit, maxLimit);
  return value;
}