import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import { client } from '../socketConfig.js';

export class S1TransferModal extends LitElement {
  static properties = {
    visible: { type: Boolean },
    state: { type: String }, // 'confirmation', 'processing', 'results'
    transferOrders: { type: Array },
    currentResults: { type: Array },
    processingIndex: { type: Number },
    overallProgress: { type: Number },
    currentToken: { type: String },
    successfulOrders: { type: Array },
    failedOrders: { type: Array }
  };

  constructor() {
    super();
    this.visible = false;
    this.state = 'confirmation';
    this.transferOrders = [];
    this.currentResults = [];
    this.processingIndex = 0;
    this.overallProgress = 0;
    this.currentToken = '';
    this.successfulOrders = [];
    this.failedOrders = [];
  }

  createRenderRoot() {
    // Disable shadow DOM to allow global styles to affect this component
    return this;
  }

  render() {
    if (!this.visible) return html``;

    return html`
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1055; max-width: 95vw; max-height: 95vh;">
        <div class="modal-dialog modal-dialog-scrollable" style="margin: 0; max-width: 700px; width: 100%; max-height: 95vh;">
          <div class="modal-content shadow-lg" style="max-height: 95vh; overflow: hidden; border: none; border-radius: 1.25rem;">
            ${this._renderCurrentState()}
          </div>
        </div>
      </div>
    `;
  }

  _renderCurrentState() {
    switch (this.state) {
      case 'confirmation':
        return this._renderConfirmation();
      case 'processing':
        return this._renderProcessing();
      case 'results':
        return this._renderResults();
      default:
        return html`<div>Unknown state: ${this.state}</div>`;
    }
  }

