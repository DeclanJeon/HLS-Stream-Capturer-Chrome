// 페이지에 주입되는 스크립트
// 필요시 웹페이지의 비디오 플레이어를 직접 조작 가능

console.log('🎬 HLS Stream Capturer Content Script 로드됨');

// 비디오 요소 감지
function detectVideoElements() {
  const videos = document.querySelectorAll('video');
  
  videos.forEach(video => {
    console.log('📹 비디오 요소 발견:', video.src);
    
    // video.src 모니터링
    if (video.src) {
      chrome.runtime.sendMessage({
        action: 'videoDetected',
        url: video.src
      });
    }
  });
}

// DOM 로드 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectVideoElements);
} else {
  detectVideoElements();
}

// MutationObserver로 동적 비디오 감지
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

// 옵저버 초기화
initObserver();