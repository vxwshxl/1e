// Basic background tasks can be added here
chrome.runtime.onInstalled.addListener(() => {
    console.log("1e extension installed");
});

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
