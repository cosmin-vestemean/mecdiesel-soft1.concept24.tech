/**
 * Hierarchical Navigation Manager
 * Handles the two-level navigation system for sub-apps
 */

class HierarchicalNavigation {
  constructor() {
    this.currentApp = 'italy-sync';
    this.currentSubTab = 'mappings';
    this.appConfigs = {
      'italy-sync': {
        name: 'Italy Sync',
        defaultTab: 'mappingsButton',
        tabs: ['mappingsButton', 'itemsButton', 'errorsButton', 'stockChangesButton', 'batchButton']
      },
      'conversie-auto': {
        name: 'Conversie Auto',
        defaultTab: 'convAutoButton',
        tabs: ['convAutoButton']
      },
      'print-config': {
        name: 'Print Config',
        defaultTab: 'printConfigButton',
        tabs: ['printConfigButton']
      },
      'achizitii': {
        name: 'Achizitii',
        defaultTab: 'branchReplenishButton',
        tabs: ['branchReplenishButton', 'necesarAchizitiiButton', 'topAbcButton']
      }
    };
    
    this.init();
  }

  init() {
    this.bindAppSelectorEvents();
    this.bindSubTabEvents();
    this.bindNavigationToggle();
    this.bindMobileMenu();
    this.setInitialState();
  }

