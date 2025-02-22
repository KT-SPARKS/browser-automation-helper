// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const serverUrl = document.getElementById('serverUrl');
  const connectButton = document.getElementById('connect');
  const inspectButton = document.getElementById('startInspect');
  const status = document.getElementById('status');
  
  // Check if current page is inspectable
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isRestricted = tab?.url?.startsWith('chrome://') || 
                      tab?.url?.startsWith('chrome-extension://') ||
                      tab?.url?.startsWith('edge://') ||
                      tab?.url?.startsWith('about:') ||
                      tab?.url?.startsWith('chrome-error://');

  if (isRestricted) {
    inspectButton.disabled = true;
    inspectButton.title = 'Cannot inspect restricted pages';
    status.textContent = 'This page cannot be inspected';
    status.className = 'error';
  }

  // Load saved server URL
  const savedConfig = await chrome.storage.local.get(['serverUrl', 'serverConnected']);
  if (savedConfig.serverUrl) {
    serverUrl.value = savedConfig.serverUrl;
  } else {
    serverUrl.value = 'ws://localhost:3000';
  }
  
  // Update UI based on connection status
  updateConnectionStatus(savedConfig.serverConnected);
  
  connectButton.addEventListener('click', async () => {
    const url = serverUrl.value.trim();
    if (!url) {
      status.textContent = 'Please enter a server URL';
      status.className = 'error';
      return;
    }
    
    // Save server URL
    await chrome.storage.local.set({ serverUrl: url });
    
    // Update UI to connecting state
    status.textContent = 'Connecting...';
    status.className = '';
    connectButton.disabled = true;
    
    // Try to connect
    chrome.runtime.sendMessage({ 
      action: 'establishConnection',
      serverUrl: url
    });
  });
  
  inspectButton.addEventListener('click', async () => {
    if (isRestricted) {
      status.textContent = 'Cannot inspect restricted pages';
      status.className = 'error';
      return;
    }

    status.textContent = 'Starting inspector...';
    status.className = '';
    
    const response = await chrome.runtime.sendMessage({ 
      action: 'startInspector' 
    });

    if (!response.success) {
      status.textContent = 'Failed to start inspector';
      status.className = 'error';
    } else {
      window.close(); // Close popup after successful start
    }
  });
  
  // Listen for connection status updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'connectionStatus') {
      updateConnectionStatus(message.connected, message.retryCount);
    }
  });
  
  function updateConnectionStatus(connected, retryCount) {
    status.textContent = connected ? 'Connected to server' : 'Disconnected';
    status.className = connected ? 'success' : 'error';
    connectButton.disabled = false;
    
    if (!isRestricted) {
      inspectButton.disabled = !connected;
    }
    
    if (!connected && retryCount !== undefined) {
      status.textContent = `Retrying connection... (Attempt ${retryCount}/5)`;
    }
  }
});