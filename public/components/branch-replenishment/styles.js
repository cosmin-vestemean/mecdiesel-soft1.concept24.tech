import { css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export const branchReplenishmentStyles = css`
  /* Fancy dropdown styles - Enhanced for better UI */
  .fancy-dropdown {
    position: relative;
  }
  
  .fancy-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    max-height: 300px;
    z-index: 1050;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .fancy-dropdown-header {
    padding: 10px;
    border-bottom: 1px solid #eee;
  }
  
  .fancy-dropdown-actions {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    background: #f8f9fa;
  }
  
  .fancy-dropdown-items {
    overflow-y: auto;
    max-height: 230px;
    padding: 4px 0;
  }
  
  .fancy-dropdown-item {
    padding: 6px 12px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }
  
  .fancy-dropdown-item:hover {
    background-color: #f0f7ff;
  }
  
  .fancy-dropdown-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background-color: #fff;
    border: 1px solid #ced4da;
    height: 100%;
  }
  
  .fancy-dropdown-toggle:after {
    content: '';
    border-top: 0.3em solid;
    border-right: 0.3em solid transparent;
    border-left: 0.3em solid transparent;
    margin-left: 8px;
    transition: transform 0.2s ease;
  }
  
  .fancy-dropdown-toggle:hover {
    background-color: #f8f9fa;
    border-color: #adb5bd;
  }

  .fancy-dropdown-toggle:focus {
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    border-color: #86b7fe;
    outline: 0;
  }

  /* Style for the select/clear buttons */
  .btn-link {
    color: #446e9b;
    text-decoration: none;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }

  .btn-link:hover {
    background-color: rgba(68, 110, 155, 0.1);
    text-decoration: underline;
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
    gap: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 5px;
    margin-bottom: 10px;
    border: 1px solid #dee2e6;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  .legend-item:hover {
    background-color: rgba(0,0,0,0.05);
  }
  
  .legend-item.active {
    background-color: rgba(13, 110, 253, 0.1);
    border: 1px solid rgba(13, 110, 253, 0.3);
  }
  
  .legend-item:not(.active) {
    opacity: 0.85;
  }
  
  .legend-count {
    margin-left: 5px;
    background-color: rgba(0,0,0,0.1);
    border-radius: 10px;
    min-width: 20px;
    height: 20px;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
  }
  
  .legend-indicator {
    width: 22px;
    height: 22px;
    margin-right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #dee2e6;
    background-color: white;
    position: relative;
  }
  
  .legend-indicator.critical::before {
    content: "▼";
    color: #dc3545;
    font-size: 10px;
    position: relative;
    top: -2px;
  }
  
  .legend-indicator.optimal {
    background-color: rgba(25, 135, 84, 0.2);
    border-radius: 3px;
    position: relative;
    border: 1px solid rgba(25, 135, 84, 0.4);
  }
  
  .legend-indicator.optimal::after {
    content: "✓";
    position: absolute;
    color: #0f5132;
    font-size: 12px;
    font-weight: bold;
    z-index: 1;
  }
  
  .legend-indicator.high::before {
    content: "▲";
    color: #198754;
    font-size: 10px;
    position: relative;
    top: -1px;
  }
  
  /* Stock status indicator styles - FIXED to not obscure values */
  .stock-critical {
    position: relative;
    padding-right: 14px;  /* Add space for the indicator */
    display: inline-block; /* Ensure proper sizing */
  }
  .stock-critical::before {
    content: "▼";
    position: absolute;
    top: 1px;
    right: 2px;
    color: #dc3545;
    font-size: 10px;
  }
  
  .stock-optimal {
    position: relative;
    padding-right: 14px;  /* Add space for the indicator */
    display: inline-block; /* Ensure proper sizing */
    font-weight: 500;
    color: #0f5132 !important;
  }
  
  .stock-optimal::after {
    content: "✓";
    position: absolute;
    top: 0;
    right: 2px;
    color: rgba(25, 135, 84, 0.7);
    font-size: 10px;
    font-weight: bold;
  }
  
  .stock-high {
    position: relative;
    padding-right: 14px;  /* Add space for the indicator */
    display: inline-block; /* Ensure proper sizing */
  }
  .stock-high::before {
    content: "▲";
    position: absolute;
    top: 1px;
    right: 2px;
    color: #198754;
    font-size: 10px;
  }

  /* Compact input for transfers */
  .compact-input {
    width: 100%;
    max-width: 70px;
    padding: 2px 4px;
    height: 26px;
    border: 1px solid #ced4da;
    border-radius: 3px;
    background-color: #fff;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }

  .compact-input:focus {
    border-color: #86b7fe;
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    outline: 0;
  }

  /* Zen Mode styling */
  .zen-mode .card,
  .zen-mode .btn-group,
  .zen-mode .status-legend {
    opacity: 0.3;
    transition: opacity 0.3s ease;
  }

  .zen-mode .card:hover,
  .zen-mode .btn-group:hover,
  .zen-mode .status-legend:hover {
    opacity: 1;
  }

  .zen-mode .table-container {
    max-height: 85vh;
  }
  
  /* Styling for numerical column filters */
  .column-filter {
    display: flex;
    flex-direction: column;
    position: absolute;
    right: 0;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 8px;
    z-index: 20;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    width: 180px;
  }

  .filter-header {
    font-weight: bold;
    font-size: 0.85rem;
    margin-bottom: 6px;
    border-bottom: 1px solid #eee;
    padding-bottom: 4px;
  }

  .filter-range {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
  }

  .filter-range input {
    width: 60px;
    padding: 2px 5px;
    border: 1px solid #ced4da;
    border-radius: 3px;
  }

  .filter-range span {
    margin: 0 5px;
  }

  .filter-actions {
    display: flex;
    justify-content: space-between;
  }
`;