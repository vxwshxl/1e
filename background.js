// Basic background tasks can be added here
chrome.runtime.onInstalled.addListener(() => {
    console.log("Galixent extension installed");
});

// Remove invalid behavioral config that was breaking the service worker
// Setting default side panel is already done in manifest.json via action -> default_path
