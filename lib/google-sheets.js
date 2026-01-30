/**
 * WhatsApp CRM - Google Sheets Integration
 * Handles syncing CRM data with Google Sheets
 */

const GoogleSheetsSync = {
  // Sheet structure
  COLUMNS: {
    PHONE: 0,
    NAME: 1,
    STATUS: 2,
    NEXT_FOLLOWUP_DATE: 3,
    NEXT_FOLLOWUP_NOTE: 4,
    FOLLOWUP_HISTORY_COUNT: 5,
    CREATED_AT: 6,
    UPDATED_AT: 7,
    LAST_SEEN_AT: 8,
    LAST_SYNC_BY: 9,
    LAST_SYNC_AT: 10
  },

  HEADERS: [
    'Phone',
    'Name',
    'Status',
    'Next Follow-up Date',
    'Next Follow-up Note',
    'History Count',
    'Created At',
    'Updated At',
    'Last Seen At',
    'Last Sync By',
    'Last Sync At'
  ],

  /**
   * Get OAuth token
   */
  async getToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
  },

  /**
   * Get sheet ID from storage
   */
  async getSheetId() {
    const result = await chrome.storage.local.get(['crm_google_sheet_id']);
    return result.crm_google_sheet_id;
  },

  /**
   * Check if connected
   */
  async isConnected() {
    try {
      const token = await this.getToken();
      return !!token;
    } catch {
      return false;
    }
  },

  /**
   * Initialize sheet with headers if needed
   */
  async initializeSheet(sheetId, token) {
    try {
      // Check if sheet has headers
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:K1`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to read sheet: ${response.status}`);
      }

      const data = await response.json();

      // If no headers, add them
      if (!data.values || data.values.length === 0) {
        await this.writeHeaders(sheetId, token);
      }

      return true;
    } catch (error) {
      console.error('[CRM] Failed to initialize sheet:', error);
      throw error;
    }
  },

  /**
   * Write headers to sheet
   */
  async writeHeaders(sheetId, token) {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:K1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'Sheet1!A1:K1',
          majorDimension: 'ROWS',
          values: [this.HEADERS]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to write headers: ${response.status}`);
    }
  },

  /**
   * Sync leads to Google Sheets
   */
  async syncLeads(leads) {
    try {
      const token = await this.getToken();
      const sheetId = await this.getSheetId();

      if (!token || !sheetId) {
        throw new Error('Not connected to Google Sheets');
      }

      // Initialize sheet if needed
      await this.initializeSheet(sheetId, token);

      // Get PC config for sync attribution
      const pcResult = await chrome.storage.local.get(['crm_pc_config']);
      const pcConfig = pcResult.crm_pc_config || {};

      // Prepare data rows
      const rows = Object.values(leads).map(lead => {
        const activeFollowUp = lead.followUps?.find(f => !f.completed);
        return [
          lead.phone,
          lead.name || '',
          lead.status || 'new',
          activeFollowUp?.dateTime || '',
          activeFollowUp?.note || '',
          lead.followUpHistory?.length || 0,
          lead.createdAt || '',
          lead.updatedAt || '',
          lead.lastSeenAt || '',
          pcConfig.pcName || 'Unknown',
          new Date().toISOString()
        ];
      });

      // Clear existing data (except header) and write new data
      const range = `Sheet1!A2:K${rows.length + 1}`;

      // First clear existing data
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:K1000:clear`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // Then write new data
      if (rows.length > 0) {
        const writeResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              range,
              majorDimension: 'ROWS',
              values: rows
            })
          }
        );

        if (!writeResponse.ok) {
          throw new Error(`Failed to write data: ${writeResponse.status}`);
        }
      }

      // Update sync status
      await chrome.storage.local.set({
        crm_sync_status: {
          status: 'synced',
          lastSync: new Date().toISOString(),
          rowCount: rows.length,
          error: null
        }
      });

      return { success: true, rowCount: rows.length };

    } catch (error) {
      console.error('[CRM] Sync failed:', error);

      await chrome.storage.local.set({
        crm_sync_status: {
          status: 'error',
          lastSync: new Date().toISOString(),
          error: error.message
        }
      });

      throw error;
    }
  },

  /**
   * Import leads from Google Sheets
   */
  async importFromSheet() {
    try {
      const token = await this.getToken();
      const sheetId = await this.getSheetId();

      if (!token || !sheetId) {
        throw new Error('Not connected to Google Sheets');
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:K1000`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to read sheet: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      // Convert rows to leads
      const leads = {};
      rows.forEach(row => {
        const phone = row[this.COLUMNS.PHONE];
        if (phone) {
          leads[phone] = {
            phone,
            name: row[this.COLUMNS.NAME] || '',
            status: row[this.COLUMNS.STATUS] || 'new',
            followUps: row[this.COLUMNS.NEXT_FOLLOWUP_DATE] ? [{
              id: 'imported_' + Date.now() + '_' + phone,
              dateTime: row[this.COLUMNS.NEXT_FOLLOWUP_DATE],
              note: row[this.COLUMNS.NEXT_FOLLOWUP_NOTE] || '',
              completed: false,
              createdAt: new Date().toISOString(),
              createdBy: 'Sheet Import'
            }] : [],
            followUpHistory: [],
            createdAt: row[this.COLUMNS.CREATED_AT] || new Date().toISOString(),
            updatedAt: row[this.COLUMNS.UPDATED_AT] || new Date().toISOString(),
            lastSeenAt: row[this.COLUMNS.LAST_SEEN_AT] || null
          };
        }
      });

      return { success: true, leads, count: Object.keys(leads).length };

    } catch (error) {
      console.error('[CRM] Import failed:', error);
      throw error;
    }
  },

  /**
   * Append follow-up history to a dedicated history sheet
   */
  async appendToHistory(phone, name, followUp) {
    try {
      const token = await this.getToken();
      const sheetId = await this.getSheetId();

      if (!token || !sheetId) return;

      const pcResult = await chrome.storage.local.get(['crm_pc_config']);
      const pcConfig = pcResult.crm_pc_config || {};

      // Append to History sheet
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/History!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [[
              phone,
              name,
              followUp.dateTime,
              followUp.note || '',
              followUp.completedAt || '',
              followUp.completedBy || pcConfig.pcName || 'Unknown',
              new Date().toISOString()
            ]]
          })
        }
      );

    } catch (error) {
      console.error('[CRM] Failed to append history:', error);
      // Don't throw - this is not critical
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.GoogleSheetsSync = GoogleSheetsSync;
}
