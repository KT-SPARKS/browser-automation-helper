// background.js
let websocket = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 2000;

// Check if URL is restricted
function isRestrictedUrl(url) {
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') ||
         url.startsWith('about:') ||
         url.startsWith('chrome-error://');
}

// Inject content scripts
async function injectContentScripts(tabId) {
  try {
    // First ensure we can access the tab
    const tab = await chrome.tabs.get(tabId);
    if (!tab || isRestrictedUrl(tab.url)) {
      throw new Error('Cannot inject into this page');
    }

    // Inject ElementAnalyzer first
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/ElementAnalyzer.js']
    });

    // Small delay to ensure first script is fully executed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Inject ElementInspector
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/ElementInspector.js']
    });

    // Small delay for second script
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify both scripts are loaded and initialized
    const verifyResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          analyzerLoaded: typeof window.ElementAnalyzer === 'function',
          inspectorLoaded: typeof window.elementInspector === 'object',
          analyzerWorking: Boolean(window.ElementAnalyzer && new window.ElementAnalyzer().analyzeElement),
          inspectorWorking: Boolean(window.elementInspector && window.elementInspector.start)
        };
      }
    });

    const status = verifyResult[0].result;
    console.log('Script verification status:', status);

    if (!status.analyzerLoaded || !status.inspectorLoaded || 
        !status.analyzerWorking || !status.inspectorWorking) {
      throw new Error('Script verification failed: ' + JSON.stringify(status));
    }

    return true;
  } catch (error) {
    console.error('Script injection error:', error);
    throw error;
  }
}

// Send message to tab with retry
async function sendMessageToTab(tabId, message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab || isRestrictedUrl(tab.url)) {
        console.log('Tab is not accessible for automation');
        return false;
      }

      // Ensure scripts are injected
      await injectContentScripts(tabId);

      // Send the message
      await chrome.tabs.sendMessage(tabId, message);
      return true;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) {
        console.error('All retry attempts failed:', error);
        return false;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'elementSelected') {
    console.log('Element selected:', message.elementInfo);
    
    // Process the element data
    const enhancedData = processElementData(message.elementInfo);
    
    // Send to server
    const sent = sendToServer('elementSelected', enhancedData);
    
    // Respond to content script
    sendResponse({ success: sent });
    return false;
  }

  if (message.action === 'establishConnection') {
    connectionAttempts = 0;
    connectWebSocket(message.serverUrl);
    sendResponse({ success: true });
    return true;
  } 

  if (message.action === 'startInspector') {
    handleStartInspector().then(result => 
      sendResponse({ success: result })
    );
    return true;
  }
});

async function handleStartInspector() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.log('No active tab found');
      return false;
    }

    if (isRestrictedUrl(tab.url)) {
      console.log('Cannot inspect restricted page:', tab.url);
      return false;
    }

    return await sendMessageToTab(tab.id, { action: 'startInspector' });
  } catch (error) {
    console.error('Error starting inspector:', error);
    return false;
  }
}

function processElementData(elementInfo) {
  const { analysis, ...basicInfo } = elementInfo;
  return {
    ...elementInfo,
    timestamp: new Date().toISOString(),
    browserInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform
    }
  };
}

function connectWebSocket(serverUrl) {
  if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
    console.log('Max connection attempts reached');
    updateConnectionStatus(false);
    return;
  }

  if (websocket) {
    websocket.close();
  }

  try {
    connectionAttempts++;
    console.log(`Attempting to connect (${connectionAttempts}/${MAX_RETRY_ATTEMPTS})`);
    updateConnectionStatus(false, connectionAttempts);

    websocket = new WebSocket(serverUrl);
    
    websocket.onopen = () => {
      console.log('Connected to automation server');
      connectionAttempts = 0;
      updateConnectionStatus(true);
      chrome.storage.local.set({ serverConnected: true });
    };
    
    websocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await sendMessageToTab(tab.id, {
            action: 'executeAutomation',
            ...message
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    websocket.onclose = (event) => {
      console.log('Disconnected from server:', event.code, event.reason);
      updateConnectionStatus(false);
      chrome.storage.local.set({ serverConnected: false });
      
      if (event.code !== 1000 && connectionAttempts < MAX_RETRY_ATTEMPTS) {
        setTimeout(() => connectWebSocket(serverUrl), RETRY_DELAY);
      }
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateConnectionStatus(false);
      chrome.storage.local.set({ serverConnected: false });
    };
  } catch (error) {
    console.error('Error creating WebSocket:', error);
    updateConnectionStatus(false);
    
    if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
      setTimeout(() => connectWebSocket(serverUrl), RETRY_DELAY);
    }
  }
}

function updateConnectionStatus(connected, retryCount) {
  chrome.runtime.sendMessage({
    action: 'connectionStatus',
    connected: connected,
    retryCount: retryCount
  }).catch(() => {
    // Ignore errors when popup is closed
  });
}

function sendToServer(action, data) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    try {
      const message = {
        action,
        data: {
          ...data,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('Sending to server:', message);
      websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending to server:', error);
      return false;
    }
  } else {
    console.warn('WebSocket not connected');
    return false;
  }
}


// Initial connection attempts
chrome.runtime.onStartup.addListener(async () => {
  const { serverUrl } = await chrome.storage.local.get(['serverUrl']);
  if (serverUrl) {
    connectWebSocket(serverUrl);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const { serverUrl } = await chrome.storage.local.get(['serverUrl']);
  if (serverUrl) {
    connectWebSocket(serverUrl);
  }
});