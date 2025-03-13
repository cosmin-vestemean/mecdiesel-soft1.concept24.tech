import { shared } from './shared.js';
import { renderTable } from './renderTable.js';
import { getS1Data, getErrors, getMesagerieConvAuto, getMappings, getSchimbareStoc } from './dataFetching.js';

class PaginationManager {
    constructor() {
        this.activeTab = 'mappings'; // Default tab
        this.paginationHandlers = {
            'items': {
                skip: () => shared.skip,
                setSkip: (val) => shared.skip = val,
                getData: () => renderTable(shared.table, "#items", shared.skip)
            },
            'errors': {
                skip: () => shared.skipErr,
                setSkip: (val) => shared.skipErr = val,
                getData: () => getS1Data("Loading messages...", "#errors", getErrors)
            },
            'mappings': {
                skip: () => shared.skipMappings,
                setSkip: (val) => shared.skipMappings = val,
                getData: () => getS1Data("Loading mappings...", "#mappings", getMappings)
            },
            'convAuto': {
                skip: () => shared.skipConvAuto,
                setSkip: (val) => shared.skipConvAuto = val,
                getData: () => getS1Data("Loading conversie...", "#convAuto", getMesagerieConvAuto)
            },
            'stockChanges': {
                skip: () => shared.skipStock,
                setSkip: (val) => shared.skipStock = val,
                getData: () => getS1Data("Loading stock...", "#stockChanges", getSchimbareStoc)
            }
        };
        
        // Initialize pagination status display
        this.updatePaginationStatus();
    }

    // Update this method to better handle limit changes
    updatePaginationStatus() {
        const handler = this.paginationHandlers[this.activeTab];
        if (!handler) return;
        
        const skip = handler.skip();
        const limit = shared.htmlLimit;
        const from = skip > 0 ? skip + 1 : 1;
        const to = skip + limit;
        const total = shared.totalRecords || '?';
        
        // Update the pagination status display
        const paginationStatus = document.getElementById('paginationStatus');
        if (paginationStatus) {
            if (total !== '?') {
                paginationStatus.textContent = `Displaying ${from} to ${to} of ${total}`;
            } else {
                paginationStatus.textContent = `Displaying ${from} to ${to}`;
            }
        }
    }

    setActiveTab(tabId) {
        // Extract tab name from button ID by removing 'Button' suffix
        let tabName = tabId.replace('Button', '').toLowerCase();
        
        // Map tab names to their corresponding handler keys
        const tabToHandlerMap = {
            'items': 'items',
            'errors': 'errors',
            'mappings': 'mappings',
            'convauto': 'convAuto',  // Match case as used in handler keys
            'stockchanges': 'stockChanges'  // Match case as used in handler keys
        };
        
        // Set the active tab using the mapped name or default to the original
        this.activeTab = tabToHandlerMap[tabName] || tabName;
        console.log('Active tab set to:', this.activeTab);
        
        // Update pagination status after changing tab
        this.updatePaginationStatus();
    }

    paginate(direction) {
        const handler = this.paginationHandlers[this.activeTab];
        if (!handler) return;

        const newSkip = handler.skip() + (direction * shared.htmlLimit);
        if (newSkip >= 0) {
            handler.setSkip(newSkip);
            handler.getData();
            this.updatePaginationStatus();
        }
    }

    first() {
        const handler = this.paginationHandlers[this.activeTab];
        if (!handler) return;
        
        handler.setSkip(0);
        handler.getData();
        this.updatePaginationStatus();
    }
}

export const paginationManager = new PaginationManager();
