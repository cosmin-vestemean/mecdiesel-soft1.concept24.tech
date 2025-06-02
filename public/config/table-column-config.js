/**
 * Configuration for the Branch Replenishment data table columns.
 */
export const columnConfig = [
  // --- Identifying Information ---
  { key: 'index', displayName: '#', visible: true, type: 'index', group: 'info' },
  { key: 'keyField', displayName: 'Key', visible: false, type: 'string', group: 'info' }, // Hidden unique key
  { key: 'mtrl', displayName: 'MTRL', visible: false, type: 'string', group: 'info' }, // Added MTRL
  { key: 'Cod', displayName: 'Cod', visible: true, type: 'string', group: 'info', isSortable: true },
  { key: 'Descriere', displayName: 'Denumire', visible: true, type: 'string', group: 'info', isSortable: true },
  { key: 'branchD', displayName: 'Branch Code', visible: false, type: 'string', group: 'info' }, // Hidden branch code
  { key: 'Destinatie', displayName: 'Dest', visible: true, type: 'string', group: 'info', isHeaderFilter: true, isSortable: true }, // Filterable in header
  { key: 'Blacklisted', displayName: 'BlkLst', visible: true, type: 'boolean', group: 'info', classFn: 'getBlacklistedClass', isHeaderFilter: true, isSortable: true },
  { key: 'InLichidare', displayName: 'InLic', visible: true, type: 'boolean', group: 'info', classFn: 'getLichidareClass', isHeaderFilter: true, isSortable: true },

  // --- Source Branch Data ---
  { key: 'stoc_emit', displayName: 'StocEmit', visible: true, type: 'number', group: 'source', classFn: 'getStockClassEmit', isHeaderFilter: true, isSortable: true },
  { key: 'min_emit', displayName: 'MinEmit', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', isHeaderFilter: true, isSortable: true },
  { key: 'max_emit', displayName: 'MaxEmit', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', isHeaderFilter: true, isSortable: true },
  { key: 'disp_min_emit', displayName: 'DispMin', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', divider: true, isHeaderFilter: true, isSortable: true },
  { key: 'disp_max_emit', displayName: 'DispMax', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', isHeaderFilter: true, isSortable: true },

  // --- Destination Branch Data ---
  { key: 'stoc_dest', displayName: 'StocDest', visible: true, type: 'number', group: 'destination', classFn: 'getStockClassDest', divider: true, isHeaderFilter: true, isSortable: true },
  { key: 'min_dest', displayName: 'MinDest', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', isHeaderFilter: true, isSortable: true },
  { key: 'max_dest', displayName: 'MaxDest', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', isHeaderFilter: true, isSortable: true },
  { key: 'salesperc', displayName: 'Sales%', visible: true, type: 'number', group: 'destination', classFn: 'getSalesPercClass', tooltip: 'Sales Percentage from ABC Analysis', isHeaderFilter: true, isSortable: true },
  { key: 'abc_class', displayName: 'ABC', visible: true, type: 'string', group: 'destination', classFn: 'getAbcBadgeClass', tooltip: 'ABC Classification', isHeaderFilter: true, isSortable: true },
  { key: 'comenzi', displayName: 'Com', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', divider: true, tooltip: 'Pending Orders', isHeaderFilter: true, isSortable: true },
  { key: 'transf_nerec', displayName: 'InTransf', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', tooltip: 'In Transfer (Unreceived)', isHeaderFilter: true, isSortable: true },

  // --- Necessity Calculation ---
  { key: 'nec_min', displayName: 'NecMin', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', divider: true, isHeaderFilter: true, isSortable: true },
  { key: 'nec_max', displayName: 'NecMax', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', isHeaderFilter: true, isSortable: true },
  { key: 'nec_min_comp', displayName: 'NecMinCo', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', tooltip: 'Company Min Necessity (Excl. Source)', isHeaderFilter: true, isSortable: true },
  { key: 'nec_max_comp', displayName: 'NecMaxCo', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', tooltip: 'Company Max Necessity (Excl. Source)', isHeaderFilter: true, isSortable: true },

  // --- Action/Transfer ---
  { key: 'cant_min', displayName: 'CantMin', visible: true, type: 'number', group: 'action', classFn: 'getValueClass', divider: true, tooltip: 'Calculated Min Transfer Qty', isHeaderFilter: true, isSortable: true },
  { key: 'cant_max', displayName: 'CantMax', visible: true, type: 'number', group: 'action', classFn: 'getValueClass', tooltip: 'Calculated Max Transfer Qty', isHeaderFilter: true, isSortable: true },
  { key: 'transfer', displayName: 'Transf', visible: true, type: 'number', group: 'action', isEditable: true, classFn: 'getValueClass', isHeaderFilter: true, isSortable: true },
];

// Helper function to get visible columns
export const getVisibleColumns = () => columnConfig.filter(col => col.visible);

// Helper function to get sortable columns
export const getSortableColumns = () => columnConfig.filter(col => col.visible && col.isSortable);

// Configuration for sorting behavior
export const sortConfig = {
  // Maximum dataset size for client-side sorting
  // Above this threshold, consider implementing server-side sorting
  clientSortThreshold: 1000,
  
  // Default sort orders for different data types
  defaultSortOrder: {
    'string': 'asc',
    'number': 'desc', // For business data, descending is often more useful
    'boolean': 'desc', // Show true values first
    'index': 'asc'
  }
};
