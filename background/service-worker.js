/**
 * WhatsApp CRM - Background Service Worker
 * Handles notifications, alarms, and Google Sheets sync
 */

// ==================== INITIALIZATION ====================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[CRM] Extension installed/updated:', details.reason);

  // Set up periodic alarm for checking follow-ups
  await chrome.alarms.create('check-followups', {
    periodInMinutes: 1
  });

  // Set up sync alarm
  await chrome.alarms.create('sync-sheets', {
    periodInMinutes: 5
  });

  // Request notification permission
  if (Notification.permission !== 'granted') {
    // Will be requested when user interacts
  }
});

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CRM] Message received:', message.type);

  switch (message.type) {
    case 'SCHEDULE_FOLLOWUP_ALARM':
      handleScheduleFollowUp(message.data).then(sendResponse);
      return true; // Keep channel open for async response

    case 'CONNECT_GOOGLE_SHEETS':
      handleGoogleSheetsConnect().then(sendResponse);
      return true;

    case 'SYNC_TO_SHEETS':
      handleSyncToSheets(message.data).then(sendResponse);
      return true;

    case 'GET_SHEETS_DATA':
      handleGetSheetsData().then(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// ==================== ALARM HANDLING ====================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[CRM] Alarm triggered:', alarm.name);

  switch (alarm.name) {
    case 'check-followups':
      await checkDueFollowUps();
      break;

    case 'sync-sheets':
      await syncToGoogleSheets();
      break;

    default:
      // Handle scheduled follow-up alarms
      if (alarm.name.startsWith('followup_')) {
        await handleFollowUpAlarm(alarm.name);
      }
  }
});

// ==================== FOLLOW-UP SCHEDULING ====================

async function handleScheduleFollowUp(data) {
  try {
    const { followUpId, phone, name, dateTime, note } = data;

    const alarmTime = new Date(dateTime).getTime();
    const now = Date.now();

    if (alarmTime <= now) {
      // Already due, trigger notification immediately
      await showFollowUpNotification(phone, name, note);
      return { success: true, immediate: true };
    }

    // Schedule alarm
    const alarmName = `followup_${followUpId}`;
    await chrome.alarms.create(alarmName, {
      when: alarmTime
    });

    console.log(`[CRM] Scheduled alarm ${alarmName} for ${new Date(alarmTime).toISOString()}`);
    return { success: true };

  } catch (error) {
    console.error('[CRM] Failed to schedule follow-up:', error);
    return { success: false, error: error.message };
  }
}

async function handleFollowUpAlarm(alarmName) {
  try {
    // Extract follow-up ID from alarm name
    const followUpId = alarmName.replace('followup_', '');

    // Get follow-up data from storage
    const result = await chrome.storage.local.get(['crm_leads']);
    const leads = result.crm_leads || {};

    // Find the follow-up
    for (const phone in leads) {
      const lead = leads[phone];
      if (lead.followUps) {
        const followUp = lead.followUps.find(f => f.id === followUpId);
        if (followUp && !followUp.completed) {
          await showFollowUpNotification(phone, lead.name, followUp.note);
          break;
        }
      }
    }

    // Clear the alarm
    await chrome.alarms.clear(alarmName);

  } catch (error) {
    console.error('[CRM] Error handling follow-up alarm:', error);
  }
}

async function checkDueFollowUps() {
  try {
    const result = await chrome.storage.local.get(['crm_leads', 'crm_settings']);
    const leads = result.crm_leads || {};
    const settings = result.crm_settings || { notificationsEnabled: true };

    if (!settings.notificationsEnabled) return;

    const now = Date.now();
    const dueFollowUps = [];

    for (const phone in leads) {
      const lead = leads[phone];
      if (lead.followUps) {
        lead.followUps.forEach(followUp => {
          if (!followUp.completed) {
            const followUpTime = new Date(followUp.dateTime).getTime();
            if (followUpTime <= now && !followUp.notified) {
              dueFollowUps.push({ phone, lead, followUp });
            }
          }
        });
      }
    }

    // Show notification for due follow-ups
    for (const { phone, lead, followUp } of dueFollowUps) {
      await showFollowUpNotification(phone, lead.name, followUp.note);

      // Mark as notified
      followUp.notified = true;

      // Update status to follow-up due
      if (lead.status !== 'followup-due') {
        lead.status = 'followup-due';
      }
    }

    // Save updated leads
    if (dueFollowUps.length > 0) {
      await chrome.storage.local.set({ crm_leads: leads });
    }

  } catch (error) {
    console.error('[CRM] Error checking due follow-ups:', error);
  }
}

// ==================== NOTIFICATIONS ====================

async function showFollowUpNotification(phone, name, note) {
  try {
    const notificationId = `followup_${phone}_${Date.now()}`;

    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon128.png'),
      title: 'Follow-up Due!',
      message: `${name || phone}${note ? ': ' + note : ''}`,
      priority: 2,
      requireInteraction: true,
      buttons: [
        { title: 'Open Chat' },
        { title: 'Mark Done' }
      ]
    });

    console.log('[CRM] Notification shown for:', name || phone);

  } catch (error) {
    console.error('[CRM] Failed to show notification:', error);
  }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith('followup_')) {
    // Open WhatsApp Web
    await chrome.tabs.create({
      url: 'https://web.whatsapp.com'
    });
  }
  chrome.notifications.clear(notificationId);
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('followup_')) {
    const phone = notificationId.split('_')[1];

    if (buttonIndex === 0) {
      // Open Chat - open WhatsApp Web
      await chrome.tabs.create({
        url: 'https://web.whatsapp.com'
      });
    } else if (buttonIndex === 1) {
      // Mark Done - complete the follow-up
      await completeFollowUpFromNotification(phone);
    }
  }
  chrome.notifications.clear(notificationId);
});

