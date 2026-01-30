/**
 * WhatsApp CRM - Storage Manager
 * Handles local storage, Chrome sync storage, and data management
 */

const CRMStorage = {
  // Storage keys
  KEYS: {
    LEADS: 'crm_leads',
    SETTINGS: 'crm_settings',
    PC_CONFIG: 'crm_pc_config',
    ACTIVITY_LOG: 'crm_activity_log',
    SYNC_STATUS: 'crm_sync_status',
    GOOGLE_SHEET_ID: 'crm_google_sheet_id'
  },

  // Default settings
  DEFAULT_SETTINGS: {
    notificationsEnabled: true,
    notificationSound: true,
    autoSync: true,
    syncInterval: 5, // minutes
    theme: 'light'
  },

  // Default PC config
  DEFAULT_PC_CONFIG: {
    pcName: '',
    role: 'staff', // 'admin' or 'staff'
    whatsappNumber: '',
    setupComplete: false
  },

  /**
   * Initialize storage
   */
  async init() {
    try {
      // Ensure default structures exist
      const leads = await this.getLeads();
      if (!leads) {
        await this.saveLeads({});
      }

      const settings = await this.getSettings();
      if (!settings) {
        await this.saveSettings(this.DEFAULT_SETTINGS);
      }

      const pcConfig = await this.getPCConfig();
      if (!pcConfig) {
        await this.savePCConfig(this.DEFAULT_PC_CONFIG);
      }

      CRMUtils.log('Storage initialized');
      return true;
    } catch (error) {
      CRMUtils.error('Storage init failed:', error);
      return false;
    }
  },

  /**
   * Generic get from Chrome storage
   */
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  },

  /**
   * Generic set to Chrome storage
   */
  async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  },

  // ==================== LEADS ====================

  /**
   * Get all leads
   */
  async getLeads() {
    return await this.get(this.KEYS.LEADS) || {};
  },

  /**
   * Save all leads
   */
  async saveLeads(leads) {
    return await this.set(this.KEYS.LEADS, leads);
  },

  /**
   * Get a single lead by phone number
   */
  async getLead(phone) {
    const normalizedPhone = CRMUtils.normalizePhone(phone);
    const leads = await this.getLeads();
    return leads[normalizedPhone] || null;
  },

  /**
   * Create or update a lead
   */
  async saveLead(lead) {
    const leads = await this.getLeads();
    const normalizedPhone = CRMUtils.normalizePhone(lead.phone);

    if (!leads[normalizedPhone]) {
      // New lead
      lead.id = CRMUtils.generateId();
      lead.createdAt = new Date().toISOString();
      lead.status = lead.status || 'new';
      lead.followUps = [];
      lead.followUpHistory = [];
      lead.notes = lead.notes || '';
    }

    lead.phone = normalizedPhone;
    lead.updatedAt = new Date().toISOString();
    leads[normalizedPhone] = lead;

    await this.saveLeads(leads);

    // Log activity
    if (!leads[normalizedPhone]?.id || lead.id === leads[normalizedPhone]?.id) {
      await this.logActivity('lead_updated', {
        phone: normalizedPhone,
        name: lead.name
      });
    } else {
      await this.logActivity('lead_created', {
        phone: normalizedPhone,
        name: lead.name
      });
    }

    return lead;
  },

  /**
   * Delete a lead
   */
  async deleteLead(phone) {
    const normalizedPhone = CRMUtils.normalizePhone(phone);
    const leads = await this.getLeads();

    if (leads[normalizedPhone]) {
      const leadName = leads[normalizedPhone].name;
      delete leads[normalizedPhone];
      await this.saveLeads(leads);
      await this.logActivity('lead_deleted', { phone: normalizedPhone, name: leadName });
      return true;
    }
    return false;
  },

  /**
   * Update lead status
   */
  async updateLeadStatus(phone, status) {
    const lead = await this.getLead(phone);
    if (lead) {
      const oldStatus = lead.status;
      lead.status = status;
      await this.saveLead(lead);
      await this.logActivity('status_changed', {
        phone: lead.phone,
        name: lead.name,
        oldStatus,
        newStatus: status
      });
      return lead;
    }
    return null;
  },

  /**
   * Get leads by status
   */
  async getLeadsByStatus(status) {
    const leads = await this.getLeads();
    return Object.values(leads).filter(lead => lead.status === status);
  },

  /**
   * Get all leads with pending follow-ups
   */
  async getLeadsWithPendingFollowUps() {
    const leads = await this.getLeads();
    return Object.values(leads).filter(lead =>
      lead.followUps && lead.followUps.length > 0 &&
      lead.followUps.some(f => !f.completed)
    );
  },

  /**
   * Get due follow-ups
   */
  async getDueFollowUps() {
    const leads = await this.getLeads();
    const dueFollowUps = [];

    Object.values(leads).forEach(lead => {
      if (lead.followUps) {
        lead.followUps.forEach(followUp => {
          if (!followUp.completed && CRMUtils.isFollowUpDue(followUp.dateTime)) {
            dueFollowUps.push({
              ...followUp,
              lead: {
                phone: lead.phone,
                name: lead.name,
                status: lead.status
              }
            });
          }
        });
      }
    });

    return dueFollowUps.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  },

  // ==================== FOLLOW-UPS ====================

  /**
   * Add a follow-up to a lead
   */
  async addFollowUp(phone, followUp) {
    const lead = await this.getLead(phone);
    if (!lead) return null;

    // Check if there's already an active follow-up
    const hasActiveFollowUp = lead.followUps && lead.followUps.some(f => !f.completed);
    if (hasActiveFollowUp) {
      throw new Error('Lead already has an active follow-up. Complete it first.');
    }

    followUp.id = CRMUtils.generateId();
    followUp.createdAt = new Date().toISOString();
    followUp.completed = false;
    followUp.createdBy = (await this.getPCConfig())?.pcName || 'Unknown';

    if (!lead.followUps) {
      lead.followUps = [];
    }
    lead.followUps.push(followUp);

    // Update status if needed
    if (lead.status === 'new') {
      lead.status = 'contacted';
    }

    await this.saveLead(lead);
    await this.logActivity('followup_added', {
      phone: lead.phone,
      name: lead.name,
      dateTime: followUp.dateTime,
      note: followUp.note
    });

    // Schedule notification
    await this.scheduleFollowUpNotification(followUp, lead);

    return followUp;
  },

  /**
   * Complete a follow-up
   */
  async completeFollowUp(phone, followUpId) {
    const lead = await this.getLead(phone);
    if (!lead || !lead.followUps) return null;

    const followUpIndex = lead.followUps.findIndex(f => f.id === followUpId);
    if (followUpIndex === -1) return null;

    const followUp = lead.followUps[followUpIndex];
    followUp.completed = true;
    followUp.completedAt = new Date().toISOString();
    followUp.completedBy = (await this.getPCConfig())?.pcName || 'Unknown';

    // Move to history
    if (!lead.followUpHistory) {
      lead.followUpHistory = [];
    }
    lead.followUpHistory.unshift({
      ...followUp,
      movedToHistoryAt: new Date().toISOString()
    });

    // Remove from active follow-ups
    lead.followUps.splice(followUpIndex, 1);

    // Update status
    if (lead.status === 'followup-due') {
      lead.status = 'contacted';
    }

    await this.saveLead(lead);
    await this.logActivity('followup_completed', {
      phone: lead.phone,
      name: lead.name,
      followUpId
    });

    return lead;
  },

  /**
   * Get active follow-up for a lead
   */
  async getActiveFollowUp(phone) {
    const lead = await this.getLead(phone);
    if (!lead || !lead.followUps) return null;
    return lead.followUps.find(f => !f.completed) || null;
  },

  /**
   * Schedule notification for follow-up
   */
  async scheduleFollowUpNotification(followUp, lead) {
    try {
      const dateTime = new Date(followUp.dateTime).getTime();
      const now = Date.now();

      if (dateTime > now) {
        // Send message to background script to schedule alarm
        chrome.runtime.sendMessage({
          type: 'SCHEDULE_FOLLOWUP_ALARM',
          data: {
            followUpId: followUp.id,
            phone: lead.phone,
            name: lead.name,
            dateTime: followUp.dateTime,
            note: followUp.note
          }
        });
      }
    } catch (error) {
      CRMUtils.error('Failed to schedule notification:', error);
    }
  },

  // ==================== SETTINGS ====================

  /**
   * Get settings
   */
  async getSettings() {
    return await this.get(this.KEYS.SETTINGS) || this.DEFAULT_SETTINGS;
  },

  /**
   * Save settings
   */
  async saveSettings(settings) {
    return await this.set(this.KEYS.SETTINGS, { ...this.DEFAULT_SETTINGS, ...settings });
  },

  /**
   * Update a single setting
   */
  async updateSetting(key, value) {
    const settings = await this.getSettings();
    settings[key] = value;
    return await this.saveSettings(settings);
  },

  // ==================== PC CONFIG ====================

  /**
   * Get PC configuration
   */
  async getPCConfig() {
    return await this.get(this.KEYS.PC_CONFIG) || this.DEFAULT_PC_CONFIG;
  },

  /**
   * Save PC configuration
   */
  async savePCConfig(config) {
    config.setupComplete = !!(config.pcName && config.role);
    return await this.set(this.KEYS.PC_CONFIG, { ...this.DEFAULT_PC_CONFIG, ...config });
  },

  /**
   * Check if current user is admin
   */
  async isAdmin() {
    const config = await this.getPCConfig();
    return config?.role === 'admin';
  },

  // ==================== ACTIVITY LOG ====================

  /**
   * Get activity log
   */
  async getActivityLog(limit = 100) {
    const log = await this.get(this.KEYS.ACTIVITY_LOG) || [];
    return log.slice(0, limit);
  },

  /**
   * Log an activity
   */
  async logActivity(action, data = {}) {
    const log = await this.getActivityLog(500);
    const pcConfig = await this.getPCConfig();

    log.unshift({
      id: CRMUtils.generateId(),
      action,
      data,
      timestamp: new Date().toISOString(),
      pcName: pcConfig?.pcName || 'Unknown',
      role: pcConfig?.role || 'staff'
    });

    // Keep only last 500 entries
    if (log.length > 500) {
      log.length = 500;
    }

    await this.set(this.KEYS.ACTIVITY_LOG, log);
  },

  /**
   * Clear old activity logs (older than 30 days)
   */
  async cleanupActivityLog() {
    const log = await this.getActivityLog(1000);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const filtered = log.filter(entry => {
      return new Date(entry.timestamp).getTime() > thirtyDaysAgo;
    });

    await this.set(this.KEYS.ACTIVITY_LOG, filtered);
    return filtered.length;
  },

  // ==================== GOOGLE SHEETS ====================

  /**
   * Get Google Sheet ID
   */
  async getGoogleSheetId() {
    return await this.get(this.KEYS.GOOGLE_SHEET_ID);
  },

  /**
   * Save Google Sheet ID
   */
  async saveGoogleSheetId(sheetId) {
    return await this.set(this.KEYS.GOOGLE_SHEET_ID, sheetId);
  },

  /**
   * Get sync status
   */
  async getSyncStatus() {
    return await this.get(this.KEYS.SYNC_STATUS) || {
      lastSync: null,
      status: 'never',
      error: null
    };
  },

  /**
   * Update sync status
   */
  async updateSyncStatus(status) {
    return await this.set(this.KEYS.SYNC_STATUS, {
      ...status,
      lastSync: new Date().toISOString()
    });
  },

  // ==================== EXPORT/IMPORT ====================

  /**
   * Export all CRM data
   */
  async exportData() {
    return {
      leads: await this.getLeads(),
      settings: await this.getSettings(),
      pcConfig: await this.getPCConfig(),
      activityLog: await this.getActivityLog(1000),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  },

  /**
   * Import CRM data
   */
  async importData(data) {
    if (data.leads) {
      await this.saveLeads(data.leads);
    }
    if (data.settings) {
      await this.saveSettings(data.settings);
    }
    // Don't import PC config - keep local config

    await this.logActivity('data_imported', {
      leadsCount: Object.keys(data.leads || {}).length
    });

    return true;
  },

  /**
   * Clear all data (use with caution)
   */
  async clearAllData() {
    await chrome.storage.local.clear();
    await this.init();
    await this.logActivity('data_cleared', {});
    return true;
  },

  // ==================== STATISTICS ====================

  /**
   * Get CRM statistics
   */
  async getStatistics() {
    const leads = await this.getLeads();
    const leadsArray = Object.values(leads);

    const stats = {
      totalLeads: leadsArray.length,
      byStatus: {},
      pendingFollowUps: 0,
      dueFollowUps: 0,
      completedFollowUpsToday: 0
    };

    const today = new Date().toDateString();

    leadsArray.forEach(lead => {
      // Count by status
      stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1;

      // Count follow-ups
      if (lead.followUps) {
        lead.followUps.forEach(f => {
          if (!f.completed) {
            stats.pendingFollowUps++;
            if (CRMUtils.isFollowUpDue(f.dateTime)) {
              stats.dueFollowUps++;
            }
          }
        });
      }

      // Count completed today
      if (lead.followUpHistory) {
        lead.followUpHistory.forEach(f => {
          if (f.completedAt && new Date(f.completedAt).toDateString() === today) {
            stats.completedFollowUpsToday++;
          }
        });
      }
    });

    return stats;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.CRMStorage = CRMStorage;
}
