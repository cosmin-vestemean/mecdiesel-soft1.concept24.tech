import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

/**
 * Diagnostic Modal Component
 * 
 * Displays excluded materials with reasons in a Bootstrap modal
 * Used for debug mode in Branch Replenishment
 */
export class DiagnosticModal extends LitElement {
  static get properties() {
    return {
      diagnostics: { type: Array },
      visible: { type: Boolean }
    };
  }

  constructor() {
    super();
    this.diagnostics = [];
    this.visible = false;
    this._modalInstance = null;
  }

  createRenderRoot() {
    return this; // Render in light DOM for Bootstrap compatibility
  }

  firstUpdated() {
    // Initialize Bootstrap modal instance
    const modalElement = this.querySelector('#diagnosticModal');
    if (modalElement && window.bootstrap) {
      this._modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: false, // No backdrop - user can interact with page
        keyboard: true
      });
      
      // Clean up diagnostics when modal is hidden
      modalElement.addEventListener('hidden.bs.modal', () => {
        this.visible = false;
      });

      // Make modal draggable
      this._makeDraggable(modalElement);
    }
  }

  /**
   * Make modal draggable by header
   */
  _makeDraggable(modalElement) {
    const dialog = modalElement.querySelector('.modal-dialog');
    const header = modalElement.querySelector('.modal-header');
    
    if (!dialog || !header) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('btn-close')) return;
      
      isDragging = true;
      initialX = e.clientX - dialog.offsetLeft;
      initialY = e.clientY - dialog.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      dialog.style.transform = `translate(${currentX}px, ${currentY}px)`;
      dialog.style.transition = 'none';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      dialog.style.transition = '';
    });
  }

  /**
   * Show modal with diagnostics data
   * @param {Array} diagnostics - Array of diagnostic objects
   */
  show(diagnostics = []) {
    this.diagnostics = diagnostics;
    this.visible = true;
    if (this._modalInstance) {
      this._modalInstance.show();
    }
  }

  /**
   * Hide modal
   */
  hide() {
    if (this._modalInstance) {
      this._modalInstance.hide();
    }
  }

  /**
   * Get Bootstrap badge class based on reason
   */
  _getReasonBadgeClass(reason) {
    const classMap = {
      'LIPSA_STOC_EMIT': 'bg-danger text-white',
      'LIMITE_INEXISTENTE_DEST': 'bg-warning text-white',
      'BRANCH_INACTIV_DEST': 'bg-danger text-white',
      'LIMITE_ZERO_DEST': 'bg-info text-white',
      'NECESAR_ZERO_DEST': 'bg-info text-white'
    };
    return classMap[reason] || 'bg-secondary text-white';
  }

  /**
   * Get human-readable label for reason
   */
  _getReasonLabel(reason) {
    const labelMap = {
      'LIPSA_STOC_EMIT': 'No Stock at Source',
      'LIMITE_INEXISTENTE_DEST': 'No Limits at Destination',
      'BRANCH_INACTIV_DEST': 'Inactive Branch',
      'LIMITE_ZERO_DEST': 'Zero Limits',
      'NECESAR_ZERO_DEST': 'Zero Necessity'
    };
    return labelMap[reason] || reason;
  }

  /**
   * Export diagnostics to CSV
   */
  _exportToCsv() {
    if (this.diagnostics.length === 0) {
      alert('Nu există date de exportat.');
      return;
    }

    // Create CSV content
    const headers = ['Material', 'Denumire', 'Motiv', 'Fil. Emit', 'Nume Fil. Emit', 'Fil. Dest', 'Nume Fil. Dest', 'Detalii'];
    const rows = this.diagnostics.map(d => [
      d.Cod || '',
      d.Denumire || '',
      this._getReasonLabel(d.Motiv),
      d.FilEmit || '',
      d.NumeFilEmit || '',
      d.FilDest || '',
      d.NumeFilDest || '',
      d.Detalii || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `diagnostic_materiale_excluse_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Group diagnostics by reason for summary
   */
  _getSummaryByReason() {
    const summary = {};
    this.diagnostics.forEach(diag => {
      const reason = diag.Motiv;
      if (!summary[reason]) {
        summary[reason] = {
          count: 0,
          label: this._getReasonLabel(reason),
          badgeClass: this._getReasonBadgeClass(reason)
        };
      }
      summary[reason].count++;
    });
    return Object.values(summary);
  }

  render() {
    const summary = this._getSummaryByReason();
    
    return html`
      <!-- Modal - No backdrop, draggable -->
      <div class="modal fade" id="diagnosticModal" tabindex="-1" aria-labelledby="diagnosticModalLabel" aria-hidden="true" style="background: rgba(0,0,0,0.1);">
        <div class="modal-dialog modal-xl modal-dialog-scrollable" style="box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          <div class="modal-content">
            <div class="modal-header bg-warning" style="user-select: none;">
              <h5 class="modal-title" id="diagnosticModalLabel">
                <i class="fas fa-bug"></i> Raport Diagnostic - Materiale Excluse
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-2">
              ${this.diagnostics.length === 0 
                ? html`
                  <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> 
                    <strong>Nicio excludere detectată!</strong>
                    <p class="mb-0 mt-2">
                      Toate materialele care îndeplinesc condițiile apar în tabelul principal.
                    </p>
                  </div>
                `
                : html`
                  <!-- Summary Section -->
                  <div class="alert alert-warning py-2 mb-2">
                    <strong><i class="fas fa-exclamation-triangle"></i> ${this.diagnostics.length} materiale excluse</strong>
                    <p class="mb-1 mt-1 small">
                      Materialele de mai jos <strong>nu</strong> apar în rezultatul principal datorită următoarelor motive:
                    </p>
                    <div class="d-flex flex-wrap gap-1">
                      ${summary.map(item => html`
                        <span class="badge ${item.badgeClass}">
                          ${item.label}: ${item.count}
                        </span>
                      `)}
                    </div>
                  </div>

                  <!-- Diagnostics Table -->
                  <div class="table-responsive">
                    <table class="table table-sm table-striped table-hover modern-table" style="font-size: 12px;">
                      <thead class="sticky-top bg-light">
                        <tr>
                          <th style="width: 100px;">Material</th>
                          <th style="width: 200px;">Denumire</th>
                          <th style="width: 150px;">Motiv</th>
                          <th style="width: 80px;">Fil. Emit</th>
                          <th style="width: 120px;">Nume Emit</th>
                          <th style="width: 80px;">Fil. Dest</th>
                          <th style="width: 120px;">Nume Dest</th>
                          <th>Detalii</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.diagnostics.map((diag, index) => html`
                          <tr class="${index % 2 === 0 ? 'even-row' : ''}">
                            <td class="text-monospace"><strong>${diag.Cod}</strong></td>
                            <td class="text-truncate" title="${diag.Denumire}">${diag.Denumire && diag.Denumire.length > 20 ? diag.Denumire.substring(0, 20) + '...' : diag.Denumire}</td>
                            <td>
                              <span class="badge ${this._getReasonBadgeClass(diag.Motiv)}">
                                ${this._getReasonLabel(diag.Motiv)}
                              </span>
                            </td>
                            <td class="text-center">${diag.FilEmit || '-'}</td>
                            <td class="text-muted small">${diag.NumeFilEmit || '-'}</td>
                            <td class="text-center">${diag.FilDest || '-'}</td>
                            <td class="text-muted small">${diag.NumeFilDest || '-'}</td>
                            <td class="text-muted small">${diag.Detalii}</td>
                          </tr>
                        `)}
                      </tbody>
                    </table>
                  </div>

                  <!-- Help Section -->
                  <div class="mt-2">
                    <h6 class="text-muted mb-1" style="font-size: 13px;">
                      <i class="fas fa-info-circle"></i> Cum rezolv excluderile?
                    </h6>
                    <ul class="small text-muted mb-0" style="font-size: 11px;">
                      <li><strong>Lipsă Stoc Emitere:</strong> Verificați stocul în filiala emițătoare sau schimbați filiala sursă</li>
                      <li><strong>Fără Limite Destinație:</strong> Configurați limitele în modulul MTRBRNLIMITS pentru filiala destinație (filialele emițătoare NU necesită limite obligatorii)</li>
                      <li><strong>Filială Inactivă:</strong> Activați filiala în sistemul branch/whouse</li>
                      <li><strong>Limite/Necesar Zero:</strong> Ajustați setările "Condiție Limite" și "Condiție Necesar" sau configurați valori > 0</li>
                    </ul>
                  </div>
                `
              }
            </div>
            <div class="modal-footer py-2">
              <button 
                type="button" 
                class="btn btn-secondary" 
                @click=${this._exportToCsv} 
                ?disabled=${this.diagnostics.length === 0}
              >
                <i class="fas fa-download"></i> Export CSV
              </button>
              <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                Închide
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('diagnostic-modal', DiagnosticModal);
