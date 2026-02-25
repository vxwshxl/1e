// Allow opening side panel on extension icon click
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionIconClick: true })
    .catch((error) => console.error(error));

// Basic background tasks can be added here
chrome.runtime.onInstalled.addListener(() => {
    console.log("Galixent extension installed");
});
