# Google Drive Bulk Ownership — Accept

Part of the Google Drive Ownership Transfer toolkit.

When ownership is transferred to you in Google Drive, items enter a "pending" state. They do not officially belong to you—and do not count against your storage—until you accept them. This guide covers the script that automates accepting thousands of pending transfers, handling subfolders, timeouts, and daily quotas.

## How It Works

- **Dual mode:** Scan your entire Drive for pending files or target a specific folder recursively.
- **Folder crawling:** In recursive mode, uses a queue to traverse subfolders and checks files for a "writer" role (indicating a pending transfer).
- **Persistence:** Saves page tokens and folder queue in `PropertiesService`; resumes exactly where it left off after the ~6-minute limit.
- **Quota management:** If Google's daily limit is hit, the script pauses for ~24 hours and resumes automatically.

## Prerequisites

- **Enable Drive API v3:**
  - In the Apps Script editor, click **Services (+)** in the left sidebar.
  - Select **Drive API**.
  - Ensure version is **v3**, then click **Add**.
- **Script properties (optional):**
  - Open **Settings** (gear icon) → **Script Properties**.
  - Add `ACCEPT_ROOT_FOLDER_ID` to limit acceptance to a specific folder ID; leave blank for a full-account scan.

## Setup Instructions

### Step 1: Initial authorization

- In the toolbar, select `acceptFiles` and click **Run**.
- Click **Review Permissions** and **Allow**.
- The script processes files for ~5.5 minutes, then stops safely.

### Step 2: Schedule the automation (trigger)

To process 10,000+ files reliably:

1. Open **Triggers** (alarm clock icon) in the left sidebar.
2. Click **+ Add Trigger**.
3. Function: `acceptFiles`
4. Event source: **Time-driven**
5. Type: **Minutes timer**
6. Interval: **Every 30 minutes**
7. Click **Save**.

## Monitoring & Logs

Check progress in **Executions** (list icon):

- `STATS: Processed X | Accepted: Y` — Normal operation.
- `QUOTA COOL-DOWN` — Daily limit hit; script waits ~24 hours.
- `TIMEOUT REACHED` — Saved state; resumes on the next trigger.

## Troubleshooting

| Issue | Cause | Solution |
| --- | --- | --- |
| Drive is not defined | Drive API Service not enabled. | Enable Drive API v3 (see Prerequisites). |
| Quota exceeded | Accepted too many files today (~2,500). | Wait; it resumes automatically tomorrow. |
| Script finishes instantly | No pending files found. | Confirm transfer invitations exist and folder scope is correct. |

## Resetting Progress

To start over from the beginning, run:

```javascript
function resetAcceptanceProgress() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('ACCEPT_PAGE_TOKEN');
  props.deleteProperty('ACCEPT_FOLDER_QUEUE');
  props.deleteProperty('ACCEPT_STATS_PROCESSED');
  props.deleteProperty('ACCEPT_STATS_ACCEPTED');
  props.deleteProperty('ACCEPT_STATS_ERRORS');
  console.log('Acceptance progress cleared.');
}
```

See the transfer-side guide in [TRANSFER.md](TRANSFER.md).