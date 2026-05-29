import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../../socketConfig.js';

export class OnlineOrdersLogPanel extends LitElement {
  static get properties() {
    return {
      logs: { type: Array },
      loading: { type: Boolean },
      error: { type: String },
      success: { type: String },
      searchInput: { type: String },
      searchQuery: { type: String },
      page: { type: Number },
      pageSize: { type: Number },
      totalPages: { type: Number },
      totalCount: { type: Number },
      setupComplete: { type: Boolean },
      hasLoaded: { type: Boolean },
      _service: { type: Object, state: true },
    };
  }

  constructor() {
    super();
    this.logs = [];
    this.loading = false;
    this.error = '';
    this.success = '';
    this.searchInput = '';
    this.searchQuery = '';
    this.page = 1;
    this.pageSize = 25;
    this.totalPages = 0;
    this.totalCount = 0;
    this.setupComplete = false;
    this.hasLoaded = false;
    this._service = client.service('s1');
  }

  createRenderRoot() {
    return this;
  }

  activate(forceRefresh = false) {
    this._ensureReady(forceRefresh);
  }

  async _ensureReady(forceRefresh = false) {
    const token = sessionStorage.getItem('s1Token');

    if (!token) {
      this.error = 'S1 token missing. Please log in again.';
      this.success = '';
      return;
    }

    this.error = '';

    if (!this.setupComplete) {
      await this._setupLog(token);
    }

    if (this.setupComplete && (!this.hasLoaded || forceRefresh)) {
      await this.loadLogs(1);
    }
  }

