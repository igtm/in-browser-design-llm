// Configure side panel behavior
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: any) => console.error('[Background] Error setting panel behavior:', error));
}

