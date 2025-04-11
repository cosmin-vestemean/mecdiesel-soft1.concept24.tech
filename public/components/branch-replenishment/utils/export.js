/**
 * Exports filtered data to Excel file
 * @param {Array} data - The filtered data to export
 * @returns {void}
 */
export function exportToExcel(data) {
  if (!data || !data.length) {
    console.warn('No data to export');
    return;
  }

  const exportData = data.map(item => ({
    'mtrl': item.mtrl,
    'Code': item.Cod,
    'Description': item.Descriere,
    'Destination': item.Destinatie,
    'Blacklisted': item.Blacklisted,
    'InLichidare': item.InLichidare,
    'Stock Emit': parseFloat(item.stoc_emit) || 0,
    'Min Emit': parseFloat(item.min_emit) || 0,
    'Max Emit': parseFloat(item.max_emit) || 0,
    'Disp Min': parseFloat(item.disp_min_emit) || 0,
    'Disp Max': parseFloat(item.disp_max_emit) || 0,
    'Stock Dest': parseFloat(item.stoc_dest) || 0,
    'Min Dest': parseFloat(item.min_dest) || 0,
    'Max Dest': parseFloat(item.max_dest) || 0,
    'Orders': parseFloat(item.comenzi) || 0,
    'In Transfer': parseFloat(item.transf_nerec) || 0,
    'Nec Min': parseFloat(item.nec_min) || 0,
    'Nec Max': parseFloat(item.nec_max) || 0,
    'Nec Min Comp': parseFloat(item.nec_min_comp) || 0,
    'Nec Max Comp': parseFloat(item.nec_max_comp) || 0,
    'Qty Min': parseFloat(item.cant_min) || 0,
    'Qty Max': parseFloat(item.cant_max) || 0,
    'Transfer': parseFloat(item.transfer) || 0
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Branch Replenishment');
  const date = new Date().toISOString().split('T')[0];
  const filename = `branch_replenishment_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}