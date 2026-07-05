// 중복 로그 방지를 위한 변수들
let loggedMessages = new Set();
let processedFirstWins = new Set();
let processedGameRecords = new Set();
let processedTournamentRecords = new Set();
let lastClearTime = Date.now();

// 중복 로그 방지 함수
function logOnce(message, key = null) {
  const logKey = key || message;
  
  // 10분마다 로그 캐시 클리어 (중요한 로그는 다시 표시되도록)
  const now = Date.now();
  if (now - lastClearTime > 10 * 60 * 1000) {
    loggedMessages.clear();
    lastClearTime = now;
  }
  
  if (!loggedMessages.has(logKey)) {
    console.log(message);
    loggedMessages.add(logKey);
  }
}

// BGA 현재 사용자 닉네임 추출 함수
function getCurrentUserNickname() {
  try {
    // 1. 게임 내 페이지에서 사용자 닉네임 추출 방법들
    
    // target_player_username 요소에서 추출
    const targetPlayerElement = document.querySelector("#target_player_username");
    if (targetPlayerElement && targetPlayerElement.textContent && targetPlayerElement.textContent.trim()) {
      const nickname = targetPlayerElement.textContent.trim();
      if (!nickname.includes("Visitor-") && nickname.length > 0) {
        logOnce(`[사용자 닉네임] #target_player_username에서 추출됨: ${nickname}`, 'nickname-target-player');
        return nickname;
      }
    }
    
    // gameui.current_player_name에서 추출
    if (typeof gameui !== 'undefined' && gameui.current_player_name) {
      const nickname = gameui.current_player_name.trim();
      if (!nickname.includes("Visitor-") && nickname.length > 0) {
        logOnce(`[사용자 닉네임] gameui.current_player_name에서 추출됨: ${nickname}`, 'nickname-gameui');
        return nickname;
      }
    }
    
    // Sentry 설정에서 추출 (스크립트 태그 내용 파싱)
    const scriptTags = document.querySelectorAll('script');
    for (const script of scriptTags) {
      const scriptContent = script.textContent || script.innerText;
      if (scriptContent && scriptContent.includes('Sentry.setUser')) {
        const usernameMatch = scriptContent.match(/username:\s*['"]([^'"]+)['"]/);
        if (usernameMatch && usernameMatch[1]) {
          const nickname = usernameMatch[1].trim();
          if (!nickname.includes("Visitor-") && nickname.length > 0) {
            logOnce(`[사용자 닉네임] Sentry.setUser에서 추출됨: ${nickname}`, 'nickname-sentry');
            return nickname;
          }
        }
      }
    }
    
    // 2. 게임 밖 페이지에서 사용자 닉네임 추출
    const menuElement = document.querySelector(".bga-player-menu__name.bga-username");
    if (menuElement && menuElement.textContent && menuElement.textContent.trim()) {
      const nickname = menuElement.textContent.trim();
      if (!nickname.includes("Visitor-") && nickname.length > 0) {
        logOnce(`[사용자 닉네임] .bga-player-menu__name.bga-username에서 추출됨: ${nickname}`, 'nickname-menu');
        return nickname;
      }
    }

    // 토너먼트/구형 페이지에서 노출되는 로그인 사용자명 후보
    const fallbackSelectors = [
      "#connected_username",
      ".me-name",
      ".player-name.me",
      "[data-current-player-name]"
    ];

    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      const nickname = element?.textContent?.trim();
      if (nickname && !nickname.includes("Visitor-")) {
        logOnce(`[사용자 닉네임] ${selector}에서 추출됨: ${nickname}`, `nickname-${selector}`);
        return nickname;
      }
    }
    
    console.log("[경고] 현재 사용자 닉네임을 찾을 수 없습니다.");
    return null;
  } catch (error) {
    console.error("[오류] 사용자 닉네임 추출 실패:", error);
    return null;
  }
}

function getStoredUserNickname() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.sync) {
      resolve(null);
      return;
    }

    chrome.storage.sync.get("userNickname", (result) => {
      if (chrome.runtime?.lastError) {
        console.log("[사용자 닉네임] 저장된 닉네임 조회 실패:", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }

      const nickname = result.userNickname?.trim();
      resolve(nickname && !nickname.includes("Visitor-") ? nickname : null);
    });
  });
}

async function getReporterNickname() {
  return getCurrentUserNickname() || await getStoredUserNickname();
}

// BGA 사용자 ID 추출 함수
function getBGAUserId() {
  try {
    // 1. dataLayer에서 user_id 추출
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      for (const data of window.dataLayer) {
        if (data.user_id) {
          console.log("[사용자 ID] dataLayer에서 추출됨:", data.user_id);
          return data.user_id;
        }
      }
    }
    
    // 2. 사용자 아바타 이미지 URL에서 ID 추출
    const avatarElement = document.querySelector('.bga-player-avatar__avatar');
    if (avatarElement) {
      const style = avatarElement.getAttribute('style');
      if (style) {
        // background-image: url(...) 에서 URL 추출
        const urlMatch = style.match(/background-image:\s*url\(['"]*([^'"]*)['"]*\)/);
        if (urlMatch && urlMatch[1]) {
          const imageUrl = urlMatch[1];
          // 파일명에서 사용자 ID 추출 (예: 85092212_50.jpg)
          const fileNameMatch = imageUrl.match(/\/(\d{8})_\d+\.jpg/);
          if (fileNameMatch && fileNameMatch[1]) {
            console.log("[사용자 ID] 아바타 이미지에서 추출됨:", fileNameMatch[1]);
            return fileNameMatch[1];
          }
        }
      }
    }
    
    // 3. 대안: URL에서 플레이어 ID 추출 (gamestats, achievements 페이지 등)
    const urlMatch = window.location.href.match(/[?&](?:player|id)=(\d+)/);
    if (urlMatch) {
      console.log("[사용자 ID] URL에서 추출됨:", urlMatch[1]);
      return urlMatch[1];
    }
    
    console.log("[경고] BGA 사용자 ID를 찾을 수 없습니다.");
    return null;
  } catch (error) {
    console.error("[오류] BGA 사용자 ID 추출 실패:", error);
    return null;
  }
}

function addCustomStyles() {
  document.head.insertAdjacentHTML(
    "beforeend",
    `
<style>
    .bga-save-button {
        position: absolute;
        left: 120px;
        top: -11px;
        border: 0;
    }
    .disabled-button {
        background: #a5a5a5 !important;
        pointer-events: none;
    }
    .z_popup {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 100;
        display: flex;
        width: 300px;
        line-height: 1.6;
        text-align: center;
        background: white;
        align-items: center;
        border: 0;
        justify-content: center;
        padding: 12px;
        background: rgba(0, 0, 0, .7);
        border-radius: 4px;
        color: white;
        animation: fadeOut 0.4s ease-out 2s forwards; /* 2초간 유지, 0.4초간 사라짐 */
    }
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
            margin-top: 10px;
        }
    }
    
    /* 사이드바 스타일 */
    #bga_extension_sidebar {
        position: fixed;
        left: 0.5em;
        top: 75px;
        z-index: 2000;
        user-select: none;
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        cursor: grab;
        transition: none;
    }
    
    #bga_extension_sidebar.dragging {
        transition: none;
        opacity: 0.8;
        cursor: grabbing;
    }
    
    .bgext_side_menu_item {
        position: relative;
    }
    
    .bgext_avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid transparent;
        box-shadow: 0px 0px 10px 0px rgba(0, 0, 0, 1);
        background-color: rgb(235, 213, 189);
        color: rgb(34, 34, 34);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        overflow: hidden;
        transition: all 0.2s ease;
    }
    
    .bgext_avatar:hover {
        transform: scale(1.1);
        box-shadow: 0px 0px 15px 0px rgba(0, 0, 0, 0.8);
    }
    
    .bgext_avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .bgext_avatar svg {
        width: 24px;
        height: 24px;
    }
    
    .bgext_player_name {
        position: absolute;
        left: 45px;
        top: 50%;
        transform: translateY(-50%);
        padding: 4px 8px;
        border: 3px solid transparent;
        border-radius: 4px;
        color: black !important;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0px 0px 10px 0px rgba(0, 0, 0, 1);
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        pointer-events: none;
    }
    
    .bgext_side_menu_item:hover .bgext_player_name {
        opacity: 1;
        visibility: visible;
        left: 50px;
    }
    
    /* 햄버거 토글 버튼 - 사이드바와 같은 위치, 같은 스타일 */
    #bga_hamburger_toggle {
        position: fixed;
        left: 0.5em;
        top: 75px;
        z-index: 2000;
        user-select: none;
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        cursor: grab;
    }
    
    #bga_extension_sidebar.collapsed {
        display: none;
    }
    
    /* 스피너 스타일 추가 */
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-left: 5px;
        vertical-align: middle;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    /* 게임 기록 마커 스타일 */
    .record-marker {
        display: inline-block;
        margin-right: 5px;
        font-size: 12px;
    }
    /* 게임 기록 로딩 스피너 스타일 */
    .record-spinner {
        display: inline-block;
        width: 11px;
        height: 11px;
        vertical-align: middle;
        border: 2px solid rgba(0,0,0,0.2);
        border-radius: 50%;
        border-top-color: #333;
        animation: record-spin 0.8s linear infinite;
    }
    @keyframes record-spin {
        to { transform: rotate(360deg); }
    }
    .boako-tournament-button {
  position: fixed;        /* 화면에 고정 */
    right: 20px;            /* 오른쪽에서 20px */
    bottom: 20px;           /* 아래에서 20px */
    z-index: 9999;          /* 무조건 맨 위 */
    
    /* 생김새 유지 */
    min-width: 176px;
    padding: 10px 16px;
    background-color: #1976d2; /* 파란색 버튼 */
    color: white;
    border: 0;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.24);
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    }
</style>
    `
  );
}

// 스타일 적용
addCustomStyles();

// 중복 실행 방지 및 최적화를 위한 플래그들
let isInitializing = false;
let lastUrlCheck = '';
let urlCheckDebounceTimer = null;
let addSaveButtonsRetryCount = 0;
const MAX_RETRY_COUNT = 10;

// 반복 로그 방지를 위한 캐시
let gameDataLogCache = {
  lastGameId: null,
  lastTournamentInfo: null,
  lastCreationTime: null,
  logCount: 0
};

function checkGameTablePage() {
  if (
    /^https:\/\/boardgamearena\.com\/table\?table=\d+#?$/.test(
      window.location.href
    )
  ) {
    console.log("[확인] 게임 테이블 페이지 - 버튼 추가 실행");
    addSaveButtons(); // 버튼 추가 함수 실행
  }
}

// 플레이한 게임 페이지 확인 함수
function checkLastResultsPage() {
  if (/^https:\/\/boardgamearena\.com\/player\?section=lastresults/.test(window.location.href)) {
    console.log("[확인] 플레이한 게임 페이지 - 게임 기록 확인 및 첫승 감지 실행");
    markLastResultsGames();
    detectFirstWinNotifications();
  }
}

// 게임 히스토리 페이지 확인 함수
function checkGameStatsPage() {
  if (/^https:\/\/boardgamearena\.com\/gamestats\?player=\d+/.test(window.location.href)) {
    console.log("[확인] 게임 히스토리 페이지 - 게임 기록 확인 실행");
    markGameStatsGames();
    
    // 동적 로딩 대비해서 추가로 한 번 더 실행 (3초 후)
    setTimeout(() => {
      console.log("[확인] 게임 히스토리 페이지 - 추가 체크 실행");
      markGameStatsGames();
    }, 3000);
  }
}


// 알림 페이지 확인 함수
function checkPlayerNotifPage() {
  if (/^https:\/\/boardgamearena\.com\/playernotif/.test(window.location.href)) {
    console.log("[확인] 알림 페이지 - 첫승 기록 확인 실행");
    checkNotificationPageForFirstWins();
  }
}

function isTournamentPage() {
  return /^https:\/\/boardgamearena\.com\/tournament(\/|\?)/.test(window.location.href);
}

function checkTournamentPage() {
  if (!isTournamentPage()) {
    document.getElementById("boako-tournament-save-button")?.remove();
    return;
  }

  console.log("[확인] 토너먼트 페이지 - 토너먼트 기록 버튼 추가 실행");
  setTimeout(() => addTournamentRecordButton(), 1000);
}

// 페이지 초기화 함수 (새로고침과 SPA 이동 모두 대응)
function initializePage() {
  if (isInitializing) {
    console.log("[BOAKO 확장] 이미 초기화 진행 중 - 스킵");
    return;
  }
  
  isInitializing = true;
  
  try {
    // 각 페이지 타입 확인 및 초기화
    checkGameTablePage();
    checkLastResultsPage();
    checkGameStatsPage();
    checkPlayerNotifPage();
    checkTournamentPage();
    
    // 게임 플레이 페이지에서만 사이드바 생성 (게임 결과 페이지 제외)
    const isGamePlayPage = /https:\/\/boardgamearena\.com\/\d+\/[a-zA-Z]+\?table=\d+/.test(window.location.href);
    
    if (isGamePlayPage) {
      console.log("[확인] 게임 플레이 페이지 - 사이드바 생성 시도");
      // 게임 플레이 페이지에서는 더 긴 지연 시간으로 사이드바 생성 시도
      let sidebarRetryCount = 0;
      const maxSidebarRetries = 10;
      
      function tryCreateSidebar() {
        const allPlayerBoards = document.querySelectorAll('.player-board');
        const playerBoards = Array.from(allPlayerBoards).filter(board => {
          const playerId = board.id.replace('overall_player_board_', '');
          return /^\d+$/.test(playerId);
        });
        console.log(`[사이드바] 시도 ${sidebarRetryCount + 1}: 전체 ${allPlayerBoards.length}개, 실제 플레이어 ${playerBoards.length}개 발견`);
        
        if (playerBoards.length > 0) {
          // 이미 사이드바가 있고 플레이어 수가 같으면 재생성하지 않음
          const existingSidebar = document.getElementById('bga_extension_sidebar');
          const currentPlayerCount = playerBoards.length;
          
          if (!existingSidebar || !existingSidebar.dataset.playerCount || 
              parseInt(existingSidebar.dataset.playerCount) !== currentPlayerCount) {
            console.log(`[사이드바] 플레이어 보드 발견됨 - 사이드바 생성 시작 (플레이어 수: ${currentPlayerCount})`);
            createPlayerSidebar();
          } else {
            console.log("[사이드바] 사이드바가 이미 존재함 - 건너뛰기");
          }
        } else if (sidebarRetryCount < maxSidebarRetries) {
          sidebarRetryCount++;
          console.log(`[사이드바] 플레이어 보드 대기 중... (${sidebarRetryCount}/${maxSidebarRetries})`);
          setTimeout(tryCreateSidebar, 1000);
        } else {
          console.log("[사이드바] 플레이어 보드를 찾을 수 없어 사이드바 생성을 포기합니다.");
        }
      }
      
      setTimeout(tryCreateSidebar, 2000); // 2초 후 첫 시도
    }
    
    // 모든 Observer들을 페이지마다 재설정 (SPA 환경에서 DOM 요소 변경 대응)
    setupAllObservers();
    
    console.log("[BOAKO 확장] 페이지 초기화 완료");
  } finally {
    isInitializing = false;
  }
}

// DOM 로드 완료 시 초기화 (새로고침 대응)
document.addEventListener("DOMContentLoaded", () => {
  initializePage();
});

// 페이지가 이미 로드된 상태에서 스크립트가 실행되는 경우 대응
if (document.readyState === 'loading') {
  // DOM이 아직 로딩 중이면 DOMContentLoaded 이벤트를 기다림
  console.log("[BOAKO 확장] DOM 로딩 중 - DOMContentLoaded 대기");
} else {
  // DOM이 이미 로드된 상태면 즉시 초기화
  initializePage();
}

// URL 변경 감지를 위한 최적화된 설정
let lastUrl = location.href;

// 디바운스를 사용한 URL 변경 감지
function handleUrlChange() {
  const url = location.href;
  if (url !== lastUrl && url !== lastUrlCheck) {
    lastUrl = url;
    lastUrlCheck = url;
    console.log('[SPA 이동] URL 변경 감지:', url);
    
    // 디바운스: 80ms 내 추가 변경이 없을 때만 실행
    if (urlCheckDebounceTimer) {
      clearTimeout(urlCheckDebounceTimer);
    }
    
    urlCheckDebounceTimer = setTimeout(() => {
      if (!isInitializing) {
        console.log('[SPA 이동] 페이지 재초기화 시작');
        initializePage();
      }
    }, 300); // 더 빠른 반응을 위해 300ms로 단축
  }
}

// SPA 감지를 위한 MutationObserver (디바운스 최적화 적용)
let urlChangeTimer = null;
const urlObserver = new MutationObserver(() => {
  // 디바운스로 과도한 호출 방지
  if (urlChangeTimer) {
    clearTimeout(urlChangeTimer);
  }
  
  urlChangeTimer = setTimeout(() => {
    handleUrlChange();
    urlChangeTimer = null;
  }, 80); // 80ms 디바운스로 성능 개선
});

// 전체 document 감시 (기존 방식 복원)
urlObserver.observe(document, {
  childList: true,
  subtree: true // SPA 감지를 위해 subtree: true 필수
});

// 추가로 popstate 이벤트도 감지 (브라우저 뒤로/앞으로 버튼)
window.addEventListener('popstate', handleUrlChange);

