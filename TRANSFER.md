# Google Drive Ownership Transfer Automation - Transfer

Part of the Google Drive Ownership Transfer toolkit.

This guide describes a Google Apps Script that helps offload a large volume of files (10,000+) to another account. Because Google Drive lacks a "Transfer All" button, the script iterates your "My Drive," identifies files you own, and invites the target email to take ownership.

## How It Works

- **Targeted search:** Finds only files where you are the current owner (`'me'` in `owners`).
- **Batch requests:** Sends ownership transfer invitations in batches of 50.
- **Resilience:** Persists progress with `PropertiesService`; resumes exactly where it left off if it hits the ~6-minute execution limit.
- **Safety throttling:** Adds a ~250ms delay between files to reduce rate-limit errors.

## Prerequisites

- **Same-domain requirement (2025):** Ownership transfers generally work only between accounts in the same organization (e.g., both `@company.com`) or between two personal `@gmail.com` accounts.
- **Enable Drive API v3 in Apps Script:**
  - Open your Apps Script project.
  - Click **Services (+)** in the left sidebar.
  - Add **Drive API** and ensure the version is **v3**.

## Setup Instructions

### Step 1: Configure the script

Replace the placeholder email in the code with the intended recipient:

```javascript
const NEW_OWNER_EMAIL = 'target-email@example.com';
```

### Step 2: Initial authorization

- In the toolbar, select `transferAllOwnedFiles` and click **Run**.
- Click **Review Permissions** and **Allow**.
- The script starts; for very large drives it will stop after ~5.5 minutes due to quotas and resume on the next run.

### Step 3: Schedule the automation (trigger)

To process all files without repeatedly clicking **Run**:

1. Open **Triggers** (alarm clock icon) in the left sidebar.
2. Click **+ Add Trigger**.
3. Choose function: `transferAllOwnedFiles`.
4. Set **Event source** to **Time-driven**.
5. Set **Type** to **Minutes timer**.
6. Set **Interval** to **Every 30 minutes**.
7. Click **Save**.

## Recipient Actions

When the script runs, the recipient will see many "Pending" ownership requests. They should use the acceptance helper described in [ACCEPT.md](ACCEPT.md) to finalize ownership transfers.

Note: If requests are not accepted, you remain the owner and files continue counting against your storage quota.

## Troubleshooting & Quotas

| Issue | Cause | Solution |
| --- | --- | --- |
| "Sharing quota exceeded" | Google's daily limit (approx. 2,500 transfers or 750GB) was reached. | Wait ~24 hours; the trigger will resume automatically. |
| "Cross-domain transfer not supported" | Attempting transfers from Business → Personal or across organizations. | Google blocks this; copy files instead of transferring ownership. |
| Script stops but says "Success" | No more files owned by you were found. | Check Drive; pending transfer invitations indicate work is complete. |

## Reset Progress

If you want the script to forget progress and start over from the first file, run:

```javascript
function resetProgress() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  console.log('Progress reset. Next run starts from file #1.');
}
```