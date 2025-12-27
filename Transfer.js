/**
 * Transfers ownership of all files owned by the current user to a new email.
 * Optimized for 2025 with Drive API v3 syntax and 6-minute timeout protection.
 */
function transferFiles() {
  const props = PropertiesService.getScriptProperties();
  const NEW_OWNER_EMAIL = props.getProperty('NEW_OWNER_EMAIL');
  if (!NEW_OWNER_EMAIL) {
    console.error("ERROR: NEW_OWNER_EMAIL property is not set.");
    return;
  }
  const ROOT_FOLDER_ID = props.getProperty('ROOT_FOLDER_ID'); // Optional: limit to a specific folder
  if (!ROOT_FOLDER_ID) {
    console.info("INFO: ROOT_FOLDER_ID property is not set.");
  }
  // 1. Load saved state
  let { pageToken, folderQueue, stats } = loadTransferState();

  const startTime = new Date().getTime();
  const TIMEOUT_LIMIT = 5.5 * 60 * 1000; // 5.5 minute safety exit

  // If we are starting fresh and have a folder ID, seed the queue
  if (!pageToken && folderQueue.length === 0 && ROOT_FOLDER_ID) {
    folderQueue.push(ROOT_FOLDER_ID);
    // We also transfer the parent folder itself first
    try {
      createPermissionWithRetry(ROOT_FOLDER_ID, NEW_OWNER_EMAIL);
      stats.sent++;
    } catch (e) {
      console.warn("Parent folder already pending or restricted");
    }
  }

  console.log(`Mode: ${ROOT_FOLDER_ID ? "Recursive Folder" : "Global Drive"}. Already processed: ${stats.processed}. Sent: ${stats.sent}`);

  do {
    // 2. Timeout Check
    if (new Date().getTime() - startTime > TIMEOUT_LIMIT) {
      saveTransferState(pageToken, folderQueue, stats);
      console.log(`TIMEOUT: Saving progress. Total sent so far: ${stats.sent}`);
      return;
    }

    // 3. Define the Search Query
    let query = "";
    if (ROOT_FOLDER_ID) {
      // Recursive Mode: Get items inside the current folder in the queue
      let currentFolderId = folderQueue[0];
      query = `'${currentFolderId}' in parents and trashed = false`;
    } else {
      // Global Mode: Get every file you own anywhere
      query = "'me' in owners and trashed = false";
    }

    try {
      const result = Drive.Files.list({
        q: query,
        fields: "nextPageToken, files(id, name, mimeType, owners)",
        pageToken: pageToken,
        pageSize: 50
      });

      const items = result.files;
      if (items && items.length > 0) {
        for (const item of items) {
          // If in Folder Mode, add subfolders to the queue
          if (ROOT_FOLDER_ID && item.mimeType === 'application/vnd.google-apps.folder') {
            folderQueue.push(item.id);
          }

          // Check ownership (always required to avoid API errors)
          const isOwner = item.owners && item.owners.some(o => o.me === true);
          if (isOwner) {
            try {
              transferItemRetry(item.id, NEW_OWNER_EMAIL);
              stats.sent++;
              Utilities.sleep(400); // 2025 Throttle
            } catch (e) {
              if (e.message.includes("quota")) throw new Error("QUOTA_REACHED");
              console.warn(`Skipped ${item.name}: ${e.message}`);
            }
            stats.processed++;
          }
        }
      }

      pageToken = result.nextPageToken;

      // If we finished a folder in Recursive Mode, move to the next folder in queue
      if (!pageToken && ROOT_FOLDER_ID) {
        folderQueue.shift();
        if (folderQueue.length === 0) break; // Finished everything
        pageToken = null; // Reset for next folder
      }
    } catch (err) {
      if (err.message === "QUOTA_REACHED" || err.message.includes("quota")) {
        console.error("QUOTA LIMIT: Stopping for today.");
        saveTransferState(pageToken, folderQueue, stats);
        return;
      }
      console.error("API Error: " + err.message);
      break;
    }
  } while (pageToken || (ROOT_FOLDER_ID && folderQueue.length > 0));

  // 4. Final Cleanup
  props.deleteProperty('TRANSFER_PAGE_TOKEN');
  props.deleteProperty('TRANSFER_FOLDER_QUEUE');
  props.deleteProperty('TRANSFER_PROCESSED');
  props.deleteProperty('TRANSFER_SENT');
  console.log(`SUCCESS: Process complete. Total transfer requests: ${stats.sent}`);
}

function transferItemRetry(fileId, email) {
  let retries = 0;
  const maxRetries = 1;

  while (retries < maxRetries) {
    try {
      return Drive.Permissions.create(
        { role: 'writer', type: 'user', emailAddress: email },
        fileId,
        { pendingOwner: true, sendNotificationEmail: true }
      );
    } catch (e) {
      if (e.message.includes("Internal Error") && retries < maxRetries - 1) {
        retries++;
        Utilities.sleep(Math.pow(2, retries) * 1000); // Wait 2s, then 4s...
        continue;
      }
      throw e; // Rethrow if it's a Quota error or after 3 failed retries
    }
  }
}

function loadTransferState() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty('TRANSFER_PAGE_TOKEN'),
    queue: JSON.parse(props.getProperty('TRANSFER_FOLDER_QUEUE') || "[]"),
    stats: {
      processed: parseInt(props.getProperty('TRANSFER_PROCESSED') || '0'),
      sent: parseInt(props.getProperty('TRANSFER_SENT') || '0')
    }
  };
}

function saveTransferState(token, folderQueue, stats) {
  const props = PropertiesService.getScriptProperties();
  if (token) props.setProperty('TRANSFER_PAGE_TOKEN', token);
  props.setProperty('TRANSFER_FOLDER_QUEUE', JSON.stringify(folderQueue));
  props.setProperty('TRANSFER_PROCESSED', stats.processed.toString());
  props.setProperty('TRANSFER_SENT', stats.sent.toString());
}
