/**
 * Processes ownership transfers for a specific folder and all its subfolders.
 * Set ACCEPT_ROOT_FOLDER_ID in Script Properties to limit scope, or leave empty for Global.
 */
function acceptFiles() {
  const startTime = new Date().getTime();
  const myEmail = Session.getActiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();

  // CONFIG: Get Root Folder from Properties (Optional)
  const ROOT_FOLDER_ID = props.getProperty('ACCEPT_ROOT_FOLDER_ID');
  const suspendUntil = props.getProperty('SUSPEND_UNTIL');

  if (suspendUntil && new Date().getTime() < parseInt(suspendUntil)) {
    console.log("QUOTA COOL-DOWN: Script is paused until " + new Date(parseInt(suspendUntil)).toLocaleString());
    return;
  }

  // 1. Load saved state from previous run
  let pageToken = props.getProperty('ACCEPT_PAGE_TOKEN') || null;
  // Queue only used if ROOT_FOLDER_ID is specified
  let folderQueue = JSON.parse(props.getProperty('ACCEPT_FOLDER_QUEUE') || "[]");

  let stats = {
    totalProcessed: parseInt(props.getProperty('ACCEPT_STATS_PROCESSED') || '0'),
    totalAccepted: parseInt(props.getProperty('ACCEPT_STATS_ACCEPTED') || '0'),
    totalErrors: parseInt(props.getProperty('ACCEPT_STATS_ERRORS') || '0')
  };

  // Seed queue if starting fresh in Recursive Mode
  if (!pageToken && folderQueue.length === 0 && ROOT_FOLDER_ID) {
    folderQueue.push(ROOT_FOLDER_ID);
  }

  const BATCH_SIZE = 20;
  const TIMEOUT_LIMIT = 5.5 * 60 * 1000;

  console.log(`Mode: ${ROOT_FOLDER_ID ? "Recursive Folder" : "Global Drive"}. Accepted: ${stats.totalAccepted}`);

  do {
    if (new Date().getTime() - startTime > TIMEOUT_LIMIT) {
      saveAcceptState(pageToken, folderQueue, stats);
      console.log(`TIMEOUT: Progress saved. Will resume on next trigger.`);
      return;
    }

    // Determine Query
    let query = "trashed = false";
    if (ROOT_FOLDER_ID && folderQueue.length > 0) {
      query = `'${folderQueue[0]}' in parents and trashed = false`;
      console.log('query: ' + query);
    }

    try {
      const result = Drive.Files.list({
        q: query,
        fields: "nextPageToken, files(id, name, mimeType, capabilities(canAcceptOwnership), permissions(id, emailAddress, role))",
        pageToken: pageToken || null,
        pageSize: 60
      });

      const files = result.files;
      if (files && files.length > 0) {
        let currentBatch = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          // If in Recursive Mode, add subfolders to the queue
          if (ROOT_FOLDER_ID && file.mimeType === 'application/vnd.google-apps.folder') {
            folderQueue.push(file.id);
            console.log('Folder: ' + file.name);
          } else {
            console.log(file.name);
          }

          if (file.capabilities && file.capabilities.canAcceptOwnership === true) {
            const myPerm = file.permissions.find(p => p.emailAddress === myEmail);
            if (myPerm) {
              console.log('  ...accepting');
              currentBatch.push({
                fileId: file.id,
                permissionId: myPerm.id,
                name: file.name
              });
            }
          }

          if (currentBatch.length === BATCH_SIZE || (i === files.length - 1 && currentBatch.length > 0)) {
            processBatch(currentBatch, stats);
            currentBatch = [];
            Utilities.sleep(500);
          }
        }
      }

      pageToken = result.nextPageToken;

      // Handle Folder Transitions in Recursive Mode
      if (!pageToken && ROOT_FOLDER_ID) {
        folderQueue.shift(); // Remove finished folder
        if (folderQueue.length === 0) break; // Entire tree finished
        pageToken = null; // Start next folder from page 1
      }

    } catch (err) {
      if (err.message === "QUOTA_REACHED") {
        saveAcceptState(pageToken, folderQueue, stats);
        return;
      }
      console.error("API ERROR: " + err.message);
      saveAcceptState(pageToken, folderQueue, stats);
      return;
    }
  } while (pageToken || (ROOT_FOLDER_ID && folderQueue.length > 0));

  // 3. Cleanup
  props.deleteProperty('ACCEPT_PAGE_TOKEN');
  props.deleteProperty('ACCEPT_FOLDER_QUEUE');
  props.deleteProperty('ACCEPT_STATS_PROCESSED');
  props.deleteProperty('ACCEPT_STATS_ACCEPTED');
  props.deleteProperty('ACCEPT_STATS_ERRORS');
  console.log(`SUCCESS: Process complete. Final Accepted: ${stats.totalAccepted}`);
}

/**
 * Helper to execute the ownership upgrade. Uses for...of to allow 'throw'.
 */
function processBatch(batch, stats) {
  for (const item of batch) {
    try {
      Drive.Permissions.update(
        { role: 'owner' },
        item.fileId,
        item.permissionId,
        { transferOwnership: true }
      );
      stats.totalAccepted += 1;
      Utilities.sleep(200); // Individual file throttle
    } catch (e) {
      const msg = e.message.toLowerCase();
      if (msg.includes("quota") || msg.includes("limit")) {
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const resumeTime = new Date().getTime() + twentyFourHours;
        PropertiesService.getScriptProperties().setProperty('SUSPEND_UNTIL', resumeTime.toString());
        throw new Error("QUOTA_REACHED");
      }
      stats.totalErrors += 1;
      console.warn(`Skipped ${item.name}: ${e.message}`);
    }
    stats.totalProcessed += 1;
  }
}

/**
 * Persists the current state to PropertiesService.
 */
function saveAcceptState(token, queue, stats) {
  const props = PropertiesService.getScriptProperties();
  if (token) props.setProperty('ACCEPT_PAGE_TOKEN', token);
  props.setProperty('ACCEPT_FOLDER_QUEUE', JSON.stringify(queue));
  props.setProperty('ACCEPT_STATS_PROCESSED', stats.totalProcessed.toString());
  props.setProperty('ACCEPT_STATS_ACCEPTED', stats.totalAccepted.toString());
  props.setProperty('ACCEPT_STATS_ERRORS', stats.totalErrors.toString());
}
