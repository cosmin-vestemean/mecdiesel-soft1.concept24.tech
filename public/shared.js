export const shared = {
  htmlLimit: 100,
  skip: 0,
  skipErr: 0,
  skipConvAuto: 0,
  skipMappings: 0,
  skipStock: 0,
  table: "mec_item",
  totalRecords: 0,
  
  // Add helper method to reset pagination for a specific tab
  resetPagination(tabName) {
    switch (tabName.toLowerCase()) {
      case 'items':
        this.skip = 0;
        break;
      case 'errors':
        this.skipErr = 0;
        break;
      case 'mappings':
        this.skipMappings = 0;
        break;
      case 'convauto':
        this.skipConvAuto = 0;
        break;
      case 'stockchanges':
        this.skipStock = 0;
        break;
      default:
        // Reset all pagination values
        this.skip = 0;
        this.skipErr = 0;
        this.skipConvAuto = 0;
        this.skipMappings = 0;
        this.skipStock = 0;
    }
  }
};
