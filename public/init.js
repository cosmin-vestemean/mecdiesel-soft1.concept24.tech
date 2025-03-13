import { paginationManager } from './paginationManager.js';
import { shared } from './shared.js';
import { renderTable } from './renderTable.js';
import { getS1Data, getErrors, getMesagerieConvAuto, getMappings, getSchimbareStoc } from './dataFetching.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize pagination manager with default tab
    paginationManager.setActiveTab('mappingsButton');
    
    // Update pagination status display
    paginationManager.updatePaginationStatus();
    
    // Initialize tab change listener for Bootstrap tabs
    const tabEls = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabEls.forEach(tabEl => {
        tabEl.addEventListener('shown.bs.tab', event => {
            const activeTabId = event.target.id;
            paginationManager.setActiveTab(activeTabId);
            console.log('Tab changed to:', activeTabId);
        });
    });
});
