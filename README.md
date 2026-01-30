# WhatsApp CRM - Follow-Up Manager

A lightweight Chrome Extension that adds a CRM layer on top of WhatsApp Web. Ensures no follow-up is ever missed, works across multiple PCs, and syncs with Google Sheets.

## Features

- **Non-Invasive CRM**: Runs as a top bar above WhatsApp Web - doesn't interfere with WhatsApp UI
- **Automatic Lead Detection**: Captures leads from opened WhatsApp chats
- **Follow-Up System**: Schedule and track follow-ups with notifications
- **Multi-PC Support**: Works across multiple PCs with role-based access (Admin/Staff)
- **Google Sheets Sync**: Real-time backup and sync with Google Sheets
- **Activity Logging**: Complete audit trail of all CRM activities
- **Safe & Stable**: Read-only access to WhatsApp - no automation, no risk of ban

## Installation

### 1. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `CRM---WHATSAPP` folder
5. The extension icon will appear in your toolbar

### 2. Generate Icons (First Time Only)

```bash
cd CRM---WHATSAPP
node scripts/generate-icons.js
```

### 3. Configure Google Sheets (Optional)

1. Create a Google Cloud Project at https://console.cloud.google.com
2. Enable the Google Sheets API
3. Create OAuth 2.0 credentials (Chrome App type)
4. Copy your Client ID
5. Update `manifest.json` - replace `YOUR_CLIENT_ID.apps.googleusercontent.com`
6. Create a new Google Sheet and copy its ID from the URL
7. Enter the Sheet ID in extension settings

## Usage

### First Time Setup

1. Open WhatsApp Web (https://web.whatsapp.com)
2. The CRM bar will appear at the top
3. Click the settings icon (⚙️)
4. Configure:
   - **PC Name**: Unique identifier for this computer (e.g., "Office-PC-1")
   - **Role**: Admin or Staff
   - **WhatsApp Number**: The number logged into this WhatsApp

### Managing Leads

1. Open any WhatsApp chat
2. The CRM automatically detects and creates a lead record
3. View lead details in the expanded panel
4. Update lead status using the dropdown

### Scheduling Follow-ups

1. Open a WhatsApp chat
2. Click "➕ Follow-up" button
3. Set date, time, and optional note
4. Click "Save Follow-up"

**Rules:**
- Each lead can have only ONE active follow-up
- Complete the current follow-up before adding a new one

### Follow-up Notifications

When a follow-up is due:
- Browser notification appears
- CRM badge shows count of due follow-ups
- Lead status changes to "Follow-Up Due"

### Completing Follow-ups

1. Click "✓ Done" on any follow-up
2. Follow-up moves to history
3. You can now schedule a new follow-up

## Lead Statuses

| Status | Description |
|--------|-------------|
| New | Just detected, not contacted yet |
| Contacted | Initial contact made |
| Follow-Up Due | Follow-up time has passed |
| Interested | Lead showed interest |
| Not Interested | Lead declined |
| Converted | Sale/goal completed |
| Closed | Lead closed (any reason) |

## Multi-PC Setup

### Recommended Setup

- **PC 1 (Admin)**: Full access to all leads and activities
- **PC 2 (Staff)**: Can manage assigned leads and follow-ups
- **PC 3 (Staff)**: Same as PC 2

### Role Permissions

**Admin:**
- View all leads and follow-ups
- Edit/delete any record
- View complete activity log
- Manage Google Sheet connection

**Staff:**
- Add and complete follow-ups
- View assigned leads
- Cannot delete history

## Google Sheets Integration

### Sheet Structure

The extension syncs to `Sheet1` with these columns:

| Column | Description |
|--------|-------------|
| Phone | Lead phone number |
| Name | Contact name |
| Status | Current lead status |
| Next Follow-up Date | Scheduled follow-up |
| Next Follow-up Note | Follow-up reason |
| History Count | Number of completed follow-ups |
| Created At | When lead was first seen |
| Updated At | Last update time |
| Last Seen At | Last time chat was opened |
| Last Sync By | PC that last synced |
| Last Sync At | Sync timestamp |

### Sync Behavior

- **Auto-sync**: Every 5 minutes (configurable)
- **Manual sync**: Click "Sync to Google Sheets" button
- **History**: Append-only to preserve audit trail

## File Structure

```
CRM---WHATSAPP/
├── manifest.json          # Chrome Extension manifest
├── assets/                # Icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
├── background/            # Service worker
│   └── service-worker.js
├── content/               # Content scripts
│   ├── lead-detector.js   # WhatsApp chat detection
│   └── crm-ui.js          # CRM panel UI
├── lib/                   # Shared libraries
│   ├── utils.js           # Utility functions
│   ├── storage.js         # Data management
│   └── google-sheets.js   # Sheets API wrapper
├── popup/                 # Extension popup
│   ├── popup.html
│   └── popup.js
├── styles/                # CSS
│   └── crm-panel.css
└── scripts/               # Build scripts
    └── generate-icons.js
```

## Data Storage

All data is stored locally using Chrome's `storage.local` API:

- **crm_leads**: Lead records indexed by phone number
- **crm_settings**: User preferences
- **crm_pc_config**: PC identification and role
- **crm_activity_log**: Activity history (last 500 entries)
- **crm_sync_status**: Google Sheets sync state
- **crm_google_sheet_id**: Connected sheet ID

## Safety & Privacy

This extension is designed to be completely safe:

- ✅ **Read-only**: Only reads chat metadata (name, phone, timestamp)
- ✅ **No automation**: Does not send messages or perform actions
- ✅ **No scraping**: Does not extract message content
- ✅ **Local storage**: Data stays on your computer
- ✅ **Optional sync**: Google Sheets sync is opt-in
- ❌ **No bulk operations**: Cannot target multiple contacts
- ❌ **No API abuse**: Uses only legitimate browser APIs

## Troubleshooting

### Extension Not Loading
- Ensure Developer Mode is enabled
- Check for errors in `chrome://extensions/`
- Reload the extension

### Leads Not Detecting
- Refresh WhatsApp Web
- Check if the extension is enabled
- Open Chrome DevTools (F12) and check for errors

### Notifications Not Working
- Allow notifications in Chrome settings
- Check notification permissions for the site

### Google Sheets Not Syncing
- Verify the Sheet ID is correct
- Re-authenticate if token expired
- Check Google Cloud Console for API errors

## Development

### Building Icons

```bash
node scripts/generate-icons.js
```

### Testing

1. Make changes to source files
2. Go to `chrome://extensions/`
3. Click reload icon on the extension
4. Refresh WhatsApp Web

### Adding Features

1. Content scripts run in WhatsApp Web context
2. Service worker handles background tasks
3. Use `chrome.runtime.sendMessage` for communication

## License

Private use only. Not for redistribution.

## Support

For issues and feature requests, please create an issue in this repository.

---

**A lightweight WhatsApp CRM that ensures no follow-up is ever missed, works across multiple PCs, syncs with Google Sheets, and survives WhatsApp UI changes.**
