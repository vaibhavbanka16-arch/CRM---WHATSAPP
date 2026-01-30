/**
 * WhatsApp CRM - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadFollowUps();
  await loadPCInfo();
  setupEventListeners();
});

/**
 * Load statistics
 */
async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['crm_leads']);
    const leads = result.crm_leads || {};
    const leadsArray = Object.values(leads);

    let dueCount = 0;
    let pendingCount = 0;
    const now = Date.now();

    leadsArray.forEach(lead => {
      if (lead.followUps) {
        lead.followUps.forEach(followUp => {
          if (!followUp.completed) {
            pendingCount++;
            const followUpTime = new Date(followUp.dateTime).getTime();
            if (followUpTime <= now) {
              dueCount++;
            }
          }
        });
      }
    });

    document.getElementById('stat-due').textContent = dueCount;
    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-leads').textContent = leadsArray.length;

    // Update due count styling
    const dueElement = document.getElementById('stat-due');
    if (dueCount > 0) {
      dueElement.classList.add('danger');
    } else {
      dueElement.classList.remove('danger');
    }

  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

/**
 * Load upcoming follow-ups
 */
async function loadFollowUps() {
  try {
    const result = await chrome.storage.local.get(['crm_leads']);
    const leads = result.crm_leads || {};

    const allFollowUps = [];
    const now = Date.now();

    Object.values(leads).forEach(lead => {
      if (lead.followUps) {
        lead.followUps.forEach(followUp => {
          if (!followUp.completed) {
            const followUpTime = new Date(followUp.dateTime).getTime();
            allFollowUps.push({
              ...followUp,
              lead,
              isDue: followUpTime <= now
            });
          }
        });
      }
    });

    // Sort by date
    allFollowUps.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    // Take first 5
    const displayFollowUps = allFollowUps.slice(0, 5);

    const container = document.getElementById('followup-list');

    if (displayFollowUps.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <div>No pending follow-ups</div>
        </div>
      `;
      return;
    }

    container.innerHTML = displayFollowUps.map(f => `
      <div class="followup-item ${f.isDue ? 'due' : ''}">
        <div class="followup-icon ${f.isDue ? 'due' : ''}">📅</div>
        <div class="followup-content">
          <div class="followup-name">${escapeHtml(f.lead.name || f.lead.phone)}</div>
          <div class="followup-time">${formatDateTime(f.dateTime)} ${f.isDue ? '(Due!)' : ''}</div>
          ${f.note ? `<div class="followup-note">${escapeHtml(f.note)}</div>` : ''}
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Failed to load follow-ups:', error);
  }
}

/**
 * Load PC info
 */
async function loadPCInfo() {
  try {
    const result = await chrome.storage.local.get(['crm_pc_config', 'crm_sync_status']);
    const pcConfig = result.crm_pc_config || {};
    const syncStatus = result.crm_sync_status || {};

    // Update PC badge
    const badge = document.getElementById('pc-badge');
    if (pcConfig.role === 'admin') {
      badge.textContent = 'Admin';
      badge.classList.add('admin');
    } else {
      badge.textContent = pcConfig.pcName || 'Staff';
    }

    // Update sync status
    const statusDot = document.getElementById('sync-status-dot');
    const statusText = document.getElementById('sync-status-text');

    if (syncStatus.status === 'connected' || syncStatus.status === 'synced') {
      statusDot.classList.add('connected');
      const lastSync = syncStatus.lastSync ? formatRelativeTime(syncStatus.lastSync) : 'Never';
      statusText.textContent = `Synced ${lastSync}`;
    } else if (syncStatus.status === 'error') {
      statusDot.classList.remove('connected');
      statusText.textContent = 'Sync error';
    } else {
      statusDot.classList.remove('connected');
      statusText.textContent = 'Not connected';
    }

  } catch (error) {
    console.error('Failed to load PC info:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Open WhatsApp Web
  document.getElementById('open-whatsapp-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    window.close();
  });

  // Sync to Google Sheets
  document.getElementById('sync-btn').addEventListener('click', async () => {
    const btn = document.getElementById('sync-btn');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>Syncing...</span>';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_TO_SHEETS' });

      if (response?.success) {
        btn.innerHTML = '<span>✅</span><span>Synced!</span>';
        await loadPCInfo();
      } else {
        btn.innerHTML = '<span>❌</span><span>Sync Failed</span>';
      }
    } catch (error) {
      console.error('Sync failed:', error);
      btn.innerHTML = '<span>❌</span><span>Sync Failed</span>';
    }

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<span>🔄</span><span>Sync to Google Sheets</span>';
    }, 2000);
  });
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
