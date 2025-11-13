// DOM elements
const captureToggle = document.getElementById('captureToggle');
const statusText = document.getElementById('statusText');
const streamCount = document.getElementById('streamCount');
const clearBtn = document.getElementById('clearBtn');
const refreshBtn = document.getElementById('refreshBtn');
const streamsList = document.getElementById('streamsList');
const filterSelect = document.getElementById('filterSelect');
const hideDuplicates = document.getElementById('hideDuplicates');

// 전역 변수
let allStreams = [];

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  loadStreams();
  
  // 필터 이벤트 리스너
  filterSelect.addEventListener('change', applyFilters);
  hideDuplicates.addEventListener('change', applyFilters);
});

// 상태 로드
function loadState() {
  chrome.storage.local.get(['isCapturing'], (result) => {
    const isCapturing = result.isCapturing || false;
    captureToggle.checked = isCapturing;
    updateStatusText(isCapturing);
  });
}

// 캡처 토글
captureToggle.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  
  chrome.runtime.sendMessage(
    { action: 'toggleCapture', enabled: enabled },
    (response) => {
      if (response && response.success) {
        updateStatusText(enabled);
        if (enabled) {
          showToast('✅ 캡처 시작됨');
        } else {
          showToast('⏸️ 캡처 중지됨');
        }
      }
    }
  );
});

// 상태 텍스트 업데이트
function updateStatusText(isCapturing) {
  statusText.textContent = isCapturing ? '캡처 중' : '캡처 중지';
  statusText.className = isCapturing ? 'status-active' : 'status-inactive';
}

// 스트림 목록 로드
function loadStreams() {
  chrome.runtime.sendMessage({ action: 'getStreams' }, (response) => {
    if (response && response.streams) {
      allStreams = response.streams;
      applyFilters();
    }
  });
}

// 필터 적용
function applyFilters() {
  const filterType = filterSelect.value;
  const shouldHideDuplicates = hideDuplicates.checked;
  
  let filteredStreams = [...allStreams];
  
  // 타입 필터링
  if (filterType !== 'all') {
    filteredStreams = filteredStreams.filter(stream => stream.type === filterType);
  }
  
  // 중복 제거
  if (shouldHideDuplicates) {
    const uniqueUrls = new Set();
    filteredStreams = filteredStreams.filter(stream => {
      const cleanUrl = stream.url.split('?')[0]; // 쿼리 파라미터 제거
      if (uniqueUrls.has(cleanUrl)) {
        return false;
      }
      uniqueUrls.add(cleanUrl);
      return true;
    });
  }
  
  displayStreams(filteredStreams);
}

// 스트림 표시
function displayStreams(streams) {
  streamCount.textContent = streams.length;

  if (streams.length === 0) {
    const filterType = filterSelect.value;
    const shouldHideDuplicates = hideDuplicates.checked;
    
    let emptyMessage = '아직 캡처된 스트림이 없습니다.';
    if (allStreams.length > 0) {
      if (filterType !== 'all') {
        emptyMessage = `${getTypeLabel(filterType)} 타입의 스트림이 없습니다.`;
      } else if (shouldHideDuplicates) {
        emptyMessage = '중복을 제외한 스트림이 없습니다.';
      }
    }
    
    streamsList.innerHTML = `
      <div class="empty-state">
        <p>${emptyMessage}</p>
        <p>위에서 캡처를 활성화하고 스트리밍 사이트를 방문하세요.</p>
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
          📋 복사
        </button>
        <button class="btn-small btn-proxy" data-url="${escapeHtml(stream.url)}">
          🔄 프록시
        </button>
        <button class="btn-small btn-open" data-url="${escapeHtml(stream.url)}">
          🔗 열기
        </button>
      </div>
    </div>
  `).join('');

  // 이벤트 리스너 추가
  attachStreamActions();
}

// 스트림 액션 이벤트 리스너
function attachStreamActions() {
  // 복사 버튼
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      copyToClipboard(url);
      showToast('📋 URL 복사됨');
    });
  });

  // 프록시 버튼
  document.querySelectorAll('.btn-proxy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const url = e.target.getAttribute('data-url');
      const btn = e.target;
      
      btn.textContent = '⏳ 처리 중...';
      btn.disabled = true;

      try {
        // background.js를 통해 프록시 서버로 요청
        chrome.runtime.sendMessage(
          { action: 'sendToProxy', url: url },
          (response) => {
            if (response && response.success) {
              // 프록시 URL 복사
              copyToClipboard(response.result.proxyUrl);
              showToast('✅ 프록시 URL 생성 및 복사됨');

              // 새 탭에서 열기
              window.open(`http://localhost:3500`, '_blank');
            } else {
              console.error('프록시 오류:', response ? response.error : '알 수 없는 오류');
              showToast('❌ 프록시 서버 연결 실패', 'error');
            }
            
            btn.textContent = '🔄 프록시';
            btn.disabled = false;
          }
        );
      } catch (error) {
        console.error('프록시 오류:', error);
        showToast('❌ 프록시 서버 연결 실패', 'error');
        btn.textContent = '🔄 프록시';
        btn.disabled = false;
      }
    });
  });

  // 열기 버튼
  document.querySelectorAll('.btn-open').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      window.open(url, '_blank');
    });
  });
}

// 타입 라벨
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

// 시간 포맷
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return '방금 전';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}분 전`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}시간 전`;
  } else {
    return date.toLocaleString('ko-KR');
  }
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 클립보드 복사
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('복사 실패:', err);
  });
}

// 토스트 메시지
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

// 전체 삭제
clearBtn.addEventListener('click', () => {
  if (confirm('모든 캡처된 스트림을 삭제하시겠습니까?')) {
    chrome.runtime.sendMessage({ action: 'clearStreams' }, (response) => {
      if (response && response.success) {
        loadStreams();
        showToast('🗑️ 전체 삭제됨');
      }
    });
  }
});

// 새로고침
refreshBtn.addEventListener('click', () => {
  loadStreams();
  showToast('🔄 새로고침됨');
});