/**
 * WhatsApp CRM - Main UI Component (Floating Popup Version)
 * Injects the CRM panel into WhatsApp Web as a floating popup
 */

const CRMUI = {
  // State
  isOpen: false,
  currentTab: 'lead',
  currentLead: null,
  elements: {},
  showFollowUpForm: false,

  /**
   * Initialize the CRM UI
   */
  async init() {
    CRMUtils.log('Initializing CRM UI...');

    // Initialize storage
    await CRMStorage.init();

    // Create and inject the CRM container
    this.createCRMContainer();

    // Setup event listeners
    this.setupEventListeners();

    // Update stats
    await this.updateStats();

    // Start checking for due follow-ups
    this.startFollowUpChecker();

    CRMUtils.log('CRM UI initialized');
  },

  /**
   * Create the main CRM container
   */
  createCRMContainer() {
    // Check if already exists
    if (document.getElementById('whatsapp-crm-container')) return;

    const container = document.createElement('div');
    container.id = 'whatsapp-crm-container';
    container.innerHTML = this.getContainerHTML();

    document.body.appendChild(container);

    // Cache element references
    this.cacheElements();
  },

  /**
   * Get container HTML with floating button and popup panel
   */
  getContainerHTML() {
    return `
      <!-- Floating Action Button -->
      <button id="crm-floating-btn" title="Open CRM">
        <div class="crm-fab-icon">CRM</div>
        <span class="crm-fab-badge hidden" id="crm-fab-badge">0</span>
      </button>

      <!-- Popup Panel -->
      <div id="crm-popup-panel">
        <!-- Header -->
        <div id="crm-popup-header">
          <div class="crm-popup-brand">
            <div class="crm-popup-brand-icon">CRM</div>
            <span class="crm-popup-brand-title">WhatsApp CRM</span>
          </div>
          <div class="crm-popup-header-actions">
            <button class="crm-popup-header-btn" id="crm-refresh-btn" title="Refresh">🔄</button>
            <button class="crm-popup-header-btn" id="crm-close-btn" title="Close">✕</button>
          </div>
        </div>

        <!-- Quick Stats -->
        <div id="crm-quick-stats">
          <div class="crm-stat-item" id="crm-stat-due" title="Due Follow-ups">
            <div class="crm-stat-value danger" id="crm-badge-due">0</div>
            <div class="crm-stat-label">Due</div>
          </div>
          <div class="crm-stat-item" id="crm-stat-pending" title="Pending Follow-ups">
            <div class="crm-stat-value" id="crm-badge-pending">0</div>
            <div class="crm-stat-label">Pending</div>
          </div>
          <div class="crm-stat-item" id="crm-stat-leads" title="Total Leads">
            <div class="crm-stat-value" id="crm-badge-leads">0</div>
            <div class="crm-stat-label">Leads</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="crm-tabs">
          <button class="crm-tab active" data-tab="lead">Lead</button>
          <button class="crm-tab" data-tab="followups">Follow-ups</button>
          <button class="crm-tab" data-tab="history">History</button>
          <button class="crm-tab" data-tab="settings">Settings</button>
        </div>

        <!-- Tab Contents -->
        <div class="crm-tab-content active" id="crm-tab-lead">
          <div id="crm-lead-container">
            <div class="crm-empty">
              <div class="crm-empty-icon">💬</div>
              <div class="crm-empty-text">Open a WhatsApp chat to see lead info</div>
            </div>
          </div>
        </div>

        <div class="crm-tab-content" id="crm-tab-followups">
          <div id="crm-followups-container">
            <div class="crm-empty">
              <div class="crm-empty-icon">📋</div>
              <div class="crm-empty-text">No pending follow-ups</div>
            </div>
          </div>
        </div>

        <div class="crm-tab-content" id="crm-tab-history">
          <div id="crm-history-container">
            <div class="crm-empty">
              <div class="crm-empty-icon">📜</div>
              <div class="crm-empty-text">No history yet</div>
            </div>
          </div>
        </div>

        <div class="crm-tab-content" id="crm-tab-settings">
          <div id="crm-settings-container">
            ${this.getSettingsHTML()}
          </div>
        </div>
      </div>

      <!-- Follow-up Modal -->
      <div class="crm-modal-overlay" id="crm-followup-modal">
        <div class="crm-modal">
          <div class="crm-modal-header">
            <h3 class="crm-modal-title">Add Follow-up</h3>
            <button class="crm-modal-close" id="crm-modal-close">✕</button>
          </div>
          <form id="crm-followup-form">
            <div class="crm-form-row">
              <div class="crm-form-group">
                <label class="crm-form-label">Date</label>
                <input type="date" class="crm-form-input" id="followup-date" required>
              </div>
              <div class="crm-form-group">
                <label class="crm-form-label">Time</label>
                <input type="time" class="crm-form-input" id="followup-time" required>
              </div>
            </div>
            <div class="crm-form-group">
              <label class="crm-form-label">Note (optional)</label>
              <textarea class="crm-form-input crm-form-textarea" id="followup-note" placeholder="Reason for follow-up, context, etc."></textarea>
            </div>
            <div class="crm-form-actions">
              <button type="button" class="crm-btn" id="followup-cancel-btn">Cancel</button>
              <button type="submit" class="crm-btn crm-btn-primary">Save Follow-up</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  /**
   * Get settings HTML
   */
  getSettingsHTML() {
    return `
      <div class="crm-settings-section">
        <div class="crm-settings-title">PC Configuration</div>
        <div class="crm-settings-item">
          <div class="crm-settings-info">
            <div class="crm-settings-label">PC Name</div>
            <div class="crm-settings-desc">Identify this computer</div>
          </div>
          <input type="text" class="crm-form-input" id="setting-pc-name" placeholder="e.g., Office-PC-1" style="width: 140px;">
        </div>
        <div class="crm-settings-item">
          <div class="crm-settings-info">
            <div class="crm-settings-label">Role</div>
            <div class="crm-settings-desc">Admin or Staff</div>
          </div>
          <select class="crm-select" id="setting-role">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="crm-settings-item">
          <div class="crm-settings-info">
            <div class="crm-settings-label">WhatsApp Number</div>
          </div>
          <input type="text" class="crm-form-input" id="setting-wa-number" placeholder="+91 98765 43210" style="width: 140px;">
        </div>
      </div>

      <div class="crm-settings-section">
        <div class="crm-settings-title">Notifications</div>
        <div class="crm-settings-item">
          <div class="crm-settings-info">
            <div class="crm-settings-label">Follow-up Reminders</div>
            <div class="crm-settings-desc">Get notified when due</div>
          </div>
          <label class="crm-toggle">
            <input type="checkbox" id="setting-notifications" checked>
            <span class="crm-toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="crm-settings-section">
        <div class="crm-settings-title">Google Sheets</div>
        <div class="crm-sheets-status">
          <span class="crm-sheets-status-dot" id="sheets-status-dot"></span>
          <span class="crm-sheets-status-text" id="sheets-status-text">Not connected</span>
          <button class="crm-btn crm-btn-sm" id="sheets-connect-btn">Connect</button>
        </div>
        <div class="crm-settings-item">
          <div class="crm-settings-info">
            <div class="crm-settings-label">Sheet ID</div>
          </div>
          <input type="text" class="crm-form-input" id="setting-sheet-id" placeholder="From URL" style="width: 140px;">
        </div>
      </div>

      <div class="crm-settings-section">
        <div class="crm-settings-title">Data</div>
        <div style="display: flex; gap: 8px;">
          <button class="crm-btn crm-btn-sm" id="export-data-btn" style="flex: 1;">📤 Export</button>
          <button class="crm-btn crm-btn-sm" id="import-data-btn" style="flex: 1;">📥 Import</button>
        </div>
        <input type="file" id="import-file-input" accept=".json" style="display: none;">
      </div>
    `;
  },

  /**
   * Cache DOM element references
   */
  cacheElements() {
    this.elements = {
      container: document.getElementById('whatsapp-crm-container'),
      floatingBtn: document.getElementById('crm-floating-btn'),
      fabBadge: document.getElementById('crm-fab-badge'),
      popupPanel: document.getElementById('crm-popup-panel'),
      closeBtn: document.getElementById('crm-close-btn'),
      refreshBtn: document.getElementById('crm-refresh-btn'),
      tabs: document.querySelectorAll('.crm-tab'),
      tabContents: document.querySelectorAll('.crm-tab-content'),
      leadContainer: document.getElementById('crm-lead-container'),
      followupsContainer: document.getElementById('crm-followups-container'),
      historyContainer: document.getElementById('crm-history-container'),
      settingsContainer: document.getElementById('crm-settings-container'),
      followupModal: document.getElementById('crm-followup-modal'),
      followupForm: document.getElementById('crm-followup-form'),
      badgeDue: document.getElementById('crm-badge-due'),
      badgePending: document.getElementById('crm-badge-pending'),
      badgeLeads: document.getElementById('crm-badge-leads')
    };
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Floating button click - toggle popup
    this.elements.floatingBtn?.addEventListener('click', () => this.togglePopup());

    // Close button
    this.elements.closeBtn?.addEventListener('click', () => this.closePopup());

    // Refresh button
    this.elements.refreshBtn?.addEventListener('click', () => this.refresh());

    // Tab switching
    this.elements.tabs?.forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Stat items click - switch to relevant tab
    document.getElementById('crm-stat-due')?.addEventListener('click', () => {
      this.switchTab('followups');
    });
    document.getElementById('crm-stat-pending')?.addEventListener('click', () => {
      this.switchTab('followups');
    });
    document.getElementById('crm-stat-leads')?.addEventListener('click', () => {
      this.switchTab('lead');
    });

    // Modal handlers
    document.getElementById('crm-modal-close')?.addEventListener('click', () => this.closeFollowUpModal());
    document.getElementById('followup-cancel-btn')?.addEventListener('click', () => this.closeFollowUpModal());

    // Click outside modal to close
    this.elements.followupModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.followupModal) {
        this.closeFollowUpModal();
      }
    });

    // Follow-up form submission
    this.elements.followupForm?.addEventListener('submit', (e) => this.handleFollowUpSubmit(e));

    // Lead detection events
    window.addEventListener('crm:chat-opened', (e) => this.handleChatOpened(e.detail.lead));
    window.addEventListener('crm:chat-closed', () => this.handleChatClosed());
    window.addEventListener('crm:followup-due', (e) => this.handleFollowUpDue(e.detail));

    // Settings handlers
    this.setupSettingsListeners();

    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen &&
          !this.elements.popupPanel?.contains(e.target) &&
          !this.elements.floatingBtn?.contains(e.target) &&
          !this.elements.followupModal?.contains(e.target)) {
        // Don't close if clicking on modal
        if (!e.target.closest('.crm-modal-overlay')) {
          this.closePopup();
        }
      }
    });
  },

  /**
   * Setup settings event listeners
   */
  setupSettingsListeners() {
    // PC Config - debounced save
    const pcNameInput = document.getElementById('setting-pc-name');
    const roleSelect = document.getElementById('setting-role');
    const waNumberInput = document.getElementById('setting-wa-number');

    const savePCConfig = CRMUtils.debounce(async () => {
      await CRMStorage.savePCConfig({
        pcName: pcNameInput?.value || '',
        role: roleSelect?.value || 'staff',
        whatsappNumber: waNumberInput?.value || ''
      });
      CRMUtils.log('PC config saved');
    }, 500);

    pcNameInput?.addEventListener('input', savePCConfig);
    roleSelect?.addEventListener('change', savePCConfig);
    waNumberInput?.addEventListener('input', savePCConfig);

    // Load current config
    this.loadSettings();

    // Notifications toggle
    document.getElementById('setting-notifications')?.addEventListener('change', async (e) => {
      await CRMStorage.updateSetting('notificationsEnabled', e.target.checked);
      CRMUtils.log('Notifications setting:', e.target.checked);
    });

    // Sheet ID
    document.getElementById('setting-sheet-id')?.addEventListener('input', CRMUtils.debounce(async (e) => {
      await CRMStorage.saveGoogleSheetId(e.target.value);
      CRMUtils.log('Sheet ID saved');
    }, 500));

    // Connect to Sheets
    document.getElementById('sheets-connect-btn')?.addEventListener('click', () => this.connectGoogleSheets());

    // Export
    document.getElementById('export-data-btn')?.addEventListener('click', () => this.exportData());

    // Import
    document.getElementById('import-data-btn')?.addEventListener('click', () => {
      document.getElementById('import-file-input')?.click();
    });
    document.getElementById('import-file-input')?.addEventListener('change', (e) => this.importData(e));
  },

  /**
   * Load settings into UI
   */
  async loadSettings() {
    try {
      const pcConfig = await CRMStorage.getPCConfig();
      const settings = await CRMStorage.getSettings();
      const sheetId = await CRMStorage.getGoogleSheetId();
      const syncStatus = await CRMStorage.getSyncStatus();

      const pcNameInput = document.getElementById('setting-pc-name');
      const roleSelect = document.getElementById('setting-role');
      const waNumberInput = document.getElementById('setting-wa-number');
      const notificationsInput = document.getElementById('setting-notifications');
      const sheetIdInput = document.getElementById('setting-sheet-id');

      if (pcNameInput) pcNameInput.value = pcConfig.pcName || '';
      if (roleSelect) roleSelect.value = pcConfig.role || 'staff';
      if (waNumberInput) waNumberInput.value = pcConfig.whatsappNumber || '';
      if (notificationsInput) notificationsInput.checked = settings.notificationsEnabled !== false;
      if (sheetIdInput) sheetIdInput.value = sheetId || '';

      // Update sheets status
      const statusDot = document.getElementById('sheets-status-dot');
      const statusText = document.getElementById('sheets-status-text');

      if (syncStatus.status === 'connected' || syncStatus.status === 'synced') {
        statusDot?.classList.add('connected');
        if (statusText) statusText.textContent = 'Connected';
      } else {
        statusDot?.classList.remove('connected');
        if (statusText) statusText.textContent = syncStatus.error || 'Not connected';
      }
    } catch (error) {
      CRMUtils.error('Failed to load settings:', error);
    }
  },

  /**
   * Toggle popup open/close
   */
  togglePopup() {
    if (this.isOpen) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  },

  /**
   * Open popup
   */
  openPopup() {
    this.isOpen = true;
    this.elements.popupPanel?.classList.add('open');
    this.elements.floatingBtn.style.display = 'none';

    // Load current tab content
    this.loadTabContent(this.currentTab);
  },

  /**
   * Close popup
   */
  closePopup() {
    this.isOpen = false;
    this.elements.popupPanel?.classList.remove('open');
    this.elements.floatingBtn.style.display = 'flex';
  },

  /**
   * Refresh data
   */
  async refresh() {
    await this.updateStats();
    await this.loadTabContent(this.currentTab);

    // Refresh current lead if detector has one
    if (window.LeadDetector?.getCurrentLead()) {
      await window.LeadDetector.refreshCurrentLead();
    }

    CRMUtils.log('Data refreshed');
  },

  /**
   * Switch tab
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    this.elements.tabs?.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab contents
    this.elements.tabContents?.forEach(content => {
      const contentTab = content.id.replace('crm-tab-', '');
      content.classList.toggle('active', contentTab === tabName);
    });

    // Load content for the tab
    this.loadTabContent(tabName);
  },

  /**
   * Load content for a specific tab
   */
  async loadTabContent(tabName) {
    switch (tabName) {
      case 'lead':
        if (this.currentLead) {
          await this.renderLeadCard(this.currentLead);
        }
        break;
      case 'followups':
        await this.loadFollowUps();
        break;
      case 'history':
        await this.loadHistory();
        break;
      case 'settings':
        await this.loadSettings();
        break;
    }
  },

  /**
   * Handle chat opened event
   */
  async handleChatOpened(lead) {
    this.currentLead = lead;

    if (this.currentTab === 'lead' && this.isOpen) {
      await this.renderLeadCard(lead);
    }

    await this.updateStats();
  },

  /**
   * Handle chat closed event
   */
  handleChatClosed() {
    this.currentLead = null;

    if (this.elements.leadContainer) {
      this.elements.leadContainer.innerHTML = `
        <div class="crm-empty">
          <div class="crm-empty-icon">💬</div>
          <div class="crm-empty-text">Open a WhatsApp chat to see lead info</div>
        </div>
      `;
    }
  },

  /**
   * Render lead card
   */
  async renderLeadCard(lead) {
    const statusInfo = CRMUtils.getStatusInfo(lead.status);
    const activeFollowUp = await CRMStorage.getActiveFollowUp(lead.phone);

    let followUpHtml = '';
    if (activeFollowUp) {
      const isDue = CRMUtils.isFollowUpDue(activeFollowUp.dateTime);
      followUpHtml = `
        <div class="crm-followup-section">
          <div class="crm-section-title">📅 Active Follow-up</div>
          <div class="crm-followup-item ${isDue ? 'due' : ''}">
            <div class="crm-followup-icon ${isDue ? 'due' : ''}">⏰</div>
            <div class="crm-followup-content">
              <div class="crm-followup-time">${CRMUtils.formatDateTime(activeFollowUp.dateTime)}</div>
              ${activeFollowUp.note ? `<div class="crm-followup-note">${CRMUtils.escapeHtml(activeFollowUp.note)}</div>` : ''}
              <div class="crm-followup-meta">
                ${CRMUtils.getRelativeTime(activeFollowUp.dateTime)} · by ${activeFollowUp.createdBy || 'Unknown'}
              </div>
            </div>
            <div class="crm-followup-actions">
              <button class="crm-followup-btn crm-followup-btn-done" data-phone="${lead.phone}" data-id="${activeFollowUp.id}">
                ✓ Done
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      followUpHtml = `
        <div class="crm-add-followup-card" id="add-followup-card">
          <div class="crm-add-followup-card-icon">📅</div>
          <div class="crm-add-followup-card-text">Click to schedule a follow-up</div>
        </div>
      `;
    }

    const html = `
      <div class="crm-lead-card">
        <div class="crm-lead-header">
          <div class="crm-lead-info">
            <div class="crm-lead-avatar">${CRMUtils.getInitials(lead.name)}</div>
            <div>
              <div class="crm-lead-name">${CRMUtils.escapeHtml(lead.name)}</div>
              <div class="crm-lead-phone">${CRMUtils.formatPhone(lead.phone)}</div>
            </div>
          </div>
          <select class="crm-status-select ${statusInfo.class}" id="lead-status-select">
            ${CRMUtils.getAllStatuses().map(s =>
              `<option value="${s.value}" ${s.value === lead.status ? 'selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
        </div>

        <div class="crm-lead-details">
          <div class="crm-detail-item">
            <div class="crm-detail-label">First Seen</div>
            <div class="crm-detail-value">${CRMUtils.formatDate(lead.firstSeenAt || lead.createdAt)}</div>
          </div>
          <div class="crm-detail-item">
            <div class="crm-detail-label">Last Seen</div>
            <div class="crm-detail-value">${CRMUtils.formatDate(lead.lastSeenAt || lead.updatedAt)}</div>
          </div>
          <div class="crm-detail-item">
            <div class="crm-detail-label">Source</div>
            <div class="crm-detail-value">${lead.source || 'WhatsApp'}</div>
          </div>
          <div class="crm-detail-item">
            <div class="crm-detail-label">Follow-ups</div>
            <div class="crm-detail-value">${(lead.followUpHistory?.length || 0)} done</div>
          </div>
        </div>
      </div>

      ${followUpHtml}
    `;

    this.elements.leadContainer.innerHTML = html;

    // Add event listeners for lead card
    this.attachLeadCardListeners(lead, activeFollowUp);
  },

  /**
   * Attach event listeners to lead card elements
   */
  attachLeadCardListeners(lead, activeFollowUp) {
    // Status change
    const statusSelect = document.getElementById('lead-status-select');
    statusSelect?.addEventListener('change', async (e) => {
      try {
        await CRMStorage.updateLeadStatus(lead.phone, e.target.value);
        lead.status = e.target.value;

        // Update the select styling
        const statusInfo = CRMUtils.getStatusInfo(e.target.value);
        statusSelect.className = `crm-status-select ${statusInfo.class}`;

        await this.updateStats();
        CRMUtils.log('Status updated to:', e.target.value);
      } catch (error) {
        CRMUtils.error('Failed to update status:', error);
        alert('Failed to update status');
      }
    });

    // Add follow-up card click
    const addFollowUpCard = document.getElementById('add-followup-card');
    addFollowUpCard?.addEventListener('click', () => this.openFollowUpModal());

    // Complete follow-up button
    const doneBtn = document.querySelector('.crm-followup-btn-done');
    doneBtn?.addEventListener('click', async (e) => {
      const phone = e.target.dataset.phone;
      const id = e.target.dataset.id;
      await this.completeFollowUp(phone, id);
    });
  },

  /**
   * Load all pending follow-ups
   */
  async loadFollowUps() {
    try {
      const leadsWithFollowUps = await CRMStorage.getLeadsWithPendingFollowUps();

      if (leadsWithFollowUps.length === 0) {
        this.elements.followupsContainer.innerHTML = `
          <div class="crm-empty">
            <div class="crm-empty-icon">📋</div>
            <div class="crm-empty-text">No pending follow-ups</div>
          </div>
        `;
        return;
      }

      // Collect all follow-ups
      const allFollowUps = [];
      leadsWithFollowUps.forEach(lead => {
        lead.followUps?.forEach(f => {
          if (!f.completed) {
            allFollowUps.push({ ...f, lead });
          }
        });
      });

      // Sort by date
      allFollowUps.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

      const html = `
        <div class="crm-followup-list">
          ${allFollowUps.map(f => {
            const isDue = CRMUtils.isFollowUpDue(f.dateTime);
            return `
              <div class="crm-followup-item ${isDue ? 'due' : ''}">
                <div class="crm-followup-icon ${isDue ? 'due' : ''}">📅</div>
                <div class="crm-followup-content">
                  <div class="crm-followup-time">
                    <strong>${CRMUtils.escapeHtml(f.lead.name)}</strong>
                  </div>
                  <div class="crm-followup-note">${CRMUtils.formatDateTime(f.dateTime)}</div>
                  ${f.note ? `<div class="crm-followup-note">${CRMUtils.escapeHtml(f.note)}</div>` : ''}
                  <div class="crm-followup-meta">
                    ${CRMUtils.getRelativeTime(f.dateTime)} · ${CRMUtils.formatPhone(f.lead.phone)}
                  </div>
                </div>
                <div class="crm-followup-actions">
                  <button class="crm-followup-btn crm-followup-btn-done" data-phone="${f.lead.phone}" data-id="${f.id}">
                    ✓ Done
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      this.elements.followupsContainer.innerHTML = html;

      // Add click handlers for done buttons
      this.elements.followupsContainer.querySelectorAll('.crm-followup-btn-done').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const phone = e.target.dataset.phone;
          const id = e.target.dataset.id;
          await this.completeFollowUp(phone, id);
        });
      });

    } catch (error) {
      CRMUtils.error('Failed to load follow-ups:', error);
    }
  },

  /**
   * Load history
   */
  async loadHistory() {
    try {
      const activityLog = await CRMStorage.getActivityLog(50);

      if (activityLog.length === 0) {
        this.elements.historyContainer.innerHTML = `
          <div class="crm-empty">
            <div class="crm-empty-icon">📜</div>
            <div class="crm-empty-text">No activity yet</div>
          </div>
        `;
        return;
      }

      const actionLabels = {
        'lead_created': '👤 New lead',
        'lead_updated': '✏️ Updated',
        'lead_deleted': '🗑️ Deleted',
        'status_changed': '🔄 Status',
        'followup_added': '📅 Follow-up added',
        'followup_completed': '✅ Completed',
        'data_imported': '📥 Imported',
        'data_cleared': '🗑️ Cleared'
      };

      const html = `
        <div class="crm-activity-log">
          ${activityLog.map(entry => `
            <div class="crm-activity-item">
              <div class="crm-activity-time">${CRMUtils.formatTime(entry.timestamp)}</div>
              <div class="crm-activity-text">
                ${actionLabels[entry.action] || entry.action}
                ${entry.data.name ? ` - ${CRMUtils.escapeHtml(entry.data.name)}` : ''}
                ${entry.data.oldStatus && entry.data.newStatus ? ` (${entry.data.oldStatus} → ${entry.data.newStatus})` : ''}
              </div>
              <div class="crm-activity-user">${entry.pcName}</div>
            </div>
          `).join('')}
        </div>
      `;

      this.elements.historyContainer.innerHTML = html;

    } catch (error) {
      CRMUtils.error('Failed to load history:', error);
    }
  },

  /**
   * Open follow-up modal
   */
  openFollowUpModal() {
    if (!this.currentLead) {
      alert('Please open a WhatsApp chat first');
      return;
    }

    // Reset form with today's date and current time
    const dateInput = document.getElementById('followup-date');
    const timeInput = document.getElementById('followup-time');
    const noteInput = document.getElementById('followup-note');

    if (dateInput) dateInput.value = CRMUtils.getTodayDate();
    if (timeInput) timeInput.value = CRMUtils.getCurrentTime();
    if (noteInput) noteInput.value = '';

    this.elements.followupModal?.classList.add('open');
  },

  /**
   * Close follow-up modal
   */
  closeFollowUpModal() {
    this.elements.followupModal?.classList.remove('open');
  },

  /**
   * Handle follow-up form submission
   */
  async handleFollowUpSubmit(e) {
    e.preventDefault();

    if (!this.currentLead) {
      alert('No lead selected');
      return;
    }

    const date = document.getElementById('followup-date')?.value;
    const time = document.getElementById('followup-time')?.value;
    const note = document.getElementById('followup-note')?.value;

    if (!date || !time) {
      alert('Please select date and time');
      return;
    }

    try {
      const dateTime = CRMUtils.combineDateAndTime(date, time);

      await CRMStorage.addFollowUp(this.currentLead.phone, {
        dateTime: dateTime.toISOString(),
        note: note || ''
      });

      this.closeFollowUpModal();
      await this.updateStats();

      // Refresh current lead display
      const updatedLead = await CRMStorage.getLead(this.currentLead.phone);
      if (updatedLead) {
        this.currentLead = updatedLead;
        if (this.currentTab === 'lead') {
          await this.renderLeadCard(updatedLead);
        }
      }

      CRMUtils.log('Follow-up added successfully');

    } catch (error) {
      alert(error.message || 'Failed to add follow-up');
      CRMUtils.error('Failed to add follow-up:', error);
    }
  },

  /**
   * Complete a follow-up
   */
  async completeFollowUp(phone, followUpId) {
    try {
      await CRMStorage.completeFollowUp(phone, followUpId);
      await this.updateStats();

      // Refresh views
      if (this.currentTab === 'followups') {
        await this.loadFollowUps();
      }

      if (this.currentLead?.phone === phone) {
        const updatedLead = await CRMStorage.getLead(phone);
        if (updatedLead) {
          this.currentLead = updatedLead;
          if (this.currentTab === 'lead') {
            await this.renderLeadCard(updatedLead);
          }
        }
      }

      CRMUtils.log('Follow-up completed');

    } catch (error) {
      alert('Failed to complete follow-up');
      CRMUtils.error('Failed to complete follow-up:', error);
    }
  },

  /**
   * Handle follow-up due event
   */
  handleFollowUpDue(data) {
    // Update FAB badge
    this.updateStats();
  },

  /**
   * Update statistics
   */
  async updateStats() {
    try {
      const stats = await CRMStorage.getStatistics();

      // Update panel stats
      if (this.elements.badgeDue) {
        this.elements.badgeDue.textContent = stats.dueFollowUps;
        this.elements.badgeDue.classList.toggle('danger', stats.dueFollowUps > 0);
      }
      if (this.elements.badgePending) {
        this.elements.badgePending.textContent = stats.pendingFollowUps;
      }
      if (this.elements.badgeLeads) {
        this.elements.badgeLeads.textContent = stats.totalLeads;
      }

      // Update FAB badge
      if (this.elements.fabBadge) {
        if (stats.dueFollowUps > 0) {
          this.elements.fabBadge.textContent = stats.dueFollowUps;
          this.elements.fabBadge.classList.remove('hidden');
        } else {
          this.elements.fabBadge.classList.add('hidden');
        }
      }

    } catch (error) {
      CRMUtils.error('Failed to update stats:', error);
    }
  },

  /**
   * Start follow-up checker interval
   */
  startFollowUpChecker() {
    // Check every minute for due follow-ups
    setInterval(async () => {
      await this.updateStats();
    }, 60000);
  },

  /**
   * Connect to Google Sheets
   */
  async connectGoogleSheets() {
    try {
      const btn = document.getElementById('sheets-connect-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Connecting...';
      }

      chrome.runtime.sendMessage({
        type: 'CONNECT_GOOGLE_SHEETS'
      }, (response) => {
        if (response?.success) {
          const statusDot = document.getElementById('sheets-status-dot');
          const statusText = document.getElementById('sheets-status-text');
          statusDot?.classList.add('connected');
          if (statusText) statusText.textContent = 'Connected';
          if (btn) btn.textContent = 'Connected';
          CRMUtils.log('Connected to Google Sheets');
        } else {
          alert('Failed to connect. Please check your settings.');
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Connect';
          }
        }
      });
    } catch (error) {
      CRMUtils.error('Failed to connect to Google Sheets:', error);
      alert('Failed to connect to Google Sheets');
    }
  },

  /**
   * Export CRM data
   */
  async exportData() {
    try {
      const data = await CRMStorage.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `whatsapp-crm-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      CRMUtils.log('Data exported successfully');
      alert('Data exported successfully!');
    } catch (error) {
      CRMUtils.error('Export failed:', error);
      alert('Failed to export data');
    }
  },

  /**
   * Import CRM data
   */
  async importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (confirm('This will merge imported data with existing data. Continue?')) {
        await CRMStorage.importData(data);
        await this.updateStats();
        alert('Data imported successfully!');
        CRMUtils.log('Data imported successfully');

        // Refresh current view
        await this.loadTabContent(this.currentTab);
      }
    } catch (error) {
      CRMUtils.error('Import failed:', error);
      alert('Failed to import data. Please check the file format.');
    }

    // Reset file input
    e.target.value = '';
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => CRMUI.init(), 1000);
  });
} else {
  setTimeout(() => CRMUI.init(), 1000);
}

// Make available globally
window.CRMUI = CRMUI;
