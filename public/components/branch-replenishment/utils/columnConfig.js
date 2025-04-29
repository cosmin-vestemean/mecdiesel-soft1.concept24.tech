export const columnMask = {
  // Internal/Hidden by default
  keyField: { label: 'Key', visible: false, type: 'string', filterable: false },
  grouper: { label: 'Grouper', visible: false, type: 'number', filterable: false },
  mtrl: { label: 'Material ID', visible: false, type: 'number', filterable: false },
  branchE: { label: 'Source Branch ID', visible: false, type: 'number', filterable: false },
  branchD: { label: 'Dest Branch ID', visible: false, type: 'number', filterable: false },

  // Visible Columns - Basic Info
  Cod: { label: 'Code', visible: true, type: 'string', filterable: true },
  Descriere: { label: 'Description', visible: true, type: 'string', filterable: true },
  Destinatie: { label: 'Destination', visible: true, type: 'string', filterable: true }, // Filtered by dropdown
  Blacklisted: { label: 'Blacklisted', visible: true, type: 'string', filterable: true }, // 'Da'/'Nu'/' - '
  InLichidare: { label: 'Outlet', visible: true, type: 'string', filterable: true }, // 'Da'/'Nu'/' - '

  // Visible Columns - Source Branch Group
  stoc_emit: { label: 'Stock', visible: true, type: 'number', filterable: true, group: 'Source' },
  min_emit: { label: 'Min', visible: true, type: 'number', filterable: true, group: 'Source' },
  max_emit: { label: 'Max', visible: true, type: 'number', filterable: true, group: 'Source' },
  disp_min_emit: { label: 'Avail (Min)', visible: true, type: 'number', filterable: true, group: 'Source' },
  disp_max_emit: { label: 'Avail (Max)', visible: true, type: 'number', filterable: true, group: 'Source' },

  // Visible Columns - Destination Branch Group
  stoc_dest: { label: 'Stock', visible: true, type: 'number', filterable: true, group: 'Destination' },
  min_dest: { label: 'Min', visible: true, type: 'number', filterable: true, group: 'Destination' },
  max_dest: { label: 'Max', visible: true, type: 'number', filterable: true, group: 'Destination' },
  comenzi: { label: 'Orders', visible: true, type: 'number', filterable: true, group: 'Destination' }, // Pending orders
  transf_nerec: { label: 'Unrec. Tr.', visible: true, type: 'number', filterable: true, group: 'Destination' }, // Unreceived transfers

  // Visible Columns - Necessity Group
  nec_min: { label: 'Nec (Min)', visible: true, type: 'number', filterable: true, group: 'Necessity' },
  nec_max: { label: 'Nec (Max)', visible: true, type: 'number', filterable: true, group: 'Necessity' },
  nec_min_comp: { label: 'Nec Comp (Min)', visible: true, type: 'number', filterable: true, group: 'Necessity' }, // Company min necessity
  nec_max_comp: { label: 'Nec Comp (Max)', visible: true, type: 'number', filterable: true, group: 'Necessity' }, // Company max necessity

  // Visible Columns - Action Group
  cant_min: { label: 'Sug. (Min)', visible: true, type: 'number', filterable: true, group: 'Action' }, // Calculated min transferrable
  cant_max: { label: 'Sug. (Max)', visible: true, type: 'number', filterable: true, group: 'Action' }, // Calculated max transferrable
  transfer: { label: 'Transfer', visible: true, type: 'number', filterable: true, group: 'Action' }, // User input transfer
};

// Helper to get visible columns in order
export const getVisibleColumns = () => {
  return Object.entries(columnMask)
    .filter(([key, config]) => config.visible)
    .map(([key, config]) => ({ key, ...config }));
};