// 플레이한 게임 페이지에서 게임 기록 표시 함수
function markLastResultsGames() {
  // 중복 실행 방지
  if (markLastResultsGames.isRunning) {
    console.log("[디버그] markLastResultsGames 이미 실행 중 - 스킵");
    return;
  }
  
  markLastResultsGames.isRunning = true;
  let gameLinks = null;
  
  try {
    const boardPostsElement = document.getElementById("boardposts_r");
    if (!boardPostsElement) {
      console.log("[주의] 'boardposts_r' 요소를 찾을 수 없습니다. 다시 시도...");
      // 최대 10회까지 재시도 (10초)
      if (!markLastResultsGames.retryCount) markLastResultsGames.retryCount = 0;
      if (markLastResultsGames.retryCount < 10) {
        markLastResultsGames.retryCount++;
        setTimeout(() => {
          markLastResultsGames.isRunning = false;
          markLastResultsGames();
        }, 1000);
      } else {
        markLastResultsGames.isRunning = false;
      }
      return;
    }

    gameLinks = boardPostsElement.querySelectorAll('a[href*="/table?table="]:not([data-record-checked])');
    
    // 성공적으로 링크를 찾았으면 재시도 카운터 리셋
    if (gameLinks.length > 0) {
      markLastResultsGames.retryCount = 0;
      markLastResultsGames.linkRetryCount = 0;
    }
  
  } finally {
    // 성공적으로 완료되면 실행 플래그 해제
    if (gameLinks && gameLinks.length > 0) {
      markLastResultsGames.isRunning = false;
    }
  }
  
  if (!gameLinks || gameLinks.length === 0) {
    console.log("[주의] 게임 링크를 찾을 수 없습니다. 다시 시도...");
    // 최대 5회까지 재시도 (5초)
    if (!markLastResultsGames.linkRetryCount) markLastResultsGames.linkRetryCount = 0;
    if (markLastResultsGames.linkRetryCount < 5) {
      markLastResultsGames.linkRetryCount++;
      setTimeout(() => {
        markLastResultsGames.isRunning = false;
        markLastResultsGames();
      }, 1000);
    } else {
      markLastResultsGames.isRunning = false;
    }
    return;
  }

  // 재시도 카운터 리셋
  markLastResultsGames.retryCount = 0;
  markLastResultsGames.linkRetryCount = 0;

  console.log(`[확인] ${gameLinks.length}개의 게임 링크를 찾았습니다.`);
  
  gameLinks.forEach(link => {
    const match = link.href.match(/table\?table=(\d+)/);
    if (match) {
      const gameId = match[1];
      checkGameRecord(gameId, link);
    }
  });
}

// 게임 히스토리 페이지에서 게임 기록 표시 함수
function markGameStatsGames() {
  const gameListElement = document.getElementById("gamelist");
  if (!gameListElement) {
    console.log("[주의] 'gamelist' 요소를 찾을 수 없습니다. 다시 시도...");
    // 최대 10회까지 재시도 (10초)
    if (!markGameStatsGames.retryCount) markGameStatsGames.retryCount = 0;
    if (markGameStatsGames.retryCount < 10) {
      markGameStatsGames.retryCount++;
      setTimeout(markGameStatsGames, 1000);
    }
    return;
  }

  const gameLinks = gameListElement.querySelectorAll('a.table_name.bga-link[href^="/table?table="]:not([data-record-checked])');
  if (gameLinks.length === 0) {
    console.log("[주의] 게임 링크를 찾을 수 없습니다. 다시 시도...");
    // 최대 5회까지 재시도 (5초)
    if (!markGameStatsGames.linkRetryCount) markGameStatsGames.linkRetryCount = 0;
    if (markGameStatsGames.linkRetryCount < 5) {
      markGameStatsGames.linkRetryCount++;
      setTimeout(markGameStatsGames, 1000);
    }
    return;
  }

  // 재시도 카운터 리셋
  markGameStatsGames.retryCount = 0;
  markGameStatsGames.linkRetryCount = 0;

  console.log(`[확인] ${gameLinks.length}개의 게임 링크를 찾았습니다.`);
  
  gameLinks.forEach(link => {
    const match = link.href.match(/table\?table=(\d+)/);
    if (match) {
      const gameId = match[1];
      console.log(`게임 기록 체크: ${gameId}`);
      checkGameRecord(gameId, link);
    }
  });
}

// 게임 기록 확인 함수
function checkGameRecord(gameId, linkElement, retryCount = 0) {
  // 최대 재시도 횟수 제한 (3회)
  if (retryCount >= 3) {
    console.log("[확장 프로그램] 최대 재시도 횟수 초과, 포기");
    linkElement.removeAttribute('data-record-check-waiting-user');
    return;
  }
  
  // 재시도가 아닌 첫 시도일 때만 중복 체크
  if (retryCount === 0) {
    // 이미 확인했거나 마커가 있는 경우 중복 처리 방지
    if (linkElement.hasAttribute('data-record-checked') || linkElement.hasAttribute('data-record-check-waiting-user') || linkElement.querySelector('.record-marker')) {
      // console.log(`[정보] 게임 ID ${gameId}는 이미 확인되었거나 마커가 있습니다.`);
      return;
    }
  }

  // 사용자 닉네임 가져오기
  const userNickname = getCurrentUserNickname();
  
  if (!userNickname) {
    console.log("[주의] 로그인 닉네임을 아직 찾지 못함 - 게임 기록 확인 재시도 예정");
    const existingMarker = linkElement.querySelector('.loading-marker');
    if (existingMarker) {
      existingMarker.remove();
    }
    linkElement.removeAttribute('data-record-checked');
    linkElement.setAttribute('data-record-check-waiting-user', 'true');
    setTimeout(() => {
      linkElement.removeAttribute('data-record-check-waiting-user');
      checkGameRecord(gameId, linkElement, retryCount + 1);
    }, 1000);
    return;
  }

  if (!linkElement.hasAttribute('data-record-checked')) {
    linkElement.setAttribute('data-record-checked', 'true');
    const loadingMarker = document.createElement('span');
    loadingMarker.className = 'record-marker loading-marker';
    loadingMarker.style.marginRight = '5px';
    loadingMarker.innerHTML = '<div class="record-spinner"></div>';
    linkElement.prepend(loadingMarker);
  }

  // 크롬 익스텐션 메시지를 통한 API 호출
  try {
    chrome.runtime.sendMessage({ 
      action: "checkGameRecord", 
      data: {
        gameId: gameId,
        nickname: userNickname.toLowerCase()
      }
    }, (response) => {
      // 기존 로딩 마커 제거
      const existingMarker = linkElement.querySelector('.loading-marker');
      if (existingMarker) {
        existingMarker.remove();
      }

      if (chrome.runtime.lastError) {
        console.log(`[확장 프로그램] 백그라운드 연결 실패: ${chrome.runtime.lastError.message}, 3초 후 재시도 예정 (${retryCount + 1}/3)`);
        
        // 재시도 시 새로운 로딩 마커 추가
        const retryLoadingMarker = document.createElement('span');
        retryLoadingMarker.className = 'record-marker loading-marker';
        retryLoadingMarker.style.marginRight = '5px';
        retryLoadingMarker.innerHTML = '<div class="record-spinner"></div>';
        linkElement.prepend(retryLoadingMarker);
        
        // 3초 후 재시도
        setTimeout(() => {
          checkGameRecord(gameId, linkElement, retryCount + 1);
        }, 3000);
        return;
      }

      // 최종 결과 마커 생성
      const marker = document.createElement('span');
      marker.className = 'record-marker';
      marker.style.marginRight = '5px';
      
      if (response && response.exists) {
        marker.textContent = '✅';
      } else {
        marker.textContent = '➖';
      }
      
      linkElement.prepend(marker);
    });
  } catch (error) {
    console.log(`[확장 프로그램] chrome.runtime.sendMessage 호출 실패: ${error}, 3초 후 재시도 예정 (${retryCount + 1}/3)`);
    
    // 기존 로딩 마커 제거
    const existingMarker = linkElement.querySelector('.loading-marker');
    if (existingMarker) {
      existingMarker.remove();
    }
    
    // 3초 후 재시도
    setTimeout(() => {
      checkGameRecord(gameId, linkElement, retryCount + 1);
    }, 3000);
    return;
  }
}

// 동적으로 추가되는 게임 링크에 마커 표시를 위한 MutationObserver
function setupGameLinksObserver() {
  
  const observers = [];
  
  // 게임 목록 페이지
  if (window.location.href.includes('boardgamearena.com/player?section=lastresults')) {
    const contentObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const boardPostsElement = document.getElementById('boardposts_r');
          if (boardPostsElement) {
            // data-record-checked 속성이 없는 링크만 선택
            const newLinks = boardPostsElement.querySelectorAll('a[href^="/table?table="]:not([data-record-checked])'); 
            newLinks.forEach(link => {
              const match = link.href.match(/table\?table=(\d+)/);
              if (match) {
                const gameId = match[1];
                checkGameRecord(gameId, link);
              }
            });
          }
        }
      });
    });
    
    contentObserver.observe(document.body, { childList: true, subtree: true });
    observers.push(contentObserver);
  }
  
  // 게임 히스토리 페이지
  if (window.location.href.includes('boardgamearena.com/gamestats?player=')) {
    const contentObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const gameListElement = document.getElementById('gamelist');
          if (gameListElement) {
            // data-record-checked 속성이 없는 링크만 선택
            const newLinks = gameListElement.querySelectorAll('a.table_name.bga-link[href^="/table?table="]:not([data-record-checked])');
            newLinks.forEach(link => {
              const match = link.href.match(/table\?table=(\d+)/);
              if (match) {
                const gameId = match[1];
                checkGameRecord(gameId, link);
              }
            });
          }
        }
      });
    });
    
    contentObserver.observe(document.body, { childList: true, subtree: true });
    observers.push(contentObserver);
  }
  
  // 전역 변수로 Observer들 저장
  window.boakoGameLinksObserver = observers;
  
  // "더 보기" 버튼 클릭 감지 및 처리 (SPA 대응을 위해 URL 조건 없이 항상 실행)
  setupSeeMoreButtonObserver();
}

// 히스토리 페이지의 "더 보기" 버튼 클릭 감지 및 처리
function setupSeeMoreButtonObserver() {
  let isProcessing = false; // 중복 처리 방지 플래그
  
  // "더 보기" 버튼 감지 및 클릭 이벤트 리스너 추가
  function attachSeeMoreListener() {
    const seeMoreButton = document.querySelector('#see_more_tables');
    if (seeMoreButton && !seeMoreButton.hasAttribute('data-boako-listener')) {
      seeMoreButton.setAttribute('data-boako-listener', 'true');
      
      seeMoreButton.addEventListener('click', () => {
        if (isProcessing) return;
        isProcessing = true;
        
        console.log('[히스토리 더 보기] 버튼 클릭 감지 - 3초 후 새 게임 기록 확인 예정');
        
        // 3초 후 새로 로드된 게임 기록들을 확인
        setTimeout(() => {
          const gameListElement = document.getElementById('gamelist');
          if (gameListElement) {
            const newLinks = gameListElement.querySelectorAll('a.table_name.bga-link[href^="/table?table="]:not([data-record-checked])');
            console.log(`[히스토리 더 보기] ${newLinks.length}개의 새 게임 기록 발견, 마커 추가 시작`);
            
            newLinks.forEach(link => {
              const match = link.href.match(/table\?table=(\d+)/);
              if (match) {
                const gameId = match[1];
                checkGameRecord(gameId, link);
              }
            });
          }
          
          isProcessing = false;
        }, 3000);
      });
    }
  }
  
  // 뉴스/보드 페이지의 "더 많은 뉴스 보기" 버튼 감지 및 클릭 이벤트 리스너 추가
  function attachBoardSeeMoreListener() {
    const boardSeeMoreButton = document.querySelector('#board_seemore_r');
    if (boardSeeMoreButton && !boardSeeMoreButton.hasAttribute('data-boako-listener')) {
      boardSeeMoreButton.setAttribute('data-boako-listener', 'true');
      
      boardSeeMoreButton.addEventListener('click', () => {
        if (isProcessing) return;
        isProcessing = true;
        
        console.log('[뉴스/보드 더 보기] 버튼 클릭 감지 - 3초 후 새 게임 기록 확인 예정');
        
        // 3초 후 새로 로드된 게임 기록들을 확인
        setTimeout(() => {
          const boardPostsElement = document.getElementById('boardposts_r');
          if (boardPostsElement) {
            const newLinks = boardPostsElement.querySelectorAll('a.table_name.bga-link[href^="/table?table="]:not([data-record-checked])');
            console.log(`[뉴스/보드 더 보기] ${newLinks.length}개의 새 게임 기록 발견, 마커 추가 시작`);
            
            newLinks.forEach(link => {
              const match = link.href.match(/table\?table=(\d+)/);
              if (match) {
                const gameId = match[1];
                checkGameRecord(gameId, link);
              }
            });
          }
          
          isProcessing = false;
        }, 3000);
      });
      
      console.log('[뉴스/보드 더 보기] 버튼에 클릭 리스너 추가됨');
    }
  }
  
  // 초기 버튼 확인
  attachSeeMoreListener();
  attachBoardSeeMoreListener();
  
  // 페이지 내용 변경 시 버튼 재확인 (동적으로 추가될 수 있음)
  const buttonObserver = new MutationObserver(() => {
    attachSeeMoreListener();
    attachBoardSeeMoreListener();
  });
  
  buttonObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  window.boakoSeeMoreButtonObserver = buttonObserver;
}

// MutationObserver를 사용하여 #game_result_panel이 동적으로 추가될 때 감지
const gameResultObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // 1) 자식 노드 추가 감지
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.id === "game_result_panel") {
          console.log("[확인] 'game_result_panel'이 새로 추가됨");
          addSaveButtons();
        }
      });
    }
    // 2) 속성 변경 감지 (예: style, class) - 버튼이 없을 때만 실행
    if (mutation.type === "attributes") {
      const target = mutation.target;
      if (target.id === "game_result_panel") {
        // 이미 버튼이 존재하면 속성 변경 시 전체 재생성하지 않음
        const existingButton = document.querySelector('.boako-save-button');
        if (existingButton) {
          console.log("[확인] 'game_result_panel' 속성 변경 - 기존 버튼 상태만 업데이트");
          updateExistingButtonState(existingButton);
        } else {
          console.log("[확인] 'game_result_panel' 속성 변경 발생 - 버튼 없음");
          // display가 none이 아닌 상태라면
          if (getComputedStyle(target).display !== "none") {
            console.log("[확인] 'game_result_panel'이 다시 화면에 보임");
            addSaveButtons();
          }
        }
      }
    }
  });
});
// 감시 시작
gameResultObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["style", "class"],
});

// 기존 버튼 상태만 업데이트하는 함수
function updateExistingButtonState(button) {
  // 게임이 진행 중인지 확인
  const statusElement = document.querySelector("#status_detailled");
  const isGameInProgress = statusElement && statusElement.textContent.includes("게임이 진행 중입니다");
  
  if (isGameInProgress) {
    button.classList.add("disabled-button");
    button.disabled = true;
    button.innerText = "게임 진행 중";
    return;
  }
  
  let isCancelled = [
    "#game_abandonned",
    "#game_cancelled", 
    "#game_unranked_cancelled",
  ].some((selector) => {
    let element = document.querySelector(selector);
    return element && getComputedStyle(element).display === "block";
  });

  let gameModeElement = document.querySelector("#gameoption_201_displayed_value");
  let isUnranked = gameModeElement ? gameModeElement.innerText.trim() === "친선전" : false;

  // 사용자가 참여하지 않은 게임인지 확인
  let isNotParticipated = false;
  const userNickname = getCurrentUserNickname();
  
  if (userNickname && !userNickname.includes("Visitor-")) {
    const gameResultPanel = document.querySelector("#game_result_panel");
    if (gameResultPanel) {
      const gameData = extractGameData(gameResultPanel);
      if (gameData && gameData.players && Array.isArray(gameData.players)) {
        const userParticipated = gameData.players.some(player => 
          player.nickname && player.nickname.toLowerCase() === userNickname.toLowerCase()
        );
        isNotParticipated = !userParticipated;
      }
    }
  }

  if (isCancelled) {
    button.classList.add("disabled-button");
    button.disabled = true;
    button.innerText = "취소된 게임";
  } else if (isUnranked) {
    button.classList.add("disabled-button");
    button.disabled = true;
    button.innerText = "친선전";
  } else if (isNotParticipated) {
    button.classList.add("disabled-button");
    button.disabled = true;
    button.innerText = "미참여 게임";
  } else {
    button.classList.remove("disabled-button");
    button.disabled = false;
    button.innerText = "기록 저장/업데이트";
  }
}

