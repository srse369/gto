/**
 * Transfers ownership of all files owned by the current user to a new email.
 * Optimized for 2025 with Drive API v3 syntax and 6-minute timeout protection.
 */
function transferAllOwnedFiles() {
  const startTime = new Date().getTime();
  const props = PropertiesService.getScriptProperties();
  const NEW_OWNER_EMAIL = props.getProperty('NEW_OWNER_EMAIL');
  if (!NEW_OWNER_EMAIL) {
    console.error("ERROR: NEW_OWNER_EMAIL property is not set.");
    return;
  }
  
  // 1. Load saved state
  let pageToken = props.getProperty('TRANSFER_PAGE_TOKEN');
  let stats = {
    processed: parseInt(props.getProperty('TRANSFER_PROCESSED') || '0'),
    sent: parseInt(props.getProperty('TRANSFER_SENT') || '0')
  };

  const TIMEOUT_LIMIT = 5.5 * 60 * 1000; // 5.5 minute safety exit

  console.log(`Resuming transfer. Already processed: ${stats.processed}. Sent: ${stats.sent}`);

  do {
    // 2. Timeout Check
    if (new Date().getTime() - startTime > TIMEOUT_LIMIT) {
      saveTransferState(pageToken, stats);
      console.log(`TIMEOUT: Saving progress. Total sent so far: ${stats.sent}`);
      return;
    }

    try {
      const result = Drive.Files.list({
        // FIX: Correct v3 syntax for files owned by you
        q: "'me' in owners and trashed = false", 
        fields: "nextPageToken, files(id, name)",
        pageToken: pageToken,
        pageSize: 50
      });

      const files = result.files;
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            // 3. Initiate Transfer
            // This creates a new permission as 'writer' and sets the pending owner flag
            Drive.Permissions.create(
              { 
                role: 'owner', 
                type: 'user', 
                emailAddress: NEW_OWNER_EMAIL 
              }, 
              file.id, 
              { 
                transferOwnership: true, 
                sendNotificationEmail: false // Set to true if you want the recipient to get an email
              }
            );
            stats.sent++;
            Utilities.sleep(250); // Throttle to prevent rate limit errors
          } catch (e) {
            // Logs files that cannot be transferred (e.g., cross-domain, or folder permissions)
            console.warn(`Skipped ${file.name}: ${e.message}`);
          }
          stats.processed++;
        }
      }
      pageToken = result.nextPageToken;
      props.setProperty('TRANSFER_PAGE_TOKEN', pageToken || ""); // Save token after every page
    } catch (err) {
      console.error("Critical API Error: " + err.message);
      saveTransferState(pageToken, stats);
      return;
    }
  } while (pageToken);

  // 4. Final Cleanup
  props.deleteProperty('TRANSFER_PAGE_TOKEN');
  props.deleteProperty('TRANSFER_PROCESSED');
  props.deleteProperty('TRANSFER_SENT');
  console.log(`SUCCESS: Finished all items. Total transfer requests sent: ${stats.sent}`);
}

function saveTransferState(token, stats) {
  const props = PropertiesService.getScriptProperties();
  if (token) props.setProperty('TRANSFER_PAGE_TOKEN', token);
  props.setProperty('TRANSFER_PROCESSED', stats.processed.toString());
  props.setProperty('TRANSFER_SENT', stats.sent.toString());
}
