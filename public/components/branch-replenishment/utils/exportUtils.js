// Utility functions for exporting data in Branch Replenishment component

/**
 * Exports the provided data array to an Excel file.
 * Assumes the XLSX library is available globally.
 * @param {Array} data - The data array to export.
 */
export function exportToExcel(data) {
  if (!data || !data.length) {
    console.warn('No data to export');
    // Optionally show a user notification here
    return;
  }

  // Check if XLSX library is loaded
  if (typeof XLSX === 'undefined') {
    console.error('XLSX library is not loaded. Cannot export to Excel.');
    // Optionally show a user notification here
    return;
  }

  try {
    // Map data to the desired export format, ensuring numerical types
    const exportData = data.map(item => ({
      'mtrl': item.mtrl,
      'Code': item.Cod,
      'Description': item.Descriere,
      'Source Branch': item.branchE, // Assuming branchE is source
      'Destination Branch': item.Destinatie,
      'Blacklisted': item.Blacklisted,
      'InLichidare': item.InLichidare,
      'Stock Emit': parseFloat(item.stoc_emit) || 0,
      'Min Emit': parseFloat(item.min_emit) || 0,
      'Max Emit': parseFloat(item.max_emit) || 0,
      'Disp Min Emit': parseFloat(item.disp_min_emit) || 0,
      'Disp Max Emit': parseFloat(item.disp_max_emit) || 0,
      'Stock Dest': parseFloat(item.stoc_dest) || 0,
      'Min Dest': parseFloat(item.min_dest) || 0,
      'Max Dest': parseFloat(item.max_dest) || 0,
      'Comenzi Dest': parseFloat(item.comenzi) || 0,
      'Transf Nerec Dest': parseFloat(item.transf_nerec) || 0,
      'Nec Min Dest': parseFloat(item.nec_min) || 0,
      'Nec Max Dest': parseFloat(item.nec_max) || 0,
      'Nec Min Comp': parseFloat(item.nec_min_comp) || 0,
      'Nec Max Comp': parseFloat(item.nec_max_comp) || 0,
      'Cant Min Transf': parseFloat(item.cant_min) || 0,
      'Cant Max Transf': parseFloat(item.cant_max) || 0,
      'Transfer': parseFloat(item.transfer) || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // --- Apply Number Formatting --- 
    // Define the range of columns to format as numbers (adjust indices as needed)
    // Assuming columns D-T correspond to the numerical fields starting from 'Stock Emit'
    const range = XLSX.utils.decode_range(ws['!ref']);
    const numericCols = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W']; // Corresponds to Stock Emit through Transfer

    for (let R = range.s.r + 1; R <= range.e.r; ++R) { // Start from row 1 (skip header)
      numericCols.forEach(colLetter => {
        const cell_address = colLetter + (R + 1); // R is 0-based, cell addresses are 1-based
        if (ws[cell_address]) {
          ws[cell_address].t = 'n'; // Set type to number
          // Optional: Add specific number format if needed, e.g., ws[cell_address].z = '0.00';
        }
      });
    }
    // --- End Apply Number Formatting ---

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Branch Replenishment');
    const date = new Date().toISOString().split('T')[0];
    const filename = `branch_replenishment_${date}.xlsx`;
    XLSX.writeFile(wb, filename);

  } catch (error) {
    console.error('Error exporting data to Excel:', error);
    // Optionally show a user notification about the error
  }
}
