/**
 * Processes ownership transfers in batches with a 6-minute timeout protection.
 * Optimized for 10,000+ files. Use a Time-Driven Trigger to run this every 15-30 mins.
 */
function batchAcceptOwnership() {
  const startTime = new Date().getTime();
  const myEmail = Session.getActiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();
  const suspendUntil = props.getProperty('SUSPEND_UNTIL');  
  
  // 0. Check if we are currently in a quota cooldown period
  if (suspendUntil && new Date().getTime() < parseInt(suspendUntil)) {
    console.log("QUOTA COOL-DOWN: Script is paused until " + new Date(parseInt(suspendUntil)).toLocaleString());
    return; 
  }

  // 1. Load saved state from previous run
  let pageToken = props.getProperty('LAST_PAGE_TOKEN');
  let stats = {
    totalProcessed: parseInt(props.getProperty('STATS_PROCESSED') || '0'),
    totalAccepted: parseInt(props.getProperty('STATS_ACCEPTED') || '0'),
    totalErrors: parseInt(props.getProperty('STATS_ERRORS') || '0')
  };
  
  const BATCH_SIZE = 20;
  const TIMEOUT_LIMIT = 5.5 * 60 * 1000; // 5.5 minutes safety exit

  console.log(`Resuming process. Already Accepted: ${stats.totalAccepted}`);

  do {
    // 2. Check for Execution Time Limit
    if (new Date().getTime() - startTime > TIMEOUT_LIMIT) {
      saveState(pageToken, stats);
      console.log(`TIMEOUT REACHED: Saved progress at page token. Will resume on next trigger.`);
      return; 
    }

    try {
      const result = Drive.Files.list({
        q: "trashed = false", 
        fields: "nextPageToken, files(id, name, permissions(id, emailAddress, role))",
        pageToken: pageToken,
        pageSize: 60 
      });

      const files = result.files;
      if (files && files.length > 0) {
        let currentBatch = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.permissions) continue;

          const myPerm = file.permissions.find(p => p.emailAddress === myEmail);
          
          if (myPerm && myPerm.role === 'writer') {
            currentBatch.push({
              fileId: file.id,
              permissionId: myPerm.id,
              name: file.name
            });
          }

          // Process batch once it hits BATCH_SIZE or end of the page
          if (currentBatch.length === BATCH_SIZE || (i === files.length - 1 && currentBatch.length > 0)) {
            processBatch(currentBatch, stats);
            currentBatch = []; // Reset batch

            console.log(`STATS: Processed: ${stats.totalProcessed} | Accepted: ${stats.totalAccepted}`);
            
            // Safety throttle between batches
            Utilities.sleep(500); 
          }
        }
      }
      pageToken = result.nextPageToken;
      props.setProperty('LAST_PAGE_TOKEN', pageToken || ""); // Update token after every successful page

    } catch (err) {
      if (err.message === "QUOTA_REACHED") {
        console.error("QUOTA STOP: Daily limit reached. Script will pause for 24h.");
        saveState(pageToken, stats);
        return; 
      }
      console.error("API ERROR: " + err.message);
      saveState(pageToken, stats);
      return;
    }
  } while (pageToken);

  // 3. Cleanup ONLY state properties, keep SUSPEND_UNTIL if it exists
  props.deleteProperty('LAST_PAGE_TOKEN');
  props.deleteProperty('STATS_PROCESSED');
  props.deleteProperty('STATS_ACCEPTED');
  props.deleteProperty('STATS_ERRORS');
  console.log(`SUCCESS: All items processed. Final Accepted: ${stats.totalAccepted}`);
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
function saveState(token, stats) {
  const props = PropertiesService.getScriptProperties();
  if (token) props.setProperty('LAST_PAGE_TOKEN', token);
  props.setProperty('STATS_PROCESSED', stats.totalProcessed.toString());
  props.setProperty('STATS_ACCEPTED', stats.totalAccepted.toString());
  props.setProperty('STATS_ERRORS', stats.totalErrors.toString());
}

