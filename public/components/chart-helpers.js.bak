// Chart helper methods for the necesar-achizitii component
// These are exported functions to help with chart rendering

/**
 * Creates appropriate datasets based on chart type
 */
export function createChartDatasets(chartType, data, labels, colorPalette, branches) {
  switch (chartType) {
    case 'total':
      return createTotalDataset(data, labels, colorPalette);
    case 'stacked':
      return createBranchDatasets(data, labels, colorPalette, branches, true);
    case 'sideBySide':
    default:
      return createBranchDatasets(data, labels, colorPalette, branches, false);
  }
}

/**
 * Creates a single dataset showing total sales
 */
export function createTotalDataset(data, labels, colorPalette) {
  // Calculate totals from the branch data
  const totalValues = labels.map(month => {
    let total = 0;
    if (data.branchData) {
      Object.values(data.branchData).forEach(branch => {
        total += branch[month] || 0;
      });
    } else if (data.values) {
      // Fallback to pre-calculated values
      const index = data.labels.indexOf(month);
      if (index >= 0) {
        total = data.values[index] || 0;
      }
    }
    return total;
  });

  return [{
    label: 'Total Sales',
    data: totalValues,
    backgroundColor: colorPalette[0],
    borderColor: colorPalette[0].replace('0.9', '1'),
    borderWidth: 1,
    barPercentage: 0.8,
    categoryPercentage: 0.8,
    minBarLength: 5
  }];
}

/**
 * Creates datasets for each branch
 */
export function createBranchDatasets(data, labels, colorPalette, branches, stacked) {
  const datasets = [];
  
  if (data.branchData) {
    // Get branch IDs and sort them numerically for consistent ordering and coloring
    const branchIds = Object.keys(data.branchData).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Create a dataset for each branch
    branchIds.forEach((branchId, index) => {
      const branchValues = labels.map(month => data.branchData[branchId][month] || 0);
      
      // Only include branches that have data if we're not stacking
      const hasData = branchValues.some(val => val > 0);
      if (!stacked && !hasData) {
        return; // Skip branches with no data for side-by-side view
      }
      
      // Add branch name to the label for better identification
      const branchName = branches[branchId] || branchId;
      datasets.push({
        label: `${branchId} - ${branchName}`,
        data: branchValues,
        backgroundColor: colorPalette[index % colorPalette.length],
        borderColor: colorPalette[index % colorPalette.length].replace('0.9', '1'),
        borderWidth: 1,
        barPercentage: stacked ? 0.9 : 0.8,
        categoryPercentage: stacked ? 0.9 : 0.8,
        minBarLength: 5
      });
    });
  } else if (data.values) {
    // Fallback for when no branch data is available
    datasets.push({
      label: 'Sales Quantity',
      data: [...data.values],
      backgroundColor: colorPalette[0],
      borderColor: colorPalette[0].replace('0.9', '1'),
      borderWidth: 1,
      barPercentage: 0.8,
      categoryPercentage: 0.8,
      minBarLength: 5
    });
  }
  
  return datasets;
}
