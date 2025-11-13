// Store captured streams
const capturedStreams = new Map();
let isCapturing = false;

// Initialize on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isCapturing: false,
    capturedStreams: []
  });
  
  console.log('✅ HLS Stream Capturer installed');
});

// Network request monitoring
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    chrome.storage.local.get(['isCapturing'], function(result) {
      if (!result.isCapturing) return;

      const url = details.url;

      // Detect HLS related files
      if (isStreamUrl(url)) {
        console.log('🎬 Stream URL detected:', url);

        const streamInfo = {
          url: url,
          type: getStreamType(url),
          timestamp: Date.now(),
          tabId: details.tabId,
          method: details.method
        };

        // Get tab information
        chrome.tabs.get(details.tabId, function(tab) {
          if (chrome.runtime.lastError) {
            console.error('Failed to get tab info:', chrome.runtime.lastError);
            return;
          }

          streamInfo.tabUrl = tab.url;
          streamInfo.tabTitle = tab.title;

          // Save stream
          saveStream(streamInfo);

          // Update badge
          updateBadge();

          // Notification feature removed
        });
      }
    });
  },
  { urls: ["<all_urls>"] }
);

// Check if URL is stream URL
function isStreamUrl(url) {
  const streamPatterns = [
    /\.m3u8/i,           // HLS manifest
    /\.mpd/i,            // DASH manifest
    /\.ts$/i,            // MPEG-TS segment
    /\.m4s$/i,           // MPEG-4 segment
    /\.mp4/i,            // MP4
    /\/hls\//i,          // HLS path
    /\/dash\//i,         // DASH path
    /\/manifest/i,       // Manifest path
    /workers\.dev/i      // Cloudflare Workers
  ];

  return streamPatterns.some(pattern => pattern.test(url));
}

// Classify stream type
function getStreamType(url) {
  if (url.includes('master.m3u8') || url.match(/playlist\.m3u8/i)) {
    return 'master-m3u8';
  } else if (url.includes('.m3u8')) {
    return 'variant-m3u8';
  } else if (url.includes('.ts')) {
    return 'ts-segment';
  } else if (url.includes('.m4s')) {
    return 'm4s-segment';
  } else if (url.includes('.mpd')) {
    return 'dash-manifest';
  } else if (url.includes('workers.dev')) {
    return 'cloudflare-workers';
  } else {
    return 'other';
  }
}

// Save stream
function saveStream(streamInfo) {
  const streamId = generateStreamId(streamInfo.url);

  // Prevent duplicates
  if (capturedStreams.has(streamId)) {
    return;
  }

  capturedStreams.set(streamId, streamInfo);

  // Save to storage
  chrome.storage.local.get(['capturedStreams'], function(result) {
    const streams = result.capturedStreams || [];
    
    // Save only Master M3U8 (exclude segments)
    if (streamInfo.type === 'master-m3u8' || 
        streamInfo.type === 'variant-m3u8' || 
        streamInfo.type === 'cloudflare-workers') {
      streams.unshift(streamInfo);
      
      // Save maximum 50 items
      if (streams.length > 50) {
        streams.pop();
      }

      chrome.storage.local.set({ capturedStreams: streams });
    }
  });
}

// Generate stream ID
function generateStreamId(url) {
  // Remove query parameters from URL and generate hash
  const cleanUrl = url.split('?')[0];
  let hash = 0;
  for (let i = 0; i < cleanUrl.length; i++) {
    const char = cleanUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Update badge
function updateBadge() {
  const count = capturedStreams.size;
  
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Notification feature removed

// Receive messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleCapture') {
    isCapturing = request.enabled;
    chrome.storage.local.set({ isCapturing: isCapturing });
    
    if (!isCapturing) {
      capturedStreams.clear();
      chrome.action.setBadgeText({ text: '' });
    }
    
    sendResponse({ success: true, isCapturing: isCapturing });
  }
  
  if (request.action === 'getStreams') {
    chrome.storage.local.get(['capturedStreams'], function(result) {
      sendResponse({ streams: result.capturedStreams || [] });
    });
    return true; // Async response
  }
  
  if (request.action === 'clearStreams') {
    capturedStreams.clear();
    chrome.storage.local.set({ capturedStreams: [] });
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
  }
  
  if (request.action === 'sendToProxy') {
    // Send to proxy server
    sendToProxyServer(request.url)
      .then(result => sendResponse({ success: true, result: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Send URL to proxy server
async function sendToProxyServer(url) {
  try {
    console.log('🔄 Attempting to send URL to proxy server:', url);
    
    // Direct fetch available in Manifest V3 background script
    const response = await fetch('http://localhost:3500/api/proxy-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: url })
    });

    console.log('📡 Proxy server response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Proxy server error response:', errorText);
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Proxy server response successful:', result);
    return result;
  } catch (error) {
    console.error('❌ Proxy server transmission error:', error);
    
    // Provide more detailed error message
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Cannot connect to proxy server. Make sure server is running at http://localhost:3500.');
    }
    
    throw error;
  }
}

console.log('🚀 HLS Stream Capturer background script running');