  bindAppSelectorEvents() {
    // Use .sidebar-module buttons instead of .app-btn
    document.querySelectorAll('.sidebar-module').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const appName = e.currentTarget.dataset.app;
        if (!appName) {
          return;
        }
        this.switchApp(appName);
      });
    });
  }

  bindSubTabEvents() {
    // Keep existing tab functionality but enhance it
    document.querySelectorAll('.sub-nav .nav-link').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabId = e.currentTarget.id;
        this.setActiveSubTab(tabId);
      });
    });
  }

  bindNavigationToggle() {
    const toggleBtn = document.getElementById('headerToggle');
    const header = document.getElementById('header');
    const sidebar = document.getElementById('appSidebar');
    const app = document.getElementById('app');

    if (!toggleBtn || !header || !sidebar || !app) {
      return;
    }

    const icon = toggleBtn.querySelector('i');

    // Keep header and sidebar collapse in lockstep so the workspace expands cleanly
    const applyState = (isCollapsed, emitEvents = true) => {
      header.classList.toggle('header-collapsed', isCollapsed);
      app.classList.toggle('header-collapsed', isCollapsed);
      sidebar.classList.toggle('collapsed', isCollapsed);
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);

      if (icon) {
        icon.className = isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      }
      toggleBtn.classList.remove('btn-outline-primary', 'btn-success');
      toggleBtn.classList.add('btn', 'btn-sm', 'me-3');
      toggleBtn.classList.add(isCollapsed ? 'btn-success' : 'btn-outline-primary');
      toggleBtn.title = isCollapsed ? 'Show navigation' : 'Hide navigation';

      localStorage.setItem('layoutCollapsed', isCollapsed.toString());
      localStorage.removeItem('headerVisible');
      localStorage.removeItem('sidebarCollapsed');

      if (emitEvents) {
        document.dispatchEvent(new CustomEvent('header-toggled', {
          detail: { isVisible: !isCollapsed }
        }));

        document.dispatchEvent(new CustomEvent('sidebar-toggled', {
          detail: { collapsed: isCollapsed }
        }));
      }

      setTimeout(() => {
        this.recalculateContentDimensions();
      }, 350);
    };

    const storedLayoutState = localStorage.getItem('layoutCollapsed');
    const legacySidebarState = localStorage.getItem('sidebarCollapsed');
    const defaultCollapsed = storedLayoutState !== null
      ? storedLayoutState === 'true'
      : legacySidebarState === 'true';

    applyState(defaultCollapsed, false);

    toggleBtn.addEventListener('click', () => {
      const nextState = !header.classList.contains('header-collapsed');
      applyState(nextState);
    });
  }

  bindMobileMenu() {
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('appSidebar');
    
    if (mobileToggle && sidebar) {
      // Create backdrop for mobile
      const backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
      
      mobileToggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('mobile-open');
        backdrop.classList.toggle('show', isOpen);
        mobileToggle.classList.toggle('open', isOpen);
        mobileToggle.setAttribute('aria-expanded', isOpen.toString());
      });
      
      // Close sidebar when clicking backdrop
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('show');
        mobileToggle.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
      
      // Close sidebar when module is selected on mobile
      document.querySelectorAll('.sidebar-module').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.innerWidth < 768) {
            sidebar.classList.remove('mobile-open');
            backdrop.classList.remove('show');
            mobileToggle.classList.remove('open');
            mobileToggle.setAttribute('aria-expanded', 'false');
          }
        });
      });
    }
  }

  recalculateContentDimensions() {
    // Force recalculation of any components that depend on viewport dimensions
    const event = new CustomEvent('viewport-resized', {
      detail: { 
        trigger: 'header-toggle',
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);
    
    // Trigger resize event for any components listening to window resize
    window.dispatchEvent(new Event('resize'));
  }

  switchApp(appName) {
    if (!this.appConfigs[appName]) {
      console.warn(`Unknown app: ${appName}`);
      return;
    }

    // Update app selector UI
    this.updateAppSelector(appName);
    
    // Show/hide sub-navigation
    this.updateSubNavigation(appName);
    
    // Update contextual controls
    this.updateContextualControls(appName);
    
    // Activate default tab for the app
    const defaultTab = this.appConfigs[appName].defaultTab;
    this.setActiveSubTab(defaultTab);
    
    // Trigger the actual tab click to show content
    document.getElementById(defaultTab)?.click();
    
    this.currentApp = appName;
    
    // Dispatch custom event for other systems to react
    this.dispatchAppChangeEvent(appName);
  }

  updateAppSelector(appName) {
    // Update sidebar module buttons
    document.querySelectorAll('.sidebar-module').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Set active on the selected module
    const selectedModule = document.querySelector(`.sidebar-module[data-app="${appName}"]`);
    if (selectedModule) {
      selectedModule.classList.add('active');
    }
  }

  updateSubNavigation(appName) {
    // Hide all sub-navs
    document.querySelectorAll('.sub-nav').forEach(nav => {
      nav.classList.add('d-none');
    });
    
    // Show the selected app's sub-nav
    const targetNav = document.querySelector(`.sub-nav[data-app="${appName}"]`);
    if (targetNav) {
      targetNav.classList.remove('d-none');
    }
  }

  updateContextualControls(appName) {
    const contextualControls = document.getElementById('contextualControls');
    if (!contextualControls) return;

    // Define which controls are visible for each app
    const controlsConfig = {
      'italy-sync': {
        'tables': true,
        'tablesLabel': true,
        'searchItems': true,
        'items50': true,
        'items100': true,
        'items200': true,
        'items500': true,
        'items1000': true
      },
      'conversie-auto': {
        'tables': false,
        'tablesLabel': false,
        'searchItems': false
      },
      'print-config': {
        'tables': false,
        'tablesLabel': false,
        'searchItems': false
      },
      'achizitii': {
        'tables': false,
        'tablesLabel': false,
        'searchItems': false
      }
    };

    const config = controlsConfig[appName] || {};
    
    // Show/hide controls based on config
    Object.keys(config).forEach(controlId => {
      const element = document.getElementById(controlId);
      if (element) {
        if (config[controlId]) {
          element.style.display = '';
          element.classList.remove('d-none');
        } else {
          element.style.display = 'none';
          element.classList.add('d-none');
        }
      }
    });

    // Special handling for tables dropdown label
    const tablesLabel = document.querySelector('label[for="tables"]');
    if (tablesLabel) {
      if (config.tablesLabel) {
        tablesLabel.style.display = '';
        tablesLabel.classList.remove('d-none');
      } else {
        tablesLabel.style.display = 'none';
        tablesLabel.classList.add('d-none');
      }
    }
  }

  setActiveSubTab(tabId) {
    // Clear all active states in current app's sub-nav
    const currentSubNav = document.querySelector(`.sub-nav[data-app="${this.currentApp}"]`);
    if (currentSubNav) {
      currentSubNav.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });
    }
    
    // Set active state on selected tab
    document.getElementById(tabId)?.classList.add('active');
    
    this.currentSubTab = tabId;
  }

  setInitialState() {
    // Set Italy Sync as default active app
    this.switchApp('italy-sync');
  }

  getCurrentApp() {
    return this.currentApp;
  }

  getCurrentSubTab() {
    return this.currentSubTab;
  }

  getAppConfig(appName) {
    return this.appConfigs[appName];
  }

  dispatchAppChangeEvent(appName) {
    const event = new CustomEvent('app-changed', {
      detail: {
        appName,
        config: this.appConfigs[appName],
        previousApp: this.currentApp
      }
    });
    document.dispatchEvent(event);
  }

  // Method to programmatically switch to a specific app and tab
  navigateTo(appName, tabId = null) {
    if (this.appConfigs[appName]) {
      this.switchApp(appName);
      
      if (tabId && this.appConfigs[appName].tabs.includes(tabId)) {
        setTimeout(() => {
          document.getElementById(tabId)?.click();
        }, 100); // Small delay to ensure DOM is updated
      }
    }
  }
}

// Initialize the hierarchical navigation when DOM is ready
let hierarchicalNav;

document.addEventListener('DOMContentLoaded', () => {
  hierarchicalNav = new HierarchicalNavigation();
});

// Export for use in other modules
export { hierarchicalNav, HierarchicalNavigation };
