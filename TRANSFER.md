# Google Drive Bulk Ownership — Transfer

Part of the Google Drive Ownership Transfer toolkit. Works only with personal accounts.

This documentation covers the setup and operation of the Resilient Ownership Transfer script, designed to handle 10,000+ items across an entire Drive or within a specific folder hierarchy.

## Overview

This script automates inviting a new owner to files you currently own. It is designed to run in the background via time-driven triggers, handling large migrations that exceed Google's ~6-minute execution limit and daily transfer quotas.

## Configuration (Script Properties)

Instead of hardcoding sensitive emails or folder IDs, the script reads configuration from Script Properties.

To set these up:

1. In the Apps Script editor, click **Settings** (gear icon) on the left.
2. Scroll down to **Script Properties**.
3. Add these keys:
   - `NEW_OWNER_EMAIL`: The recipient email (e.g., `user@example.com`).
   - `ROOT_FOLDER_ID` (optional): The folder ID to scope transfers. Leave blank for a full-account transfer.

## Installation

1. **Enable Drive API v3:** Click the **+** next to **Services** in the sidebar, select **Drive API**, ensure version **v3**, then click **Add**.
2. **Authorize:** Run `transferAllOwnedFiles` once manually and grant permissions.
3. **Set a trigger:**
   - Open **Triggers** (clock icon).
   - Click **+ Add Trigger**.
   - Function: `transferAllOwnedFiles`
   - Event: **Time-driven**
   - Type: **Minutes timer**
   - Interval: **Every 30 minutes**

## Operational Logic

- **Global mode:** If `ROOT_FOLDER_ID` is not set, the script finds every file you own anywhere in Drive.
- **Recursive mode:** If `ROOT_FOLDER_ID` is provided, the script performs a breadth‑first traversal: processes the folder, discovers subfolders, and queues them for sequential processing.
- **Throttling:** ~400ms delay plus API overhead keeps under the 10 requests/second rate limit.

## Daily Quotas & Cooldowns

- **Limits:** Google typically enforces ~2,500 items or ~750GB per 24‑hour period for ownership transfers.
- **If quota reached:** The script logs `QUOTA LIMIT` and stops.
- **Automatic resume:** Progress is saved; 30‑minute triggers idle until the 24‑hour window resets, then the next run resumes automatically.

## Recipient Instructions

The recipient will receive notifications for transfers and must accept them to finalize ownership. For bulk acceptance, see [ACCEPT.md](ACCEPT.md).

## Maintenance

To restart from scratch or clear a stuck queue, run:

```javascript
function clearAllProgress() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('TRANSFER_PAGE_TOKEN');
  props.deleteProperty('TRANSFER_FOLDER_QUEUE');
  props.deleteProperty('TRANSFER_PROCESSED');
  props.deleteProperty('TRANSFER_SENT');
  console.log('Memory cleared. Ready for a fresh run.');
}
```