  async _setupLog(token) {
    this.loading = true;
    this.error = '';

    try {
      const result = await this._service.setupOnlineOrdersLog({ token });

      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to initialize webshop log table.');
      }

      this.setupComplete = true;
      this.success = '';
    } catch (error) {
      console.error('Failed to initialize webshop log table', error);
      this.error = error.message || 'Failed to initialize webshop log table.';
      this.setupComplete = false;
    } finally {
      this.loading = false;
    }
  }

  async loadLogs(page = this.page) {
    const token = sessionStorage.getItem('s1Token');

    if (!token) {
      this.error = 'S1 token missing. Please log in again.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      const result = await this._service.getOnlineOrdersLog({
        token,
        page,
        pageSize: this.pageSize,
        search: this.searchQuery,
      });

      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to load webshop logs.');
      }

      this.logs = Array.isArray(result.rows) ? result.rows : [];
      this.page = result.page || page;
      this.totalPages = result.totalPages || 0;
      this.totalCount = result.totalCount || 0;
      this.hasLoaded = true;
    } catch (error) {
      console.error('Failed to load webshop logs', error);
      this.error = error.message || 'Failed to load webshop logs.';
      this.logs = [];
      this.totalCount = 0;
      this.totalPages = 0;
    } finally {
      this.loading = false;
    }
  }

  _onSearchInput(event) {
    this.searchInput = event.target.value;
  }

  _onSearchKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this._applySearch();
    }
  }

  _applySearch() {
    this.searchQuery = this.searchInput.trim();
    this.loadLogs(1);
  }

  _clearSearch() {
    this.searchInput = '';
    this.searchQuery = '';
    this.loadLogs(1);
  }

  _refresh() {
    this.activate(true);
  }

  _goToFirstPage() {
    if (this.page > 1) {
      this.loadLogs(1);
    }
  }

  _goToPreviousPage() {
    if (this.page > 1) {
      this.loadLogs(this.page - 1);
    }
  }

  _goToNextPage() {
    if (this.totalPages > 0 && this.page < this.totalPages) {
      this.loadLogs(this.page + 1);
    }
  }

  _renderTable() {
    if (this.loading) {
      return html`
        <div class="card border-0 shadow-sm">
          <div class="card-body py-5 text-center text-muted">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <div>Loading webshop logs...</div>
          </div>
        </div>
      `;
    }

    if (!this.logs.length) {
      return html`
        <div class="card border-0 shadow-sm">
          <div class="card-body py-5 text-center text-muted">
            No webshop logs found for the current filter.
          </div>
        </div>
      `;
    }

    return html`
      <div class="table-responsive online-orders-table-wrapper">
        <table class="table table-sm align-middle mb-0 online-orders-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>TRDR</th>
              <th>Branches</th>
              <th>Series</th>
              <th>Refs</th>
              <th>Carrier</th>
              <th>Status</th>
              <th>Message</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            ${this.logs.map((row) => html`
              <tr>
                <td>
                  <div class="fw-semibold">${row.LOGDATE || '-'}</div>
                  <div class="text-muted small">${row.USRNAME || 'SYSTEM'}</div>
                </td>
                <td>
                  <div class="fw-semibold">${row.TRDR || '-'}</div>
                  <div class="text-muted small">${row.CLIENTID ? 'clientID logged' : 'clientID missing'}</div>
                </td>
                <td>
                  <div>TRDBRANCH: <strong>${row.TRDBRANCH || '-'}</strong></div>
                  <div>BRANCH: <strong>${row.BRANCH || '-'}</strong></div>
                </td>
                <td>
                  <div>SERIES: <strong>${row.SERIES || '-'}</strong></div>
                  <div class="text-muted small">${row.OBJECTNAME || '-'} / ${row.FORMNAME || '-'}</div>
                </td>
                <td>
                  <div>VARCHAR02: <strong>${row.VARCHAR02 || '-'}</strong></div>
                  <div>CCCORDER: <strong>${row.CCCORDER || '-'}</strong></div>
                </td>
                <td>${row.SOCARRIER || '-'}</td>
                <td>
                  <span class="badge ${row.VALIDATIONSTATUS === 1 ? 'text-bg-success' : 'text-bg-warning'}">
                    ${row.VALIDATIONSTATUS === 1 ? 'Valid' : 'Needs attention'}
                  </span>
                </td>
                <td>
                  <div class="message-cell">${row.VALIDATIONMESSAGE || '-'}</div>
                </td>
                <td>
                  <details>
                    <summary>View payload</summary>
                    <pre class="payload-preview mt-2">${row.PAYLOADRAW || ''}</pre>
                  </details>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  render() {
    const hasSearch = this.searchQuery !== '';
    const pageLabel = this.totalPages > 0 ? `${this.page} / ${this.totalPages}` : '0 / 0';

    return html`
      <style>
        .online-orders-log-panel .metric-card {
          border: 1px solid rgba(13, 110, 253, 0.12);
          border-radius: 1rem;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 255, 0.96));
        }

        .online-orders-log-panel .table thead th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #f8f9fa;
        }

        .online-orders-log-panel .online-orders-table-wrapper {
          max-height: 62vh;
          overflow: auto;
          border-radius: 1rem;
          border: 1px solid rgba(33, 37, 41, 0.08);
          background: #fff;
        }

        .online-orders-log-panel .payload-preview {
          max-width: 420px;
          max-height: 220px;
          margin: 0;
          padding: 0.75rem;
          overflow: auto;
          border-radius: 0.75rem;
          background: #0f172a;
          color: #e2e8f0;
          font-size: 0.75rem;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .online-orders-log-panel .message-cell {
          min-width: 240px;
          max-width: 360px;
          white-space: pre-wrap;
          word-break: break-word;
        }
      </style>

      <section class="online-orders-log-panel">
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-body p-4">
            <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
              <div>
                <h3 class="mb-1">Web shop payload log</h3>
                <p class="text-muted mb-0">
                  Audit trail for webshop orders sent to Soft1, with server-side validation and 7-day retention.
                </p>
              </div>
              <div class="d-flex flex-wrap gap-2 align-items-center">
                <button class="btn btn-outline-secondary" @click=${this._refresh} ?disabled=${this.loading}>
                  Refresh
                </button>
              </div>
            </div>

            <div class="row g-3 mb-4">
              <div class="col-md-4">
                <div class="metric-card p-3 h-100">
                  <div class="text-muted small text-uppercase">Entries</div>
                  <div class="fs-4 fw-bold">${this.totalCount}</div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="metric-card p-3 h-100">
                  <div class="text-muted small text-uppercase">Current page</div>
                  <div class="fs-4 fw-bold">${pageLabel}</div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="metric-card p-3 h-100">
                  <div class="text-muted small text-uppercase">Active search</div>
                  <div class="fs-6 fw-semibold">${hasSearch ? this.searchQuery : 'None'}</div>
                </div>
              </div>
            </div>

            <div class="row g-3 align-items-end mb-3">
              <div class="col-lg-8">
                <label class="form-label fw-semibold">Search</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="TRDR, TRDBRANCH, VARCHAR02, CCCORDER, validation message"
                  .value=${this.searchInput}
                  @input=${this._onSearchInput}
                  @keydown=${this._onSearchKeyDown}
                />
              </div>
              <div class="col-lg-4">
                <div class="d-flex gap-2">
                  <button class="btn btn-primary flex-fill" @click=${this._applySearch} ?disabled=${this.loading}>
                    Search
                  </button>
                  <button class="btn btn-outline-secondary" @click=${this._clearSearch} ?disabled=${this.loading}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            ${this.error ? html`<div class="alert alert-danger mb-3">${this.error}</div>` : ''}
            ${this.success ? html`<div class="alert alert-success mb-3">${this.success}</div>` : ''}

            ${this._renderTable()}

            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-3">
              <div class="text-muted small">
                Retention: 7 days. Results ordered by latest payload first.
              </div>
              <div class="btn-group" role="group">
                <button class="btn btn-outline-primary" @click=${this._goToFirstPage} ?disabled=${this.loading || this.page <= 1}>
                  First
                </button>
                <button class="btn btn-outline-primary" @click=${this._goToPreviousPage} ?disabled=${this.loading || this.page <= 1}>
                  Prev
                </button>
                <button class="btn btn-outline-primary" @click=${this._goToNextPage} ?disabled=${this.loading || this.page >= this.totalPages || this.totalPages === 0}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

customElements.define('online-orders-log-panel', OnlineOrdersLogPanel);