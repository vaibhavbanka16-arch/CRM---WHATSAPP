/**
 * WhatsApp CRM - Lead Detector
 * Monitors WhatsApp Web for opened chats and extracts lead information
 *
 * IMPORTANT: This only READS metadata - no automation or message sending
 */

const LeadDetector = {
  // State
  currentLead: null,
  lastDetectedPhone: null,
  observer: null,
  isInitialized: false,

  // WhatsApp Web selectors (may need updates if WhatsApp changes their UI)
  // These are designed to be resilient to minor UI changes
  SELECTORS: {
    // Chat header area
    chatHeader: 'header[data-testid="conversation-header"], #main header, [data-testid="conversation-panel-header"]',

    // Phone number and name in header - multiple fallbacks
    contactName: '[data-testid="conversation-info-header-chat-title"], header span[title], header [role="button"] span',

    // Profile picture click area (for getting more info)
    profileClick: 'header [data-testid="contact-profile-picture"], header img[draggable="false"]',

    // Last message area
    lastMessage: '[data-testid="last-msg-status"], .message-in:last-child, .message-out:last-child',

    // Conversation panel
    conversationPanel: '#main, [data-testid="conversation-panel-wrapper"]',

    // Chat list for observing
    chatList: '#pane-side, [data-testid="chat-list"]',

    // Message container
    messageContainer: '[data-testid="conversation-panel-messages"], .copyable-area'
  },

  /**
   * Initialize the lead detector
   */
  async init() {
    if (this.isInitialized) return;

    CRMUtils.log('Initializing Lead Detector...');

    // Wait for WhatsApp Web to fully load
    await this.waitForWhatsApp();

    // Start observing DOM changes
    this.startObserver();

    // Initial detection
    this.detectCurrentChat();

    // Listen for URL changes (WhatsApp uses hash-based routing)
    window.addEventListener('hashchange', () => this.detectCurrentChat());

    // Periodic check as backup
    setInterval(() => this.detectCurrentChat(), 3000);

    this.isInitialized = true;
    CRMUtils.log('Lead Detector initialized');
  },

  /**
   * Wait for WhatsApp Web to be ready
   */
  async waitForWhatsApp() {
    return new Promise((resolve) => {
      const check = () => {
        const app = document.querySelector('#app');
        const chatList = document.querySelector(this.SELECTORS.chatList);

        if (app && chatList) {
          CRMUtils.log('WhatsApp Web is ready');
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  },

  /**
   * Start observing DOM for changes
   */
  startObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    // Observe the main app for changes
    const app = document.querySelector('#app');
    if (!app) return;

    this.observer = new MutationObserver(
      CRMUtils.debounce(() => {
        this.detectCurrentChat();
      }, 300)
    );

    this.observer.observe(app, {
      childList: true,
      subtree: true,
      attributes: false
    });
  },

  /**
   * Detect the currently open chat
   */
  async detectCurrentChat() {
    const chatInfo = this.extractChatInfo();

    if (!chatInfo) {
      if (this.currentLead) {
        this.currentLead = null;
        this.notifyChatClosed();
      }
      return;
    }

    // Only process if different from last detected
    if (chatInfo.phone && chatInfo.phone !== this.lastDetectedPhone) {
      this.lastDetectedPhone = chatInfo.phone;
      await this.processNewChat(chatInfo);
    }
  },

  /**
   * Extract chat information from the current view
   */
  extractChatInfo() {
    try {
      // Check if a chat is open
      const header = document.querySelector(this.SELECTORS.chatHeader);
      if (!header) return null;

      // Get contact name
      const nameElement = header.querySelector(this.SELECTORS.contactName);
      const name = nameElement?.textContent?.trim() || '';

      if (!name) return null;

      // Try to extract phone number
      // Method 1: From the contact name if it's a phone number
      let phone = this.extractPhoneFromText(name);

      // Method 2: From the header title attribute
      if (!phone) {
        const titleEl = header.querySelector('[title]');
        if (titleEl) {
          phone = this.extractPhoneFromText(titleEl.getAttribute('title'));
        }
      }

      // Method 3: From URL hash (WhatsApp sometimes includes phone in URL)
      if (!phone) {
        phone = this.extractPhoneFromUrl();
      }

      // Method 4: Check for phone in profile info area
      if (!phone) {
        phone = this.extractPhoneFromProfile();
      }

      // If still no phone, use name as identifier (for named contacts)
      // Generate a normalized key
      const identifier = phone || this.normalizeNameAsId(name);

      if (!identifier) return null;

      // Get last message timestamp (optional)
      const lastMessageTime = this.getLastMessageTime();

      return {
        phone: phone || '',
        name: name,
        identifier: identifier,
        lastMessageTime: lastMessageTime,
        detectedAt: new Date().toISOString()
      };
    } catch (error) {
      CRMUtils.error('Error extracting chat info:', error);
      return null;
    }
  },

  /**
   * Extract phone number from text
   */
  extractPhoneFromText(text) {
    if (!text) return null;

    // Remove all non-numeric characters except + at the beginning
    const cleaned = text.replace(/[^\d+]/g, '');

    // Check if it looks like a phone number (at least 10 digits)
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits;
    }

    return null;
  },

  /**
   * Extract phone from URL
   */
  extractPhoneFromUrl() {
    try {
      const hash = window.location.hash;
      // WhatsApp Web sometimes uses formats like #/chat/919876543210
      const match = hash.match(/(\d{10,15})/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  },

  /**
   * Try to extract phone from profile area
   */
  extractPhoneFromProfile() {
    try {
      // Look for phone patterns in various places
      const possibleElements = document.querySelectorAll(
        '[data-testid="conversation-info-header"] span, header span, [role="button"] span'
      );

      for (const el of possibleElements) {
        const phone = this.extractPhoneFromText(el.textContent);
        if (phone) return phone;
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Normalize name to use as identifier when phone is not available
   */
  normalizeNameAsId(name) {
    if (!name) return null;
    // Create a consistent ID from name
    return 'name_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50);
  },

  /**
   * Get last message timestamp
   */
  getLastMessageTime() {
    try {
      // Look for timestamp in messages
      const messages = document.querySelectorAll('[data-testid="msg-meta"] span, .message-time');
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        return lastMsg?.textContent?.trim() || null;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Process a newly detected chat
   */
  async processNewChat(chatInfo) {
    CRMUtils.log('New chat detected:', chatInfo.name);

    try {
      // Check if lead exists in storage
      let lead = await CRMStorage.getLead(chatInfo.identifier);

      if (!lead) {
        // Create new lead
        lead = {
          phone: chatInfo.phone || chatInfo.identifier,
          name: chatInfo.name,
          status: 'new',
          source: 'whatsapp-web',
          firstSeenAt: chatInfo.detectedAt,
          lastSeenAt: chatInfo.detectedAt
        };

        await CRMStorage.saveLead(lead);
        CRMUtils.log('New lead created:', lead.name);
      } else {
        // Update last seen
        lead.lastSeenAt = chatInfo.detectedAt;
        if (chatInfo.name && chatInfo.name !== lead.name) {
          lead.name = chatInfo.name; // Update name if changed
        }
        await CRMStorage.saveLead(lead);
      }

      // Update current lead reference
      this.currentLead = lead;

      // Notify UI
      this.notifyChatOpened(lead);

      // Check for due follow-ups
      this.checkDueFollowUps(lead);

    } catch (error) {
      CRMUtils.error('Error processing chat:', error);
    }
  },

  /**
   * Check if this lead has due follow-ups
   */
  async checkDueFollowUps(lead) {
    const activeFollowUp = await CRMStorage.getActiveFollowUp(lead.phone);

    if (activeFollowUp && CRMUtils.isFollowUpDue(activeFollowUp.dateTime)) {
      // Update lead status
      if (lead.status !== 'followup-due') {
        await CRMStorage.updateLeadStatus(lead.phone, 'followup-due');
        this.currentLead.status = 'followup-due';
      }

      // Notify UI about due follow-up
      window.dispatchEvent(new CustomEvent('crm:followup-due', {
        detail: {
          lead: this.currentLead,
          followUp: activeFollowUp
        }
      }));
    }
  },

  /**
   * Notify UI that a chat was opened
   */
  notifyChatOpened(lead) {
    window.dispatchEvent(new CustomEvent('crm:chat-opened', {
      detail: { lead }
    }));
  },

  /**
   * Notify UI that chat was closed
   */
  notifyChatClosed() {
    window.dispatchEvent(new CustomEvent('crm:chat-closed'));
  },

  /**
   * Get current lead
   */
  getCurrentLead() {
    return this.currentLead;
  },

  /**
   * Refresh current lead data
   */
  async refreshCurrentLead() {
    if (this.currentLead) {
      const lead = await CRMStorage.getLead(this.currentLead.phone);
      if (lead) {
        this.currentLead = lead;
        this.notifyChatOpened(lead);
      }
    }
  },

  /**
   * Cleanup
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isInitialized = false;
    CRMUtils.log('Lead Detector destroyed');
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LeadDetector.init());
} else {
  LeadDetector.init();
}

// Make available globally
window.LeadDetector = LeadDetector;
