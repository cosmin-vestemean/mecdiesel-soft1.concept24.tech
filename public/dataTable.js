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
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
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

  renderHeader(item) {
    const headerCells = [html`<th>Row</th>`];
    for (let key of Object.keys(item)) {
      if (key.toLowerCase() !== "is_signaled") {
        headerCells.push(html`<th>${key}</th>`);
      }
    }
    return html`<tr>${headerCells}</tr>`;
  }

  renderRow(item, index) {
    const rowNumber = this.skipNr + index + 1;
    let rowClass = '';
    if (Object.keys(item).includes("is_signaled") && item.is_signaled == 0) {
      rowClass = 'table-light';
    }

    const cells = [html`<td>${rowNumber}</td>`];
    for (let key of Object.keys(item)) {
      const value = item[key];
      switch (key.toLowerCase()) {
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
        case "mtrl":
          // Skip this field
          break;
        case "trdr":
          // Skip this field
          break;
        default:
          cells.push(html`<td>${this.renderCellContent(value)}</td>`);
          break;
      }
    }
    return html`<tr class="${rowClass}">${cells}</tr>`;
  }

  render() {
    if (!this.items || this.items.length === 0) {
      return html`<p>No data available</p>`;
    }

    return html`
      <table class="table table-striped table-hover">
        <thead>
          ${this.renderHeader(this.items[0])}
        </thead>
        <tbody>
          ${this.items.map((item, index) => this.renderRow(item, index))}
        </tbody>
      </table>
    `;
  }
}

customElements.define('data-table', DataTable);