function addSaveButtons() {
  // 게임 플레이 페이지에서는 실행하지 않음 (무한 루프 방지)
  const currentUrl = window.location.href;
  if (/https:\/\/boardgamearena\.com\/\d+\/\w+\?table=\d+/.test(currentUrl)) {
    console.log("[정보] 게임 플레이 페이지 - addSaveButtons 실행 안함");
    return;
  }
  
  // 게임이 진행 중인지 확인 (가장 먼저 체크)
  const statusElement = document.querySelector("#status_detailled");
  const isGameInProgress = statusElement && statusElement.textContent.includes("게임이 진행 중입니다");
  
  if (isGameInProgress) {
    console.log("[정보] 게임 진행 중 - 저장 버튼 생성 안함");
    return;
  }
  
  // === 중복 실행 방지: 이미 버튼이 존재하면 상태만 업데이트 ===
  const existingButton = document.querySelector('.boako-save-button');
  if (existingButton) {
    console.log("[정보] 저장 버튼이 이미 존재함 - 상태만 업데이트");
    // 기존 버튼의 상태만 업데이트
    updateExistingButtonState(existingButton);
    return;
  }
  
  // 재시도 카운터 초기화 (외부에서 호출될 때마다)
  if (addSaveButtonsRetryCount === 0) {
    console.log("[디버그] addSaveButtons 호출 - 새 버튼 생성 시작");
  }
  
  // gameResultPanel 가져오기 및 재시도 로직
  const gameResultPanel = document.querySelector("#game_result_panel");
  if (!gameResultPanel) {
    addSaveButtonsRetryCount++;
    
    if (addSaveButtonsRetryCount > MAX_RETRY_COUNT) {
      console.log(
        `[오류] 'game_result_panel' 찾기 실패 - 최대 재시도 횟수(${MAX_RETRY_COUNT}) 초과`
      );
      addSaveButtonsRetryCount = 0; // 카운터 리셋
      return;
    }
    
    console.log(
      `[주의] 'game_result_panel'이 없습니다. 125ms 후 다시 시도... (${addSaveButtonsRetryCount}/${MAX_RETRY_COUNT})`
    );
    setTimeout(addSaveButtons, 125);
    return;
  }
  
  // 성공적으로 패널을 찾았으면 카운터 리셋
  addSaveButtonsRetryCount = 0;

  // 이미 버튼이 있는지 확인 (중복 실행 방지)
  if (gameResultPanel.querySelector(".bga-save-button")) {
    console.log("[정보] '기록 저장' 버튼이 이미 존재합니다.");
    return;
  }

  console.log("[실행] addSaveButtons 함수 실행 시작");

  // 버튼 즉시 생성 및 추가
  const gameResultTitle = gameResultPanel.querySelector("h3.pagesection__title");
  if (!gameResultTitle) {
      console.warn("[경고] '게임 결과' 제목 요소를 찾을 수 없습니다.");
      return; // 제목 없으면 버튼 추가 불가
  }
  
  let button = document.createElement("button");
  button.innerText = "확인중...";
  button.classList.add(
    "bga-save-button",
    "boako-save-button", // 중복 실행 방지용 클래스
    "bgabutton",
    "bgabutton_blue",
    "disabled-button"
  );
  gameResultTitle.after(button);
  console.log("[확인] '확인중...' 버튼 DOM에 추가됨");

  // 800ms 딜레이 후에 나머지 로직 실행 (닉네임 확인, 버튼 상태 업데이트 등)
  setTimeout(() => {
    // 사용자 닉네임을 가져와서 Visitor-인지 확인
    const userNickname = getCurrentUserNickname();
    if (!userNickname) {
      console.log("로그인 되지 않음");
      // 이미 버튼이 있다면 제거(있을 경우)
      let existingButton = document.querySelector(".bga-save-button");
      if (existingButton) {
        existingButton.remove();
      }
      return;
    }

    // 나머지 addSaveButtons 로직...
    const htmlLang = document.documentElement.lang || "";
    if (htmlLang.toLowerCase() !== "ko") {
      alert("아레나 언어 설정이 'ko'일 때만 정상 작동합니다.");
      return;
    }

    // 게임 상태 감지 및 버튼 상태 업데이트
    function updateButtonState() {
      // 게임이 진행 중인지 확인
      const statusElement = document.querySelector("#status_detailled");
      const isGameInProgress = statusElement && statusElement.textContent.includes("게임이 진행 중입니다");
      
      if (isGameInProgress) {
        button.classList.add("disabled-button");
        button.disabled = true;
        button.innerText = "게임 진행 중";
        return;
      }
      
      let isCancelled = [
        "#game_abandonned",
        "#game_cancelled",
        "#game_unranked_cancelled",
      ].some((selector) => {
        let element = document.querySelector(selector);
        return element && getComputedStyle(element).display === "block";
      });

      let gameModeElement = document.querySelector(
        "#gameoption_201_displayed_value"
      );
      let isUnranked = gameModeElement
        ? gameModeElement.innerText.trim() === "친선전"
        : false;

      // 사용자가 참여하지 않은 게임인지 확인
      let isNotParticipated = false;
      let isNotWinner = false;
      const userNickname = getCurrentUserNickname();
      
      if (userNickname && !userNickname.includes("Visitor-")) {
        // 현재 페이지에서 플레이어 정보 추출
        const gameResultPanel = document.querySelector("#game_result_panel");
        if (gameResultPanel) {
          const gameData = extractGameData(gameResultPanel);
          if (gameData && gameData.players && Array.isArray(gameData.players)) {
            const userParticipated = gameData.players.some(player => 
              player.nickname && player.nickname.toLowerCase() === userNickname.toLowerCase()
            );
            isNotParticipated = !userParticipated;
            
            // 승리 여부 확인 (참여한 게임에서만)
            if (userParticipated && gameData.winner) {
              const userWon = gameData.winner.toLowerCase().includes(userNickname.toLowerCase());
              isNotWinner = !userWon;
            }
          }
        }
      }


      if (isCancelled) {
        button.classList.add("disabled-button");
        button.disabled = true;
        button.innerText = "취소된 게임";
      } else if (isUnranked) {
        button.classList.add("disabled-button");
        button.disabled = true;
        button.innerText = "친선전";
      } else if (isNotParticipated) {
        button.classList.add("disabled-button");
        button.disabled = true;
        button.innerText = "미참여 게임";
      } else {
        button.classList.remove("disabled-button");
        button.disabled = false;
        button.innerText = "기록 저장/업데이트";
      }
    }

    // 초기 버튼 상태 업데이트
    updateButtonState();
    
    // 게임 결과 패널 내용 변경 감지 Observer 설정 (최적화)
    let contentUpdateTimer = null;
    const gameResultContentObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach((mutation) => {
        // 자식 노드가 추가/제거되거나 텍스트가 변경된 경우
        if (mutation.type === "childList" || mutation.type === "characterData") {
          shouldUpdate = true;
        }
      });
      
      if (shouldUpdate) {
        // 디바운스로 과도한 업데이트 방지
        if (contentUpdateTimer) {
          clearTimeout(contentUpdateTimer);
        }
        
        contentUpdateTimer = setTimeout(() => {
          updateButtonState();
          contentUpdateTimer = null;
        }, 80); // 80ms로 디바운스 시간 최적화
      }
    });
    
    // 게임 결과 패널의 내용 변화 감시
    gameResultContentObserver.observe(gameResultPanel, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 버튼 클릭 이벤트 추가
    button.onclick = () => {
      if (button.disabled) {
        console.log("[정보] 기록이 불가능한 게임이므로 클릭이 차단됨.");
        showPopupMessage("이 게임은 기록할 수 없습니다.", false, button);
        return;
      }

      // 스피너 추가
      const originalText = button.innerText;
      button.innerHTML = originalText + ' <div class="spinner"></div>';
      button.disabled = true; // 중복 클릭 방지

      const gameResult = document.querySelector("#game_result");
      
      // 데이터 추출 시도 (재시도 포함)
      function tryExtractData(attempt = 1, maxAttempts = 3) {
        const gameData = extractGameData(gameResult);
        
        if (gameData === null && attempt < maxAttempts) {
          setTimeout(() => {
            tryExtractData(attempt + 1, maxAttempts);
          }, (attempt + 1) * 1000); // 1초, 2초, 3초 간격으로 재시도
          return;
        }
        
        if (gameData === null) {
          console.log("[오류] 게임 결과 데이터를 추출하지 못해 저장을 중단합니다.");
          resetButton(button, originalText);
          showPopupMessage("게임 결과를 아직 읽지 못했습니다. 잠시 후 다시 시도해주세요.", false, button);
        } else {
          sendToBackground(gameData, button, originalText);
        }
      }
      
      tryExtractData();
    };

    console.log("[확인] '기록 저장' 버튼 추가됨");
    
    // 버튼 상태가 활성화되어 있고, 자동 클릭 시도가 없었으면 자동 클릭 실행
    setTimeout(() => {
      // gameResultPanel이 여전히 유효한지 다시 확인 (페이지 이동 등 대비)
      const currentPanel = document.querySelector("#game_result_panel");
      if (!currentPanel || currentPanel.getAttribute('data-autoclick-attempted') === 'true') {
          console.log("[정보] 자동 클릭 건너뜀 (패널 없음 또는 이미 시도됨)");
          return;
      }
      
      // 자동 클릭 시도 플래그 설정
      currentPanel.setAttribute('data-autoclick-attempted', 'true');
      
      if (!button.disabled) {
        console.log("[확인] 버튼 자동 클릭 실행");
        button.click();
      } else {
        console.log("[정보] 버튼이 비활성화 상태여서 자동 클릭 실행되지 않음");
      }
    }, 500); // 버튼 상태 업데이트 후 약간의 딜레이를 두고 클릭
  }, 800); // 800ms 후 실행
}

// 플레이어 사이드바 생성 함수
function createPlayerSidebar() {
  // 이미 사이드바나 햄버거 버튼이 있으면 제거
  const existingSidebar = document.getElementById('bga_extension_sidebar');
  const existingHamburger = document.getElementById('bga_hamburger_toggle');
  
  if (existingSidebar) {
    existingSidebar.remove();
  }
  if (existingHamburger) {
    existingHamburger.remove();
  }
  
  // 플레이어 보드에서 플레이어 정보 수집 (실제 플레이어만)
  const allPlayerBoards = document.querySelectorAll('.player-board');
  const playerBoards = Array.from(allPlayerBoards).filter(board => {
    const playerId = board.id.replace('overall_player_board_', '');
    // 숫자로만 이루어진 ID만 실제 플레이어로 간주
    return /^\d+$/.test(playerId);
  });
  
  console.log(`[사이드바] 전체 보드: ${allPlayerBoards.length}개, 실제 플레이어: ${playerBoards.length}개`);
  
  if (playerBoards.length === 0) {
    console.log("[사이드바] 실제 플레이어 보드를 찾을 수 없습니다.");
    return;
  }
  
  // 2번째 플레이어 정보로 범용 패턴 찾기 (호환성 검증)
  let compatibleGame = false;
  console.log(`[사이드바] 호환성 검사 시작 - 플레이어 보드 수: ${playerBoards.length}`);
  
  if (playerBoards.length >= 2) {
    const secondPlayer = playerBoards[1]; // 2번째 플레이어 (첫번째는 현재 플레이어)
    const secondPlayerId = secondPlayer.id.replace('overall_player_board_', '');
    
    // 범용 컬러코드 추출: 플레이어ID가 포함된 모든 요소에서 6자리 연속 숫자 찾기
    let secondPlayerColorCode = null;
    
    // 페이지 전체에서 secondPlayerId가 포함된 모든 요소 검색
    const elementsWithPlayerId = document.querySelectorAll(`[id*="${secondPlayerId}"], [data-color], [style*="color"], [class*="color"]`);
    
    for (const element of elementsWithPlayerId) {
      // id, data-color, style, class에서 6자리 연속 영숫자 찾기
      const searchTexts = [
        element.id,
        element.getAttribute('data-color'),
        element.getAttribute('style'),
        element.className
      ].filter(text => text && text.includes && (text.includes(secondPlayerId) || text.includes('color')));
      
      for (const text of searchTexts) {
        // 6자리 16진수 패턴 찾기
        const colorMatch = text.match(/[a-fA-F0-9]{6}/);
        if (colorMatch) {
          secondPlayerColorCode = colorMatch[0].toLowerCase();
          break;
        }
        // 10진수를 16진수로 변환 시도 (센츄리 게임 대응)
        const decimalMatch = text.match(/\b(\d{6})\b/);
        if (decimalMatch) {
          const decimalValue = parseInt(decimalMatch[1]);
          if (decimalValue <= 16777215) { // 0xFFFFFF
            secondPlayerColorCode = decimalValue.toString(16).padStart(6, '0').toLowerCase();
            console.log(`[사이드바] 10진수 컬러코드 변환: ${decimalMatch[1]} -> ${secondPlayerColorCode}`);
            break;
          }
        }
      }
      if (secondPlayerColorCode) break;
    }
    
    console.log(`[사이드바] 2번째 플레이어 정보 - ID: ${secondPlayerId}, 컬러코드: ${secondPlayerColorCode}`);
    
    if (secondPlayerId && secondPlayerColorCode) {
      // 범용 패턴 검색: 키워드 + (컬러코드 또는 플레이어ID)가 포함된 요소 찾기
      const searchKeywords = ['player', 'table', 'game', 'map', 'zone', 'board'];
      
      for (const keyword of searchKeywords) {
        // 컬러코드 기반 검색 (전체 문서에서)
        const colorElements = document.querySelectorAll(`[id*="${keyword}"][id*="${secondPlayerColorCode}"]`);
        if (colorElements.length > 0) {
          compatibleGame = true;
          console.log(`[사이드바] 호환 게임 감지: ${keyword} + 컬러코드 패턴`);
          break;
        }
        
        // 플래이어ID 기반 검색 (전체 문서에서)
        const idElements = document.querySelectorAll(`[id*="${keyword}"][id*="${secondPlayerId}"]`);
        if (idElements.length > 0) {
          compatibleGame = true;
          console.log(`[사이드바] 호환 게임 감지: ${keyword} + 플래이어ID 패턴 (${secondPlayerId})`);
          break;
        }
      }
      
      // 범용 색상 패턴 검사
      if (!compatibleGame) {
        const colorElements = document.querySelectorAll(`[style*="color:#${secondPlayerColorCode}"]`);
        if (colorElements.length > 0) {
          compatibleGame = true;
          console.log(`[사이드바] 호환 게임 감지: 색상 패턴 (color:#${secondPlayerColorCode})`);
        }
      }
      
      // 플레이어 ID만으로 검사 (마지막 패턴)
      if (!compatibleGame) {
        const playerIdElements = document.querySelectorAll(`[id*="${secondPlayerId}"]`);
        if (playerIdElements.length > 0) {
          compatibleGame = true;
          console.log(`[사이드바] 호환 게임 감지: 플레이어ID 패턴 (${secondPlayerId})`);
        }
      }
    }
  }
  
  if (!compatibleGame) {
    console.log("[사이드바] 이 게임은 사이드바와 호환되지 않습니다.");
    return;
  }
  
  // 햄버거 토글 버튼 생성 (항상 보임)
  const hamburgerToggle = document.createElement('div');
  hamburgerToggle.id = 'bga_hamburger_toggle';
  
  const hamburgerItem = document.createElement('div');
  hamburgerItem.className = 'bgext_side_menu_item';
  
  const hamburgerButton = document.createElement('div');
  hamburgerButton.className = 'bgext_avatar';
  hamburgerButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z"/>
  </svg>`;
  
  hamburgerItem.appendChild(hamburgerButton);
  hamburgerToggle.appendChild(hamburgerItem);
  document.body.appendChild(hamburgerToggle);
  
  // 사이드바 컨테이너 생성
  const sidebar = document.createElement('div');
  sidebar.id = 'bga_extension_sidebar';
  
  const sidebarContent = document.createElement('div');
  sidebarContent.style.cssText = 'display: flex; flex-flow: column; gap: 0.3em;';
  
  // X 버튼을 첫 번째로 추가 (햄버거 버튼과 같은 위치)
  const closeButton = createSidebarButton('close');
  
  // 토글 함수 정의
  function toggleSidebar() {
    if (sidebar.classList.contains('collapsed')) {
      // 사이드바 열기
      sidebar.classList.remove('collapsed');
      hamburgerToggle.style.display = 'none';
    } else {
      // 사이드바 닫기
      sidebar.classList.add('collapsed');
      hamburgerToggle.style.display = 'block';
    }
  }
  
  // 이벤트 리스너 등록
  closeButton.addEventListener('click', toggleSidebar);
  hamburgerButton.addEventListener('click', toggleSidebar);
  
  sidebarContent.appendChild(closeButton);
  
  // 위쪽 화살표 버튼
  const upButton = createSidebarButton('up');
  upButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  sidebarContent.appendChild(upButton);
  
  // 플레이어 버튼들 추가
  playerBoards.forEach((board, index) => {
    const playerId = board.id.replace('overall_player_board_', '');
    const avatarImg = board.querySelector('.avatar');
    const playerNameElement = board.querySelector('.player-name a');
    const playerColor = board.style.borderColor || '#ffffff';
    
    if (avatarImg && playerNameElement) {
      const playerName = playerNameElement.textContent.trim();
      const playerButton = createPlayerButton(avatarImg.src, playerName, playerColor, playerId);
      
      playerButton.addEventListener('click', () => {
        // 범용 컬러코드 추출: 플레이어 이름 링크의 style에서 6자리 연속 숫자 찾기
        const playerNameLink = board.querySelector('.player-name a[style*="color"]');
        let playerColorCode = null;
        
        if (playerNameLink && playerNameLink.style.color) {
          const styleColor = playerNameLink.style.color;
          // var(--color-mapping_008000) 또는 #72c3b1 에서 6자리 연속 숫자 추출
          const colorMatch = styleColor.match(/[a-fA-F0-9]{6}/);
          if (colorMatch) {
            playerColorCode = colorMatch[0].toLowerCase();
          }
        }
        
        let targetElement = null;
        
        // 범용 패턴으로 플레이어 영역 찾기
        const searchKeywords = ['player', 'table', 'game', 'map', 'zone', 'board'];
        
        // 1. 키워드 + ID/컬러코드 패턴 시도
        for (const keyword of searchKeywords) {
          // 컬러코드 기반 검색 (left-side-wrapper 안에서 page-title 제외)
          if (playerColorCode) {
            const wrapper = document.querySelector('#left-side-wrapper');
            if (wrapper) {
              const colorElements = wrapper.querySelectorAll(`[id*="${keyword}"][id*="${playerColorCode}"]`);
              const colorElement = Array.from(colorElements).find(el => !el.closest('#page-title') && el.offsetParent);
              if (colorElement) {
                targetElement = colorElement;
                console.log(`[사이드바] 찾은 패턴: ${keyword} + 컬러코드 (${colorElement.id})`);
                break;
              }
            }
          }
          
          // 플레이어ID 기반 검색 (left-side-wrapper 안에서 page-title 제외)
          const wrapper = document.querySelector('#left-side-wrapper');
          if (wrapper) {
            const idElements = wrapper.querySelectorAll(`[id*="${keyword}"][id*="${playerId}"]`);
            const idElement = Array.from(idElements).find(el => !el.closest('#page-title') && el.offsetParent);
            if (idElement) {
              targetElement = idElement;
              console.log(`[사이드바] 찾은 패턴: ${keyword} + 플래이어ID (${idElement.id})`);
              break;
            }
          }
        }
        
        // 2. 범용 색상 패턴 시도
        if (!targetElement && playerColorCode) {
          const colorElement = document.querySelector(`[style*="color:#${playerColorCode}"]`);
          if (colorElement && colorElement.offsetParent) {
            // 색상 요소의 적절한 부모 컨테이너 찾기
            targetElement = colorElement.closest('.whiteblock, .player-area, .game-area') || 
                           colorElement.parentElement || 
                           colorElement;
            console.log(`[사이드바] 찾은 패턴: 색상 기반 (color:#${playerColorCode})`);
          }
        }
        
        // 3. 플레이어 ID만으로 패턴 시도 (마지막, left-side-wrapper 안에서 page-title 제외)
        if (!targetElement) {
          const wrapper = document.querySelector('#left-side-wrapper');
          if (wrapper) {
            const playerIdElements = wrapper.querySelectorAll(`[id*="${playerId}"]`);
            const filteredElements = Array.from(playerIdElements).filter(el => !el.closest('#page-title') && el.offsetParent);
            if (filteredElements.length > 0) {
              targetElement = filteredElements[0];
              console.log(`[사이드바] 찾은 패턴: 플레이어ID 기반 (${targetElement.id})`);
            }
          }
        }
        
        // 모든 패턴이 실패하면 스크롤하지 않음 (player_boards는 정보 추출용이므로 제외)
        if (!targetElement || !targetElement.offsetParent) {
          targetElement = null; // 적절한 플레이어 보드를 찾지 못함
        }
        
        // 스크롤 실행
        if (targetElement && targetElement.offsetParent) {
          const elementTop = targetElement.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementTop - 100; // 100px 오프셋 적용
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
          console.log(`[사이드바] ${playerName} 플레이어 영역으로 스크롤:`, targetElement.id);
        } else {
          console.log(`[사이드바] ${playerName} 플레이어 영역을 찾을 수 없음`);
        }
      });
      
      sidebarContent.appendChild(playerButton);
    }
  });
  
  // 아래쪽 화살표 버튼
  const downButton = createSidebarButton('down');
  downButton.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
  sidebarContent.appendChild(downButton);
  
  sidebar.appendChild(sidebarContent);
  document.body.appendChild(sidebar);
  
  // 플레이어 수 저장 (중복 생성 방지용)
  sidebar.dataset.playerCount = playerBoards.length;
  
  // 초기 상태: 사이드바는 접혀있고, 햄버거 버튼만 보임
  sidebar.classList.add('collapsed');
  hamburgerToggle.style.display = 'block';
  
  // 드래그 기능 추가 (사이드바와 햄버거 버튼 모두)
  makeDraggable(sidebar, hamburgerToggle);
  makeDraggableHamburger(hamburgerToggle, sidebar);
  
  console.log(`[사이드바] 플레이어 사이드바가 생성되었습니다. (플레이어 수: ${playerBoards.length})`);
}