  _renderConfirmation() {
    const totalOrders = this.transferOrders.length;
    const totalItems = this.transferOrders.reduce((sum, order) => sum + order.totalItems, 0);
    const totalQuantity = this.transferOrders.reduce((sum, order) => sum + order.totalQuantity, 0);
    const totalBlacklistedItems = this.transferOrders.reduce((sum, order) => sum + order.blacklistedItemsCount, 0);

    return html`
      <div class="modal-header text-bg-primary">
        <h5 class="modal-title mb-0" style="font-weight: 300; letter-spacing: 0.3px; color: white;">
          <i class="fas fa-paper-plane me-2" style="opacity: 0.9;"></i>
          Confirmare Transfer
        </h5>
      </div>
      
      <div class="modal-body" style="background: #f8f9fa; padding: 2rem; max-height: 70vh; overflow-y: auto;">
        <!-- Professional intro message -->
        <div class="text-center mb-4">
          <p class="text-muted mb-2" style="font-size: 1.1rem; line-height: 1.6;">
            Pregătit pentru transferul a <strong class="text-dark">${totalOrders} ${totalOrders === 1 ? 'comenzii' : 'comenzi'}</strong> către SoftOne.
          </p>
          <p class="text-muted small mb-0">
            Vă rugăm să verificați detaliile înainte de a continua.
          </p>
        </div>

        <!-- Summary cards with professional design -->
        <div class="row g-3 mb-4">
          <div class="col-md-3">
            <div class="card border-0 shadow-sm text-bg-primary" style="color: white;">
              <div class="card-body text-center py-2">
                <i class="fas fa-list-ul fa-2x mb-2" style="opacity: 0.9;"></i>
                <h5 class="mb-1" style="font-weight: 300; color: white;">${totalOrders}</h5>
                <small style="opacity: 0.9; font-weight: 300; color: rgba(255,255,255,0.9);">Comenzi</small>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card border-0 shadow-sm" style="background: #6c757d; color: white;">
              <div class="card-body text-center py-2">
                <i class="fas fa-cube fa-2x mb-2" style="opacity: 0.9;"></i>
                <h5 class="mb-1" style="font-weight: 300; color: white;">${totalItems}</h5>
                <small style="opacity: 0.9; font-weight: 300; color: rgba(255,255,255,0.9);">Produse</small>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card border-0 shadow-sm" style="background: #198754; color: white;">
              <div class="card-body text-center py-2">
                <i class="fas fa-balance-scale fa-2x mb-2" style="opacity: 0.9;"></i>
                <h5 class="mb-1" style="font-weight: 300; color: white;">${totalQuantity.toFixed(1)}</h5>
                <small style="opacity: 0.9; font-weight: 300; color: rgba(255,255,255,0.9);">Cantitate</small>
              </div>
            </div>
          </div>
          ${totalBlacklistedItems > 0 ? html`
            <div class="col-md-3">
              <div class="card border-0 shadow-sm" style="background: #dc3545; color: white;">
                <div class="card-body text-center py-2">
                  <i class="fas fa-shield-alt fa-2x mb-2" style="opacity: 0.9;"></i>
                  <h5 class="mb-1" style="font-weight: 300; color: white;">${totalBlacklistedItems}</h5>
                  <small style="opacity: 0.9; font-weight: 300; color: rgba(255,255,255,0.9);">Excluse</small>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- Order list with improved styling -->
        <div class="mb-4">
          <h6 class="text-dark mb-3" style="font-weight: 500;">
            <i class="fas fa-route me-2 text-muted"></i>
            Detalii Transferuri
          </h6>
          <div class="list-group shadow-sm" style="border-radius: 0.75rem; overflow: hidden;">
            ${this.transferOrders.map(order => html`
              <div class="list-group-item border-0" style="background: white; padding: 1.25rem;">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <div class="d-flex align-items-center mb-2">
                      <div class="rounded-circle d-flex align-items-center justify-content-center me-3" 
                           style="width: 40px; height: 40px;">
                        <i class="fas fa-store text-white"></i>
                      </div>
                      <div>
                        <h6 class="mb-0" style="color: #495057; font-weight: 500;">
                          ${order.sourceName} → ${order.destinationName}
                        </h6>
                        <small class="text-muted">Transfer către destinație</small>
                      </div>
                    </div>
                    <div class="text-muted small">
                      <i class="fas fa-boxes me-1"></i>${order.totalItems} produse
                      <span class="mx-2">•</span>
                      <i class="fas fa-weight me-1"></i>${order.totalQuantity.toFixed(2)} unități
                    </div>
                  </div>
                  <div>
                    ${order.blacklistedItemsCount > 0 ? html`
                      <span class="text-danger">
                        <i class="fas fa-shield-alt me-1"></i>
                        ${order.blacklistedItemsCount} excluse
                      </span>
                    ` : html`
                      <span class="text-success">
                        <i class="fas fa-check me-1"></i>
                        Gata pentru transfer
                      </span>
                    `}
                  </div>
                </div>
              </div>
            `)}
          </div>
        </div>

        <!-- Production reminder with professional design -->
        <div class="alert alert-warning border-0" style="background: #fff3cd; border-radius: 0.5rem; border-left: 4px solid #ffc107;">
          <div class="d-flex align-items-center">
            <i class="fas fa-check-circle text-success me-3"></i>
            <div>
              <strong class="text-dark">Sistem de producție:</strong> 
              <span class="text-dark">Transferurile vor fi generate cu comentarii contextuale.</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer" style="background: white; border-top: 1px solid #e9ecef; padding: 1.5rem 2rem;">
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="${this._handleCancel}">
          <i class="fas fa-times me-1"></i>Anulează
        </button>
        <button type="button" class="btn btn-sm btn-primary" @click="${this._handleConfirm}" 
          <i class="fas fa-check me-1"></i>Confirmă
        </button>
      </div>
    `;
  }

  _renderProcessing() {
    const completedCount = this.currentResults.filter(r => r && (r.status === 'success' || r.status === 'failed')).length;
    const totalCount = this.transferOrders.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return html`
      <div class="modal-header" style="background: #495057; color: white; border-bottom: none;">
        <h5 class="modal-title mb-0" style="font-weight: 300; letter-spacing: 0.3px; color: white;">
          <i class="fas fa-cog fa-spin me-2" style="opacity: 0.9;"></i>
          Transfer în curs
        </h5>
      </div>
      
      <div class="modal-body" style="background: #f8f9fa; padding: 2rem; max-height: 70vh; overflow-y: auto;">
        <!-- Professional progress message -->
        <div class="text-center mb-4">
          <p class="text-muted mb-2" style="font-size: 1.1rem; line-height: 1.6;">
            Se procesează transferul către SoftOne...
          </p>
          <p class="text-muted small mb-0">
            Vă rugăm să așteptați finalizarea operațiunii.
          </p>
        </div>

        <!-- Overall progress with professional design -->
        <div class="mb-4">
          <div class="card border-0 shadow-sm" style="border-radius: 0.5rem;">
            <div class="card-body p-2 text-primary">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 class="mb-1" style="font-weight: 300;">Progres General</h5>
                  <small;">Se procesează comenzile...</small>
                </div>
                <div class="text-end">
                  <h5 class="mb-0" style="font-weight: 300;">${progressPercent}%</h5>
                  <small>${completedCount} din ${totalCount}</small>
                </div>
              </div>
              <div class="progress" style="height: 10px; border-radius: 0.25rem;">
                <div class="progress-bar" 
                     style="width: ${progressPercent}%; background: #198754; border-radius: 0.25rem;"></div>
              </div>
              <div class="mt-2">
                <small>
                  <i class="fas fa-info-circle me-1"></i>
                  Progresul se bazează pe numărul de comenzi procesate
                </small>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Individual order status with improved design -->
        <div class="mb-4">
          <h6 class="text-dark mb-3" style="font-weight: 500;">
            <i class="fas fa-tasks me-2 text-muted"></i>
            Status Individual
          </h6>
          <div class="list-group shadow-sm" style="border-radius: 0.75rem; overflow: hidden;">
            ${this.transferOrders.map((order, index) => this._renderOrderStatus(order, index))}
          </div>
        </div>
        
        <!-- Production reminder with muted business design -->
        <div class="alert border-0 shadow-sm">
          <div class="d-flex align-items-center">
            <i class="fas fa-check-circle fa-lg me-3 text-success" style="opacity: 0.8;"></i>
            <div>
              <strong style="opacity: 0.95;">Sistem activ:</strong> 
              <span style="opacity: 0.8;">Transferurile sunt procesate în mod profesional către SoftOne ERP.</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer" style="background: white; border-top: 1px solid #e9ecef; padding: 1.5rem 2rem;">
        <button type="button" class="btn btn-sm btn-outline-danger" @click="${this._handleCancelRemaining}" style="border-radius: 0.375rem; padding: 0.5rem 1rem; font-weight: 500;">
          <i class="fas fa-stop me-1"></i>Oprește transferul
        </button>
      </div>
    `;
  }

  _renderOrderStatus(order, index) {
    const result = this.currentResults[index];
    
    if (!result) {
      // Waiting
      return html`
        <div class="list-group-item border-0" style="background: white; padding: 1.25rem;">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <div class="rounded-circle d-flex align-items-center justify-content-center me-3" 
                   style="width: 40px; height: 40px;">
                <i class="fas fa-clock"></i>
              </div>
              <div>
                <h6 class="mb-0" style="color: #495057; font-weight: 500;">
                  ${order.destinationName}
                </h6>
                <small class="text-muted">În așteptare...</small>
              </div>
            </div>
            <div>
              <span class="text-muted">Așteptare</span>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'processing') {
      // Currently processing
      return html`
        <div class="list-group-item border-0" style="background: #f8f9fa; padding: 1.25rem;">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <div class="rounded-circle d-flex align-items-center justify-content-center me-3" 
                   style="width: 40px; height: 40px; background: #495057; color: white;">
                <i class="fas fa-cog fa-spin"></i>
              </div>
              <div>
                <h6 class="mb-0" style="color: #495057; font-weight: 500;">
                  ${order.destinationName}
                </h6>
                <small style="color: #6c757d;">Se procesează...</small>
              </div>
            </div>
            <div class="text-end">
              <span class="text-primary">În lucru</span>
              <br>
              <small class="text-muted mt-1">
                <i class="fas fa-stopwatch me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'success') {
      // Completed successfully
      return html`
        <div class="list-group-item border-0">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <div class="rounded-circle d-flex align-items-center justify-content-center me-3" 
                   style="width: 40px; height: 40px;">
                <i class="fas fa-check"></i>
              </div>
              <div>
                <h6 class="mb-0" style="color: #495057; font-weight: 500;">
                  ${order.destinationName}
                </h6>
                <small style="color: #16a34a;">Finalizat cu succes • ID: #${result.data?.id || 'unknown'}</small>
              </div>
            </div>
            <div class="text-end">
              <span>Complet</span>
              <br>
              <small class="text-muted mt-1">
                <i class="fas fa-stopwatch me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'failed') {
      // Failed
      return html`
        <div class="list-group-item border-0" style="background: #fff5f5; padding: 1.25rem;">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <div class="rounded-circle d-flex align-items-center justify-content-center me-3" 
                   style="width: 40px; height: 40px; background: #dc3545; color: white;">
                <i class="fas fa-exclamation"></i>
              </div>
              <div>
                <h6 class="mb-0" style="color: #495057; font-weight: 500;">
                  ${order.destinationName}
                </h6>
                <small style="color: #dc2626;">${result.data?.message || 'Eroare necunoscută'}</small>
              </div>
            </div>
            <div class="text-end">
              <span class="text-danger">Eșuat</span>
              <br>
              <small class="text-muted mt-1">
                <i class="fas fa-stopwatch me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    return html``;
  }

  _renderResults() {
    const totalOrders = this.transferOrders.length;
    const successCount = this.successfulOrders.length;
    const errorCount = this.failedOrders.length;
    const successRate = totalOrders > 0 ? Math.round((successCount / totalOrders) * 100) : 0;

    return html`
      <div class="modal-header" style="background: ${successCount === totalOrders ? '#198754' : '#495057'}; color: white; border-bottom: none;">
        <h5 class="modal-title mb-0" style="font-weight: 300; letter-spacing: 0.3px; color: white;">
          <i class="fas fa-${successCount === totalOrders ? 'check-circle' : 'clipboard-check'} me-2" style="opacity: 0.9;"></i>
          Transfer ${successCount === totalOrders ? 'completat' : 'finalizat'}
        </h5>
      </div>
      
      <div class="modal-body" style="background: #f8f9fa; padding: 2rem; max-height: 70vh; overflow-y: auto;">
        <!-- Professional completion message -->
        <div class="text-center mb-4">
          ${successCount === totalOrders ? html`
            <div class="mb-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" 
                   style="width: 80px; height: 80px; background: #198754; color: white;">
                <i class="fas fa-check fa-2x" style="opacity: 0.9;"></i>
              </div>
              <h5 class="text-success mb-2" style="font-weight: 300;">Transfer finalizat cu succes</h5>
              <p class="text-muted" style="font-size: 1.1rem; line-height: 1.6;">
                Toate comenzile au fost transferate în SoftOne.
              </p>
            </div>
          ` : html`
            <div class="mb-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" 
                   style="width: 80px; height: 80px; background: #495057; color: white;">
                <i class="fas fa-clipboard-check fa-2x" style="opacity: 0.9;"></i>
              </div>
              <h5 class="text-dark mb-2" style="font-weight: 300;">Transfer finalizat</h5>
              <p class="text-muted" style="font-size: 1.1rem; line-height: 1.6;">
                Transferul s-a încheiat. Unele comenzi necesită atenție suplimentară.
              </p>
            </div>
          `}
        </div>

        <!-- Results summary with professional cards -->
        <div class="row g-3 mb-4">
          <div class="col-md-4">
            <div class="card border-0 shadow-sm" style="background: #198754; color: white; border-radius: 0.5rem;">
              <div class="card-body text-center py-2">
                <i class="fas fa-check-circle fa-2x mb-2" style="opacity: 0.9;"></i>
                <h3 class="mb-1" style="font-weight: 300; color: white;">${successCount}</h3>
                <small style="opacity: 0.9; font-weight: 300; color: rgba(255,255,255,0.9);">Reușite</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border-0 shadow-sm" style="background: #dc3545; color: white; border-radius: 0.5rem;">
              <div class="card-body text-center py-2">
                <i class="fas fa-exclamation-circle fa-2x mb-2" style="opacity: 0.9;"></i>
                <h3 class="mb-1" style="font-weight: 300; color: white;">${errorCount}</h3>
                <small style="opacity: 0.9; font-weight: 300; color: rgba(255,255,255,0.9);">Eșuate</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card border-0 shadow-sm" style="background: #6c757d; color: white; border-radius: 0.5rem;">
              <div class="card-body text-center py-2">
                <i class="fas fa-percentage fa-2x mb-2" style="opacity: 0.9;"></i>
                <h3 class="mb-1" style="font-weight: 300; color: white;">${successRate}%</h3>
                <small style="opacity: 0.9; font-weight: 300; color: rgba(255,255,255,0.9);">Rata de succes</small>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Detailed results -->
        <div class="mb-4">
          <h6 class="text-dark mb-3" style="font-weight: 500;">
            <i class="fas fa-list-alt me-2 text-muted"></i>
            Rezultate Detaliate
          </h6>
          <div class="list-group shadow-sm" style="border-radius: 0.75rem; overflow: hidden;">
            ${this.currentResults.map((result, index) => this._renderDetailedResult(this.transferOrders[index], result, index))}
          </div>
        </div>

        <!-- Show friendly IDs section if we have successful orders -->
        ${this.successfulOrders.length > 0 ? html`
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h6 class="mb-3" style="font-weight: 500; opacity: 0.95;">
                <i class="fas fa-id-card me-2"></i>
                Comenzi Create cu Succes
              </h6>
              <div id="friendly-ids-container" style="opacity: 0.9;">
                <i class="fas fa-spinner fa-spin me-2"></i>Se încarcă ID-urile prietenoase...
              </div>
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="modal-footer" style="background: white; border-top: 1px solid #e9ecef; padding: 1.5rem 2rem;">
        ${this.failedOrders.length > 0 ? html`
          <button type="button" class="btn btn-sm btn-danger me-2" @click="${this._retryAllFailed}"
                  style="border-radius: 0.375rem; padding: 0.5rem 1rem; font-weight: 500;">
            <i class="fas fa-redo me-1"></i>
            Reîncearcă Eșuatele (${this.failedOrders.length})
          </button>
        ` : ''}
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="${this._handleClose}" style="border-radius: 0.375rem; padding: 0.5rem 1rem; font-weight: 500;">
          <i class="fas fa-times me-1"></i>Închide
        </button>
      </div>
    `;
  }

  _renderDetailedResult(order, result, index) {
    if (result.status === 'success') {
      return html`
        <div class="list-group-item border-0" style="background: white; padding: 1.25rem;">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <div class="rounded-circle d-flex align-items-center justify-content-center me-3" 
                   style="width: 50px; height: 50px;">
                <i class="fas fa-check fa-lg"></i>
              </div>
              <div>
                <h6 class="mb-1" style="color: #495057; font-weight: 500;">
                  ${order.destinationName}
                </h6>
                <p class="mb-1 text-muted small">${order.totalItems} produse • ${order.totalQuantity.toFixed(2)} cantitate</p>
                <small style="color: #16a34a; font-weight: 500;">
                  <i class="fas fa-id-card me-1"></i>ID SoftOne: #${result.data?.id || 'unknown'}
                </small>
              </div>
            </div>
            <div class="text-end">
              <span>
                <i class="fas fa-thumbs-up me-1"></i>Reușit
              </span>
              <br>
              <small class="text-muted mt-2 d-block">
                <i class="fas fa-clock me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    if (result.status === 'failed') {
      return html`
        <div class="list-group-item border-0" style="background: white; padding: 1.25rem;">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1 d-flex align-items-start">
              <div class="rounded-circle d-flex align-items-center justify-content-center me-3" 
                   style="width: 50px; height: 50px; background: #dc3545; color: white;">
                <i class="fas fa-exclamation fa-lg"></i>
              </div>
              <div class="flex-grow-1">
                <h6 class="mb-1" style="color: #495057; font-weight: 500;">
                  ${order.destinationName}
                </h6>
                <p class="mb-2 text-muted small">${order.totalItems} produse • ${order.totalQuantity.toFixed(2)} cantitate</p>
                
                <!-- Error summary -->
                <div class="alert alert-light border border-danger" style="border-radius: 0.5rem; background: #fef2f2;">
                  <small class="text-danger">
                    <i class="fas fa-info-circle me-1"></i>
                    <strong>${result.data?.message || 'Eroare necunoscută'}</strong>
                  </small>
                </div>
                
                <!-- Error details (expandable) -->
                <div class="mt-3">
                  <button class="btn btn-sm btn-outline-secondary shadow-sm" 
                          @click="${() => this._toggleErrorDetails(index)}"
                          style="border-radius: 1.5rem; font-weight: 500;">
                    <i class="fas fa-chevron-down me-2"></i>
                    Vezi Detalii Complete
                  </button>
                  
                  <div class="collapse mt-3" id="error-details-${index}">
                    <div class="card border-0 shadow-sm" style="border-radius: 0.75rem;">
                      <div class="card-body">
                        <div class="d-flex align-items-start">
                          <i class="fas fa-exclamation-triangle text-danger me-3 mt-1"></i>
                          <div class="flex-grow-1">
                            <h6 class="text-danger mb-3">${result.data?.message || 'Eroare necunoscută'}</h6>
                            
                            <!-- Multiple error messages if available -->
                            ${result.data?.messages && Array.isArray(result.data.messages) && result.data.messages.length > 1 ? html`
                              <div class="mb-3">
                                <small class="text-muted d-block mb-2">Mesaje detaliate:</small>
                                ${result.data.messages.map((msg, i) => html`
                                  <div class="alert alert-light border-0 py-2 mb-2" style="background: #f8f9fa;">
                                    <small>
                                      <i class="fas fa-dot-circle text-danger me-2" style="font-size: 0.6rem;"></i>
                                      ${msg}
                                    </small>
                                  </div>
                                `)}
                              </div>
                            ` : ''}
                            
                            <!-- Order context information -->
                            ${result.data?.orderInfo ? html`
                              <div class="mb-3 p-3 rounded" style="background: #f8f9fa;">
                                <small class="text-muted d-block mb-2 fw-bold">Context comandă:</small>
                                <div class="small">
                                  <div class="row g-2">
                                    <div class="col-6">
                                      <strong>Destinație:</strong><br>
                                      <span class="text-muted">${result.data.orderInfo.destination}</span>
                                    </div>
                                    <div class="col-6">
                                      <strong>Articole:</strong><br>
                                      <span class="text-muted">${result.data.orderInfo.items}</span>
                                    </div>
                                    <div class="col-6">
                                      <strong>Cantitate totală:</strong><br>
                                      <span class="text-muted">${result.data.orderInfo.totalQuantity || 'N/A'}</span>
                                    </div>
                                    ${result.data.orderInfo.maxRetries ? html`
                                      <div class="col-6">
                                        <strong>Încercări max:</strong><br>
                                        <span class="text-muted">${result.data.orderInfo.maxRetries}</span>
                                      </div>
                                    ` : ''}
                                  </div>
                                </div>
                              </div>
                            ` : ''}
                          </div>
                        </div>
                        
                        <!-- SoftOne Documentation Section -->
                        ${result.data?.softOneDocumentation ? html`
                          <div class="mt-3 border-top pt-3">
                            <button class="btn btn-sm btn-outline-info shadow-sm" 
                                    @click="${() => this._toggleDocumentation(index)}"
                                    style="border-radius: 1.5rem; font-weight: 500;">
                              <i class="fas fa-book me-2"></i>
                              Documentație SoftOne
                            </button>
                            <div class="collapse mt-3" id="docs-${index}">
                              <div class="card border-0" style="background: #495057; color: white; border-radius: 0.5rem;">
                                <div class="card-body">
                                  <pre class="mb-0 small" style="white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: white; opacity: 0.95;">${result.data.softOneDocumentation}</pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        ` : ''}
                        
                        <!-- Technical details toggle -->
                        ${result.data?.error || result.data?.code ? html`
                          <div class="mt-3 border-top pt-3">
                            <button class="btn btn-sm btn-outline-warning shadow-sm" 
                                    @click="${() => this._toggleTechnicalDetails(index)}"
                                    style="border-radius: 1.5rem; font-weight: 500;">
                              <i class="fas fa-code me-2"></i>
                              Detalii Tehnice
                            </button>
                            <div class="collapse mt-3" id="tech-details-${index}">
                              <div class="card border-0" style="background: #6c757d; color: white; border-radius: 0.5rem;">
                                <div class="card-body">
                                  <pre class="small mb-0" style="color: white; opacity: 0.95;">
<strong>Cod eroare:</strong> ${result.data?.error || 'N/A'}
<strong>Cod HTTP:</strong> ${result.data?.code || 'N/A'}
<strong>Timestamp:</strong> ${result.data?.enhancedAt || new Date().toISOString()}

${result.data?.originalResponse ? html`<strong>Răspuns original:</strong>
${JSON.stringify(result.data.originalResponse, null, 2)}` : ''}

${result.data?.originalError ? html`<strong>Eroare originală:</strong>
${result.data.originalError.toString()}` : ''}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="text-end ms-3">
              <span class="text-danger mb-3">
                <i class="fas fa-times me-1"></i>Eșuat
              </span>
              <br>
              <!-- Inline retry button -->
              <button class="btn btn-sm btn-primary" 
                      @click="${() => this._retryOrder(index)}"
                      ?disabled="${result.retrying}"
                      style="border-radius: 0.375rem; font-weight: 500;">
                <i class="fas fa-${result.retrying ? 'spinner fa-spin' : 'redo'} me-1"></i>
                ${result.retrying ? 'Se reîncearcă...' : 'Reîncearcă'}
              </button>
              <br>
              <small class="text-muted mt-2 d-block">
                <i class="fas fa-clock me-1"></i>${this._formatDuration(result.duration || 0)}
              </small>
            </div>
          </div>
        </div>
      `;
    }

    return html``;
  }

  // Public methods for parent component
  showConfirmation(orders, token) {
    this.transferOrders = orders;
    this.currentToken = token;
    this.state = 'confirmation';
    this.visible = true;
    this.currentResults = [];
    this.processingIndex = 0;
    this.successfulOrders = [];
    this.failedOrders = [];
  }

  startProcessing() {
    this.state = 'processing';
    this.currentResults = new Array(this.transferOrders.length).fill(null);
    this.requestUpdate();
  }

  updateProgress(orderIndex, status, data = {}) {
    const startTime = this.currentResults[orderIndex]?.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    this.currentResults[orderIndex] = {
      status,
      data,
      duration,
      startTime: this.currentResults[orderIndex]?.startTime || startTime
    };
    
    if (status === 'processing') {
      this.currentResults[orderIndex].startTime = Date.now();
    }
    
    this.requestUpdate();
  }

  showResults() {
    this.state = 'results';
    
    // Categorize results
    this.successfulOrders = [];
    this.failedOrders = [];
    
    this.currentResults.forEach((result, index) => {
      if (result?.status === 'success') {
        this.successfulOrders.push({ order: this.transferOrders[index], result, index });
      } else if (result?.status === 'failed') {
        this.failedOrders.push({ order: this.transferOrders[index], result, index });
      }
    });
    
    this.requestUpdate();
    
    // Fetch friendly IDs for successful orders
    if (this.successfulOrders.length > 0) {
      this._fetchFriendlyIds();
    }
  }

  // Event handlers
  _handleCancel() {
    this.visible = false;
    this.dispatchEvent(new CustomEvent('cancelled', { 
      bubbles: true, 
      composed: true 
    }));
  }

  _handleConfirm() {
    this.dispatchEvent(new CustomEvent('confirmed', { 
      bubbles: true, 
      composed: true 
    }));
  }

  _handleClose() {
    this.visible = false;
    this.dispatchEvent(new CustomEvent('closed', { 
      bubbles: true, 
      composed: true 
    }));
  }

  _handleCancelRemaining() {
    this.dispatchEvent(new CustomEvent('cancel-remaining', { 
      bubbles: true, 
      composed: true 
    }));
  }

  async _retryOrder(orderIndex) {
    const result = this.currentResults[orderIndex];
    if (!result || result.retrying) return;

    // Mark as retrying
    this.currentResults[orderIndex] = { 
      ...result, 
      retrying: true 
    };
    this.requestUpdate();

    // Dispatch retry event
    this.dispatchEvent(new CustomEvent('retry-order', { 
      bubbles: true, 
      composed: true,
      detail: { orderIndex, order: this.transferOrders[orderIndex] }
    }));
  }

  async _retryAllFailed() {
    // Dispatch retry all event
    this.dispatchEvent(new CustomEvent('retry-all-failed', { 
      bubbles: true, 
      composed: true,
      detail: { failedOrders: this.failedOrders }
    }));
  }

  _toggleErrorDetails(index) {
    const element = this.querySelector(`#error-details-${index}`);
    if (element) {
      element.classList.toggle('show');
    }
  }

  _toggleTechnicalDetails(index) {
    const element = this.querySelector(`#tech-details-${index}`);
    if (element) {
      element.classList.toggle('show');
    }
  }

  _toggleDocumentation(index) {
    const element = this.querySelector(`#docs-${index}`);
    if (element) {
      element.classList.toggle('show');
    }
  }

  // Helper methods
  _formatDuration(milliseconds) {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    const seconds = (milliseconds / 1000).toFixed(1);
    return `${seconds}s`;
  }

  async _fetchFriendlyIds() {
    try {
      const ids = this.successfulOrders.map(item => item.result.data.id).join(',');
      
      const response = await client.service('s1').getSqlDataset({
        token: this.currentToken,
        SQL: `SELECT findoc, fincode FROM findoc WHERE findoc IN (${ids})`
      });

      if (response.succes && response.rows) {
        const container = this.querySelector('#friendly-ids-container');
        if (container) {
          const idMap = new Map();
          response.rows.forEach(row => {
            idMap.set(row.findoc.toString(), row.fincode);
          });

          container.innerHTML = this.successfulOrders.map(item => {
            const friendlyId = idMap.get(item.result.data.id.toString()) || item.result.data.id;
            return `<div><strong>${item.order.destinationName}:</strong> ${friendlyId}</div>`;
          }).join('');
        }
      }
    } catch (error) {
      console.error('Error fetching friendly IDs:', error);
      const container = this.querySelector('#friendly-ids-container');
      if (container) {
        container.innerHTML = '<span class="text-danger">Eroare la încărcarea ID-urilor prietenoase</span>';
      }
    }
  }

  async _lookupErrorCode(errorCode) {
    // This would lookup error codes in SoftOne documentation
    // For now, return a placeholder
    return `Error code ${errorCode} - verificați documentația SoftOne`;
  }
}

customElements.define('s1-transfer-modal', S1TransferModal);
