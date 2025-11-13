// 캡처된 스트림 저장
const capturedStreams = new Map();
let isCapturing = false;

// 확장 프로그램 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isCapturing: false,
    capturedStreams: []
  });
  
  console.log('✅ HLS Stream Capturer 설치 완료');
});

// 네트워크 요청 모니터링
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    chrome.storage.local.get(['isCapturing'], function(result) {
      if (!result.isCapturing) return;

      const url = details.url;

      // HLS 관련 파일 감지
      if (isStreamUrl(url)) {
        console.log('🎬 스트림 URL 감지:', url);

        const streamInfo = {
          url: url,
          type: getStreamType(url),
          timestamp: Date.now(),
          tabId: details.tabId,
          method: details.method
        };

        // 탭 정보 가져오기
        chrome.tabs.get(details.tabId, function(tab) {
          if (chrome.runtime.lastError) {
            console.error('탭 정보 가져오기 실패:', chrome.runtime.lastError);
            return;
          }

          streamInfo.tabUrl = tab.url;
          streamInfo.tabTitle = tab.title;

          // 스트림 저장
          saveStream(streamInfo);

          // 배지 업데이트
          updateBadge();

          // 알림 기능 제거됨
        });
      }
    });
  },
  { urls: ["<all_urls>"] }
);

// 스트림 URL 여부 판단
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

// 스트림 타입 분류
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

// 스트림 저장
function saveStream(streamInfo) {
  const streamId = generateStreamId(streamInfo.url);

  // 중복 방지
  if (capturedStreams.has(streamId)) {
    return;
  }

  capturedStreams.set(streamId, streamInfo);

  // Storage에 저장
  chrome.storage.local.get(['capturedStreams'], function(result) {
    const streams = result.capturedStreams || [];
    
    // Master M3U8만 저장 (세그먼트는 제외)
    if (streamInfo.type === 'master-m3u8' || 
        streamInfo.type === 'variant-m3u8' || 
        streamInfo.type === 'cloudflare-workers') {
      streams.unshift(streamInfo);
      
      // 최대 50개까지만 저장
      if (streams.length > 50) {
        streams.pop();
      }

      chrome.storage.local.set({ capturedStreams: streams });
    }
  });
}

// 스트림 ID 생성
function generateStreamId(url) {
  // URL에서 쿼리 파라미터 제거 후 해시 생성
  const cleanUrl = url.split('?')[0];
  let hash = 0;
  for (let i = 0; i < cleanUrl.length; i++) {
    const char = cleanUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// 배지 업데이트
function updateBadge() {
  const count = capturedStreams.size;
  
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// 알림 기능 제거됨

// 팝업에서 메시지 수신
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
    return true; // 비동기 응답
  }
  
  if (request.action === 'clearStreams') {
    capturedStreams.clear();
    chrome.storage.local.set({ capturedStreams: [] });
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
  }
  
  if (request.action === 'sendToProxy') {
    // 프록시 서버로 전송
    sendToProxyServer(request.url)
      .then(result => sendResponse({ success: true, result: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 프록시 서버로 URL 전송
async function sendToProxyServer(url) {
  try {
    console.log('🔄 프록시 서버로 URL 전송 시도:', url);
    
    // Manifest V3에서는 background script에서 직접 fetch 사용 가능
    const response = await fetch('http://localhost:3500/api/proxy-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: url })
    });

    console.log('📡 프록시 서버 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 프록시 서버 오류 응답:', errorText);
      throw new Error(`서버 오류: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ 프록시 서버 응답 성공:', result);
    return result;
  } catch (error) {
    console.error('❌ 프록시 서버 전송 오류:', error);
    
    // 더 상세한 오류 메시지 제공
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('프록시 서버에 연결할 수 없습니다. 서버가 http://localhost:3500 에서 실행 중인지 확인하세요.');
    }
    
    throw error;
  }
}

console.log('🚀 HLS Stream Capturer 백그라운드 스크립트 실행 중');