// 사이드바 버튼 생성 함수 (X, 화살표)
function createSidebarButton(type) {
  const item = document.createElement('div');
  item.className = 'bgext_side_menu_item';
  
  const avatar = document.createElement('div');
  avatar.className = 'bgext_avatar';
  
  let svgContent = '';
  switch(type) {
    case 'close':
      svgContent = `<svg width="32" height="32" viewBox="-40 -40 200 200" fill="currentColor" stroke="currentColor">
        <g><path fill-rule="evenodd" clip-rule="evenodd" d="M90.914,5.296c6.927-7.034,18.188-7.065,25.154-0.068 c6.961,6.995,6.991,18.369,0.068,25.397L85.743,61.452l30.425,30.855c6.866,6.978,6.773,18.28-0.208,25.247 c-6.983,6.964-18.21,6.946-25.074-0.031L60.669,86.881L30.395,117.58c-6.927,7.034-18.188,7.065-25.154,0.068 c-6.961-6.995-6.992-18.369-0.068-25.397l30.393-30.827L5.142,30.568c-6.867-6.978-6.773-18.28,0.208-25.247 c6.983-6.963,18.21-6.946,25.074,0.031l30.217,30.643L90.914,5.296L90.914,5.296z"></path></g>
      </svg>`;
      break;
    case 'up':
      svgContent = `<svg width="32" height="32" viewBox="-60 0 640 540" fill="currentColor" stroke="currentColor">
        <g transform="translate(0,-540.3622)"><path stroke-width="38.88000107" d="M 439.28228,860.51096 256.00063,677.22934 72.71772,860.51096 l 54.98539,54.9841 128.29752,-128.29752 128.29622,128.29752 z"></path></g>
      </svg>`;
      break;
    case 'down':
      svgContent = `<svg width="32" height="32" viewBox="-60 0 640 540" fill="currentColor" stroke="currentColor">
        <g transform="rotate(180) translate(-520,-1080)"><path stroke-width="38.88000107" d="M 439.28228,860.51096 256.00063,677.22934 72.71772,860.51096 l 54.98539,54.9841 128.29752,-128.29752 128.29622,128.29752 z"></path></g>
      </svg>`;
      break;
  }
  
  avatar.innerHTML = svgContent;
  item.appendChild(avatar);
  
  return item;
}

// 플레이어 버튼 생성 함수
function createPlayerButton(avatarSrc, playerName, playerColor, playerId) {
  const item = document.createElement('div');
  item.className = 'bgext_side_menu_item';
  
  const avatar = document.createElement('div');
  avatar.className = 'bgext_avatar';
  avatar.style.borderColor = playerColor;
  
  const avatarImg = document.createElement('img');
  avatarImg.src = avatarSrc;
  avatarImg.alt = playerName;
  avatar.appendChild(avatarImg);
  
  const nameLabel = document.createElement('div');
  nameLabel.className = 'bgext_player_name';
  nameLabel.style.backgroundColor = playerColor;
  nameLabel.textContent = playerName;
  
  // 텍스트 색상을 배경색에 따라 조정
  const rgb = playerColor.match(/\d+/g);
  if (rgb) {
    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    nameLabel.style.setProperty('color', brightness > 128 ? '#000000' : '#ffffff', 'important');
  } else {
    nameLabel.style.setProperty('color', '#000000', 'important'); // 기본값
  }
  
  item.appendChild(avatar);
  item.appendChild(nameLabel);
  
  return item;
}

// 드래그 기능 구현 함수
function makeDraggable(sidebar, hamburgerToggle) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  // 드래그 시작
  function handleMouseDown(e) {
    isDragging = true;
    sidebar.classList.add('dragging');
    
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = sidebar.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
  }
  
  // 드래그 중
  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newLeft = startLeft + deltaX;
    let newTop = startTop + deltaY;
    
    // 화면 경계 체크
    const maxLeft = window.innerWidth - sidebar.offsetWidth;
    const maxTop = window.innerHeight - sidebar.offsetHeight;
    
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));
    
    sidebar.style.left = newLeft + 'px';
    sidebar.style.top = newTop + 'px';
    
    // 햄버거 버튼 위치도 동일하게 이동
    hamburgerToggle.style.left = newLeft + 'px';
    hamburgerToggle.style.top = newTop + 'px';
  }
  
  // 드래그 종료
  function handleMouseUp(e) {
    isDragging = false;
    sidebar.classList.remove('dragging');
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // 위치 저장 (localStorage에 저장)
    const rect = sidebar.getBoundingClientRect();
    localStorage.setItem('bga_sidebar_position', JSON.stringify({
      left: rect.left,
      top: rect.top
    }));
  }
  
  // 터치 이벤트 (모바일 지원)
  function handleTouchStart(e) {
    const touch = e.touches[0];
    handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault()
    });
  }
  
  function handleTouchMove(e) {
    const touch = e.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  }
  
  function handleTouchEnd(e) {
    handleMouseUp(e);
  }
  
  // 이벤트 리스너 등록 (드래그 활성화)
  let startPos = { x: 0, y: 0 };
  let isDragReady = false;
  
  sidebar.addEventListener('mousedown', (e) => {
    startPos = { x: e.clientX, y: e.clientY };
    isDragReady = true;
    
    const tempMouseMove = (moveEvent) => {
      if (!isDragReady) return;
      
      const distance = Math.sqrt(
        Math.pow(moveEvent.clientX - startPos.x, 2) + 
        Math.pow(moveEvent.clientY - startPos.y, 2)
      );
      
      // 5px 이상 움직이면 드래그 시작
      if (distance > 5) {
        isDragReady = false;
        document.removeEventListener('mousemove', tempMouseMove);
        document.removeEventListener('mouseup', tempMouseUp);
        handleMouseDown(e);
      }
    };
    
    const tempMouseUp = () => {
      isDragReady = false;
      document.removeEventListener('mousemove', tempMouseMove);
      document.removeEventListener('mouseup', tempMouseUp);
    };
    
    document.addEventListener('mousemove', tempMouseMove);
    document.addEventListener('mouseup', tempMouseUp);
  });
  
  sidebar.addEventListener('touchstart', (e) => {
    if (e.target.closest('.bgext_avatar')) {
      return;
    }
    handleTouchStart(e);
  });
  
  sidebar.addEventListener('touchmove', handleTouchMove);
  sidebar.addEventListener('touchend', handleTouchEnd);
  
  // 저장된 위치 복원
  const savedPosition = localStorage.getItem('bga_sidebar_position');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      
      // 화면 크기 변경을 고려한 위치 조정
      const maxLeft = window.innerWidth - sidebar.offsetWidth;
      const maxTop = window.innerHeight - sidebar.offsetHeight;
      
      const newLeft = Math.max(0, Math.min(position.left, maxLeft));
      const newTop = Math.max(0, Math.min(position.top, maxTop));
      
      sidebar.style.left = newLeft + 'px';
      sidebar.style.top = newTop + 'px';
      hamburgerToggle.style.left = newLeft + 'px';
      hamburgerToggle.style.top = newTop + 'px';
      
    } catch (e) {
      console.log('[사이드바] 저장된 위치 복원 실패:', e);
    }
  }
}

// 햄버거 버튼 드래그 기능
function makeDraggableHamburger(hamburgerToggle, sidebar) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  function handleMouseDown(e) {
    isDragging = true;
    hamburgerToggle.style.cursor = 'grabbing';
    
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = hamburgerToggle.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
  }
  
  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newLeft = startLeft + deltaX;
    let newTop = startTop + deltaY;
    
    // 화면 경계 체크
    const maxLeft = window.innerWidth - hamburgerToggle.offsetWidth;
    const maxTop = window.innerHeight - hamburgerToggle.offsetHeight;
    
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));
    
    hamburgerToggle.style.left = newLeft + 'px';
    hamburgerToggle.style.top = newTop + 'px';
    
    // 사이드바 위치도 동일하게 이동
    sidebar.style.left = newLeft + 'px';
    sidebar.style.top = newTop + 'px';
  }
  
  function handleMouseUp(e) {
    isDragging = false;
    hamburgerToggle.style.cursor = 'grab';
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // 위치 저장
    const rect = hamburgerToggle.getBoundingClientRect();
    localStorage.setItem('bga_sidebar_position', JSON.stringify({
      left: rect.left,
      top: rect.top
    }));
  }
  
  // 드래그 감지 시스템 (사이드바와 동일)
  let startPos = { x: 0, y: 0 };
  let isDragReady = false;
  
  hamburgerToggle.addEventListener('mousedown', (e) => {
    startPos = { x: e.clientX, y: e.clientY };
    isDragReady = true;
    
    const tempMouseMove = (moveEvent) => {
      if (!isDragReady) return;
      
      const distance = Math.sqrt(
        Math.pow(moveEvent.clientX - startPos.x, 2) + 
        Math.pow(moveEvent.clientY - startPos.y, 2)
      );
      
      // 5px 이상 움직이면 드래그 시작
      if (distance > 5) {
        isDragReady = false;
        document.removeEventListener('mousemove', tempMouseMove);
        document.removeEventListener('mouseup', tempMouseUp);
        handleMouseDown(e);
      }
    };
    
    const tempMouseUp = () => {
      isDragReady = false;
      document.removeEventListener('mousemove', tempMouseMove);
      document.removeEventListener('mouseup', tempMouseUp);
    };
    
    document.addEventListener('mousemove', tempMouseMove);
    document.addEventListener('mouseup', tempMouseUp);
  });
}

// 게임 데이터를 추출하는 함수
function extractGameData(gameResult) {
  if (!gameResult) {
    return null;
  }
  
  const players = [];
  const scoreEntries = gameResult.querySelectorAll(".score-entry");
  
  // 게임 결과가 제대로 로드되었는지 검증
  if (scoreEntries.length === 0) {
    return null; // null 반환으로 호출자에게 재시도 신호
  }

  scoreEntries.forEach((entry) => {
    const rank = entry.querySelector(".rank")?.innerText.trim();
    const nickname = entry.querySelector(".playername, a.playername")?.innerText.trim();
    const scoreElement = entry.querySelector(".score");
    
    // 점수에서 숫자 부분만 추출 (예: "81 ★" -> "81")
    let score = "";
    if (scoreElement) {
      const scoreText = scoreElement.innerText.trim();
      const scoreMatch = scoreText.match(/^\d+/);
      score = scoreMatch ? scoreMatch[0] : scoreText;
    }

    // 유효한 데이터만 추가 (rank, nickname이 모두 있는 경우)
    // 닉네임은 띄어쓰기가 포함될 수 있으므로 null/undefined/빈문자열만 체크
    if (rank && nickname && rank.trim() !== "" && nickname != null && nickname !== "") {
      players.push({ rank, nickname, score });
    }
  });

  let gameNameElement = document.querySelector("#table_name");
  let gameName = gameNameElement
    ? gameNameElement.innerText.trim()
    : "게임명 오류";

  let url = window.location.href;
  let gameId = "unknown";

  let match = url.match(/table\?table=(\d+)/);
  if (match) {
    gameId = match[1];
  }

  let now = new Date();
  let formattedDateTime = getKSTDateTime();

  // 토너먼트 정보 추출
  let tournamentType = extractTournamentInfo();

  // 게임 생성 시각 추출
  let gameCreationTime = extractGameCreationTime();

  // 게임 타입 결정 (협력, 경쟁)
  let gameType = determineGameType(players);
  let winner;

  if (gameType === "협력") {
    // 협력 게임인 경우: rank에 "승자"가 포함된 모든 플레이어의 닉네임을 쉼표로 구분
    const winners = players
      .filter((player) => player.rank && player.rank.includes("승자"))
      .map((player) => player.nickname)
      .filter(nickname => nickname != null && nickname !== ""); // 띄어쓰기 포함 닉네임 허용
    
    // 협력게임에서 승자가 없으면 빈값 전송 (협력 실패)
    winner = winners.length > 0 ? winners.join(",") : "";
  } else {
    // 경쟁 게임인 경우: 여러 방법으로 승리자 찾기
    let winners = [];
    
    // 1차: "1위" 또는 "승자"가 포함된 플레이어 찾기
    winners = players
      .filter((player) => player.rank && (player.rank.includes("1위") || player.rank.includes("승자")))
      .map((player) => player.nickname)
      .filter(nickname => nickname != null && nickname !== ""); // 띄어쓰기 포함 닉네임 허용
    
    // 2차: 1차에서 찾지 못했으면 첫 번째 플레이어를 승리자로 간주 (순위순 정렬되어 있다고 가정)
    if (winners.length === 0 && players.length > 0) {
      const firstPlayer = players[0];
      if (firstPlayer && firstPlayer.nickname != null && firstPlayer.nickname !== "") {
        winners = [firstPlayer.nickname];
      }
    }
    
    winner = winners.length > 0 ? winners.join(",") : "No Winner";
  }
  
  if (players.length === 0) {
    return null; // null 반환으로 호출자에게 재시도 신호
  }
  
  // 디버깅을 위한 로그 추가
  logOnce(`[디버그] 게임 타입: ${gameType}`, 'game-type-debug');
  logOnce(`[디버그] 플레이어 데이터: ${JSON.stringify(players)}`, 'player-data-debug');
  logOnce(`[디버그] 승자 결과: ${winner}`, 'winner-result-debug');

  if (!winner || winner === "" || winner === "No Winner") {
    console.log("[경고] 승자가 없어서 null 반환");
    return null; // null 반환으로 호출자에게 재시도 신호
  }

  return {
    gameId,
    gameName,
    players,
    winner: winner,
    gameType: gameType,
    date: formattedDateTime,
    tournamentType: tournamentType,
    gameCreationTime: gameCreationTime,
  };
}

