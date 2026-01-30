/**
 * WhatsApp CRM - Utility Functions
 */

const CRMUtils = {
  /**
   * Generate a unique ID
   */
  generateId() {
    return 'crm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Format phone number for display
   */
  formatPhone(phone) {
    if (!phone) return '';
    // Remove all non-numeric characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    return cleaned;
  },

  /**
   * Normalize phone number for storage/comparison
   */
  normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-numeric characters
    return phone.replace(/\D/g, '');
  },

  /**
   * Format date for display
   */
  formatDate(date, options = {}) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };

    return d.toLocaleDateString('en-US', defaultOptions);
  },

  /**
   * Format time for display
   */
  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  },

  /**
   * Format date and time together
   */
  formatDateTime(date) {
    if (!date) return '';
    return `${this.formatDate(date)} at ${this.formatTime(date)}`;
  },

  /**
   * Get relative time (e.g., "2 hours ago", "in 3 days")
   */
  getRelativeTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins === 0) return 'now';

    const abs = Math.abs;
    const past = diffMs < 0;

    if (abs(diffMins) < 60) {
      const mins = abs(diffMins);
      return past ? `${mins}m ago` : `in ${mins}m`;
    }

    if (abs(diffHours) < 24) {
      const hours = abs(diffHours);
      return past ? `${hours}h ago` : `in ${hours}h`;
    }

    const days = abs(diffDays);
    return past ? `${days}d ago` : `in ${days}d`;
  },

  /**
   * Check if a follow-up is due
   */
  isFollowUpDue(followUpDateTime) {
    if (!followUpDateTime) return false;
    const d = new Date(followUpDateTime);
    return d.getTime() <= Date.now();
  },

  /**
   * Check if a follow-up is due soon (within 1 hour)
   */
  isFollowUpDueSoon(followUpDateTime) {
    if (!followUpDateTime) return false;
    const d = new Date(followUpDateTime);
    const diff = d.getTime() - Date.now();
    return diff > 0 && diff <= 3600000; // Within 1 hour
  },

  /**
   * Get status display info
   */
  getStatusInfo(status) {
    const statusMap = {
      'new': { label: 'New', class: 'crm-status-new', color: '#1976d2' },
      'contacted': { label: 'Contacted', class: 'crm-status-contacted', color: '#f57c00' },
      'followup-due': { label: 'Follow-Up Due', class: 'crm-status-followup-due', color: '#d32f2f' },
      'interested': { label: 'Interested', class: 'crm-status-interested', color: '#388e3c' },
      'not-interested': { label: 'Not Interested', class: 'crm-status-not-interested', color: '#757575' },
      'converted': { label: 'Converted', class: 'crm-status-converted', color: '#2e7d32' },
      'closed': { label: 'Closed', class: 'crm-status-closed', color: '#546e7a' }
    };

    return statusMap[status] || statusMap['new'];
  },

  /**
   * Get all available statuses
   */
  getAllStatuses() {
    return [
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'followup-due', label: 'Follow-Up Due' },
      { value: 'interested', label: 'Interested' },
      { value: 'not-interested', label: 'Not Interested' },
      { value: 'converted', label: 'Converted' },
      { value: 'closed', label: 'Closed' }
    ];
  },

  /**
   * Get initials from name
   */
  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Safe JSON parse
   */
  safeJSONParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return defaultValue;
    }
  },

  /**
   * Deep clone object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Create element with attributes
   */
  createElement(tag, attributes = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          el.dataset[dataKey] = dataValue;
        });
      } else {
        el.setAttribute(key, value);
      }
    });

    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    });

    return el;
  },

  /**
   * Show browser notification
   */
  async showNotification(title, options = {}) {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      return new Notification(title, {
        icon: chrome.runtime.getURL('assets/icon128.png'),
        badge: chrome.runtime.getURL('assets/icon48.png'),
        ...options
      });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return new Notification(title, {
          icon: chrome.runtime.getURL('assets/icon128.png'),
          ...options
        });
      }
    }
  },

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Get current time in HH:MM format
   */
  getCurrentTime() {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  },

  /**
   * Combine date and time strings into Date object
   */
  combineDateAndTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    return new Date(`${dateStr}T${timeStr}`);
  },

  /**
   * Log to console with CRM prefix
   */
  log(...args) {
    console.log('[WhatsApp CRM]', ...args);
  },

  /**
   * Log error with CRM prefix
   */
  error(...args) {
    console.error('[WhatsApp CRM Error]', ...args);
  },

  /**
   * Log warning with CRM prefix
   */
  warn(...args) {
    console.warn('[WhatsApp CRM Warning]', ...args);
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.CRMUtils = CRMUtils;
}
