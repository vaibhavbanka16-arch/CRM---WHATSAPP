/**
 * WhatsApp CRM - Main UI Component
 * Injects the CRM panel into WhatsApp Web
 */

const CRMUI = {
  // State
  isExpanded: false,
  currentTab: 'lead',
  currentLead: null,
  elements: {},

  /**
   * Initialize the CRM UI
   */
  async init() {
    CRMUtils.log('Initializing CRM UI...');

    // Initialize storage
    await CRMStorage.init();

    // Check if PC setup is complete
    const pcConfig = await CRMStorage.getPCConfig();
    if (!pcConfig.setupComplete) {
      // Will prompt for setup on first expand
    }

    // Create and inject the CRM container
    this.createCRMContainer();

    // Setup event listeners
    this.setupEventListeners();

    // Update stats
    await this.updateStats();

    // Add body class for CSS adjustments
    document.body.classList.add('crm-active');

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

    const container = CRMUtils.createElement('div', { id: 'whatsapp-crm-container' });

    // Create top bar
    container.innerHTML = this.getTopBarHTML();

    // Create expanded panel
    const panel = CRMUtils.createElement('div', { id: 'crm-panel' });
    panel.innerHTML = this.getPanelHTML();
    container.appendChild(panel);

    // Insert at the very top of body
    document.body.insertBefore(container, document.body.firstChild);

    // Cache element references
    this.cacheElements();
  },

  /**
   * Get top bar HTML
   */
  getTopBarHTML() {
    return `
      <div id="crm-topbar">
        <div class="crm-brand" id="crm-toggle-panel">
          <div class="crm-brand-icon">CRM</div>
          <span class="crm-brand-title">WhatsApp CRM</span>
        </div>

        <div class="crm-quick-stats" id="crm-quick-stats">
          <div class="crm-stat" id="crm-stat-due" title="Due Follow-ups">
            <span>🔔</span>
            <span>Due</span>
            <span class="crm-stat-badge danger" id="crm-badge-due">0</span>
          </div>
          <div class="crm-stat" id="crm-stat-pending" title="Pending Follow-ups">
            <span>📋</span>
            <span>Pending</span>
            <span class="crm-stat-badge" id="crm-badge-pending">0</span>
          </div>
          <div class="crm-stat" id="crm-stat-leads" title="Total Leads">
            <span>👥</span>
            <span>Leads</span>
            <span class="crm-stat-badge" id="crm-badge-leads">0</span>
          </div>
        </div>

        <div class="crm-actions">
          <button class="crm-btn crm-btn-primary" id="crm-add-followup-btn" title="Add Follow-up" disabled>
            <span>➕</span>
            <span>Follow-up</span>
          </button>
          <button class="crm-btn crm-btn-icon" id="crm-settings-btn" title="Settings">
            ⚙️
          </button>
          <button class="crm-btn crm-btn-icon" id="crm-expand-btn" title="Expand/Collapse">
            ▼
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Get expanded panel HTML
   */
  getPanelHTML() {
    return `
      <div class="crm-tabs">
        <button class="crm-tab active" data-tab="lead">Current Lead</button>
        <button class="crm-tab" data-tab="followups">Follow-ups</button>
        <button class="crm-tab" data-tab="history">History</button>
        <button class="crm-tab" data-tab="settings">Settings</button>
      </div>

      <!-- Lead Tab -->
      <div class="crm-tab-content active" id="crm-tab-lead">
        <div id="crm-lead-container">
          <div class="crm-empty">
            <div class="crm-empty-icon">💬</div>
            <div class="crm-empty-text">Open a WhatsApp chat to see lead info</div>
          </div>
        </div>
      </div>

      <!-- Follow-ups Tab -->
      <div class="crm-tab-content" id="crm-tab-followups">
        <div id="crm-followups-container">
          <div class="crm-empty">
            <div class="crm-empty-icon">📋</div>
            <div class="crm-empty-text">No pending follow-ups</div>
          </div>
        </div>
      </div>

      <!-- History Tab -->
      <div class="crm-tab-content" id="crm-tab-history">
        <div id="crm-history-container">
          <div class="crm-empty">
            <div class="crm-empty-icon">📜</div>
            <div class="crm-empty-text">No history yet</div>
          </div>
        </div>
      </div>

      <!-- Settings Tab -->
      <div class="crm-tab-content" id="crm-tab-settings">
        <div id="crm-settings-container">
          ${this.getSettingsHTML()}
        </div>
      </div>

      <!-- Add Follow-up Modal -->
      <div class="crm-modal-overlay" id="crm-followup-modal">
        <div class="crm-modal">
          <div class="crm-modal-header">
            <h3 class="crm-modal-title">Add Follow-up</h3>
            <button class="crm-modal-close" id="crm-modal-close">✕</button>
          </div>
          <div id="crm-followup-form-container">
            ${this.getFollowUpFormHTML()}
          </div>
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
        <h4 class="crm-settings-title">PC Configuration</h4>
        <div class="crm-settings-item">
          <div>
            <div class="crm-settings-label">PC Name</div>
            <div class="crm-settings-desc">Identify this computer in activity logs</div>
          </div>
          <input type="text" class="crm-form-input" id="setting-pc-name" placeholder="e.g., Office-PC-1" style="width: 200px;">
        </div>
        <div class="crm-settings-item">
          <div>
            <div class="crm-settings-label">Role</div>
            <div class="crm-settings-desc">Admin can view all data, Staff has limited access</div>
          </div>
          <select class="crm-select" id="setting-role">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="crm-settings-item">
          <div>
            <div class="crm-settings-label">WhatsApp Number</div>
            <div class="crm-settings-desc">The WhatsApp number used on this PC</div>
          </div>
          <input type="text" class="crm-form-input" id="setting-wa-number" placeholder="e.g., +91 98765 43210" style="width: 200px;">
        </div>
      </div>

      <div class="crm-settings-section">
        <h4 class="crm-settings-title">Notifications</h4>
        <div class="crm-settings-item">
          <div>
            <div class="crm-settings-label">Follow-up Reminders</div>
            <div class="crm-settings-desc">Get notified when follow-ups are due</div>
          </div>
          <label class="crm-toggle">
            <input type="checkbox" id="setting-notifications" checked>
            <span class="crm-toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="crm-settings-section">
        <h4 class="crm-settings-title">Google Sheets Sync</h4>
        <div class="crm-sheets-status" id="sheets-status">
          <span class="crm-sheets-status-dot" id="sheets-status-dot"></span>
          <span class="crm-sheets-status-text" id="sheets-status-text">Not connected</span>
          <button class="crm-btn" id="sheets-connect-btn">Connect</button>
        </div>
        <div class="crm-settings-item" style="margin-top: 12px;">
          <div>
            <div class="crm-settings-label">Sheet ID</div>
            <div class="crm-settings-desc">Enter your Google Sheet ID for syncing</div>
          </div>
          <input type="text" class="crm-form-input" id="setting-sheet-id" placeholder="Sheet ID from URL" style="width: 250px;">
        </div>
      </div>

      <div class="crm-settings-section">
        <h4 class="crm-settings-title">Data Management</h4>
        <div class="crm-settings-item">
          <div>
            <div class="crm-settings-label">Export Data</div>
            <div class="crm-settings-desc">Download all CRM data as JSON</div>
          </div>
          <button class="crm-btn" id="export-data-btn">Export</button>
        </div>
        <div class="crm-settings-item">
          <div>
            <div class="crm-settings-label">Import Data</div>
            <div class="crm-settings-desc">Import CRM data from JSON file</div>
          </div>
          <button class="crm-btn" id="import-data-btn">Import</button>
          <input type="file" id="import-file-input" accept=".json" style="display: none;">
        </div>
      </div>
    `;
  },

  /**
   * Get follow-up form HTML
   */
  getFollowUpFormHTML() {
    const today = CRMUtils.getTodayDate();
    const currentTime = CRMUtils.getCurrentTime();

    return `
      <form id="crm-followup-form">
        <div class="crm-form-row">
          <div class="crm-form-group">
            <label class="crm-form-label">Date</label>
            <input type="date" class="crm-form-input" id="followup-date" value="${today}" required>
          </div>
          <div class="crm-form-group">
            <label class="crm-form-label">Time</label>
            <input type="time" class="crm-form-input" id="followup-time" value="${currentTime}" required>
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
    `;
  },

  /**
   * Cache DOM element references
   */
  cacheElements() {
    this.elements = {
      container: document.getElementById('whatsapp-crm-container'),
      topbar: document.getElementById('crm-topbar'),
      panel: document.getElementById('crm-panel'),
      toggleBtn: document.getElementById('crm-toggle-panel'),
      expandBtn: document.getElementById('crm-expand-btn'),
      addFollowupBtn: document.getElementById('crm-add-followup-btn'),
      settingsBtn: document.getElementById('crm-settings-btn'),
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
    // Toggle panel
    this.elements.toggleBtn?.addEventListener('click', () => this.togglePanel());
    this.elements.expandBtn?.addEventListener('click', () => this.togglePanel());

    // Tab switching
    this.elements.tabs?.forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Add follow-up button
    this.elements.addFollowupBtn?.addEventListener('click', () => this.openFollowUpModal());

    // Settings button
    this.elements.settingsBtn?.addEventListener('click', () => {
      this.expandPanel();
      this.switchTab('settings');
    });

    // Modal close
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
  },

  /**
   * Setup settings event listeners
   */
  setupSettingsListeners() {
    // PC Config
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
    });

    // Sheet ID
    document.getElementById('setting-sheet-id')?.addEventListener('input', CRMUtils.debounce(async (e) => {
      await CRMStorage.saveGoogleSheetId(e.target.value);
    }, 500));

    // Connect to Sheets
    document.getElementById('sheets-connect-btn')?.addEventListener('click', () => this.connectGoogleSheets());

    // Export/Import
    document.getElementById('export-data-btn')?.addEventListener('click', () => this.exportData());
    document.getElementById('import-data-btn')?.addEventListener('click', () => {
      document.getElementById('import-file-input')?.click();
    });
    document.getElementById('import-file-input')?.addEventListener('change', (e) => this.importData(e));
  },

  /**
   * Load settings into UI
   */
  async loadSettings() {
    const pcConfig = await CRMStorage.getPCConfig();
    const settings = await CRMStorage.getSettings();
    const sheetId = await CRMStorage.getGoogleSheetId();

    document.getElementById('setting-pc-name').value = pcConfig.pcName || '';
    document.getElementById('setting-role').value = pcConfig.role || 'staff';
    document.getElementById('setting-wa-number').value = pcConfig.whatsappNumber || '';
    document.getElementById('setting-notifications').checked = settings.notificationsEnabled !== false;
    document.getElementById('setting-sheet-id').value = sheetId || '';
  },

  /**
   * Toggle panel expand/collapse
   */
  togglePanel() {
    if (this.isExpanded) {
      this.collapsePanel();
    } else {
      this.expandPanel();
    }
  },

  /**
   * Expand panel
   */
  expandPanel() {
    this.isExpanded = true;
    this.elements.panel?.classList.add('open');
    this.elements.topbar?.classList.add('expanded');
    document.body.classList.add('crm-expanded');
    this.elements.expandBtn.textContent = '▲';
  },

  /**
   * Collapse panel
   */
  collapsePanel() {
    this.isExpanded = false;
    this.elements.panel?.classList.remove('open');
    this.elements.topbar?.classList.remove('expanded');
    document.body.classList.remove('crm-expanded');
    this.elements.expandBtn.textContent = '▼';
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
          this.renderLeadCard(this.currentLead);
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
    this.elements.addFollowupBtn.disabled = false;

    if (this.currentTab === 'lead') {
      this.renderLeadCard(lead);
    }

    await this.updateStats();
  },

  /**
   * Handle chat closed event
   */
  handleChatClosed() {
    this.currentLead = null;
    this.elements.addFollowupBtn.disabled = true;

    this.elements.leadContainer.innerHTML = `
      <div class="crm-empty">
        <div class="crm-empty-icon">💬</div>
        <div class="crm-empty-text">Open a WhatsApp chat to see lead info</div>
      </div>
    `;
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
        <div class="crm-followup-item ${isDue ? 'due' : ''}">
          <div class="crm-followup-icon ${isDue ? 'due' : ''}">📅</div>
          <div class="crm-followup-content">
            <div class="crm-followup-time">${CRMUtils.formatDateTime(activeFollowUp.dateTime)}</div>
            ${activeFollowUp.note ? `<div class="crm-followup-note">${CRMUtils.escapeHtml(activeFollowUp.note)}</div>` : ''}
            <div class="crm-followup-meta">
              ${CRMUtils.getRelativeTime(activeFollowUp.dateTime)} · Created by ${activeFollowUp.createdBy || 'Unknown'}
            </div>
          </div>
          <div class="crm-followup-actions">
            <button class="crm-followup-btn crm-followup-btn-done" data-phone="${lead.phone}" data-id="${activeFollowUp.id}">
              ✓ Done
            </button>
          </div>
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
            <div class="crm-detail-value">${(lead.followUpHistory?.length || 0)} completed</div>
          </div>
        </div>
      </div>

      ${activeFollowUp ? `
        <div class="crm-followup-form">
          <div class="crm-form-title">Active Follow-up</div>
          ${followUpHtml}
        </div>
      ` : `
        <div class="crm-followup-form">
          <div class="crm-form-title">No Active Follow-up</div>
          <button class="crm-btn crm-btn-primary" id="add-followup-inline-btn" style="width: 100%;">
            ➕ Schedule Follow-up
          </button>
        </div>
      `}
    `;

    this.elements.leadContainer.innerHTML = html;

    // Add event listeners
    document.getElementById('lead-status-select')?.addEventListener('change', async (e) => {
      await CRMStorage.updateLeadStatus(lead.phone, e.target.value);
      lead.status = e.target.value;
      this.renderLeadCard(lead);
      await this.updateStats();
    });

    document.getElementById('add-followup-inline-btn')?.addEventListener('click', () => {
      this.openFollowUpModal();
    });

    // Complete follow-up button
    document.querySelector('.crm-followup-btn-done')?.addEventListener('click', async (e) => {
      const phone = e.target.dataset.phone;
      const id = e.target.dataset.id;
      await this.completeFollowUp(phone, id);
    });
  },

  /**
   * Load all pending follow-ups
   */
  async loadFollowUps() {
    const dueFollowUps = await CRMStorage.getDueFollowUps();
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

    // Sort by follow-up date
    const allFollowUps = [];
    leadsWithFollowUps.forEach(lead => {
      lead.followUps?.forEach(f => {
        if (!f.completed) {
          allFollowUps.push({ ...f, lead });
        }
      });
    });

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
                  <strong>${CRMUtils.escapeHtml(f.lead.name)}</strong> - ${CRMUtils.formatDateTime(f.dateTime)}
                </div>
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

    // Add click handlers
    this.elements.followupsContainer.querySelectorAll('.crm-followup-btn-done').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const phone = e.target.dataset.phone;
        const id = e.target.dataset.id;
        await this.completeFollowUp(phone, id);
      });
    });
  },

  /**
   * Load history
   */
  async loadHistory() {
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
      'lead_updated': '✏️ Lead updated',
      'lead_deleted': '🗑️ Lead deleted',
      'status_changed': '🔄 Status changed',
      'followup_added': '📅 Follow-up scheduled',
      'followup_completed': '✅ Follow-up completed',
      'data_imported': '📥 Data imported',
      'data_cleared': '🗑️ Data cleared'
    };

    const html = `
      <div class="crm-activity-log">
        ${activityLog.map(entry => `
          <div class="crm-activity-item">
            <div class="crm-activity-time">${CRMUtils.formatDateTime(entry.timestamp)}</div>
            <div class="crm-activity-text">
              ${actionLabels[entry.action] || entry.action}
              ${entry.data.name ? ` - <strong>${CRMUtils.escapeHtml(entry.data.name)}</strong>` : ''}
              ${entry.data.oldStatus && entry.data.newStatus ? ` (${entry.data.oldStatus} → ${entry.data.newStatus})` : ''}
            </div>
            <div class="crm-activity-user">${entry.pcName}</div>
          </div>
        `).join('')}
      </div>
    `;

    this.elements.historyContainer.innerHTML = html;
  },

  /**
   * Open follow-up modal
   */
  openFollowUpModal() {
    if (!this.currentLead) {
      alert('Please open a WhatsApp chat first');
      return;
    }

    // Reset form
    document.getElementById('followup-date').value = CRMUtils.getTodayDate();
    document.getElementById('followup-time').value = CRMUtils.getCurrentTime();
    document.getElementById('followup-note').value = '';

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

    const date = document.getElementById('followup-date').value;
    const time = document.getElementById('followup-time').value;
    const note = document.getElementById('followup-note').value;

    if (!date || !time) {
      alert('Please select date and time');
      return;
    }

    try {
      const dateTime = CRMUtils.combineDateAndTime(date, time);

      await CRMStorage.addFollowUp(this.currentLead.phone, {
        dateTime: dateTime.toISOString(),
        note: note
      });

      this.closeFollowUpModal();
      await this.updateStats();

      // Refresh current lead display
      if (this.currentTab === 'lead') {
        const updatedLead = await CRMStorage.getLead(this.currentLead.phone);
        this.currentLead = updatedLead;
        this.renderLeadCard(updatedLead);
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
        this.currentLead = updatedLead;
        if (this.currentTab === 'lead') {
          this.renderLeadCard(updatedLead);
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
    // Show notification in UI
    this.elements.badgeDue?.classList.add('crm-notification-active');

    // Highlight the stat
    setTimeout(() => {
      this.elements.badgeDue?.classList.remove('crm-notification-active');
    }, 5000);
  },

  /**
   * Update statistics in top bar
   */
  async updateStats() {
    const stats = await CRMStorage.getStatistics();

    this.elements.badgeDue.textContent = stats.dueFollowUps;
    this.elements.badgePending.textContent = stats.pendingFollowUps;
    this.elements.badgeLeads.textContent = stats.totalLeads;

    // Update badge styles
    if (stats.dueFollowUps > 0) {
      this.elements.badgeDue.classList.add('danger');
    } else {
      this.elements.badgeDue.classList.remove('danger');
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
      // Send message to background script to initiate OAuth
      chrome.runtime.sendMessage({
        type: 'CONNECT_GOOGLE_SHEETS'
      }, (response) => {
        if (response?.success) {
          document.getElementById('sheets-status-dot').classList.add('connected');
          document.getElementById('sheets-status-text').textContent = 'Connected';
          document.getElementById('sheets-connect-btn').textContent = 'Reconnect';
        } else {
          alert('Failed to connect to Google Sheets. Please check your settings.');
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
    } catch (error) {
      CRMUtils.error('Export failed:', error);
      alert('Failed to export data');
    }
  },

  /**
   * Import CRM data
   */
  async importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (confirm('This will merge imported data with existing data. Continue?')) {
        await CRMStorage.importData(data);
        await this.updateStats();
        alert('Data imported successfully!');
        CRMUtils.log('Data imported successfully');
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