// 협력/경쟁 게임 타입 판별: 모두 승자 OR 모두 패자면 협력, 일부만 승자면 경쟁
function determineGameType(players) {
  const allWinners = players.every((player) => player.rank.trim() === "승자");
  
  // 아무도 승자나 1위가 아닌 경우 (모두 패자)
  const noWinners = players.every((player) => 
    !player.rank.includes("승자") && !player.rank.includes("1위")
  );
  
  // 모두 승자이거나 아무도 승자/1위가 아닌 경우 협력 게임
  return (allWinners || noWinners) ? "협력" : "경쟁";
}

// 토너먼트 정보를 추출하는 함수
function extractTournamentInfo() {
  // 토너먼트 링크 DOM 요소 찾기
  const tournamentElement = document.querySelector("#tournament_link");
  
  if (!tournamentElement || getComputedStyle(tournamentElement).display === "none") {
    if (gameDataLogCache.lastTournamentInfo !== "none") {
      console.log("[게임 정보] 토너먼트: 일반 게임");
      gameDataLogCache.lastTournamentInfo = "none";
    }
    return "none";
  }
  
  // 토너먼트 링크 텍스트 추출
  const tournamentLink = tournamentElement.querySelector("a.bga-link");
  if (!tournamentLink) {
    console.log("[토너먼트] 토너먼트 링크 없음 - 일반 게임");
    return "none";
  }
  
  const tournamentText = tournamentLink.textContent.trim().toLowerCase();
  console.log("[토너먼트] 토너먼트 텍스트:", tournamentText);
  
  // 'boako' 문자열이 포함되어 있는지 확인 (대소문자 무관)
  if (tournamentText.includes("boako")) {
    console.log("[토너먼트] BOAKO 토너먼트 감지");
    return "boako";
  } else {
    console.log("[토너먼트] 일반 토너먼트 감지");
    return "general";
  }
}

function addTournamentRecordButton() {
  if (!isTournamentPage()) return;
  
  // 중복 생성 방지
  if (document.getElementById("boako-tournament-save-button")) return;

  const button = document.createElement("button");
  button.id = "boako-tournament-save-button";
  button.innerText = "토너먼트 기록 저장";
  button.classList.add("boako-tournament-button", "bgabutton", "bgabutton_blue");

  // 👊 그냥 body에 추가하면 CSS의 fixed 속성 때문에 알아서 오른쪽 아래로 갑니다.
  document.body.appendChild(button);

  console.log("✅ 버튼을 다시 편안한 오른쪽 아래로 보냈습니다.");


  button.onclick = async () => {
    const originalText = button.innerText;
    button.innerHTML = `${originalText} <div class="spinner"></div>`;
    button.disabled = true;
    button.classList.add("disabled-button");

    const reporter = await getReporterNickname();
    if (!reporter) {
      resetButton(button, originalText);
      button.classList.remove("disabled-button");
      showPopupMessage("로그인 닉네임을 찾을 수 없습니다.", false, button);
      return;
    }

    const tournamentData = extractTournamentData(reporter);
    if (tournamentData?.error === "not_boako") {
      resetButton(button, originalText);
      button.classList.remove("disabled-button");
      showPopupMessage("BOAKO 토너먼트만 저장할 수 있습니다.", false, button);
      return;
    }

    if (!tournamentData || tournamentData.players.length === 0) {
      resetButton(button, originalText);
      button.classList.remove("disabled-button");
      showPopupMessage("토너먼트 순위 데이터를 찾지 못했습니다.", false, button);
      return;
    }

    console.log("[토너먼트 기록] 추출 데이터:", tournamentData);
    sendTournamentToBackground(tournamentData, button, originalText);
  };

  document.body.appendChild(button);
}

function extractTournamentData(reporter) {
  const tournamentName = extractTournamentName();
  if (!isBoakoTournamentName(tournamentName)) {
    return {
      error: "not_boako",
      tournamentName: tournamentName
    };
  }

  const players = extractTournamentPlayers();
  const rankSection = buildTournamentRankSection(players);

// ▼▼▼ 게임명 가져오는  ▼▼▼
  const gameLink = document.querySelector('a.bga-link[href*="gamepanel?game="]');
  const gameName = gameLink ? gameLink.innerText.trim() : "Unknown Game";
  // ▲▲▲ 추가 끝 ▲▲▲

  return {
    tournamentId: extractTournamentId(),
    tournamentName: tournamentName,
    tournamentMode: extractTournamentMode(),
    startTime: parseKoreanDateTimeToTZ(extractTournamentStartTime()),
    reporter: reporter,
    rankSection: rankSection,
    playerCount: players.length,
    players: players,
    sourceUrl: window.location.href,
    collectedAt: getKSTDateTime(),
    gameName:gameName
  };
}

function extractTournamentId() {
  const url = window.location.href;
  const idMatch = url.match(/[?&]id=(\d+)/) || url.match(/\/tournament\/(\d+)/);
  if (idMatch) {
    return idMatch[1];
  }

  const fallbackId = `${window.location.pathname}${window.location.search}`
    .replace(/[^\w=-]/g, "_")
    .slice(0, 80);
  return fallbackId || "unknown";
}

function isBoakoTournamentName(tournamentName) {
  return /boako/i.test(String(tournamentName || ""));
}

function extractTournamentName() {
  const titleElement = document.querySelector(".bga-tournament__game-header__tournament-name");
  const championshipElement = document.querySelector(".bga-tournament__game-header__tournament-championship-name");

  const nameParts = [
    getCleanTournamentText(titleElement),
    getCleanTournamentText(championshipElement)
  ].filter(Boolean);

  if (nameParts.length > 0) {
    return [...new Set(nameParts)].join(" ");
  }

  const fallbackTitle = document.querySelector("h1, h2, .pagesection__title, #page-title");
  return getCleanTournamentText(fallbackTitle) || "정보 없음";
}

function extractTournamentMode() {
  const pageText = document.body?.innerText || "";

  if (/스위스|swiss/i.test(pageText)) {
    return "swiss";
  }

  if (/엘리미네이션|elimination|knockout/i.test(pageText)) {
    return "elimination";
  }

  if (/라운드\s*로빈|round\s*robin/i.test(pageText)) {
    return "round_robin";
  }

  return "unknown";
}

function extractTournamentStartTime() {
  const selectors = [
    ".bga-tournament__game-header .truncate",
    ".bga-tournament__game-header [class*='date']",
    ".tournament-header [class*='date']",
    ".truncate.svelte-1yitbuo",
    "[class*='tournament'][class*='date']"
  ];

  for (const selector of selectors) {
    const value = getCleanTournamentText(document.querySelector(selector));
    if (value) {
      return value;
    }
  }

  const header = document.querySelector(".bga-tournament__game-header") || document.body;
  const dateLikeText = findTournamentText(header, [
    /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/,
    /\d{1,2}월\s*\d{1,2}일/,
    /\d{4}-\d{1,2}-\d{1,2}/,
    /\d{1,2}:\d{2}/
  ]);

  return dateLikeText || "정보 없음";
}

function extractTournamentPlayers() {
  const playerMap = collectTournamentPlayersByRankPriority();
  const rows = collectTournamentResultRows();

  rows.forEach((row, index) => {
    const names = extractTournamentNamesFromRow(row);
    if (names.length === 0) {
      return;
    }

    const rank = extractTournamentRankFromRow(row, index);
    names.forEach((name) => {
      mergeTournamentPlayerRank(playerMap, name, rank || String(index + 1), 3);
    });
  });

  if (playerMap.size > 0) {
    return mapTournamentPlayers(playerMap);
  }

  return extractTournamentPlayersFromRankElements();
}

function collectTournamentPlayersByRankPriority() {
  const rankSources = [
    {
      selector: ".relative.text-white.font-semibold.h-full.flex.justify-center.items-center.leading-none",
      priority: 1
    },
    {
      selector: ".tournament-results__rank--shared",
      priority: 2
    }
  ];
  const playerMap = new Map();

  rankSources.forEach((rankSource) => {
    document.querySelectorAll(rankSource.selector).forEach((rankElement) => {
      const rank = normalizeTournamentRank(rankElement.innerText);
      if (!rank) {
        return;
      }

      const row = findTournamentRowForRankElement(rankElement);
      if (!row) {
        return;
      }

      extractTournamentNamesFromRow(row).forEach((name) => {
        mergeTournamentPlayerRank(playerMap, name, rank, rankSource.priority);
      });
    });
  });

  return playerMap;
}

function mapTournamentPlayers(playerMap) {
  return Array.from(playerMap.values()).map((player) => ({
    rank: player.rank,
    name: player.name
  }));
}

function findTournamentRowForRankElement(rankElement) {
  const closestRow = rankElement.closest(
    ".tournament-results__row, [class*='tournament-results__row'], [class*='tournament-ranking__row'], tr"
  );
  if (closestRow) {
    return closestRow;
  }

  const fallbackRow = rankElement.parentElement?.parentElement;
  if (fallbackRow?.querySelector(".playername, a.playername, [class*='playername'], [class*='player-name']")) {
    return fallbackRow;
  }

  return null;
}

function mergeTournamentPlayerRank(playerMap, name, rank, priority) {
  if (!name || !rank) {
    return;
  }

  const existing = playerMap.get(name);
  if (!existing || priority < existing.priority) {
    playerMap.set(name, {
      name: name,
      rank: rank,
      priority: priority
    });
  }
}

function collectTournamentResultRows() {
  const rowSelectors = [
    ".tournament-results__row",
    "[class*='tournament-results__row']",
    "[class*='tournament-ranking__row']",
    "tr"
  ];
  const rows = [];
  const seen = new Set();

  rowSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((row) => {
      if (!seen.has(row) && row.querySelector(".playername, a.playername, [class*='playername'], [class*='player-name']")) {
        rows.push(row);
        seen.add(row);
      }
    });
  });

  return rows;
}

function extractTournamentPlayersFromRankElements() {
  const rankElements = document.querySelectorAll(
    ".tournament-results__rank--shared, [class*='tournament-results__rank'], [class*='tournament-ranking__rank']"
  );
  const players = [];

  rankElements.forEach((rankElement) => {
    const rank = normalizeTournamentRank(rankElement.innerText);
    const row = rankElement.closest(".tournament-results__row, [class*='tournament-results__row'], [class*='tournament-ranking__row'], tr");
    if (!row || !rank) {
      return;
    }

    extractTournamentNamesFromRow(row).forEach((name) => {
      players.push({ rank, name });
    });
  });

  return dedupeTournamentPlayers(players);
}

function extractTournamentNamesFromRow(row) {
  const nameElements = row.querySelectorAll(".playername, a.playername, [class*='playername'], [class*='player-name']");
  const names = [];

  nameElements.forEach((nameElement) => {
    const name = getCleanTournamentText(nameElement);
    if (name && !names.includes(name)) {
      names.push(name);
    }
  });

  return names;
}

function extractTournamentRankFromRow(row, rowIndex) {
  const rankSelectors = [
    ".tournament-results__rank--shared",
    "[class*='tournament-results__rank']",
    "[class*='tournament-ranking__rank']",
    ".rank"
  ];

  for (const selector of rankSelectors) {
    const candidates = row.querySelectorAll(selector);
    for (const candidate of candidates) {
      const rank = normalizeTournamentRank(candidate.innerText);
      if (rank) {
        return rank;
      }
    }
  }

  const cells = Array.from(row.querySelectorAll("td, th")).slice(0, 3);
  for (const cell of cells) {
    const rank = normalizeTournamentRank(cell.innerText);
    if (rank) {
      return rank;
    }
  }

  return String(rowIndex + 1);
}

