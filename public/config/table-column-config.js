/**
 * Configuration for the Branch Replenishment data table columns.
 */
export const columnConfig = [
  // --- Identifying Information ---
  { key: 'index', displayName: '#', visible: true, type: 'index', filterable: false, group: 'info' },
  { key: 'keyField', displayName: 'Key', visible: false, type: 'string', filterable: false, group: 'info' }, // Hidden unique key
  { key: 'mtrl', displayName: 'MTRL', visible: true, type: 'string', filterable: false, group: 'info' }, // Added MTRL
  { key: 'Cod', displayName: 'Code', visible: true, type: 'string', filterable: true, group: 'info' },
  { key: 'Descriere', displayName: 'Description', visible: true, type: 'string', filterable: true, group: 'info', truncate: 50 },
  { key: 'branchD', displayName: 'Branch Code', visible: false, type: 'string', filterable: false, group: 'info' }, // Hidden branch code
  { key: 'Destinatie', displayName: 'Destination', visible: true, type: 'string', filterable: true, group: 'info', isHeaderFilter: true }, // Filterable in header
  { key: 'Blacklisted', displayName: 'Blacklisted', visible: true, type: 'boolean', filterable: false, group: 'info', classFn: 'getBlacklistedClass' },
  { key: 'InLichidare', displayName: 'In Lichidare', visible: true, type: 'boolean', filterable: false, group: 'info', classFn: 'getLichidareClass' },

  // --- Source Branch Data ---
  { key: 'stoc_emit', displayName: 'Stock Emit', visible: true, type: 'number', filterable: false, group: 'source', classFn: 'getStockClassEmit' },
  { key: 'min_emit', displayName: 'Min Emit', visible: true, type: 'number', filterable: false, group: 'source', classFn: 'getValueClass' },
  { key: 'max_emit', displayName: 'Max Emit', visible: true, type: 'number', filterable: false, group: 'source', classFn: 'getValueClass' },
  { key: 'disp_min_emit', displayName: 'Disp Min', visible: true, type: 'number', filterable: false, group: 'source', classFn: 'getValueClass', divider: true },
  { key: 'disp_max_emit', displayName: 'Disp Max', visible: true, type: 'number', filterable: false, group: 'source', classFn: 'getValueClass' },

  // --- Destination Branch Data ---
  { key: 'stoc_dest', displayName: 'Stock Dest', visible: true, type: 'number', filterable: false, group: 'destination', classFn: 'getStockClassDest', divider: true },
  { key: 'min_dest', displayName: 'Min Dest', visible: true, type: 'number', filterable: false, group: 'destination', classFn: 'getValueClass' },
  { key: 'max_dest', displayName: 'Max Dest', visible: true, type: 'number', filterable: false, group: 'destination', classFn: 'getValueClass' },
  { key: 'comenzi', displayName: 'Com.', visible: true, type: 'number', filterable: false, group: 'destination', classFn: 'getValueClass', divider: true, tooltip: 'Pending Orders' },
  { key: 'transf_nerec', displayName: 'In Transf.', visible: true, type: 'number', filterable: false, group: 'destination', classFn: 'getValueClass', tooltip: 'In Transfer (Unreceived)' },

  // --- Necessity Calculation ---
  { key: 'nec_min', displayName: 'Nec Min', visible: true, type: 'number', filterable: false, group: 'necessity', classFn: 'getValueClass', divider: true },
  { key: 'nec_max', displayName: 'Nec Max', visible: true, type: 'number', filterable: false, group: 'necessity', classFn: 'getValueClass' },
  { key: 'nec_min_comp', displayName: 'Nec Min Comp', visible: true, type: 'number', filterable: false, group: 'necessity', classFn: 'getValueClass', tooltip: 'Company Min Necessity (Excl. Source)' },
  { key: 'nec_max_comp', displayName: 'Nec Max Comp', visible: true, type: 'number', filterable: false, group: 'necessity', classFn: 'getValueClass', tooltip: 'Company Max Necessity (Excl. Source)' },

  // --- Action/Transfer ---
  { key: 'cant_min', displayName: 'Cant Min', visible: true, type: 'number', filterable: false, group: 'action', classFn: 'getValueClass', divider: true, tooltip: 'Calculated Min Transfer Qty' },
  { key: 'cant_max', displayName: 'Cant Max', visible: true, type: 'number', filterable: false, group: 'action', classFn: 'getValueClass', tooltip: 'Calculated Max Transfer Qty' },
  { key: 'transfer', displayName: 'Transf.', visible: true, type: 'number', filterable: false, group: 'action', isEditable: true, classFn: 'getValueClass' },
];

// Helper function to get visible columns
export const getVisibleColumns = () => columnConfig.filter(col => col.visible);
