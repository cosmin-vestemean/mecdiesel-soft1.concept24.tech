import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class TopAbcTable extends LitElement {
  static get properties() {
    return {
      data: { type: Array },
      filterClass: { type: String }
    };
  }

  static styles = css`
    /* Styles from data-table-minimal.css */
    .data-table-container {
        border: 1px solid #dee2e6;
        border-radius: 4px;
        background: #fff;
    }

    .table-responsive {
        overflow-x: auto;
    }

    .modern-table {
        font-size: 0.8rem;
        background: #fff;
        color: #212529;
        border-collapse: separate; /* Changed from collapse to separate for modern-table */
        border-spacing: 0;
        width: 100%; /* Ensure table takes full width */
    }

    .modern-table th {
        background: #f8f9fa;
        font-weight: 600;
        text-align: center;
        padding: 0.5rem 0.7rem;
        border-bottom: 1px solid #dee2e6;
        color: #495057;
        position: sticky; /* Make headers sticky */
        top: 0; /* Stick to the top of the viewport or scrollable container */
        z-index: 1; /* Ensure headers stay above table content */
    }

    .modern-table td {
        padding: 0.35rem 0.7rem;
        border-bottom: 1px solid #f1f3f4;
        vertical-align: middle;
        font-size: 0.8rem;
        background: #fff; /* Ensure td background is white */
    }

    /* .modern-table .even-row { Removed as direct striping might conflict with group headers or hover */
    /*   background: #f8f9fa; */
    /* } */

    .modern-table tbody tr:hover td { /* Apply hover to td for better specificity */
        background: #e9ecef !important;
    }

    /* .sticky-top specific to a different context, th is now sticky */

    .vertical-divider {
        border-left: 1px solid #dee2e6 !important;
    }

    .text-truncate span {
        max-width: 180px;
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    /* Original abc-table styles adapted */
    .abc-table-controls {
      margin-bottom: 10px;
      padding: 8px;
      background-color: #f8f9fa;
      border-radius: 4px;
      border: 1px solid #dee2e6;
    }
    .abc-table-controls span {
      margin-right: 10px;
      font-weight: bold;
      color: #495057;
    }
    .abc-table-controls button {
      margin-left: 5px;
      padding: 0.3rem 0.6rem; /* Adjusted padding */
      font-size: 0.8rem; /* Match table font size */
      cursor: pointer;
      border: 1px solid #ced4da;
      background-color: #fff;
      border-radius: 4px;
      color: #007bff;
    }
    .abc-table-controls button.active {
      background-color: #007bff;
      color: white;
      border-color: #007bff;
    }
    .abc-table-controls button:hover:not(.active) {
      background-color: #e9ecef;
      border-color: #adb5bd;
    }
    .abc-group-header td {
      font-weight: bold;
      background-color: #e9ecef; 
      padding: 0.5rem 0.7rem; /* Consistent padding */
      text-align: left;
      border-bottom: 1px solid #dee2e6; /* Add border like th */
      color: #343a40;
    }
    /* .abc-table th specific styles removed, covered by .modern-table th */
    .no-items-message td {
      text-align: center;
      padding: 10px;
      font-style: italic;
      color: #6c757d;
    }
    .abc-table-view {
      /* Container for the table, can add overflow if needed */
      /* overflow-x: auto; /* Moved to .table-responsive if used globally */
    }
  `;

  constructor() {
    super();
    this.data = [];
    this.filterClass = 'All'; // Default filter
  }

  createRenderRoot() {
    return this; // Render in light DOM to use global styles
  }

  _handleFilterClick(className) {
    this.filterClass = className;
  }

  _renderRow(item) {
    const abcClass = item.ABC || 'Unknown';
    const cumulativePercValue = parseFloat(item.CUMULATIVEPERC);
    const salesPercValue = parseFloat(item.SALESPERC);
    const valueValue = parseFloat(item.VALUE);
    const qtyValue = parseFloat(item.SUMQTY);

    const cumulativePerc = !isNaN(cumulativePercValue) ? cumulativePercValue.toFixed(4) + '%' : 'N/A';
    const salesPerc = !isNaN(salesPercValue) ? salesPercValue.toFixed(4) + '%' : 'N/A';
    const valueDisplay = !isNaN(valueValue) ? valueValue.toFixed(4) : (item.VALUE || 'N/A');
    const qtyDisplay = !isNaN(qtyValue) ? qtyValue.toFixed(2) : (item.SUMQTY || 'N/A');

    return html`
      <tr class="abc-class-${abcClass.toLowerCase()}">
        <td>${item.CODE || ''}</td>
        <td>${item.DESCRIPTION || ''}</td>
        <td><span class="abc-badge abc-badge-${abcClass.toLowerCase()}">${abcClass}</span></td>
        <td>${valueDisplay}</td>
        <td>${qtyDisplay}</td>
        <td>${cumulativePerc}</td>
        <td>${salesPerc}</td>
      </tr>
    `;
  }

  render() {
    console.log('Rendering TopAbcTable with data:', this.data, 'and filter:', this.filterClass);
    
    if (!Array.isArray(this.data)) {
      console.warn('Invalid data received by TopAbcTable:', this.data);
      return html`
        <div class="abc-table-controls">
          <span>Filter by Class:</span>
          <button @click=${() => this._handleFilterClick('All')} class="${this.filterClass === 'All' ? 'active' : ''}">All</button>
          <button @click=${() => this._handleFilterClick('A')} class="${this.filterClass === 'A' ? 'active' : ''}">A</button>
          <button @click=${() => this._handleFilterClick('B')} class="${this.filterClass === 'B' ? 'active' : ''}">B</button>
          <button @click=${() => this._handleFilterClick('C')} class="${this.filterClass === 'C' ? 'active' : ''}">C</button>
        </div>
        <div class="abc-table-view">No data available (invalid data format)</div>
      `;
    }
    if (this.data.length === 0) {
      return html`
        <div class="abc-table-controls">
          <span>Filter by Class:</span>
          <button @click=${() => this._handleFilterClick('All')} class="${this.filterClass === 'All' ? 'active' : ''}">All</button>
          <button @click=${() => this._handleFilterClick('A')} class="${this.filterClass === 'A' ? 'active' : ''}">A</button>
          <button @click=${() => this._handleFilterClick('B')} class="${this.filterClass === 'B' ? 'active' : ''}">B</button>
          <button @click=${() => this._handleFilterClick('C')} class="${this.filterClass === 'C' ? 'active' : ''}">C</button>
        </div>
        <div class="abc-table-view">No data to display.</div>
      `;
    }

    let tableContent;

    if (this.filterClass === 'All') {
      const groupedData = { A: [], B: [], C: [] };
      let otherData = []; // For items not explicitly A, B, or C

      this.data.forEach(item => {
        if (item.ABC === 'A' || item.ABC === 'B' || item.ABC === 'C') {
          groupedData[item.ABC].push(item);
        } else {
          otherData.push(item);
        }
      });

      const sections = ['A', 'B', 'C'].map(className => {
        if (groupedData[className].length > 0) {
          return html`
            <tbody id="table-${className}-heading">
              <tr><td colspan="6" class="abc-group-header modern-table">Class ${className} (${groupedData[className].length} items)</td></tr>
              ${groupedData[className].map(item => this._renderRow(item))}
            </tbody>
          `;
        }
        return html``; // Return empty if no items for this class
      });

      if (otherData.length > 0) {
        sections.push(html`
          <tbody id="table-Other-heading">
            <tr><td colspan="6" class="abc-group-header modern-table">Other (${otherData.length} items)</td></tr>
            ${otherData.map(item => this._renderRow(item))}
          </tbody>
        `);
      }
      
      tableContent = sections;

    } else {
      const filteredData = this.data.filter(item => item.ABC === this.filterClass);
      if (filteredData.length > 0) {
        tableContent = html`
          <tbody id="table-${this.filterClass}-heading">
            <tr><td colspan="6" class="abc-group-header modern-table">Class ${this.filterClass} (${filteredData.length} items)</td></tr>
            ${filteredData.map(item => this._renderRow(item))}
          </tbody>
        `;
      } else {
        tableContent = html`<tbody><tr class="no-items-message"><td colspan="6">No items found for Class ${this.filterClass}.</td></tr></tbody>`;
      }
    }

    return html`
      <div class="abc-table-controls">
        <span>Filter by Class:</span>
        <button @click=${() => this._handleFilterClick('All')} class="${this.filterClass === 'All' ? 'active' : ''}">All</button>
        <button @click=${() => this._handleFilterClick('A')} class="${this.filterClass === 'A' ? 'active' : ''}">A</button>
        <button @click=${() => this._handleFilterClick('B')} class="${this.filterClass === 'B' ? 'active' : ''}">B</button>
        <button @click=${() => this._handleFilterClick('C')} class="${this.filterClass === 'C' ? 'active' : ''}">C</button>
      </div>
      <div class="abc-table-view table-responsive">
        <table class="modern-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Class</th>
              <th>Value</th>
              <th>Quantity</th>
              <th>Cumulative %</th>
              <th>Sales %</th>
            </tr>
          </thead>
          ${tableContent}
        </table>
      </div>
    `;
  }
}

customElements.define('top-abc-table', TopAbcTable);