function normalizeTournamentRank(text) {
  const value = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) {
    return null;
  }

  const rangeMatch = value.match(/(\d+)\s*[-~–]\s*(\d+)/);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  const koreanRankMatch = value.match(/^#?\s*(\d+)\s*위/);
  if (koreanRankMatch) {
    return koreanRankMatch[1];
  }

  const ordinalMatch = value.match(/^#?\s*(\d+)(?:st|nd|rd|th)?\.?$/i);
  if (ordinalMatch) {
    return ordinalMatch[1];
  }

  const leadingNumberMatch = value.match(/^#?\s*(\d+)\b/);
  if (leadingNumberMatch && value.length <= 8) {
    return leadingNumberMatch[1];
  }

  // 🎯 여기에 탈락, 기권, 실격 조건을 추가!
  if (/^(승자|winner|탈락|기권|실격)$/i.test(value)) {
    return value;
  }

  return null;
}

function buildTournamentRankSection(players) {
  const rankSection = [];

  players.forEach((player) => {
    if (player.rank && !rankSection.includes(player.rank)) {
      rankSection.push(player.rank);
    }
  });

  return rankSection;
}

function dedupeTournamentPlayers(players) {
  const seen = new Set();
  return players.filter((player) => {
    const key = `${player.rank}::${player.name}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getCleanTournamentText(elementOrText) {
  const text = typeof elementOrText === "string"
    ? elementOrText
    : elementOrText?.innerText || elementOrText?.textContent || "";

  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findTournamentText(root, patterns) {
  if (!root) {
    return null;
  }

  const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
  for (const element of elements) {
    const text = getCleanTournamentText(element);
    if (text && text.length < 120 && patterns.some((pattern) => pattern.test(text))) {
      return text;
    }
  }

  return null;
}

// 게임 생성 시각을 추출하는 함수
function extractGameCreationTime() {
  // 여러 선택자 시도
  const possibleSelectors = [
    "#creationtime",
    ".creationtime", 
    "[id*='creation']",
    "[class*='creation']",
    ".gamedate",
    ".game-date",
    ".table-date",
    ".created",
    ".game-created"
  ];
  
  let creationTimeElement = null;
  let creationTimeText = "";
  
  // 각 선택자를 순서대로 시도
  for (const selector of possibleSelectors) {
    creationTimeElement = document.querySelector(selector);
    if (creationTimeElement) {
      creationTimeText = creationTimeElement.textContent.trim();
      // 로그는 최종 결과에서만 출력
      if (creationTimeText && creationTimeText.includes("생성")) {
        break; // 생성 관련 텍스트가 있으면 사용
      }
    }
  }
  
  // 선택자로 찾지 못했으면 텍스트 검색으로 시도
  if (!creationTimeElement || !creationTimeText.includes("생성")) {
    console.log("[생성시각] 선택자로 찾지 못함, 텍스트 검색 시도");
    
    // 페이지 전체에서 "생성됨" 텍스트 검색
    const allElements = document.querySelectorAll("*");
    for (const element of allElements) {
      const text = element.textContent.trim();
      // 절대 시간, 상대 시간, 상대 날짜+시간 형식 모두 지원
      if (text.includes("생성됨") && (
        text.match(/\d{4}년.*\d{1,2}월.*\d{1,2}일.*\d{1,2}시.*\d{1,2}분에\s*생성됨/) ||  // 절대 시간
        text.match(/\d+(분|시간|일)\s*전에\s*생성됨/) ||  // 상대 시간
        text.match(/(어제|그저께|오늘)\s*\d{1,2}:\d{1,2}에\s*생성됨/)  // 상대 날짜+시간
      )) {
        creationTimeText = text;
        console.log("[생성시각] 텍스트 검색으로 발견:", creationTimeText);
        break;
      }
    }
  }
  
  if (!creationTimeText || !creationTimeText.includes("생성")) {
    console.log("[생성시각] 생성 시각을 찾을 수 없음");
    return null;
  }
  
  // 같은 생성시각이면 로그 생략
  if (gameDataLogCache.lastCreationTime !== creationTimeText) {
    console.log("[게임 정보] 생성시각:", creationTimeText);
    gameDataLogCache.lastCreationTime = creationTimeText;
  }
  
  // 1. 절대 시간 형식: "2025년 06월 12일 06시 45분에 생성됨"
  const absoluteTimeMatch = creationTimeText.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시\s*(\d{1,2})분에\s*생성됨/);
  
  if (absoluteTimeMatch) {
    const [, year, month, day, hour, minute] = absoluteTimeMatch;
    const formattedTime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
    // 변환된 시간은 로그에 출력하지 않음 (중복 방지)
    return formattedTime;
  }
  
  // 2. 상대 시간 형식: "26분 전에 생성됨", "4시간 전에 생성됨" 등
  const relativeTimeMatch = creationTimeText.match(/(\d+)(분|시간|일)\s*전에\s*생성됨/);
  
  if (relativeTimeMatch) {
    const [, amount, unit] = relativeTimeMatch;
    const now = new Date();
    const amountNum = parseInt(amount);
    
    let targetTime;
    switch (unit) {
      case '분':
        targetTime = new Date(now.getTime() - (amountNum * 60 * 1000));
        break;
      case '시간':
        targetTime = new Date(now.getTime() - (amountNum * 60 * 60 * 1000));
        break;
      case '일':
        targetTime = new Date(now.getTime() - (amountNum * 24 * 60 * 60 * 1000));
        break;
      default:
        logOnce(`[생성시각] 알 수 없는 시간 단위: ${unit}`, 'unknown-time-unit');
        return null;
    }
    
    // KST 기준으로 MySQL DATETIME 형식으로 변환
    const kstOffset = 9 * 60; // KST는 UTC+9
    const utc = targetTime.getTime() + (targetTime.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (kstOffset * 60000));
    
    const year = kst.getFullYear();
    const month = String(kst.getMonth() + 1).padStart(2, '0');
    const day = String(kst.getDate()).padStart(2, '0');
    const hour = String(kst.getHours()).padStart(2, '0');
    const minute = String(kst.getMinutes()).padStart(2, '0');
    const second = String(kst.getSeconds()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    console.log(`[생성시각] 상대 시간 변환: ${amountNum}${unit} 전 -> ${formattedTime}`);
    return formattedTime;
  }
  
  // 3. 상대 날짜 + 시간 형식: "어제 15:07에 생성됨", "그저께 09:30에 생성됨" 등
  const relativeDayTimeMatch = creationTimeText.match(/(어제|그저께|오늘)\s*(\d{1,2}):(\d{1,2})에\s*생성됨/);
  
  if (relativeDayTimeMatch) {
    const [, dayText, hour, minute] = relativeDayTimeMatch;
    const now = new Date();
    let targetDate;
    
    switch (dayText) {
      case '오늘':
        targetDate = new Date(now);
        break;
      case '어제':
        targetDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case '그저께':
        targetDate = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
        break;
      default:
        console.log("[생성시각] 알 수 없는 날짜 표현:", dayText);
        return null;
    }
    
    // 시간 설정
    targetDate.setHours(parseInt(hour));
    targetDate.setMinutes(parseInt(minute));
    targetDate.setSeconds(0);
    targetDate.setMilliseconds(0);
    
    // KST 기준으로 MySQL DATETIME 형식으로 변환
    const kstOffset = 9 * 60; // KST는 UTC+9
    const utc = targetDate.getTime() + (targetDate.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (kstOffset * 60000));
    
    const year = kst.getFullYear();
    const month = String(kst.getMonth() + 1).padStart(2, '0');
    const day = String(kst.getDate()).padStart(2, '0');
    const formattedHour = String(kst.getHours()).padStart(2, '0');
    const formattedMinute = String(kst.getMinutes()).padStart(2, '0');
    const second = String(kst.getSeconds()).padStart(2, '0');
    
    const formattedTime = `${year}-${month}-${day} ${formattedHour}:${formattedMinute}:${second}`;
    logOnce(`[생성시각] 상대 날짜+시간 변환: ${dayText} ${hour}:${minute} -> ${formattedTime}`, 'relative-datetime-conversion');
    return formattedTime;
  }
  
  console.log("[생성시각] 시간 형식 파싱 실패 - 지원되지 않는 형식:", creationTimeText);
  return null;
}

// 백그라운드 스크립트로 데이터 전송
function sendToBackground(data, buttonElement, originalButtonText) {
  // 기존의 chrome.storage.sync.get 대신, 문서에서 직접 사용자 닉네임을 가져옴.
  const userNickname = getCurrentUserNickname();
  if (!userNickname) {
    console.log("로그인 되지 않음");
    resetButton(buttonElement, originalButtonText);
    showPopupMessage("로그인 되지 않음", false, buttonElement);
    return;
  }

  data.nickname = userNickname.toLowerCase();
  
  // 게임 기록 중복 처리 방지 (올바른 필드명 사용)
  const gameKey = `${data.nickname}-${data.gameName}-${data.gameId}`;
  if (processedGameRecords.has(gameKey)) {
    console.log("[게임 기록] 이미 처리된 게임 기록:", gameKey);
    return;
  }
console.log("[게임 기록] 쌩쌩한 신규 데이터 발견! 슈파베이스로 출발합니다.");
  // 사용자가 참여한 게임 기록을 전송 (버튼 단계에서 이미 필터링됨)
  // ineligible 여부는 서버에서 판단

  try {
    chrome.runtime.sendMessage({ action: "saveGameRecord", data }, (response) => {
      if (chrome.runtime.lastError) {
      console.log(
        "[확장 프로그램] 백그라운드 스크립트 연결 실패:",
        chrome.runtime.lastError.message
      );
      resetButton(buttonElement, originalButtonText);
      showPopupMessage(
        "저장 실패: 확장 프로그램을 새로고침하세요",
        false,
        buttonElement
      );
      return;
    }

    console.log("백그라운드 응답:", response);
    resetButton(buttonElement, originalButtonText);

    if (response && response.success) {
      // 처리 완료된 게임 기록으로 표시
      processedGameRecords.add(gameKey);
      
      // 서버에서 제공한 메시지가 있으면 그것을 사용, 없으면 기본 메시지 사용
      const successMessage = response.message || "게임 기록 성공";
      showPopupMessage(successMessage, true, buttonElement);
    } else {
      let errorMessage = "저장 실패: ";
      if (response?.error) {
        switch (response.error) {
          case "unauthorized":
            errorMessage += "권한이 없습니다.";
            break;
          case "duplicate":
            errorMessage += "이미 저장된 게임 기록입니다.";
            break;
          case "invalid_data":
            errorMessage += "잘못된 데이터 형식입니다.";
            break;
          case "invalid_game_id":
            errorMessage +=
              "오류: 게임 ID를 찾을 수 없습니다. 다시 시도해주세요.";
            break;
          case "server_error":
            errorMessage += "서버 오류가 발생했습니다. 다시 시도해주세요.";
            break;
          default:
            errorMessage += "알 수 없는 오류 발생.";
        }
      }
      showPopupMessage(errorMessage, false, buttonElement);
    }
    });
  } catch (error) {
    console.error("[오류] chrome.runtime.sendMessage 호출 실패:", error);
    resetButton(buttonElement, originalButtonText);
    showPopupMessage("저장 실패: 확장 프로그램 오류", false, buttonElement);
  }
}

function sendTournamentToBackground(data, buttonElement, originalButtonText) {
  const tournamentKey = `${data.reporter}-${data.tournamentId}`;
  if (processedTournamentRecords.has(tournamentKey)) {
    console.log("[토너먼트 기록] 이미 처리된 토너먼트 기록:", tournamentKey);
    resetButton(buttonElement, originalButtonText);
    buttonElement?.classList.remove("disabled-button");
    showPopupMessage("이미 처리한 토너먼트 기록입니다.", true, buttonElement);
    return;
  }

  try {
    chrome.runtime.sendMessage({ action: "saveTournamentRecord", data }, (response) => {
      if (chrome.runtime.lastError) {
        console.log(
          "[확장 프로그램] 토너먼트 기록 백그라운드 연결 실패:",
          chrome.runtime.lastError.message
        );
        resetButton(buttonElement, originalButtonText);
        buttonElement?.classList.remove("disabled-button");
        showPopupMessage("저장 실패: 확장 프로그램을 새로고침하세요", false, buttonElement);
        return;
      }

      console.log("[토너먼트 기록] 백그라운드 응답:", response);
      resetButton(buttonElement, originalButtonText);
      buttonElement?.classList.remove("disabled-button");

      if (response && response.success) {
        processedTournamentRecords.add(tournamentKey);
        showPopupMessage(response.message || "토너먼트 기록 저장 완료", true, buttonElement);
        return;
      }

      let errorMessage = "토너먼트 저장 실패";
      if (response?.error) {
        switch (response.error) {
          case "invalid_data":
            errorMessage = "토너먼트 저장 실패: 데이터 형식 오류";
            break;
          case "server_error":
            errorMessage = "토너먼트 저장 실패: 서버 오류";
            break;
          default:
            errorMessage = `토너먼트 저장 실패: ${response.error}`;
        }
      }

      showPopupMessage(errorMessage, false, buttonElement);
    });
  } catch (error) {
    console.error("[오류] 토너먼트 기록 전송 실패:", error);
    resetButton(buttonElement, originalButtonText);
    buttonElement?.classList.remove("disabled-button");
    showPopupMessage("저장 실패: 확장 프로그램 오류", false, buttonElement);
  }
}

// 버튼 초기화 헬퍼 함수 추가
function resetButton(buttonElement, originalText) {
  if (buttonElement) {
    buttonElement.innerHTML = originalText;
    buttonElement.disabled = false;
  }
}

// 팝업 메시지를 시스템 대화창으로 표시하는 함수
function showPopupMessage(message, isSuccess = true, buttonElement = null) {
  let popup = document.createElement("div");
  popup.classList.add("z_popup");
  popup.innerText = message;
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.remove();
  }, 3500);
}

// 모든 Observer들을 통합 관리하는 함수
function setupAllObservers() {
  
  // 기존 Observer들 정리 (메모리 누수 방지)
  cleanupAllObservers();
  
  // 새로운 Observer들 설정
  setupGameLinksObserver();
  setupFirstWinObserver();
  setupTrophyPopupObserver();
  setupPlayerMenuTabObserver();
}

// 모든 Observer들을 정리하는 함수
function cleanupAllObservers() {
  // 첫승 Observer 정리
  if (window.boakoFirstWinObserver) {
    window.boakoFirstWinObserver.disconnect();
    window.boakoFirstWinObserver = null;
  }
  
  // 게임 링크 Observer들 정리 (배열)
  if (window.boakoGameLinksObserver && Array.isArray(window.boakoGameLinksObserver)) {
    window.boakoGameLinksObserver.forEach(observer => {
      if (observer) observer.disconnect();
    });
    window.boakoGameLinksObserver = null;
  }
  
  // 트로피 팝업 Observer 정리
  if (window.boakoTrophyPopupObserver) {
    window.boakoTrophyPopupObserver.disconnect();
    window.boakoTrophyPopupObserver = null;
  }
  
  // 플레이어 메뉴 탭 Observer 정리
  if (window.boakoPlayerMenuTabObserver) {
    window.boakoPlayerMenuTabObserver.disconnect();
    window.boakoPlayerMenuTabObserver = null;
  }

  if (window.boakoPlayerMenuTabClickHandler) {
    document.removeEventListener('click', window.boakoPlayerMenuTabClickHandler);
    window.boakoPlayerMenuTabClickHandler = null;
  }

  if (window.boakoSeeMoreNewsButton && window.boakoSeeMoreNewsClickHandler) {
    window.boakoSeeMoreNewsButton.removeEventListener('click', window.boakoSeeMoreNewsClickHandler);
    window.boakoSeeMoreNewsButton = null;
    window.boakoSeeMoreNewsClickHandler = null;
  }
  window.seeMoreNewsObserverActive = false;
  
  // 기타 Observer들 (설정되어 있다면 정리)
  const otherObservers = [
    'boakoAchievementsPageObserver',
    'boakoSeeMoreButtonObserver', 
    'boakoSeeMoreNewsObserver'
  ];
  
  otherObservers.forEach(observerName => {
    if (window[observerName]) {
      window[observerName].disconnect();
      window[observerName] = null;
    }
  });

  console.log(`[Observer 정리] 모든 Observer 정리됨`);
}

// 첫승 감지를 위한 Observer 설정 함수
function setupFirstWinObserver() {
  
  // 사이드바 알림 영역을 감시하는 Observer
  const firstWinObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // 텍스트 노드가 아닌 엘리먼트만 처리
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 알림 메시지에서 "첫 승" 텍스트 찾기
            const notificationContent = node.querySelector('.notification-content');
            if (notificationContent) {
              const notificationText = notificationContent.textContent || '';
              if (notificationText.includes('첫 승') && notificationText.includes('업적을 획득했습니다')) {
                logOnce(`[첫승 감지] ${notificationText}`, `first-win-found-${notificationText}`);

                // 첫승 정보 추출
                const firstWinInfo = extractFirstWinInfo(node);
                if (firstWinInfo) {
                  
                  // 첫승 정보를 데이터베이스에 저장
                  saveFirstWinRecord(firstWinInfo);
                }
              }
            }
          }
        });
      }
    });
  });
  
  // 사이드바 영역 감시 시작
  const sidebarElement = document.querySelector('#right-side-first-part') || 
                        document.querySelector('.player_board_wrap');
  
  if (sidebarElement) {
    firstWinObserver.observe(sidebarElement, {
      childList: true,
      subtree: true
    });
    
    // 전역 변수로 Observer 참조 저장 (정리용)
    window.boakoFirstWinObserver = firstWinObserver;
  }
}

// 첫승 정보 추출 함수
function extractFirstWinInfo(notificationElement) {
  try {
    const notificationContent = notificationElement.querySelector('.notification-content');
    const notificationTime = notificationElement.querySelector('.notification-time');
    
    if (!notificationContent || !notificationTime) {
      logOnce("[첫승 정보 추출] 필요한 요소를 찾을 수 없음", 'first-win-elements-not-found');
      return null;
    }
    
    // 플레이어 닉네임 추출
    const playerLink = notificationContent.querySelector('a.playername');
    const playerNickname = playerLink ? playerLink.textContent.trim() : null;
    
    // 게임 이름 추출
    const gameNameElement = notificationContent.querySelector('.gamename');
    const gameName = gameNameElement ? gameNameElement.textContent.trim() : null;
    
    // 사용자 업적 링크 생성 (achievements?id={user_id} 패턴)
    const userId = getBGAUserId();
    const achievementsLink = userId ? `https://boardgamearena.com/achievements?id=${userId}` : null;
    
    // 시간 정보 추출 ("6일 전" 형식)
    const timeText = notificationTime.textContent.trim();
    const firstWinDate = parseRelativeDate(timeText);
    
    // 전체 알림 텍스트
    const fullNotificationText = notificationContent.textContent.trim();
    
    if (!playerNickname || !gameName || !firstWinDate) {
      console.log("[첫승 정보 추출] 필수 정보 누락 - 닉네임:", playerNickname, "게임명:", gameName, "날짜:", firstWinDate);
      return null;
    }
    
    return {
      playerNickname: playerNickname.toLowerCase(),
      gameName: gameName,
      firstWinDate: firstWinDate,
      awardLink: achievementsLink,
      notificationText: fullNotificationText + " (사이드바 알림)"
    };
    
  } catch (error) {
    console.error("[첫승 정보 추출] 오류 발생:", error);
    return null;
  }
}

// 상대 날짜를 실제 날짜로 변환하는 함수 (KST 기준)
function parseRelativeDate(timeText) {
  try {
    const now = new Date();
    
    // "N일 전", "N시간 전", "N분 전" 등의 패턴 처리
    if (timeText.includes('일 전')) {
      const daysMatch = timeText.match(/(\d+)일 전/);
      if (daysMatch) {
        const daysAgo = parseInt(daysMatch[1]);
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - daysAgo);
        return getKSTDateFromDate(targetDate); // KST 기준 YYYY-MM-DD 형식
      }
    } else if (timeText.includes('시간 전')) {
      const hoursMatch = timeText.match(/(\d+)시간 전/);
      if (hoursMatch) {
        const hoursAgo = parseInt(hoursMatch[1]);
        const targetDate = new Date(now);
        targetDate.setHours(targetDate.getHours() - hoursAgo);
        return getKSTDateFromDate(targetDate); // KST 기준 YYYY-MM-DD 형식
      }
    } else if (timeText.includes('분 전')) {
      // 1시간 미만은 오늘로 간주
      return getKSTDate(); // KST 기준 YYYY-MM-DD 형식
    } else if (timeText.includes('방금') || timeText.includes('지금')) {
      // 방금 전은 오늘로 간주
      return getKSTDate(); // KST 기준 YYYY-MM-DD 형식
    }
    
    console.log("[날짜 파싱] 알 수 없는 시간 형식:", timeText);
    return null;
    
  } catch (error) {
    console.error("[날짜 파싱] 오류 발생:", error);
    return null;
  }
}

// 업적 팝업 첫승 감지를 위한 Observer 설정 함수
function setupTrophyPopupObserver() {
  
  // 업적 팝업 오버레이를 감시하는 Observer
  const trophyPopupObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // 텍스트 노드가 아닌 엘리먼트만 처리
          if (node.nodeType === Node.ELEMENT_NODE) {
            // splashedNotifications_overlay가 추가되었는지 확인
            if (node.id === 'splashedNotifications_overlay' || node.querySelector('#splashedNotifications_overlay')) {
              console.log("[업적 팝업 첫승 감지] 업적 팝업 감지됨");
              
              // 약간의 딜레이 후에 첫승 확인 (DOM이 완전히 로드될 때까지)
              setTimeout(() => {
                checkTrophyPopupForFirstWin(node.id === 'splashedNotifications_overlay' ? node : node.querySelector('#splashedNotifications_overlay'));
              }, 500);
            }
            
            // 또는 기존 오버레이 내에 새로운 splash_block이 추가된 경우
            if (node.classList && node.classList.contains('splash_block')) {
              logOnce("[업적 팝업 첫승 감지] 새 업적 블록 감지됨", 'trophy-block-detected');
              setTimeout(() => {
                checkTrophyPopupForFirstWin(document.querySelector('#splashedNotifications_overlay'));
              }, 500);
            }
          }
        });
      }
      
      // 속성 변경 감지 (display: block 등)
      if (mutation.type === 'attributes' && mutation.target.id === 'splashedNotifications_overlay') {
        const target = mutation.target;
        const style = getComputedStyle(target);
        if (style.display === 'block' && style.opacity !== '0') {
          logOnce("[업적 팝업 첫승 감지] 업적 팝업 표시됨", 'trophy-popup-shown');
          setTimeout(() => {
            checkTrophyPopupForFirstWin(target);
          }, 500);
        }
      }
    });
  });
  
  // document.body 전체를 감시
  trophyPopupObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  // 전역 변수로 Observer 저장
  window.boakoTrophyPopupObserver = trophyPopupObserver;
}

