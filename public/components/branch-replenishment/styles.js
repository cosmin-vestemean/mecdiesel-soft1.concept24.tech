import { css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export const branchReplenishmentStyles = css`
  .fancy-dropdown {
    position: relative;
  }
  .fancy-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    max-height: 300px;
    z-index: 1050;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .fancy-dropdown-header {
    padding: 8px;
    border-bottom: 1px solid #eee;
  }
  .fancy-dropdown-actions {
    display: flex;
    justify-content: space-between;
    padding: 5px 8px;
    border-bottom: 1px solid #eee;
    background: #f8f9fa;
  }
  .fancy-dropdown-items {
    overflow-y: auto;
    max-height: 230px;
  }
  .fancy-dropdown-item {
    padding: 6px 12px;
    cursor: pointer;
  }
  .fancy-dropdown-item:hover {
    background: #f8f9fa;
  }
  .fancy-dropdown-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  .fancy-dropdown-toggle:after {
    content: '';
    border-top: 0.3em solid;
    border-right: 0.3em solid transparent;
    border-left: 0.3em solid transparent;
    margin-left: 8px;
  }
  
  /* Add vertical dividers between logical column groups */
  .vertical-divider {
    border-left: 1px solid #dee2e6;
  }
  
  /* Add subtle background color to group columns visually */
  .group-source {
    background-color: rgba(240, 249, 255, 0.5);
  }
  
  .group-destination {
    background-color: rgba(240, 255, 240, 0.5);
  }
  
  .group-necessity {
    background-color: rgba(255, 248, 240, 0.5);
  }
  
  .group-action {
    background-color: rgba(249, 240, 255, 0.5);
  }
  
  /* Status indicator legend */
  .status-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 0.375rem;
    border: 1px solid #dee2e6;
    margin-bottom: 1rem;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
  }
  
  .legend-item:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  .legend-item.active {
    background-color: rgba(13, 110, 253, 0.1);
    border-color: rgba(13, 110, 253, 0.3);
  }
  
  .legend-item:not(.active) {
    opacity: 0.85;
  }
  
  .legend-count {
    margin-left: 0.75rem;
    background: rgba(0, 0, 0, 0.1);
    padding: 0.125rem 0.5rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    min-width: 1.5rem;
    text-align: center;
  }
  
  .legend-indicator {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.75rem;
    border-radius: 4px;
    background: white;
    border: 1px solid #dee2e6;
    position: relative;
  }
  
  .legend-indicator.critical {
    color: #dc3545;
  }
  
  .legend-indicator.critical::after {
    content: "▼";
    color: #dc3545;
    font-size: 16px;
    font-weight: bold;
  }
  
  .legend-indicator.optimal {
    background: rgba(25, 135, 84, 0.1);
    border-color: rgba(25, 135, 84, 0.2);
  }
  
  .legend-indicator.optimal::after {
    content: "✓";
    color: #198754;
    font-size: 16px;
    font-weight: bold;
  }
  
  .legend-indicator.high {
    color: #198754;
  }
  
  .legend-indicator.high::after {
    content: "▲";
    color: #198754;
    font-size: 16px;
    font-weight: bold;
  }
  
  /* Table cell positioning for stock indicators */
  .table td {
    padding: 0.5rem;
    vertical-align: middle;
  }
  
  /* Stock status column styling */
  td[class*="stock-"] {
    position: relative;
    padding-right: 25px !important;
  }
  
  td.stock-critical::after {
    content: "▼";
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: #dc3545;
    font-weight: bold;
  }
  
  td.stock-optimal::after {
    content: "✓";
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: #198754;
    font-weight: bold;
  }
  
  td.stock-high::after {
    content: "▲";
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: #198754;
    font-weight: bold;
  }
  
  /* Stock value colors */
  td.stock-critical {
    color: #dc3545 !important;
    font-weight: 500;
  }
  
  td.stock-optimal {
    color: #198754 !important;
    font-weight: 500;
  }
  
  td.stock-high {
    color: #198754 !important;
    font-weight: 500;
  }
  
  td.stock-undefined {
    color: #856404 !important;
  }
  
  /* Sticky header style */
  .table-container {
    max-height: 70vh;
    overflow-y: auto;
    position: relative;
  }
  
  thead.sticky-top {
    position: sticky;
    top: 0;
    z-index: 1020;
    background-color: #f8f9fa;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.075);
  }
  
  /* Compact input styling */
  .compact-input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    line-height: 1.5;
    border: 1px solid #dee2e6;
    border-radius: 0.25rem;
  }
  
  /* Zen mode styling */
  .zen-mode {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    z-index: 1040;
    padding: 1rem;
    overflow-y: auto;
  }
`;