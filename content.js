// Script injected into page
// Can directly manipulate video players on web pages if needed

console.log('🎬 HLS Stream Capturer Content Script loaded');

// Detect video elements
function detectVideoElements() {
  const videos = document.querySelectorAll('video');
  
  videos.forEach(video => {
    console.log('📹 Video element found:', video.src);
    
      // Monitor video.src
    if (video.src) {
      chrome.runtime.sendMessage({
        action: 'videoDetected',
        url: video.src
      });
    }
  });
}

// Run after DOM loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectVideoElements);
} else {
  detectVideoElements();
}

// Dynamic video detection with MutationObserver
function initObserver() {
  if (!document.body) {
    setTimeout(initObserver, 100);
    return;
  }
  
  const observer = new MutationObserver((mutations) => {
    detectVideoElements();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize observer
initObserver();