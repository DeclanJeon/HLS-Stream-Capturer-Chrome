// DOM elements
const captureToggle = document.getElementById('captureToggle');
const statusText = document.getElementById('statusText');
const streamCount = document.getElementById('streamCount');
const clearBtn = document.getElementById('clearBtn');
const refreshBtn = document.getElementById('refreshBtn');
const streamsList = document.getElementById('streamsList');
const filterSelect = document.getElementById('filterSelect');
const hideDuplicates = document.getElementById('hideDuplicates');

// Global variables
let allStreams = [];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  loadStreams();
  
  // Filter event listeners
  filterSelect.addEventListener('change', applyFilters);
  hideDuplicates.addEventListener('change', applyFilters);
});

// Load state
function loadState() {
  chrome.storage.local.get(['isCapturing'], (result) => {
    const isCapturing = result.isCapturing || false;
    captureToggle.checked = isCapturing;
    updateStatusText(isCapturing);
  });
}

// Capture toggle
captureToggle.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  
  chrome.runtime.sendMessage(
    { action: 'toggleCapture', enabled: enabled },
    (response) => {
      if (response && response.success) {
        updateStatusText(enabled);
        if (enabled) {
          showToast('✅ Capture started');
        } else {
          showToast('⏸️ Capture stopped');
        }
      }
    }
  );
});

// Update status text
function updateStatusText(isCapturing) {
  statusText.textContent = isCapturing ? 'Capturing' : 'Capture stopped';
  statusText.className = isCapturing ? 'status-active' : 'status-inactive';
}

// Load streams list
function loadStreams() {
  chrome.runtime.sendMessage({ action: 'getStreams' }, (response) => {
    if (response && response.streams) {
      allStreams = response.streams;
      applyFilters();
    }
  });
}

// Apply filters
function applyFilters() {
  const filterType = filterSelect.value;
  const shouldHideDuplicates = hideDuplicates.checked;
  
  let filteredStreams = [...allStreams];
  
  // Type filtering
  if (filterType !== 'all') {
    filteredStreams = filteredStreams.filter(stream => stream.type === filterType);
  }
  
  // Remove duplicates
  if (shouldHideDuplicates) {
    const uniqueUrls = new Set();
    filteredStreams = filteredStreams.filter(stream => {
      const cleanUrl = stream.url.split('?')[0]; // Remove query parameters
      if (uniqueUrls.has(cleanUrl)) {
        return false;
      }
      uniqueUrls.add(cleanUrl);
      return true;
    });
  }
  
  displayStreams(filteredStreams);
}

// Display streams
function displayStreams(streams) {
  streamCount.textContent = streams.length;

  if (streams.length === 0) {
    const filterType = filterSelect.value;
    const shouldHideDuplicates = hideDuplicates.checked;
    
    let emptyMessage = 'No captured streams yet.';
    if (allStreams.length > 0) {
      if (filterType !== 'all') {
        emptyMessage = `No ${getTypeLabel(filterType)} type streams found.`;
      } else if (shouldHideDuplicates) {
        emptyMessage = 'No streams found after removing duplicates.';
      }
    }
    
    streamsList.innerHTML = `
      <div class="empty-state">
        <p>${emptyMessage}</p>
        <p>Enable capture above and visit streaming sites.</p>
      </div>
    `;
    return;
  }

  streamsList.innerHTML = streams.map((stream, index) => `
    <div class="stream-item" data-index="${index}">
      <div class="stream-header">
        <span class="stream-type ${stream.type}">${getTypeLabel(stream.type)}</span>
        <span class="stream-time">${formatTime(stream.timestamp)}</span>
      </div>
      <div class="stream-title">${escapeHtml(stream.tabTitle || 'Unknown')}</div>
      <div class="stream-url">${escapeHtml(stream.url)}</div>
      <div class="stream-actions">
        <button class="btn-small btn-copy" data-url="${escapeHtml(stream.url)}">
          📋 Copy
        </button>
        <button class="btn-small btn-proxy" data-url="${escapeHtml(stream.url)}">
          🔄 Proxy
        </button>
        <button class="btn-small btn-open" data-url="${escapeHtml(stream.url)}">
          🔗 Open
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners
  attachStreamActions();
}

// Stream action event listeners
function attachStreamActions() {
  // Copy button
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      copyToClipboard(url);
      showToast('📋 URL copied');
    });
  });

  // Proxy button
  document.querySelectorAll('.btn-proxy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const url = e.target.getAttribute('data-url');
      const btn = e.target;
      
      btn.textContent = '⏳ Processing...';
      btn.disabled = true;

      try {
        // Send request to proxy server through background.js
        chrome.runtime.sendMessage(
          { action: 'sendToProxy', url: url },
          (response) => {
            if (response && response.success) {
              // Copy proxy URL
              copyToClipboard(response.result.proxyUrl);
              showToast('✅ Proxy URL generated and copied');

              // Open in new tab
              window.open(`http://localhost:3500`, '_blank');
            } else {
              console.error('Proxy error:', response ? response.error : 'Unknown error');
              showToast('❌ Failed to connect to proxy server', 'error');
            }
            
            btn.textContent = '🔄 Proxy';
            btn.disabled = false;
          }
        );
      } catch (error) {
        console.error('Proxy error:', error);
        showToast('❌ Failed to connect to proxy server', 'error');
        btn.textContent = '🔄 Proxy';
        btn.disabled = false;
      }
    });
  });

  // Open button
  document.querySelectorAll('.btn-open').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      window.open(url, '_blank');
    });
  });
}

// Type labels
function getTypeLabel(type) {
  const labels = {
    'master-m3u8': 'Master M3U8',
    'variant-m3u8': 'Variant M3U8',
    'ts-segment': 'TS Segment',
    'm4s-segment': 'M4S Segment',
    'dash-manifest': 'DASH',
    'cloudflare-workers': 'CF Workers',
    'other': 'Other'
  };
  return labels[type] || type;
}

// Time formatting
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} minutes ago`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} hours ago`;
  } else {
    return date.toLocaleString('en-US');
  }
}

// HTML escaping
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Copy failed:', err);
  });
}

// Toast messages
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Clear all
clearBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to delete all captured streams?')) {
    chrome.runtime.sendMessage({ action: 'clearStreams' }, (response) => {
      if (response && response.success) {
        loadStreams();
        showToast('🗑️ All cleared');
      }
    });
  }
});

// Refresh
refreshBtn.addEventListener('click', () => {
  loadStreams();
  showToast('🔄 Refreshed');
});