// 업적 팝업에서 첫승 확인 함수
function checkTrophyPopupForFirstWin(overlayElement) {
  if (!overlayElement) {
    console.log("[업적 팝업 첫승 확인] 오버레이 요소가 없음");
    return;
  }
  
  try {
    // 현재 표시된 업적 블록 찾기
    const splashBlocks = overlayElement.querySelectorAll('.splash_block');
    
    splashBlocks.forEach((block) => {
      // 게임 이름 추출
      const gameNameElement = block.querySelector('.splash_gamename.gamename');
      const gameName = gameNameElement ? gameNameElement.textContent.trim() : null;
      
      // 업적 이름 추출
      const trophyNameElement = block.querySelector('.splash_trophyname');
      const trophyName = trophyNameElement ? trophyNameElement.textContent.trim() : null;
      
      console.log("[업적 팝업 첫승 확인] 게임:", gameName, "업적:", trophyName);
      
      // "첫 승"이 포함된 업적인지 확인
      if (trophyName && trophyName.includes('첫 승')) {
        console.log("[업적 팝업 첫승 확인] 첫승 업적 발견!");
        
        const currentUserNickname = getCurrentUserNickname();
        
        if (!currentUserNickname) {
          console.log("[업적 팝업 첫승 확인] 로그인되지 않음");
          return;
        }
        
        // 첫승 정보 생성 (오늘 날짜로)
        const today = getKSTDate(); // KST 기준 YYYY-MM-DD 형식
        
        const firstWinInfo = {
          playerNickname: currentUserNickname.toLowerCase(),
          gameName: gameName,
          firstWinDate: today,
          awardLink: null, // 팝업에서는 링크 정보 없음
          notificationText: `${currentUserNickname}님이 ${gameName}에서 ${trophyName} 업적을 획득했습니다 (업적 팝업)`
        };
        
        console.log("[업적 팝업 첫승 확인] 첫승 정보:", firstWinInfo);
        
        // 첫승 정보 저장
        saveFirstWinRecord(firstWinInfo);
      }
    });
    
  } catch (error) {
    console.error("[업적 팝업 첫승 확인] 오류 발생:", error);
  }
}

// 알림 페이지에서 첫승 기록 확인 함수
function checkNotificationPageForFirstWins() {
  const notifBoard = document.querySelector('#notif_board');
  if (!notifBoard) {
    console.log("[알림 페이지 첫승 확인] 알림 보드를 찾을 수 없음");
    setTimeout(checkNotificationPageForFirstWins, 1000); // 1초 후 재시도
    return;
  }
  
  const posts = notifBoard.querySelectorAll('.post');
  if (posts.length === 0) {
    console.log("[알림 페이지 첫승 확인] 게시물이 없음");
    setTimeout(checkNotificationPageForFirstWins, 1000); // 1초 후 재시도
    return;
  }
  
  console.log(`[알림 페이지 첫승 확인] ${posts.length}개의 게시물 확인 시작`);
  
  // 현재 사용자 닉네임 확인
  const currentUserNickname = getCurrentUserNickname();
  
  if (!currentUserNickname) {
    console.log("[알림 페이지 첫승 확인] 로그인되지 않음");
    return;
  }
  
  // "더 많은 뉴스 보기..." 버튼 클릭 이벤트 설정
  setupSeeMoreNewsObserver();
  
  posts.forEach((post) => {
    try {
      // 트로피 이미지가 있는 게시물만 확인 (업적 관련)
      const trophyImage = post.querySelector('.postimage.trophyimg');
      if (!trophyImage) {
        return; // 트로피가 없으면 건너뛰기
      }
      
      const postMessage = post.querySelector('.postmessage');
      if (!postMessage) {
        return; // 메시지가 없으면 건너뛰기
      }
      
      const messageText = postMessage.textContent || '';
      
      // "첫 승" 업적이 포함되어 있는지 확인
      if (!messageText.includes('첫 승')) {
        return; // 첫승이 아니면 건너뛰기
      }
      
      console.log("[알림 페이지 첫승 확인] 첫승 업적 발견:", messageText);
      
      // 플레이어 이름 추출
      const playerLink = postMessage.querySelector('a.playername');
      const playerName = playerLink ? playerLink.textContent.trim() : null;
      
      // 현재 사용자의 첫승만 처리
      if (!playerName || playerName.toLowerCase() !== currentUserNickname.toLowerCase()) {
        console.log("[알림 페이지 첫승 확인] 다른 사용자의 첫승이므로 건너뛰기");
        return;
      }
      
      // 게임 이름 추출
      const gameNameElement = postMessage.querySelector('.gamename');
      const gameName = gameNameElement ? gameNameElement.textContent.trim() : null;
      
      // 날짜 정보 추출
      const postDate = post.querySelector('.postdate');
      const dateText = postDate ? postDate.textContent.trim() : null;
      const firstWinDate = parseRelativeDate(dateText);
      
      if (!gameName || !firstWinDate) {
        console.log("[알림 페이지 첫승 확인] 필수 정보 누락 - 게임:", gameName, "날짜:", firstWinDate);
        return;
      }
      
      // BGA 사용자 ID 추출 및 업적 링크 생성
      const bgaUserId = getBGAUserId();
      const achievementsLink = bgaUserId ? `https://boardgamearena.com/achievements?id=${bgaUserId}` : null;
      
      // 첫승 정보 생성
      const firstWinInfo = {
        playerNickname: currentUserNickname.toLowerCase(),
        gameName: gameName,
        firstWinDate: firstWinDate,
        gameResultLink: achievementsLink, // 플레이어별 업적 페이지 링크
        notificationText: messageText.trim() + " (알림 페이지)"
      };
      
      console.log("[알림 페이지 첫승 확인] 첫승 정보 추출됨:", firstWinInfo);
      
      // 첫승 정보 저장
      saveFirstWinRecord(firstWinInfo);
      
    } catch (error) {
      console.error("[알림 페이지 첫승 확인] 게시물 처리 중 오류:", error);
    }
  });
}

// "더 많은 뉴스 보기..." 버튼 클릭 감지 Observer 설정
function setupSeeMoreNewsObserver() {
  console.log("[더 많은 뉴스 감지] Observer 설정 시작");
  
  // 이미 설정된 Observer가 있는지 확인 (중복 방지)
  if (window.seeMoreNewsObserverActive) {
    console.log("[더 많은 뉴스 감지] Observer가 이미 활성화됨");
    return;
  }
  
  // "더 많은 뉴스 보기..." 버튼 찾기
  const seeMoreButton = document.querySelector('#board_seemore__');
  if (!seeMoreButton) {
    console.log("[더 많은 뉴스 감지] '더 많은 뉴스 보기' 버튼을 찾을 수 없음");
    return;
  }
  
  // 버튼 클릭 이벤트 리스너 추가
  const clickHandler = (event) => {
    console.log("[더 많은 뉴스 감지] '더 많은 뉴스 보기' 버튼 클릭됨");
    
    // 클릭 후 새로운 콘텐츠가 로드될 때까지 딜레이
    setTimeout(() => {
      console.log("[더 많은 뉴스 감지] 새로운 콘텐츠 로드 후 첫승 재확인");
      checkNotificationPageForFirstWins();
    }, 2000); // 2초 딜레이
  };
  
  seeMoreButton.addEventListener('click', clickHandler);
  window.boakoSeeMoreNewsButton = seeMoreButton;
  window.boakoSeeMoreNewsClickHandler = clickHandler;
  window.seeMoreNewsObserverActive = true;
  
  console.log("[더 많은 뉴스 감지] 클릭 이벤트 리스너 추가됨");
  
  // DOM 변경도 감시 (Ajax로 새 콘텐츠가 추가될 때)
  const contentObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // 새로운 게시물(.post)이 추가되었는지 확인
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.classList?.contains('post') || node.querySelector?.('.post'))) {
            console.log("[더 많은 뉴스 감지] 새로운 게시물 감지됨");
            
            // 짧은 딜레이 후 첫승 확인
            setTimeout(() => {
              checkNewPostsForFirstWins(node);
            }, 500);
          }
        });
      }
    });
  });
  
  // 알림 보드 감시
  const notifBoard = document.querySelector('#notif_board');
  if (notifBoard) {
    contentObserver.observe(notifBoard, {
      childList: true,
      subtree: true
    });
    window.boakoSeeMoreNewsObserver = contentObserver;
    console.log("[더 많은 뉴스 감지] DOM 변경 Observer 설정 완료");
  }
}

// 새로 추가된 게시물에서 첫승 확인
function checkNewPostsForFirstWins(newNode) {
  try {
    // 현재 사용자 닉네임 확인
    const currentUserNickname = getCurrentUserNickname();
    
    if (!currentUserNickname) {
      return;
    }
    
    // 새로 추가된 노드에서 게시물 찾기
    let postsToCheck = [];
    if (newNode.classList?.contains('post')) {
      postsToCheck = [newNode];
    } else {
      postsToCheck = Array.from(newNode.querySelectorAll('.post'));
    }
    
    console.log(`[새 게시물 첫승 확인] ${postsToCheck.length}개의 새 게시물 확인`);
    
    postsToCheck.forEach((post) => {
      // 트로피 이미지가 있는 게시물만 확인
      const trophyImage = post.querySelector('.postimage.trophyimg');
      if (!trophyImage) {
        return;
      }
      
      const postMessage = post.querySelector('.postmessage');
      if (!postMessage) {
        return;
      }
      
      const messageText = postMessage.textContent || '';
      
      // "첫 승" 업적 확인
      if (!messageText.includes('첫 승')) {
        return;
      }
      
      console.log("[새 게시물 첫승 확인] 새로운 첫승 업적 발견:", messageText);
      
      // 플레이어 이름 확인
      const playerLink = postMessage.querySelector('a.playername');
      const playerName = playerLink ? playerLink.textContent.trim() : null;
      
      if (!playerName || playerName.toLowerCase() !== currentUserNickname.toLowerCase()) {
        return;
      }
      
      // 게임 이름과 기타 정보 추출
      const gameNameElement = postMessage.querySelector('.gamename');
      const gameName = gameNameElement ? gameNameElement.textContent.trim() : null;
      
      const postDate = post.querySelector('.postdate');
      const dateText = postDate ? postDate.textContent.trim() : null;
      const firstWinDate = parseRelativeDate(dateText);
      
      if (!gameName || !firstWinDate) {
        return;
      }
      
      // BGA 사용자 ID 추출 및 업적 링크 생성
      const bgaUserId = getBGAUserId();
      const achievementsLink = bgaUserId ? `https://boardgamearena.com/achievements?id=${bgaUserId}` : null;
      
      // 첫승 정보 생성 및 저장
      const firstWinInfo = {
        playerNickname: currentUserNickname.toLowerCase(),
        gameName: gameName,
        firstWinDate: firstWinDate,
        gameResultLink: achievementsLink, // 플레이어별 업적 페이지 링크
        notificationText: messageText.trim() + " (새 게시물)"
      };
      
      console.log("[새 게시물 첫승 확인] 새로운 첫승 정보 저장:", firstWinInfo);
      saveFirstWinRecord(firstWinInfo);
    });
    
  } catch (error) {
    console.error("[새 게시물 첫승 확인] 오류 발생:", error);
  }
}

// 플레이어 메뉴 탭 클릭 감지를 위한 Observer 설정 함수
function setupPlayerMenuTabObserver() {
  if (window.boakoPlayerMenuTabClickHandler) {
    document.removeEventListener('click', window.boakoPlayerMenuTabClickHandler);
    window.boakoPlayerMenuTabClickHandler = null;
  }
  
  // 플레이어 메뉴 탭 클릭을 감시하는 Observer
  const playerMenuTabObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // 텍스트 노드가 아닌 엘리먼트만 처리
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 사이드바나 알림 패널이 열렸는지 확인
            checkForSidebarNotifications(node);
          }
        });
      }
    });
  });
  
  // 플레이어 메뉴 탭 클릭 이벤트 직접 감지
  const playerMenuTabClickHandler = (event) => {
    try {
      const clickedElement = event.target;
      
      // Player 페이지의 메뉴 탭 클릭 감지 (lastresults, gamestats 등)
      const pageheaderMenuItem = clickedElement.closest('.pageheader_menuitem');
      if (pageheaderMenuItem) {
        const menuId = pageheaderMenuItem.id;
        console.log(`[페이지 메뉴] ${menuId} 탭 클릭 감지`);
        
        // lastresults 탭 클릭 시 2초 후 게임 기록 확인
        if (menuId === 'pageheader_lastresults') {
          setTimeout(() => {
            console.log('[lastresults 탭] 2초 후 게임 기록 확인 시작');
            markLastResultsGames();
            detectFirstWinNotifications();
          }, 2000);
        }
        // gamestats 탭 클릭 시 2초 후 게임 기록 확인  
        else if (menuId === 'pageheader_gamestats') {
          setTimeout(() => {
            console.log('[gamestats 탭] 2초 후 게임 기록 확인 시작');
            markGameStatsGames();
          }, 2000);
        }
      }
      
      // 2번째 탭 (알림 탭) 클릭 감지
      const playerMenuTab = clickedElement.closest('.bga-player-menu__tab');
      
      if (playerMenuTab) {
        // 모든 탭을 찾아서 2번째인지 확인
        const allTabs = document.querySelectorAll('.bga-player-menu__tab');
        const tabIndex = Array.from(allTabs).indexOf(playerMenuTab);
        
        if (tabIndex === 1) { // 2번째 탭 (0-based index)
          console.log("[플레이어 메뉴 탭 감지] 2번째 탭 (알림) 클릭됨");
          
          // 약간의 딜레이 후에 사이드바 내용 확인
          setTimeout(() => {
            checkSidebarForFirstWinNotifications();
          }, 500);
        }
      }
    } catch (error) {
      console.error("[플레이어 메뉴 탭 감지] 클릭 이벤트 처리 중 오류:", error);
    }
  };

  document.addEventListener('click', playerMenuTabClickHandler);
  window.boakoPlayerMenuTabClickHandler = playerMenuTabClickHandler;
  
  // document.body 전체를 감시
  playerMenuTabObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 전역 변수로 Observer 저장
  window.boakoPlayerMenuTabObserver = playerMenuTabObserver;
}

// 사이드바에서 첫승 알림 확인 함수
function checkSidebarForFirstWinNotifications() {
  console.log("[사이드바 첫승 확인] 사이드바에서 첫승 알림 확인 시작");
  
  // 가능한 사이드바 컨테이너들 확인
  const possibleSidebarSelectors = [
    '.bga-player-menu__content',
    '.bga-player-menu',
    '#right-side-first-part',
    '.player_board_wrap',
    '[class*="notification"]',
    '[class*="sidebar"]'
  ];
  
  let sidebarFound = false;
  
  for (const selector of possibleSidebarSelectors) {
    const sidebarElement = document.querySelector(selector);
    if (sidebarElement && getComputedStyle(sidebarElement).display !== 'none') {
      console.log("[사이드바 첫승 확인] 사이드바 발견:", selector);
      checkSidebarElementForFirstWins(sidebarElement);
      sidebarFound = true;
      break;
    }
  }
  
  if (!sidebarFound) {
    console.log("[사이드바 첫승 확인] 사이드바를 찾을 수 없음");
    // 1초 후 재시도
    setTimeout(() => {
      checkSidebarForFirstWinNotifications();
    }, 1000);
  }
}

// 사이드바 요소에서 첫승 확인
function checkSidebarElementForFirstWins(sidebarElement) {
  try {
    // 사이드바 내의 알림 요소들 찾기
    const notificationElements = sidebarElement.querySelectorAll(
      '.notification-content, .postmessage, [class*="notification"], [class*="notif"]'
    );
    
    console.log(`[사이드바 첫승 확인] ${notificationElements.length}개의 알림 요소 확인`);
    
    notificationElements.forEach((element) => {
      const notificationText = element.textContent || '';
      if (notificationText.includes('첫 승') && notificationText.includes('업적을 획득했습니다')) {
        console.log("[사이드바 첫승 확인] 첫승 업적 발견:", notificationText);
        
        // 첫승 정보 추출 (기존 extractFirstWinInfo 로직과 유사)
        const firstWinInfo = extractFirstWinInfoFromElement(element.closest('.notification') || element);
        if (firstWinInfo) {
          console.log("[사이드바 첫승 확인] 첫승 정보 추출됨:", firstWinInfo);
          saveFirstWinRecord(firstWinInfo);
        }
      }
    });
    
  } catch (error) {
    console.error("[사이드바 첫승 확인] 오류 발생:", error);
  }
}

