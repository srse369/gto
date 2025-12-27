# Google Drive Ownership Transfer Automation - Accept

Part of the Google Drive Ownership Transfer toolkit.

This Google Apps Script automates accepting large numbers of pending ownership transfers in Google Drive. Because of Google API constraints (6‑minute execution limit and daily sharing quotas), the script uses a resilient pattern that saves progress and resumes automatically via scheduled triggers.

## Prerequisites

- **Google Account:** Works best with a Google Workspace account.
- **Google Apps Script Project:** A place to paste and run the code.
- **Advanced Drive API Enabled:** The script uses the Advanced Drive API service.

## 1. Script Code

Paste the complete script below into a new Google Apps Script project's `Code.gs` file.

> Note: Insert your full script here (from the prior message or source).

## 2. Setup and Configuration

### Step 2A: Enable the Drive API Service

The script needs access to the Advanced Drive Service to perform ownership updates.

1. In the Apps Script editor, click **Services** (the + icon) in the left sidebar.
2. Select **Drive API** from the list.
3. Ensure the **Version** is set to **v3**.
4. Click **Add**.

### Step 2B: Run Once to Authorize

You must manually run the function once to grant permission to access your Google Drive data and properties storage.

1. In the Apps Script editor, select the function `batchAcceptOwnership` from the dropdown at the top.
2. Click **Run**.
3. When prompted with "Authorization required," click **Review permissions**.
4. Select your Google account and click **Allow**. The script will run briefly and stop (authorization must be granted before it can find files).

## 3. Scheduling the Automation (Trigger)

To handle large batches (e.g., 10,000 files), the script needs to run repeatedly. Timeout logic ensures it stops safely after ~5.5 minutes and resumes on the next trigger run.

1. In the Apps Script editor, click **Triggers** (alarm clock icon) in the left sidebar.
2. Click **+ Add Trigger** (bottom right).
3. Configure the trigger:
	- **Function to run:** `batchAcceptOwnership`
	- **Event source:** Time-driven
	- **Type of time-based trigger:** Minutes timer
	- **Minute interval:** Every 30 minutes (safe and robust for large transfers)
4. Click **Save**.

The script is now fully automated. It will run every 30 minutes until all files are accepted.

## 4. Monitoring Progress and Troubleshooting

You can monitor the automation in the Executions log:

1. In the Apps Script editor, click **Executions** (list/play icon) in the left sidebar.
2. You will see entries for each run. Click an execution to see `console.log` stats.

### What to Look For

| Log Message | Meaning | Action Needed |
| --- | --- | --- |
| APPROACHING TIMEOUT: Saved progress... | Script stopped at ~5.5 minutes and saved its place. | None — next trigger run resumes automatically. |
| STATS: Processed X / Accepted: Y | Normal operation and progress report. | None. |
| QUOTA COOL-DOWN: Script is paused until... | Daily limit hit; script paused itself for 24 hours. | None — resumes automatically after 24 hours. |
| SUCCESS: Finished all items. | The script completed all ownership transfers. | Optional cleanup — you can delete the time-driven trigger. |
| Authorization required | Initial authorization missing. | Manually run once to authorize (see Step 2B). |