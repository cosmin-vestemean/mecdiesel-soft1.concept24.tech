import { LitElement, html, unsafeHTML } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

class DataTable extends LitElement {
  static properties = {
    items: { type: Array },
    skipNr: { type: Number },
  };

  constructor() {
    super();
    this.items = [];
    this.skipNr = 0;
  }

  createRenderRoot() {
    // Disable shadow DOM to allow global styles to affect this component
    return this;
  }

  // Helper function to determine if content might contain HTML
  containsHtml(str) {
    if (typeof str !== 'string') return false;
    
    // More comprehensive test for HTML content
    const htmlRegex = /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i;
    return htmlRegex.test(str);
  }

  // Helper function to safely render cell content (HTML or plain text)
  renderCellContent(content) {
    if (this.containsHtml(content)) {
      return html`${unsafeHTML(content)}`;
    }
    return html`${content}`;
  }

  showToast(message, type = 'info', delay = 3000) {
    const toastId = `toast-${Date.now()}`;
    const toastHtml = `
      <div id="${toastId}" class="toast align-items-center text-white bg-${type}" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;
    
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed top-0 end-0 p-3';
      document.body.appendChild(container);
    }
    
    document.getElementById('toast-container').insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: delay });
    toast.show();
  }

  updated(changedProperties) {
    if (changedProperties.has('items')) {
      if (this.items && this.items.length > 0) {
        this.showToast(`Successfully loaded ${this.items.length} records`, 'success');
      }
    }
  }

  renderTableContent() {
    if (!this.items || this.items.length === 0) {
      //this.showToast('No data available', 'warning');
      return html`<tr><td colspan="100%"><h6 class="text-danger">No data (yet?)</h2></td></tr>`;
    }

    // Find the lengthier item as object
    const itemsClone = [...this.items];
    itemsClone.sort((a, b) => Object.keys(b).length - Object.keys(a).length);
    const columnNo = Object.keys(itemsClone[0]).length;
    
    // Generate header cells
    const headerCells = [html`<th>Row</th>`];
    for (let i = 0; i < columnNo; i++) {
      if (Object.keys(this.items[0])[i].toLowerCase() !== "is_signaled") {
        headerCells.push(html`<th>${Object.keys(this.items[0])[i]}</th>`);
      }
    }

    // Generate row cells
    const rows = this.items.map((item, rowIndex) => {
      // Determine row class
      let rowClass = '';
      if (Object.keys(item).includes("is_signaled") && item.is_signaled == 0) {
        rowClass = 'table-light';
      }
      
      // Generate cells for this row
      const cells = [html`<td>${rowIndex + 1 + this.skipNr}</td>`];
      
      for (let i = 0; i < columnNo; i++) {
        const key = Object.keys(item)[i].toLowerCase();
        const value = Object.values(item)[i];
        
        switch (key) {
          case "stoc":
            if (value == 0) {
              if (item.is_signaled > 0) {
                cells.push(html`<td class="fw-bold text-danger">${this.renderCellContent(value)}<i class="fas fa-caret-down me-1"></i></td>`);
              } else {
                cells.push(html`<td>${this.renderCellContent(value)}</td>`);
              }
            } else if (value > 0) {
              if (item.is_processed == -1 && item.is_available == -1) {
                cells.push(html`<td>${this.renderCellContent(value)}</td>`);
              } else {
                cells.push(html`<td class="fw-bold text-success">${this.renderCellContent(value)}<i class="fas fa-caret-up me-1"></i></td>`);
              }
            }
            break;
          case "is_processed":
            if (item.is_processed == -1) {
              cells.push(html`<td class="table-light">-</td>`);
            } else {
              cells.push(html`<td>${this.renderCellContent(value)}</td>`);
            }
            break;
          case "is_available":
            if (item.is_available == -1) {
              cells.push(html`<td class="table-light">-</td>`);
            } else {
              cells.push(html`<td>${this.renderCellContent(value)}</td>`);
            }
            break;
          case "is_signaled":
            // Skip this field
            break;
          default:
            cells.push(html`<td>${this.renderCellContent(value)}</td>`);
            break;
        }
      }
      
      return html`<tr class="${rowClass}">${cells}</tr>`;
    });

    return html`
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>${rows}</tbody>
    `;
  }

  render() {
    return html`${this.renderTableContent()}`;
  }
}

customElements.define('data-table', DataTable);