// 요소에서 첫승 정보 추출 (범용 함수)
function extractFirstWinInfoFromElement(element) {
  try {
    if (!element) return null;
    
    // 플레이어 닉네임 추출
    const playerLink = element.querySelector('a.playername');
    const playerNickname = playerLink ? playerLink.textContent.trim() : null;
    
    // 게임 이름 추출
    const gameNameElement = element.querySelector('.gamename');
    const gameName = gameNameElement ? gameNameElement.textContent.trim() : null;
    
    // 사용자 업적 링크 생성 (achievements?id={user_id} 패턴)
    const userId = getBGAUserId();
    const achievementsLink = userId ? `https://boardgamearena.com/achievements?id=${userId}` : null;
    
    // 시간 정보 추출
    const timeElement = element.querySelector('.notification-time, .postdate');
    const timeText = timeElement ? timeElement.textContent.trim() : null;
            const firstWinDate = timeText ? parseRelativeDate(timeText) : getKSTDate();
    
    // 전체 알림 텍스트
    const fullNotificationText = element.textContent.trim();
    
    // 현재 사용자 닉네임 확인
    const currentUserNickname = getCurrentUserNickname();
    
    // 기본값으로 현재 사용자 설정 (사이드바는 자신의 알림만 표시)
    const finalPlayerNickname = playerNickname || (currentUserNickname ? currentUserNickname.toLowerCase() : null);
    
    if (!finalPlayerNickname || !gameName || !firstWinDate) {
      console.log("[첫승 정보 추출] 필수 정보 누락 - 닉네임:", finalPlayerNickname, "게임명:", gameName, "날짜:", firstWinDate);
      return null;
    }
    
    return {
      playerNickname: finalPlayerNickname.toLowerCase(),
      gameName: gameName,
      firstWinDate: firstWinDate,
      gameResultLink: achievementsLink, // 플레이어별 업적 페이지 링크
      notificationText: fullNotificationText + " (사이드바 메뉴)"
    };
    
  } catch (error) {
    console.error("[첫승 정보 추출] 오류 발생:", error);
    return null;
  }
}

// DOM에서 새로운 사이드바 알림 확인
function checkForSidebarNotifications(node) {
  // 알림 관련 클래스나 ID를 가진 요소인지 확인
  if (node.querySelector && (
    node.classList?.contains('notification') ||
    node.classList?.contains('bga-player-menu__content') ||
    node.querySelector('.notification-content') ||
    node.querySelector('[class*="notification"]')
  )) {
    console.log("[사이드바 알림 감지] 새로운 알림 요소 감지됨");
    setTimeout(() => {
      checkSidebarElementForFirstWins(node);
    }, 300);
  }
}

// 한국어 날짜를 ISO 형식으로 변환하는 함수
function convertKoreanDateToISO(koreanDate) {
  try {
    // "2023년  8월  5일" 형식 파싱
    const match = koreanDate.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    console.log("[날짜 변환] 지원하지 않는 날짜 형식:", koreanDate);
    return null;
    
  } catch (error) {
    console.log("[날짜 변환] 오류 발생:", error, "입력:", koreanDate);
    return null;
  }
}

// lastresults 페이지에서 첫승 알림 감지 함수
function detectFirstWinNotifications() {
  console.log("[lastresults 첫승 감지] 첫승 알림 감지 시작");
  
  // 현재 사용자 닉네임 확인
  const currentUserNickname = getCurrentUserNickname();
  
  if (!currentUserNickname) {
    console.log("[lastresults 첫승 감지] 로그인되지 않음");
    return;
  }
  
  // 게시물(.post) 찾기 및 확인
  const posts = document.querySelectorAll('.post');
  console.log(`[lastresults 첫승 감지] ${posts.length}개의 게시물 확인`);
  
  posts.forEach((post, index) => {
    try {
      // 트로피 이미지가 있는 게시물만 확인 (업적 관련)
      const trophyImage = post.querySelector('.postimage.trophyimg');
      if (!trophyImage) {
        return; // 트로피가 없으면 건너뛰기
      }
      
      // 게시물 메시지 내용 확인
      const postMessage = post.querySelector('.postmessage');
      if (!postMessage) {
        return;
      }
      
      const messageText = postMessage.textContent || '';
      
      // "첫 승" 업적이 포함되어 있는지 확인
      if (!messageText.includes('첫 승')) {
        return; // 첫승이 아니면 건너뛰기
      }
      
      console.log(`[lastresults 첫승 감지] 첫승 업적 발견 (${index + 1}번째 게시물):`, messageText);
      
      // 플레이어 이름 추출
      const playerLink = postMessage.querySelector('a.playername');
      const playerName = playerLink ? playerLink.textContent.trim() : null;
      
      // 현재 사용자의 첫승만 처리
      if (!playerName || playerName.toLowerCase() !== currentUserNickname.toLowerCase()) {
        console.log("[lastresults 첫승 감지] 다른 사용자의 첫승이므로 건너뛰기");
        return;
      }
      
      // 게임 이름 추출
      const gameNameElement = postMessage.querySelector('.gamename');
      const gameName = gameNameElement ? gameNameElement.textContent.trim() : null;
      
      // 날짜 정보 추출
      const postDate = post.querySelector('.postdate');
      const dateText = postDate ? postDate.textContent.trim() : null;
      const firstWinDate = parseRelativeDate(dateText);
      
      if (!gameName || !firstWinDate) {
        console.log("[lastresults 첫승 감지] 필수 정보 누락 - 게임:", gameName, "날짜:", firstWinDate);
        return;
      }
      
      // BGA 사용자 ID 추출 및 업적 링크 생성
      const bgaUserId = getBGAUserId();
      const achievementsLink = bgaUserId ? `https://boardgamearena.com/achievements?id=${bgaUserId}` : null;
      
      // 첫승 정보 생성
      const firstWinInfo = {
        playerNickname: currentUserNickname.toLowerCase(),
        gameName: gameName,
        firstWinDate: firstWinDate,
        gameResultLink: achievementsLink, // 플레이어별 업적 페이지 링크
        notificationText: messageText.trim() + " (플레이한 게임 목록)"
      };
      
      // 첫승 정보 저장
      saveFirstWinRecord(firstWinInfo);
      
    } catch (error) {
      console.error("[lastresults 첫승 감지] 게시물 처리 중 오류:", error);
    }
  });
  
  // "더 보기" 버튼이 있다면 클릭 감지 설정
  setupLastResultsSeeMoreObserver();
}

// lastresults 페이지의 "더 보기" 버튼 감지 함수
function setupLastResultsSeeMoreObserver() {
  const seeMoreButton = document.querySelector('a[href="#"][onclick*="more"]');
  if (seeMoreButton && !seeMoreButton.hasAttribute('data-boako-firstwin-listener')) {
    seeMoreButton.setAttribute('data-boako-firstwin-listener', 'true');
    
    seeMoreButton.addEventListener('click', () => {
      console.log('[lastresults 더 보기] 버튼 클릭 - 3초 후 새 첫승 알림 확인');
      
      // 3초 후 새로 로드된 게시물에서 첫승 확인
      setTimeout(() => {
        detectFirstWinNotifications();
      }, 3000);
    });
  }
}

// 첫승 기록을 데이터베이스에 저장하는 함수
function saveFirstWinRecord(firstWinInfo) {
  const gameKey = `${firstWinInfo.playerNickname}-${firstWinInfo.gameName}`;
  
  // 이미 처리된 첫승인지 확인
  if (processedFirstWins.has(gameKey)) {
    return;
  }
  
  // 현재 로그인된 사용자 닉네임 확인
  const currentUserNickname = getCurrentUserNickname();
  
  if (!currentUserNickname) {
    console.log("[첫승 저장] 로그인되지 않음");
    return;
  }
  
  // 현재 사용자와 첫승 달성자가 같은지 확인 (자신의 첫승만 기록)
  if (firstWinInfo.playerNickname !== currentUserNickname.toLowerCase()) {
    console.log("[첫승 저장] 다른 사용자의 첫승이므로 저장하지 않음");
    return;
  }

  // 크롬 익스텐션을 통해 서버에 첫승 저장 요청
  try {
    chrome.runtime.sendMessage({
      action: "saveFirstWin", 
      data: firstWinInfo
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("[첫승 저장] 백그라운드 연결 실패:", chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.success) {
        console.log("[첫승 저장] 성공:", response.message);
        
        // 처리 완료된 첫승으로 표시
        processedFirstWins.add(gameKey);
        
        // 새로운 첫승 달성 시 메시지 표시(아직)

      } else {
        console.log("[첫승 저장] 실패:", response?.error || "알 수 없는 오류");
      }
    });
  } catch (error) {
    console.log("[첫승 저장] chrome.runtime.sendMessage 호출 실패:", error);
  }
}

// KST 시간을 반환하는 함수 (한국 표준시)
function getKSTDateTime() {
  const now = new Date();
  const kstOffset = 9 * 60; // KST는 UTC+9
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (kstOffset * 60000));
  
  // YYYY-MM-DD HH:MM:SS 형식으로 반환
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  const hours = String(kst.getHours()).padStart(2, '0');
  const minutes = String(kst.getMinutes()).padStart(2, '0');
  const seconds = String(kst.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// KST 날짜만 반환하는 함수 (YYYY-MM-DD 형식)
function getKSTDate() {
  const now = new Date();
  const kstOffset = 9 * 60; // KST는 UTC+9
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (kstOffset * 60000));
  
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// 주어진 Date 객체를 KST 기준 날짜로 변환하는 함수 (YYYY-MM-DD 형식)
function getKSTDateFromDate(date) {
  const kstOffset = 9 * 60; // KST는 UTC+9
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (kstOffset * 60000));
  
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

//토너먼트 시작날짜를 날짜 형태로 변환하는 함수 
function parseKoreanDateTimeToTZ(koreanStr) {
  try {
    const regex = /(\d+)년\s+(\d+)월\s+(\d+)일\s+(오전|오후)\s+(\d+):(\d+)/;
    const match = koreanStr.match(regex);
    
    if (!match) return koreanStr;

    let [_, year, month, day, ampm, hour, minute] = match;
    hour = parseInt(hour, 10);

    if (ampm === "오후" && hour < 12) hour += 12;
    if (ampm === "오전" && hour === 12) hour = 0;

    month = String(month).padStart(2, '0');
    day = String(day).padStart(2, '0');
    hour = String(hour).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  } catch (e) {
    return koreanStr;
  }
}

/*


================================================================================
                              함수 및 호출 관계 정리
================================================================================

### 1. 로그 및 유틸리티 함수
- logOnce(message, key): 중복 로그 방지 함수
- showPopupMessage(message, isSuccess, buttonElement): 팝업 메시지 표시 함수

### 2. 사용자 정보 추출 함수
- getCurrentUserNickname(): BGA 현재 사용자 닉네임 추출
- getBGAUserId(): BGA 사용자 ID 추출

### 3. 스타일 관련 함수
- addCustomStyles(): CSS 스타일 적용

### 4. 페이지 확인 함수
- checkGameTablePage(): 게임 테이블 페이지 확인
- checkLastResultsPage(): 플레이한 게임 페이지 확인
- checkGameStatsPage(): 게임 히스토리 페이지 확인
- checkPlayerNotifPage(): 알림 페이지 확인
- checkTournamentPage(): 토너먼트 결과 페이지 확인

### 5. 초기화 함수
- initializePage(): 페이지 초기화 (모든 페이지 확인 함수들 호출)
- handleUrlChange(): URL 변경 감지 및 처리

### 6. 게임 기록 관련 함수
- markLastResultsGames(): 플레이한 게임 페이지에서 게임 기록 표시
- markGameStatsGames(): 게임 히스토리 페이지에서 게임 기록 표시
- checkGameRecord(gameId, linkElement, retryCount): 게임 기록 확인 및 마커 추가

### 7. 버튼 관련 함수
- addSaveButtons(): 게임 결과 패널에 저장 버튼 추가
- updateExistingButtonState(button): 기존 버튼 상태 업데이트
- resetButton(buttonElement, originalText): 버튼 초기화

### 8. 사이드바 관련 함수
- createPlayerSidebar(): 플레이어 사이드바 생성
- createSidebarButton(type): 사이드바 버튼 생성 (X, 화살표)
- createPlayerButton(avatarSrc, playerName, playerColor, playerId): 플레이어 버튼 생성
- makeDraggable(sidebar, hamburgerToggle): 사이드바 드래그 기능 구현
- makeDraggableHamburger(hamburgerToggle, sidebar): 햄버거 버튼 드래그 기능

### 9. 게임 데이터 추출 함수
- extractGameData(gameResult): 게임 결과에서 데이터 추출
- determineGameType(players): 협력/경쟁 게임 타입 판별
- extractTournamentInfo(): 토너먼트 정보 추출
- extractTournamentData(reporter): BOAKO 토너먼트 결과 데이터 추출
- collectTournamentPlayersByRankPriority(): 스위스/엘리미네이션 순위 우선순위 병합
- extractGameCreationTime(): 게임 생성 시각 추출

### 10. 백그라운드 통신 함수
- sendToBackground(data, buttonElement, originalButtonText): 백그라운드 스크립트로 데이터 전송
- sendTournamentToBackground(data, buttonElement, originalButtonText): 토너먼트 기록을 백그라운드로 전송

### 11. Observer 설정 및 관리 함수
- setupAllObservers(): 모든 Observer들을 통합 관리하여 페이지마다 재설정
- cleanupAllObservers(): 기존 Observer들을 모두 정리하여 메모리 누수 방지
- setupGameLinksObserver(): 게임 링크 마커 표시를 위한 Observer 설정
- setupFirstWinObserver(): 첫승 감지를 위한 Observer 설정
- setupTrophyPopupObserver(): 업적 팝업 첫승 감지를 위한 Observer 설정
- setupPlayerMenuTabObserver(): 플레이어 메뉴 탭 클릭 감지를 위한 Observer 설정
- setupSeeMoreButtonObserver(): "더 보기" 버튼 클릭 감지 Observer 설정
- setupSeeMoreNewsObserver(): "더 많은 뉴스 보기" 버튼 클릭 감지 Observer 설정

### 12. 첫승 감지 및 처리 함수
- extractFirstWinInfo(notificationElement): 첫승 정보 추출
- extractFirstWinInfoFromElement(element): 요소에서 첫승 정보 추출 (범용)
- checkTrophyPopupForFirstWin(overlayElement): 업적 팝업에서 첫승 확인
- checkNotificationPageForFirstWins(): 알림 페이지에서 첫승 기록 확인
- checkSidebarForFirstWinNotifications(): 사이드바에서 첫승 알림 확인
- checkSidebarElementForFirstWins(sidebarElement): 사이드바 요소에서 첫승 확인
- checkForSidebarNotifications(node): DOM에서 새로운 사이드바 알림 확인
- processFirstWinAchievements(): 업적 페이지에서 첫승 업적들 처리 (자신의 페이지인지 검증 포함)
- detectFirstWinNotifications(): lastresults 페이지에서 첫승 알림 감지
- setupLastResultsSeeMoreObserver(): lastresults 페이지의 "더 보기" 버튼 감지
- checkNewPostsForFirstWins(newNode): 새로 추가된 게시물에서 첫승 확인
- saveFirstWinRecord(firstWinInfo): 첫승 기록을 데이터베이스에 저장

### 13. 날짜 변환 함수
- parseRelativeDate(timeText): 상대 날짜를 실제 날짜로 변환
- convertKoreanDateToISO(koreanDate): 한국어 날짜를 ISO 형식으로 변환

### 14. 이벤트 리스너 및 Observer 설정
- gameResultObserver: 게임 결과 패널 변경 감지
- urlObserver: SPA 페이지 변경 감지
- 각종 MutationObserver들: DOM 변경 감지

### 함수 호출 관계도:
```
initializePage() 
├─ checkGameTablePage() → addSaveButtons()
├─ checkLastResultsPage() → markLastResultsGames() → checkGameRecord()
│                        └─ detectFirstWinNotifications()
├─ checkGameStatsPage() → markGameStatsGames() → checkGameRecord()
├─ checkPlayerNotifPage() → checkNotificationPageForFirstWins()
├─ createPlayerSidebar() (게임 플레이 페이지에서만)
└─ setupAllObservers() → cleanupAllObservers() (기존 Observer 정리)
                      └─ setupGameLinksObserver()
                      └─ setupFirstWinObserver()
                      └─ setupTrophyPopupObserver()
                      └─ setupPlayerMenuTabObserver()

addSaveButtons() → extractGameData() → sendToBackground()
                                    → checkAndSaveFirstWinFromGameResult()

extractGameData() → determineGameType()
                  → extractTournamentInfo()
                  → extractGameCreationTime()

Observer 감지 및 호출:
- setupGameLinksObserver() → checkGameRecord()
- setupFirstWinObserver() → extractFirstWinInfo() → saveFirstWinRecord()
- setupTrophyPopupObserver() → checkTrophyPopupForFirstWin() → saveFirstWinRecord()
- setupPlayerMenuTabObserver() → checkSidebarForFirstWinNotifications()
```

### 주요 실행 흐름:
1. 페이지 로드 시 initializePage() 호출
2. URL에 따라 해당 페이지 확인 함수 실행
3. 각 페이지에서 게임 기록 확인, 첫승 감지, 버튼 추가 등 수행
4. Observer들이 DOM 변경, 사용자 상호작용 등을 감지하여 필요한 함수들 호출
5. 데이터 추출 후 백그라운드 스크립트로 전송하여 서버에 저장

### Observer 재설정 로직:
- 모든 Observer들을 페이지마다 완전 재설정 (SPA 환경에서 DOM 요소 변경 대응)
- cleanupAllObservers()로 기존 Observer들을 disconnect() 후 메모리 해제
- setupAllObservers()로 새로운 Observer들을 설정하여 중복 및 메모리 누수 방지
- 전역 변수 (window.boakoXXXObserver)로 Observer 참조 관리

### 업적 페이지 검증 로직:
- processFirstWinAchievements()에서 getBGAUserId()로 현재 사용자 ID 추출
- URL에서 achievements?id=숫자 패턴으로 페이지 소유자 ID 추출
- 두 ID가 일치할 때만 첫승 업적 처리 (자신의 업적만 데이터베이스에 저장)

### 메모: 이 주석들은 함수 구조 이해를 위한 것이므로 절대로 지우지 말아줘.
================================================================================
*/