async function completeFollowUpFromNotification(phone) {
  try {
    const result = await chrome.storage.local.get(['crm_leads', 'crm_pc_config']);
    const leads = result.crm_leads || {};
    const pcConfig = result.crm_pc_config || {};

    const lead = leads[phone];
    if (!lead || !lead.followUps) return;

    // Find active follow-up
    const followUpIndex = lead.followUps.findIndex(f => !f.completed);
    if (followUpIndex === -1) return;

    const followUp = lead.followUps[followUpIndex];
    followUp.completed = true;
    followUp.completedAt = new Date().toISOString();
    followUp.completedBy = pcConfig.pcName || 'Unknown';

    // Move to history
    if (!lead.followUpHistory) {
      lead.followUpHistory = [];
    }
    lead.followUpHistory.unshift({
      ...followUp,
      movedToHistoryAt: new Date().toISOString()
    });

    // Remove from active
    lead.followUps.splice(followUpIndex, 1);

    // Update status
    if (lead.status === 'followup-due') {
      lead.status = 'contacted';
    }

    await chrome.storage.local.set({ crm_leads: leads });

    console.log('[CRM] Follow-up completed from notification:', phone);

  } catch (error) {
    console.error('[CRM] Failed to complete follow-up from notification:', error);
  }
}

// ==================== GOOGLE SHEETS INTEGRATION ====================

async function handleGoogleSheetsConnect() {
  try {
    // Get OAuth token using chrome.identity
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    if (token) {
      await chrome.storage.local.set({
        crm_sync_status: {
          status: 'connected',
          lastSync: new Date().toISOString(),
          error: null
        }
      });

      return { success: true, token };
    }

    return { success: false, error: 'No token received' };

  } catch (error) {
    console.error('[CRM] Google Sheets connect failed:', error);
    return { success: false, error: error.message };
  }
}

async function syncToGoogleSheets() {
  try {
    const result = await chrome.storage.local.get([
      'crm_leads',
      'crm_settings',
      'crm_google_sheet_id'
    ]);

    const settings = result.crm_settings || {};
    const sheetId = result.crm_google_sheet_id;

    if (!settings.autoSync || !sheetId) {
      return { success: false, reason: 'Auto-sync disabled or no sheet ID' };
    }

    // Get OAuth token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    // Prepare data for sheets
    const leads = result.crm_leads || {};
    const rows = Object.values(leads).map(lead => [
      lead.phone,
      lead.name,
      lead.status,
      lead.followUps?.[0]?.dateTime || '',
      lead.followUps?.[0]?.note || '',
      lead.followUpHistory?.length || 0,
      lead.createdAt,
      lead.updatedAt,
      lead.lastSeenAt
    ]);

    // Add header row
    const data = [
      ['Phone', 'Name', 'Status', 'Next Follow-up', 'Note', 'History Count', 'Created', 'Updated', 'Last Seen'],
      ...rows
    ];

    // Update sheet
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:I?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'Sheet1!A1:I',
          majorDimension: 'ROWS',
          values: data
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Sheets API error: ${response.status}`);
    }

    await chrome.storage.local.set({
      crm_sync_status: {
        status: 'synced',
        lastSync: new Date().toISOString(),
        error: null
      }
    });

    console.log('[CRM] Synced to Google Sheets');
    return { success: true };

  } catch (error) {
    console.error('[CRM] Sync to sheets failed:', error);

    await chrome.storage.local.set({
      crm_sync_status: {
        status: 'error',
        lastSync: new Date().toISOString(),
        error: error.message
      }
    });

    return { success: false, error: error.message };
  }
}

async function handleSyncToSheets(data) {
  return await syncToGoogleSheets();
}

async function handleGetSheetsData() {
  try {
    const result = await chrome.storage.local.get(['crm_google_sheet_id']);
    const sheetId = result.crm_google_sheet_id;

    if (!sheetId) {
      return { success: false, error: 'No sheet ID configured' };
    }

    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Sheets API error: ${response.status}`);
    }

    const sheetsData = await response.json();
    return { success: true, data: sheetsData.values };

  } catch (error) {
    console.error('[CRM] Get sheets data failed:', error);
    return { success: false, error: error.message };
  }
}

// ==================== CONTEXT MENU (Optional) ====================

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for quick actions
  chrome.contextMenus.create({
    id: 'crm-add-lead',
    title: 'Add to CRM',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'crm-add-lead' && info.selectionText) {
    // Send message to content script to add lead
    chrome.tabs.sendMessage(tab.id, {
      type: 'ADD_LEAD_FROM_SELECTION',
      text: info.selectionText
    });
  }
});

// ==================== BADGE UPDATES ====================

async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(['crm_leads']);
    const leads = result.crm_leads || {};

    let dueCount = 0;
    const now = Date.now();

    for (const phone in leads) {
      const lead = leads[phone];
      if (lead.followUps) {
        lead.followUps.forEach(followUp => {
          if (!followUp.completed) {
            const followUpTime = new Date(followUp.dateTime).getTime();
            if (followUpTime <= now) {
              dueCount++;
            }
          }
        });
      }
    }

    if (dueCount > 0) {
      await chrome.action.setBadgeText({ text: dueCount.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#DC3545' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }

  } catch (error) {
    console.error('[CRM] Failed to update badge:', error);
  }
}

// Update badge periodically
setInterval(updateBadge, 60000);

console.log('[CRM] Background service worker initialized');
