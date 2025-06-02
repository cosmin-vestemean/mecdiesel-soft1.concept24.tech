import { paginationManager } from './paginationManager.js';
import { shared } from './shared.js';
import { renderTable } from './renderTable.js';
import { getS1Data, getErrors, getMesagerieConvAuto, getMappings, getSchimbareStoc } from './dataFetching.js';
import { hierarchicalNav } from './hierarchical-navigation.js';

document.addEventListener('DOMContentLoaded', () => {
    // Wait for hierarchical navigation to be ready
    setTimeout(() => {
        // Initialize pagination manager with default tab based on hierarchical nav
        const currentApp = hierarchicalNav?.getCurrentApp() || 'italy-sync';
        const appConfig = hierarchicalNav?.getAppConfig(currentApp);
        const defaultTab = appConfig?.defaultTab || 'mappingsButton';
        
        paginationManager.setActiveTab(defaultTab);
        
        // Update pagination status display
        paginationManager.updatePaginationStatus();
    }, 100);
    
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
