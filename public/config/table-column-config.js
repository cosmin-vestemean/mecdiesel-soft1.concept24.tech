/**
 * Configuration for the Branch Replenishment data table columns.
 */
export const columnConfig = [
  // --- Identifying Information ---
  { key: 'index', displayName: '#', visible: true, type: 'index', group: 'info' },
  { key: 'keyField', displayName: 'Key', visible: false, type: 'string', group: 'info' }, // Hidden unique key
  { key: 'mtrl', displayName: 'MTRL', visible: false, type: 'string', group: 'info' }, // Added MTRL
  { key: 'Cod', displayName: 'Cod', visible: true, type: 'string', group: 'info' },
  { key: 'Descriere', displayName: 'Denumire', visible: true, type: 'string', group: 'info' },
  { key: 'branchD', displayName: 'Branch Code', visible: false, type: 'string', group: 'info' }, // Hidden branch code
  { key: 'Destinatie', displayName: 'Dest', visible: true, type: 'string', group: 'info', isHeaderFilter: true }, // Filterable in header
  { key: 'Blacklisted', displayName: 'BlkLst', visible: true, type: 'boolean', group: 'info', classFn: 'getBlacklistedClass' },
  { key: 'InLichidare', displayName: 'InLic', visible: true, type: 'boolean', group: 'info', classFn: 'getLichidareClass' },

  // --- Source Branch Data ---
  { key: 'stoc_emit', displayName: 'StocEmit', visible: true, type: 'number', group: 'source', classFn: 'getStockClassEmit', isHeaderFilter: true },
  { key: 'min_emit', displayName: 'MinEmit', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', isHeaderFilter: true },
  { key: 'max_emit', displayName: 'MaxEmit', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', isHeaderFilter: true },
  { key: 'disp_min_emit', displayName: 'DispMin', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', divider: true, isHeaderFilter: true },
  { key: 'disp_max_emit', displayName: 'DispMax', visible: true, type: 'number', group: 'source', classFn: 'getValueClass', isHeaderFilter: true },

  // --- Destination Branch Data ---
  { key: 'stoc_dest', displayName: 'StocDest', visible: true, type: 'number', group: 'destination', classFn: 'getStockClassDest', divider: true, isHeaderFilter: true },
  { key: 'min_dest', displayName: 'MinDest', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', isHeaderFilter: true },
  { key: 'max_dest', displayName: 'MaxDest', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', isHeaderFilter: true },
  { key: 'salesperc', displayName: 'Sales%', visible: true, type: 'number', group: 'destination', classFn: 'getSalesPercClass', tooltip: 'Sales Percentage from ABC Analysis', isHeaderFilter: true },
  { key: 'abc_class', displayName: 'ABC', visible: true, type: 'string', group: 'destination', classFn: 'getAbcBadgeClass', tooltip: 'ABC Classification', isHeaderFilter: true },
  { key: 'comenzi', displayName: 'Com', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', divider: true, tooltip: 'Pending Orders', isHeaderFilter: true },
  { key: 'transf_nerec', displayName: 'InTransf', visible: true, type: 'number', group: 'destination', classFn: 'getValueClass', tooltip: 'In Transfer (Unreceived)', isHeaderFilter: true },

  // --- Necessity Calculation ---
  { key: 'nec_min', displayName: 'NecMin', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', divider: true, isHeaderFilter: true },
  { key: 'nec_max', displayName: 'NecMax', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', isHeaderFilter: true },
  { key: 'nec_min_comp', displayName: 'NecMinCo', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', tooltip: 'Company Min Necessity (Excl. Source)', isHeaderFilter: true },
  { key: 'nec_max_comp', displayName: 'NecMaxCo', visible: true, type: 'number', group: 'necessity', classFn: 'getValueClass', tooltip: 'Company Max Necessity (Excl. Source)', isHeaderFilter: true },

  // --- Action/Transfer ---
  { key: 'cant_min', displayName: 'CantMin', visible: true, type: 'number', group: 'action', classFn: 'getValueClass', divider: true, tooltip: 'Calculated Min Transfer Qty', isHeaderFilter: true },
  { key: 'cant_max', displayName: 'CantMax', visible: true, type: 'number', group: 'action', classFn: 'getValueClass', tooltip: 'Calculated Max Transfer Qty', isHeaderFilter: true },
  { key: 'transfer', displayName: 'Transf', visible: true, type: 'number', group: 'action', isEditable: true, classFn: 'getValueClass', isHeaderFilter: true },
];

// Helper function to get visible columns
export const getVisibleColumns = () => columnConfig.filter(col => col.visible);
