/**
 * [BOAKO WIDGET] 아카이브 로그인 연동 - 쪽지함/팀챗/토스트 알림 위젯
 * 🌟 content.js(기존 175KB, 게임기록 관련)와 완전히 분리된 독립 모듈. 매니페스트 content_scripts에서
 *    boako-realtime.min.js → boako-widget.js → content.js 순서로 로드됨.
 * 🌟 화면 좌측 하단 고정 아이콘(토너먼트 버튼이 우측 하단이라 반대편으로 배치, 겹침 없음).
 *    🌟 [신규] 아이콘을 드래그해서 원하는 위치로 옮길 수 있음 (content.js 사이드바 드래그와 동일 패턴,
 *    5px 이상 움직여야 드래그로 인식, 위치는 localStorage에 저장돼 다음 방문에도 유지됨). 패널도
 *    아이콘 위치를 따라다니며 화면 밖으로 안 나가게 위/아래·좌/우가 자동으로 뒤집힘.
 * 🌟 실시간 연결은 content.js가 살아있는 동안(=BGA 탭이 열려있는 동안)만 유지됨 — MV3 서비스워커는
 *    상시 웹소켓 연결을 못 하기 때문에 background.js가 아니라 여기(콘텐츠 스크립트)에서 직접 연결함.
 * 🌟 [디버깅] BGA 페이지의 CSP(Content-Security-Policy)가 Supabase로의 웹소켓 연결을 막을 가능성이
 *    있어서, 연결 시도/성공/실패/닫힘 각 단계를 전부 눈에 띄는 색깔의 console 로그로 남김.
 *    문제가 생기면 개발자 도구 콘솔에서 "[BOAKO WIDGET]"으로 검색하면 바로 원인 단계를 특정할 수 있음.
 * 🌟 [버그수정] 로그인 성공 응답엔 user 정보만 오고 토큰이 없어서 State.session이 계속 null로 남아있던
 *    문제 수정 — 로그인 성공 직후 저장된 전체 세션을 다시 조회해서 채우도록 함.
 * 🌟 [버그수정] onOpen/onClose/onError는 RealtimeClient 최상위가 아니라 client.socketAdapter에 있음.
 * 🌟 [버그수정] 대화방을 열어도 실제 메시지 없이 고정 안내 문구만 뜨던 문제 — fetchThreadMessages/
 *    markThreadAsRead/openConversation을 신규 추가해서 실제 대화 내역을 말풍선으로 그리고 읽음 처리까지 함.
 *    실시간으로 새 쪽지가 오면, 그 대화를 이미 보고 있는 경우 목록뿐 아니라 열린 대화창에도 바로 반영됨.
 * 🌟 [버그수정] fetchMessages에 limit=30이 걸려있어서, 최근 메시지 30건 안에 없는 오래된 대화가
 *    목록에서 통째로 안 보이던 문제 — 사이트(messenger.js)처럼 제한 없이 전체를 가져오도록 수정.
 * 🌟 [신규] 쪽지 목록의 각 대화 항목에 그 대화의 안읽음 개수를 빨간 배지로 표시.
 * 🌟 [버그수정] sendMessageReply에서 receiver_name_override를 안 넣어서, 확장에서 보낸 쪽지가
 *    상대방 목록에 "알 수 없음"으로 뜨던 문제 — 이미 생긴 데이터는 DB에서 소급 백필, 코드도 같이 수정.
 * 🌟 [신규] 게임 페이지 등에서 아이콘이 화면 밖/아래로 밀려나 보이는 현상에 대한 방어 로직 —
 *    resize 이벤트 + 페이지 로드 직후 몇 번(1/3/6/10초)만 확인 후 멈춤 (무한 폴링 대신 경량화, !important 추가).
 * 🌟 [수정] 대화 스레드를 한 번에(limit=100) 불러오던 것 → 카톡처럼 최근 30개만 먼저 불러오고
 *    "이전 대화 더 보기" 버튼을 눌러야 그 이전 30개를 추가로 불러오는 방식으로 변경 (리소스 절약).
 * 🌟 [신규] 아카이브 소식(news_feed_items) 실시간 구독 연결 — 사이트 소식지에 새 카드가 등록되면
 *    토스트로 알림. 유저 필터 없는 공개 채널이라 로그인만 돼있으면 누구든 받음.
 * 🌟 [수정] 소식 토스트 클릭 시 무조건 홈으로만 가던 것 → link_type/link_id를 URL 쿼리로 실어서
 *    보냄 (예: ?open=RIVAL_MATCH&id=매치id). 사이트 쪽(auth.js)에서 이 쿼리를 읽어
 *    Boako.Util.navigateToLink()로 정확한 화면으로 자동 이동시킴.
 * 🌟 [신규] 업적 획득/라이벌전 투표결과/오늘의 추천게임 보너스 실시간 오버레이 추가.
 * 🌟 [수정] 위 세 오버레이를 간소화 버전에서 사이트(achievements.js/rival_notify.js/recommend_notify.js)
 *    원본과 완전히 동일한 마크업으로 교체 — 업적은 시즌로고/OO매니아 티어 합성 배지까지, 라이벌전은
 *    승자(크게)-VS-패자(작게) 프로필사진 구도까지 그대로 재현.
 * 🌟 [신규] 사이트 util.js의 window.sfx(Web Audio API로 직접 합성하는 효과음, 외부 음원 파일 없음)를
 *    그대로 이식 — 업적/라이벌전결과/추천보너스 오버레이가 뜰 때 사운드도 사이트와 동일하게 재생됨.
 * 🌟 [신규] 실시간 연결이 socket closed(1006 등)로 끊기면 그 탭에서는 재접속 전까지 계속 죽어있던 문제 —
 *    onClose에서 의도적 해제(로그아웃)가 아니면 지수 백오프(2s→4s→8s→...최대30s)로 자동 재연결하도록 수정.
 *    connectRealtime을 _doConnect/_scheduleReconnect/_subscribeAllChannels로 분리해서 재연결 시에도
 *    동일하게 전체 채널을 다시 구독함.
 * 🌟 [신규] 위 재연결과 별개로, 백그라운드 탭은 브라우저가 타이머를 느리게 만들어 하트비트가 늦어지며
 *    끊기는 경우가 흔함 — visibilitychange로 탭이 다시 보이는 순간 백오프 대기 없이 즉시 재연결 시도.
 * 🌟 [신규] 탭 간 실시간 연결 리더 선출 — BGA 탭을 여러 개 열면 탭마다 각자 웹소켓을 만들어서
 *    Supabase 무료 플랜 동시연결 한도를 필요 이상으로 빨리 잡아먹는 문제 방지. localStorage 하트비트로
 *    같은 브라우저의 탭들 중 리더 하나만 진짜 연결을 열고, 나머지(팔로워)는 BroadcastChannel로 중계된
 *    이벤트만 받아 동일하게 반응(토스트/뱃지/오버레이는 각 탭이 알아서 그림). 리더 탭이 닫히면(하트비트
 *    끊김 또는 beforeunload로 즉시 통지) 남은 탭 중 하나가 자동 승격.
 * 🌟 [신규] 확장 방문 카운트 기록(fn_record_ext_visit) — 세션 확인마다 profiles.ext_visit_count,
 *    ext_last_seen_at 갱신. 사이트만 왔다갔다 하고 확장은 안 켜본 사람을 구분하기 위한 용도.
 * 🌟 [리팩토링] ④⑤⑥번 활성화 오버레이 — 로그인 시점 실시간 계산(fn_check_*) 방식에서 크론(fn_enqueue_*) +
 *    대기열(activation_overlay_queue) 방식으로 전환. checkActivationOverlayQueue() 하나만
 *    fn_get_my_activation_overlay()를 호출해서 대기열을 조회하고, overlay_type에 따라 렌더러를 호출함.
 *    업적/라이벌결과/추천보너스 실시간 오버레이(_fsOverlayShowing)가 떠 있으면 끝날 때까지 대기했다가 표시.
 * 🌟 [수정] ⑥번 오버레이 아이콘을 사이트 메뉴바와 통일 — 토너먼트 🏅(메뉴바 "🏅 토너먼트"와 동일),
 *    팀 🛡️(메뉴바 "🛡️ 팀 창단"과 동일). 기존 🏟️/🚩는 메뉴바와 따로 놀아서 교체.
 * 🌟 [수정] 팀 타입 문구 — 이 타입은 라이벌전은 물론 토너먼트까지 이미 참가한 사람한테 뜨는 거라
 *    "라이벌전까지 즐기셨다면"이라는 조건문이 안 맞았음(이미 다 해본 사람인데). "활발하게 활동하시네요!"로
 *    바로 인정해주는 톤으로 교체. ⑦번(팀 소속인데 활동 없음)도 이 렌더러를 그대로 재사용하므로 함께 반영됨.
 * 🌟 [신규] 시즌 스플래시 — 사이트 js/season_splash.js와 완전히 동일한 디자인(좌우 와이프 패널, 곡선 궤적
 *    로고 애니메이션, Web Audio 합성 휘슈/임팩트 사운드)을 확장에서도 재현. 팀 소속자 전용(무소속은 미노출),
 *    하루 1회(profiles.tutorial_status.season_splash_last_shown — 사이트와 같은 필드 공유라 사이트/확장
 *    어느 쪽에서 봤든 서로 중복 안 뜸). enqueueFullscreenOverlay 큐에 태워서 업적/라이벌결과/추천보너스/
 *    ④⑤⑥⑦활성화 오버레이와 자동으로 안 겹침.
 * 🌟 [버그수정] 쪽지함의 "액션 카드"(일정제안/라이벌도전장/팀가입신청/스카웃제안) 메시지가 그냥
 *    텍스트로만 보여서 확장에서 수락/거절/날짜선택 버튼을 아예 누를 수 없던 문제 — 사이트
 *    messenger.js와 동일한 카드+버튼을 그리고, 클릭은 handleThreadActionClick()이 위임 처리.
 *    inline onclick은 콘텐츠 스크립트 격리 세계에서 안 먹히므로 data-action 속성 + 이벤트 위임 사용.
 */
(function () {
  // iframe에서 중복 실행 방지 (게임 플레이 페이지는 iframe 구조라 all_frames:true로 여러 프레임에서 로드됨)
  if (window.top !== window) return;

  const SUPABASE_URL = "https://qrredwrxdnvqwdxzanba.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFycmVkd3J4ZG52cXdkeHphbmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjYxNjEsImV4cCI6MjA5Mjg0MjE2MX0.RrDMN1uxGe9YoonomO-Ibq_dhyaSaKMa7B05i-j0LuY";

  // ========================================================================
  // 🌟 [디버깅용] 색깔 있는 콘솔 로그 헬퍼 — 브라우저 콘솔에서 "[BOAKO WIDGET]"으로 필터링하면
  // 이 위젯 관련 로그만 쫙 모아볼 수 있음
  // ========================================================================
  const boakoLog = (msg, ...args) => console.log(`%c[BOAKO WIDGET] ${msg}`, 'color:#4f46e5;font-weight:bold;', ...args);
  const boakoWarn = (msg, ...args) => console.warn(`%c[BOAKO WIDGET] ⚠️ ${msg}`, 'color:#f59e0b;font-weight:bold;', ...args);
  const boakoErr = (msg, ...args) => console.error(`%c[BOAKO WIDGET] ❌ ${msg}`, 'color:#ef4444;font-weight:bold;', ...args);
  const boakoOk = (msg, ...args) => console.log(`%c[BOAKO WIDGET] ✅ ${msg}`, 'color:#16a34a;font-weight:bold;', ...args);

  boakoLog('스크립트 로드됨. Realtime 라이브러리 확인 중...');
  if (typeof BoakoRealtimeClient === 'undefined') {
    boakoErr('BoakoRealtimeClient를 찾을 수 없음 — boako-realtime.min.js가 이 스크립트보다 먼저 로드됐는지 manifest.json의 content_scripts 순서를 확인하세요.');
  } else {
    boakoOk('BoakoRealtimeClient 로드 확인됨. 실시간 연결에 사용할 준비가 됐어요.');
  }

  // 🌟 사이트 Boako.Util.cdn과 동일 — Supabase Storage 경로를 CDN 도메인으로 치환
  function cdnUrl(url) {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/^http:\/\//i, 'https://').replace('qrredwrxdnvqwdxzanba.supabase.co', 'cdn.boakoarchive.co.kr');
  }

  // 🌟 업적 배지 합성 렌더링용 캐시 (사이트 achievements.js와 동일한 캐시 패턴)
  const _achievementByCodeCache = {};
  const _seasonLogoCache = {};
  const _gameLogoCache = {};

  // ========================================================================
  // 🌟 [신규] 사이트 util.js의 window.sfx를 그대로 이식 — 외부 음원 파일이 아니라 Web Audio API로
  // 직접 합성하는 방식이라(오실레이터로 음 생성) 확장 프로그램에서도 그대로 재사용 가능.
  // 필요한 것만(success/achievementUnlock/click) 가져옴 — 브라우저 자동재생 정책 대응(pendingReplay) 포함.
  // ========================================================================
  const boakoSfx = (function () {
    let ctx = null;
    let pendingReplay = [];
    let unlockListenerAttached = false;

    function ensureUnlockListener() {
      if (unlockListenerAttached) return;
      unlockListenerAttached = true;
      const unlock = () => {
        if (ctx && ctx.state === 'suspended') ctx.resume();
        const queued = pendingReplay.splice(0, pendingReplay.length);
        queued.forEach(fn => fn());
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
        document.removeEventListener('touchstart', unlock);
        unlockListenerAttached = false;
      };
      document.addEventListener('click', unlock, { once: true });
      document.addEventListener('keydown', unlock, { once: true });
      document.addEventListener('touchstart', unlock, { once: true });
    }

    function getCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, duration, type, startGain, delay) {
      const c = getCtx();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + (delay || 0));
      gain.gain.setValueAtTime(startGain, c.currentTime + (delay || 0));
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay || 0) + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + (delay || 0));
      osc.stop(c.currentTime + (delay || 0) + duration);
    }

    function noiseBurst(duration, startGain, delay) {
      const c = getCtx();
      if (!c) return;
      const bufferSize = c.sampleRate * duration;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.setValueAtTime(startGain, c.currentTime + (delay || 0));
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay || 0) + duration);
      src.connect(gain);
      gain.connect(c.destination);
      src.start(c.currentTime + (delay || 0));
    }

    const raw = {
      click: function () { tone(700, 0.05, 'sine', 0.06); },
      success: function () {
        tone(523.25, 0.1, 'sine', 0.15);
        tone(783.99, 0.2, 'sine', 0.13, 0.08);
      },
      achievementUnlock: function () {
        tone(65.41, 0.5, 'triangle', 0.32, 0);
        tone(130.81, 0.4, 'sawtooth', 0.2, 0);
        noiseBurst(0.15, 0.24, 0);
        tone(523.25, 0.16, 'triangle', 0.24, 0.12);
        tone(261.63, 0.16, 'triangle', 0.14, 0.12);
        tone(659.25, 0.16, 'triangle', 0.24, 0.22);
        tone(329.63, 0.16, 'triangle', 0.14, 0.22);
        tone(783.99, 0.16, 'triangle', 0.24, 0.32);
        tone(392.00, 0.16, 'triangle', 0.14, 0.32);
        tone(1046.5, 0.65, 'triangle', 0.3, 0.44);
        tone(1318.5, 0.65, 'triangle', 0.24, 0.44);
        tone(1568.0, 0.65, 'triangle', 0.24, 0.44);
        tone(523.25, 0.65, 'sine', 0.16, 0.44);
        tone(2093.0, 0.45, 'sine', 0.11, 0.48);
        tone(3136.0, 0.35, 'sine', 0.06, 0.52);
      }
    };

    const wrapped = {};
    Object.keys(raw).forEach(key => {
      wrapped[key] = function (...args) {
        raw[key].apply(null, args);
        if (ctx && ctx.state !== 'running') {
          ensureUnlockListener();
          pendingReplay.push(() => raw[key].apply(null, args));
        }
      };
    });
    return wrapped;
  })();

  const State = {
    session: null,       // { access_token, refresh_token, expires_at, user: {id, nickname, avatar} }
    teamId: null,
    unread: 0,
    panelOpen: false,
    activeTab: 'messages',
    activeConversation: null, // { otherId, otherName }
    realtimeClient: null,
    reconnectAttempts: 0, // 🌟 [신규] 자동 재연결 시도 횟수 (지수 백오프 계산용)
    reconnectTimer: null, // 🌟 [신규] 예약된 재연결 타이머
    intentionalDisconnect: false, // 🌟 [신규] 로그아웃 등 의도적 연결 해제인지 구분 (true면 재연결 안 함)
    messages: [],   // 최근 쪽지 (내가 받은/보낸 것 중 상대방별 최신 1건씩)
    threadMessages: [], // 🌟 [신규] 현재 열어본 대화 상대와 주고받은 전체 메시지
    threadHasMore: false, // 🌟 [신규] 더 불러올 과거 대화가 남아있는지
    threadLoadingMore: false,
    teamChats: [],  // 최근 팀챗
    settings: {
      showSenderName: false,
      dnd: {
        message: { enabled: false, start: '23:00', end: '08:00' },
        news: { enabled: false, start: '23:00', end: '08:00' }
      }
    }
  };

  // ========================================================================
  // 설정 저장/불러오기 (chrome.storage.sync — 같은 구글 계정 크롬이면 기기 간에도 유지됨)
  // ========================================================================
  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('boakoWidgetSettings', (result) => {
        if (result.boakoWidgetSettings) {
          State.settings = Object.assign(State.settings, result.boakoWidgetSettings);
        }
        resolve();
      });
    });
  }
  function saveSettings() {
    chrome.storage.sync.set({ boakoWidgetSettings: State.settings });
  }

  function isInDnd(type) {
    const cfg = State.settings.dnd[type];
    if (!cfg.enabled) return false;
    const now = new Date();
    const [sh, sm] = cfg.start.split(':').map(Number);
    const [eh, em] = cfg.end.split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin; // 자정 넘어가는 구간
  }

  // ========================================================================
  // background.js와의 메시지 통신 (로그인/세션 확인)
  // ========================================================================
  function sendBgMessage(action, data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, data }, (response) => {
        if (chrome.runtime.lastError) {
          boakoErr(`백그라운드 통신 실패 (${action}):`, chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    });
  }

  async function checkSession() {
    boakoLog('세션 확인 요청 중...');
    const res = await sendBgMessage('getArchiveSession');
    State.session = res?.session || null;
    if (State.session) {
      boakoOk('로그인 세션 확인됨:', State.session.user.nickname);
      recordExtVisit(); // 🌟 확장 방문 카운트 기록 (실패해도 무시, 결과 안 기다림)
    } else {
      boakoLog('로그인 안 된 상태');
    }
    return State.session;
  }

  // 🌟 [신규] 확장에서 세션이 확인될 때마다 profiles.ext_visit_count / ext_last_seen_at 갱신 —
  // "확장을 실제로 켜본 적 있는지" 판별용 (사이트만 왔다갔다 하고 확장은 안 켠 사람을 구분하기 위함)
  function recordExtVisit() {
    fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_record_ext_visit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({})
    }).catch(() => { /* 실패해도 조용히 무시 */ });
  }

  async function doLogin() {
    boakoLog('로그인 팝업 요청 중... (chrome.identity.launchWebAuthFlow)');
    const res = await sendBgMessage('archiveLogin');
    if (res?.success) {
      boakoOk('로그인 성공:', res.user.nickname);
      // 🌟 [버그수정] archiveLogin 응답엔 user 정보만 오고 토큰은 안 실려있어서, State.session이
      // 계속 null로 남아 그 이후 모든 조회가 실패했음. 저장된 전체 세션(토큰 포함)을 다시 조회해서 채움.
      await checkSession();
      await initAfterLogin();
    } else {
      boakoErr('로그인 실패:', res?.error);
      showToast('system', '❌', '로그인 실패', res?.error || '알 수 없는 오류');
    }
  }

  async function doLogout() {
    boakoLog('로그아웃 처리 중...');
    disconnectRealtime();
    await sendBgMessage('archiveLogout');
    State.session = null;
    State.teamId = null;
    State.unread = 0;
    render();
    boakoOk('로그아웃 완료');
  }

  // ========================================================================
  // 데이터 조회 (REST) — content_script는 fetch를 페이지 컨텍스트에서 직접 실행 가능
  // ========================================================================
  function authHeaders() {
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${State.session.access_token}`,
      'Content-Type': 'application/json'
    };
  }

  async function fetchTeamId() {
    try {
      const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${State.session.user.id}&select=full_name`, { headers: authHeaders() });
      const [profile] = await profRes.json();
      if (!profile?.full_name) return null;

      const teamRes = await fetch(`${SUPABASE_URL}/rest/v1/team_members?player_name=eq.${encodeURIComponent(profile.full_name)}&is_active=eq.true&select=team_id`, { headers: authHeaders() });
      const [member] = await teamRes.json();
      return member?.team_id || null;
    } catch (e) {
      boakoErr('팀 id 조회 실패:', e);
      return null;
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/messages?receiver_id=eq.${State.session.user.id}&is_read=eq.false&select=message_id`,
        { headers: { ...authHeaders(), Prefer: 'count=exact' } }
      );
      const countHeader = res.headers.get('content-range'); // 형식: "0-9/총개수"
      const total = countHeader ? parseInt(countHeader.split('/')[1], 10) : 0;
      State.unread = total || 0;
      boakoLog(`안읽은 쪽지 ${State.unread}개 확인됨`);
    } catch (e) {
      boakoErr('안읽음 개수 조회 실패:', e);
    }
  }

  // 🌟 [버그수정] limit=30 때문에 오래된 대화가 통째로 안 보이던 문제 — 사이트(messenger.js)처럼
  // 제한 없이 전체를 가져오도록 수정. 대화별 안읽음 개수도 같이 집계해서 목록에 배지로 보여줌.
  async function fetchMessages() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/messages?or=(sender_id.eq.${State.session.user.id},receiver_id.eq.${State.session.user.id})&order=created_at.desc&select=message_id,sender_id,receiver_id,content,created_at,is_read,sender_name_override,receiver_name_override`,
        { headers: authHeaders() }
      );
      const rows = await res.json();
      // 상대방 id별로 가장 최근 메시지 1건 + 안읽음 개수를 같이 집계해서 "대화 목록"처럼 구성
      const byOther = new Map();
      rows.forEach(m => {
        const isMine = m.sender_id === State.session.user.id;
        const otherId = isMine ? m.receiver_id : m.sender_id;
        const otherName = isMine ? m.receiver_name_override : m.sender_name_override;
        if (!byOther.has(otherId)) {
          byOther.set(otherId, { otherId, otherName, lastMessage: m.content, lastTime: m.created_at, unread: 0 });
        }
        if (!isMine && !m.is_read) byOther.get(otherId).unread += 1;
      });
      State.messages = [...byOther.values()];
      boakoLog(`쪽지 대화 ${State.messages.length}건 로드됨`);
    } catch (e) {
      boakoErr('쪽지 목록 조회 실패:', e);
    }
  }

  async function fetchTeamChats() {
    if (!State.teamId) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/team_chats?team_id=eq.${State.teamId}&order=created_at.desc&limit=30&select=id,sender_id,content,created_at`,
        { headers: authHeaders() }
      );
      const rows = await res.json();
      State.teamChats = rows.reverse();
      boakoLog(`팀챗 ${State.teamChats.length}건 로드됨`);
    } catch (e) {
      boakoErr('팀챗 조회 실패:', e);
    }
  }

  const THREAD_PAGE_SIZE = 30;

  // 🌟 [수정] 전체를 한 번에(limit=100) 불러오던 것 → 카톡처럼 최근 30개만 먼저 불러오고,
  // "이전 대화 더 보기"를 눌러야 그 이전 30개를 추가로 불러오는 방식으로 변경 (불필요한 리소스 낭비 방지).
  // before가 없으면 최신 30개, 있으면 그 시각 이전의 30개를 더 가져와서 앞쪽에 이어붙임.
  async function fetchThreadMessages(otherId, before) {
    try {
      // 🌟 [신규] 일정제안/도전장/팀가입/스카웃 같은 "액션 카드" 메시지 렌더링에 필요한 컬럼 추가
      let url = `${SUPABASE_URL}/rest/v1/messages?or=(and(sender_id.eq.${State.session.user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${State.session.user.id}))&order=created_at.desc&limit=${THREAD_PAGE_SIZE}&select=message_id,sender_id,content,created_at,action_type,action_status,metadata,match_id`;
      if (before) url += `&created_at=lt.${encodeURIComponent(before)}`;

      const res = await fetch(url, { headers: authHeaders() });
      const rows = await res.json(); // 최신순(desc)으로 옴
      State.threadHasMore = rows.length === THREAD_PAGE_SIZE; // 정확히 페이지 크기만큼 왔으면 더 있을 가능성

      const chronological = rows.reverse(); // 화면엔 오래된→최신 순으로 보여줘야 하니 뒤집음
      State.threadMessages = before ? [...chronological, ...State.threadMessages] : chronological;
      boakoLog(`대화 내역 ${chronological.length}건 ${before ? '추가' : ''}로드됨 (더 있음: ${State.threadHasMore})`);
    } catch (e) {
      boakoErr('대화 내역 조회 실패:', e);
      if (!before) State.threadMessages = [];
    }
  }

  // 🌟 [신규] "이전 대화 더 보기" 클릭 시 호출 — 지금 맨 위에 있는 메시지 시각 기준으로 그 이전 30개를 더 불러옴
  async function loadMoreThread() {
    if (State.threadLoadingMore || !State.threadHasMore || State.threadMessages.length === 0) return;
    State.threadLoadingMore = true;
    const oldestTime = State.threadMessages[0].created_at;
    const body = document.getElementById('boako-panel-body');
    const prevScrollHeight = body ? body.scrollHeight : 0;

    await fetchThreadMessages(State.activeConversation.otherId, oldestTime);
    render();

    // 위로 새 메시지가 붙었을 때, 보던 위치가 화면에서 안 튀도록 스크롤 보정
    if (body) body.scrollTop = body.scrollHeight - prevScrollHeight;
    State.threadLoadingMore = false;
  }

  // 🌟 [신규] 이 상대방이 보낸(내가 받은) 메시지들을 읽음 처리 — 배지 숫자에도 반영
  async function markThreadAsRead(otherId) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/messages?sender_id=eq.${otherId}&receiver_id=eq.${State.session.user.id}&is_read=eq.false`,
        { method: 'PATCH', headers: { ...authHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ is_read: true }) }
      );
      if (res.ok) await fetchUnreadCount();
    } catch (e) {
      boakoErr('읽음 처리 실패:', e);
    }
  }

  // 🌟 [신규] 대화 열기 — 내역 조회 + 읽음 처리를 한 번에 처리
  async function openConversation(otherId, otherName) {
    State.activeConversation = { otherId, otherName };
    State.threadMessages = []; // 🌟 이전에 보던 대화의 잔상이 잠깐 섞여 보이지 않도록 먼저 비움
    State.threadHasMore = false;
    render(); // 우선 스레드 헤더만 보여주고
    await fetchThreadMessages(otherId);
    await markThreadAsRead(otherId);
    await fetchMessages(); // 목록의 안읽음 배지도 즉시 갱신
    render(); // 실제 메시지로 다시 그림
  }

  // 🌟 [버그수정] receiver_name_override를 안 넣어서, 내가 보낸 답장 목록에서 상대방 이름이
  // "알 수 없음"으로 뜨던 문제 — 대화창을 열 때 이미 알고 있는 상대방 이름(otherName)을 같이 저장.
  async function sendMessageReply(receiverId, receiverName, content) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: { ...authHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          sender_id: State.session.user.id,
          receiver_id: receiverId,
          content,
          sender_name_override: State.session.user.nickname,
          receiver_name_override: receiverName
        })
      });
      boakoOk('쪽지 답장 전송 완료');
    } catch (e) {
      boakoErr('쪽지 전송 실패:', e);
    }
  }

  async function sendTeamChatMessage(content) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/team_chats`, {
        method: 'POST',
        headers: { ...authHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ team_id: State.teamId, sender_id: State.session.user.id, content })
      });
      boakoOk('팀챗 전송 완료');
    } catch (e) {
      boakoErr('팀챗 전송 실패:', e);
    }
  }

  // ========================================================================
  // 🌟 [신규] 탭 간 실시간 연결 리더 선출 — BGA 탭을 여러 개 열면 탭마다 각자 웹소켓을 만들어서
  // Supabase 무료 플랜 동시연결(200개) 한도를 필요 이상으로 빨리 잡아먹는 문제를 방지.
  // 같은 브라우저 안의 탭들 중 "리더" 탭 하나만 진짜 연결을 열고, 나머지(팔로워)는 그 리더가
  // BroadcastChannel로 중계해주는 이벤트만 받아서 동일하게 반응(토스트/뱃지/오버레이는 각 탭이 알아서 그림).
  // 리더가 죽으면(탭 닫힘 등) 하트비트가 끊기고, 남은 탭 중 하나가 자동으로 리더를 이어받음.
  // ========================================================================
  const TAB_ID = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const LEADER_KEY = 'boako_realtime_leader';
  const LEADER_TTL_MS = 6000;       // 이 시간 넘게 하트비트가 없으면 리더가 죽은 것으로 간주
  const HEARTBEAT_INTERVAL_MS = 2000;

  let isRealtimeLeader = false;
  let leaderHeartbeatTimer = null;
  let followerWatchTimer = null;
  let realtimeBC = null;

  function getLeaderInfo() {
    try {
      const raw = localStorage.getItem(LEADER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function isLeaderInfoAlive(info) {
    return !!info && (Date.now() - info.ts) < LEADER_TTL_MS;
  }

  // 팔로워 탭으로 전달할 때 사용 — 리더 탭에서만 실제로 방송함
  function broadcastToFollowers(type, payload) {
    if (!isRealtimeLeader || !realtimeBC) return;
    try { realtimeBC.postMessage({ type, payload }); } catch (e) { /* noop */ }
  }

  // 팔로워 탭이 리더로부터 중계받은 이벤트를 로컬 이벤트와 동일하게 처리
  function dispatchRelayedEvent(type, payload) {
    switch (type) {
      case 'message-insert': onMessageInsert(payload); break;
      case 'team-chat-insert': onTeamChatInsert(payload); break;
      case 'news-insert': onNewsInsert(payload); break;
      case 'achievement-insert': onAchievementInsert(payload); break;
      case 'rival-vote-update': onRivalVoteUpdate(payload); break;
      case 'recommend-bonus-update': onRecommendBonusUpdate(payload); break;
    }
  }

  function claimLeadership() {
    if (followerWatchTimer) { clearInterval(followerWatchTimer); followerWatchTimer = null; }
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
    isRealtimeLeader = true;
    boakoOk(`이 탭이 실시간 연결 리더로 선출됨 (id: ${TAB_ID.slice(0, 8)})`);
    _doConnect(); // 진짜 웹소켓 연결은 리더 탭에서만 생성
    leaderHeartbeatTimer = setInterval(() => {
      localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
    }, HEARTBEAT_INTERVAL_MS);
    // 🌟 [신규] 시즌 스플래시(팀 소속자 전용) — 사이트 season_splash.js와 완전히 동일한 디자인/애니메이션/사운드.
    // enqueueFullscreenOverlay 큐에 태워서 업적/라이벌결과/추천보너스/④⑤⑥⑦활성화와 자동으로 안 겹치게 함.
    checkSeasonSplash();
    // 🌟 [리팩토링] ④⑤⑥번 활성화 오버레이 통합 대기열 체크 — 여러 BGA 탭이 열려있어도
    // 리더 탭에서만 체크해서 중복 방지. 크론이 미리 계산해둔 대기열을 조회만 함.
    checkActivationOverlayQueue();
  }

  function becomeFollower() {
    isRealtimeLeader = false;
    boakoLog('다른 탭이 이미 실시간 연결 리더 — 이 탭은 팔로워로 대기 (중계 이벤트만 수신, 별도 연결 안 만듦)');
    if (!followerWatchTimer) {
      followerWatchTimer = setInterval(() => {
        const info = getLeaderInfo();
        if (!isLeaderInfoAlive(info)) {
          boakoWarn('리더 탭의 하트비트가 끊김 — 리더 승격 시도');
          tryClaimWithJitter();
        }
      }, 2000);
    }
  }

  // 여러 탭이 동시에 리더가 없다고 판단해서 한꺼번에 승격을 시도할 수 있으므로,
  // 무작위 지연을 살짝 준 뒤 그 사이 다른 탭이 먼저 리더가 됐는지 다시 확인
  function tryClaimWithJitter() {
    const jitter = Math.random() * 400;
    setTimeout(() => {
      const info = getLeaderInfo();
      if (!isLeaderInfoAlive(info)) {
        claimLeadership();
      } else {
        becomeFollower();
      }
    }, jitter);
  }

  function initRealtimeCoordination() {
    realtimeBC = new BroadcastChannel('boako-realtime-relay');
    realtimeBC.onmessage = (e) => {
      if (isRealtimeLeader) return; // 리더는 이벤트의 원본 발신자이므로 자기 방송은 무시
      const { type, payload } = e.data || {};
      if (type) dispatchRelayedEvent(type, payload);
    };

    window.addEventListener('beforeunload', () => {
      if (isRealtimeLeader) {
        // 리더가 사라진다는 걸 즉시 localStorage에서 지워서, 팔로워가 하트비트 타임아웃(최대 6초)까지
        // 안 기다리고 다음 감시 주기(2초 이내)에 바로 승격하도록 함
        try {
          const info = getLeaderInfo();
          if (info && info.tabId === TAB_ID) localStorage.removeItem(LEADER_KEY);
        } catch (e) { /* noop */ }
        if (leaderHeartbeatTimer) clearInterval(leaderHeartbeatTimer);
      }
    });

    tryClaimWithJitter();
  }

  function teardownRealtimeCoordination() {
    if (leaderHeartbeatTimer) { clearInterval(leaderHeartbeatTimer); leaderHeartbeatTimer = null; }
    if (followerWatchTimer) { clearInterval(followerWatchTimer); followerWatchTimer = null; }
    if (isRealtimeLeader) {
      try {
        const info = getLeaderInfo();
        if (info && info.tabId === TAB_ID) localStorage.removeItem(LEADER_KEY);
      } catch (e) { /* noop */ }
    }
    isRealtimeLeader = false;
    if (realtimeBC) { try { realtimeBC.close(); } catch (e) {} realtimeBC = null; }
  }

  // ========================================================================
  // 🌟 실시간 연결 (핵심 디버깅 대상) — 이 단계에서 CSP 문제가 있으면 아래 로그로 바로 드러남
  // 🌟 [신규] socket closed(1006 등)로 연결이 끊기면 기존엔 그냥 로그만 남기고 끝이었음 —
  // 그 탭에서는 재접속 전까지 실시간 기능이 계속 죽어있는 상태로 남는 문제가 있었음.
  // onClose에서 의도적 해제(로그아웃)가 아니면 지수 백오프(2s→4s→8s→...→최대 30s)로 자동 재연결하도록 수정.
  // ========================================================================
  function connectRealtime() {
    if (State.realtimeClient) {
      boakoLog('이미 연결된 realtime 클라이언트가 있어 재사용');
      return;
    }
    State.intentionalDisconnect = false;
    _doConnect();
  }

  function _scheduleReconnect() {
    if (State.intentionalDisconnect) return; // 로그아웃 등 의도적 해제면 재연결 안 함
    if (State.reconnectTimer) return; // 이미 예약돼 있으면 중복 예약 방지

    const delay = Math.min(2000 * Math.pow(2, State.reconnectAttempts), 30000);
    State.reconnectAttempts += 1;
    boakoWarn(`${(delay / 1000).toFixed(0)}초 후 실시간 연결 재시도 (${State.reconnectAttempts}번째 시도)`);

    State.reconnectTimer = setTimeout(() => {
      State.reconnectTimer = null;
      if (State.realtimeClient) {
        try { State.realtimeClient.disconnect(); } catch (e) { /* noop */ }
        State.realtimeClient = null;
      }
      if (!State.intentionalDisconnect && State.session) _doConnect();
    }, delay);
  }

  function _doConnect() {
    if (typeof BoakoRealtimeClient === 'undefined') {
      boakoErr('BoakoRealtimeClient 없음 — 실시간 연결 시도 자체를 할 수 없음');
      return;
    }

    const wsUrl = `${SUPABASE_URL.replace('https://', 'wss://')}/realtime/v1`;
    boakoLog('웹소켓 연결 시도:', wsUrl);

    const client = new BoakoRealtimeClient(wsUrl, { params: { apikey: SUPABASE_KEY } });
    State.realtimeClient = client;

    // 🌟 [버그수정] onOpen/onClose/onError는 client(RealtimeClient) 최상위가 아니라
    // client.socketAdapter(내부 소켓 래퍼)에 있음 — 연결 단계별 상태를 전부 로그로 남김.
    // CSP가 막으면 보통 onError가 뜨거나, onOpen이 영원히 안 뜸
    client.socketAdapter.onOpen(() => {
      boakoOk('웹소켓 연결 성공! (CSP 문제 없음)');
      State.reconnectAttempts = 0; // 정상 연결됐으니 다음에 끊기면 다시 짧은 지연부터 재시도
    });
    client.socketAdapter.onClose((e) => {
      boakoWarn('웹소켓 연결 종료됨:', e);
      State.realtimeClient = null;
      _scheduleReconnect();
    });
    client.socketAdapter.onError((e) => boakoErr('웹소켓 연결 오류 발생 — BGA 페이지의 CSP가 Supabase 연결을 막고 있을 가능성이 있음. 개발자 도구 콘솔에 "Refused to connect" 또는 "violates the following Content Security Policy" 에러가 같이 떠 있는지 확인해보세요.', e));

    client.setAuth(State.session.access_token);
    client.connect();

    _subscribeAllChannels(client);
  }

  // 🌟 재연결 시에도 동일하게 전체 채널을 다시 구독해야 하므로 별도 함수로 분리
  // ========================================================================
  // 🌟 [신규] 각 실시간 이벤트의 실제 처리 로직을 독립 함수로 분리.
  // 리더 탭에서는 실제 구독 콜백에서 호출되고, 팔로워 탭에서는 BroadcastChannel로 중계받은
  // 이벤트에서 동일하게 호출됨 — 어느 쪽이든 완전히 똑같은 화면 반응(토스트/뱃지/오버레이)을 보장.
  // ========================================================================
  async function onMessageInsert(payload) {
    boakoOk('새 쪽지 실시간 수신:', payload.new);
    State.unread += 1;
    await fetchMessages();
    const isViewingThisThread = State.panelOpen && State.activeTab === 'messages' && State.activeConversation?.otherId === payload.new.sender_id;
    if (isViewingThisThread) {
      await fetchThreadMessages(payload.new.sender_id);
      await markThreadAsRead(payload.new.sender_id);
    }
    render();
    if (!isViewingThisThread) handleIncomingToast('message', payload.new);
  }

  function onTeamChatInsert(payload) {
    if (payload.new.sender_id === State.session.user.id) return;
    boakoOk('새 팀챗 실시간 수신:', payload.new);
    fetchTeamChats().then(render);
    handleIncomingToast('message', payload.new, true);
  }

  function onNewsInsert(payload) {
    boakoOk('새 아카이브 소식 실시간 수신:', payload.new);
    const item = payload.new;
    const targetUrl = (item.link_type && item.link_id)
      ? `https://boakoarchive.co.kr/?open=${encodeURIComponent(item.link_type)}&id=${encodeURIComponent(item.link_id)}`
      : 'https://boakoarchive.co.kr/';
    fireNewsToast(item.title || '새 소식이 도착했어요', item.subtitle || '클릭해서 확인해보세요', targetUrl);
  }

  async function onAchievementInsert(payload) {
    boakoOk('새 업적 달성 실시간 수신:', payload.new);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/achievements?id=eq.${payload.new.achievement_id}&select=*`, { headers: authHeaders() });
      const [achievement] = await res.json();
      if (achievement) enqueueFullscreenOverlay(() => renderAchievementOverlay(achievement, payload.new.meta, payload.new.season_no));
    } catch (e) { boakoErr('업적 정보 조회 실패:', e); }
  }

  function onRivalVoteUpdate(payload) {
    if (!payload.new.resolved_at || (payload.old && payload.old.resolved_at)) return;
    boakoOk('라이벌전 투표 결과 실시간 수신:', payload.new);
    enqueueFullscreenOverlay(() => renderRivalResultOverlay(payload.new));
  }

  function onRecommendBonusUpdate(payload) {
    if (!payload.new.bonus_point || payload.new.bonus_point <= 0) return;
    if (payload.old && payload.old.bonus_point > 0) return;
    boakoOk('오늘의 추천 게임 보너스 실시간 수신:', payload.new);
    enqueueFullscreenOverlay(() => renderRecommendBonusOverlay(payload.new.game_name, payload.new.bonus_point));
  }

  function _subscribeAllChannels(client) {

    // 내 쪽지함 실시간 구독
    const msgTopic = `messages-${State.session.user.id}`;
    boakoLog(`채널 구독 시도: ${msgTopic}`);
    const msgChannel = client.channel(msgTopic, { config: {} });
    msgChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${State.session.user.id}` }, (payload) => {
      onMessageInsert(payload);
      broadcastToFollowers('message-insert', payload);
    });
    msgChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') boakoOk(`채널 구독 성공: ${msgTopic}`);
      else if (status === 'CHANNEL_ERROR') boakoErr(`채널 구독 실패(CHANNEL_ERROR): ${msgTopic}`, err);
      else if (status === 'TIMED_OUT') boakoErr(`채널 구독 타임아웃(TIMED_OUT, CSP/네트워크 문제 가능성): ${msgTopic}`);
      else if (status === 'CLOSED') boakoWarn(`채널 닫힘(CLOSED): ${msgTopic}`);
    });

    // 팀챗 실시간 구독 (팀 소속인 경우만)
    if (State.teamId) {
      const teamTopic = `team-chats-${State.teamId}`;
      boakoLog(`채널 구독 시도: ${teamTopic}`);
      const teamChannel = client.channel(teamTopic, { config: {} });
      teamChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chats', filter: `team_id=eq.${State.teamId}` }, (payload) => {
        onTeamChatInsert(payload);
        broadcastToFollowers('team-chat-insert', payload);
      });
      teamChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') boakoOk(`채널 구독 성공: ${teamTopic}`);
        else if (status === 'CHANNEL_ERROR') boakoErr(`채널 구독 실패(CHANNEL_ERROR): ${teamTopic}`, err);
        else if (status === 'TIMED_OUT') boakoErr(`채널 구독 타임아웃(TIMED_OUT): ${teamTopic}`);
        else if (status === 'CLOSED') boakoWarn(`채널 닫힘(CLOSED): ${teamTopic}`);
      });
    }

    // 🌟 아카이브 소식(news_feed_items) 실시간 구독
    const newsTopic = 'archive-news-feed';
    boakoLog(`채널 구독 시도: ${newsTopic}`);
    const newsChannel = client.channel(newsTopic, { config: {} });
    newsChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_feed_items' }, (payload) => {
      onNewsInsert(payload);
      broadcastToFollowers('news-insert', payload);
    });
    newsChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') boakoOk(`채널 구독 성공: ${newsTopic}`);
      else if (status === 'CHANNEL_ERROR') boakoErr(`채널 구독 실패(CHANNEL_ERROR): ${newsTopic}`, err);
      else if (status === 'TIMED_OUT') boakoErr(`채널 구독 타임아웃(TIMED_OUT): ${newsTopic}`);
      else if (status === 'CLOSED') boakoWarn(`채널 닫힘(CLOSED): ${newsTopic}`);
    });

    // 🌟 업적 획득 실시간 구독
    const achvTopic = `achievements-${State.session.user.id}`;
    boakoLog(`채널 구독 시도: ${achvTopic}`);
    const achvChannel = client.channel(achvTopic, { config: {} });
    achvChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_achievements', filter: `user_id=eq.${State.session.user.id}` }, (payload) => {
      onAchievementInsert(payload);
      broadcastToFollowers('achievement-insert', payload);
    });
    achvChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') boakoOk(`채널 구독 성공: ${achvTopic}`);
      else if (status === 'CHANNEL_ERROR') boakoErr(`채널 구독 실패(CHANNEL_ERROR): ${achvTopic}`, err);
      else if (status === 'TIMED_OUT') boakoErr(`채널 구독 타임아웃(TIMED_OUT): ${achvTopic}`);
      else if (status === 'CLOSED') boakoWarn(`채널 닫힘(CLOSED): ${achvTopic}`);
    });

    // 🌟 라이벌전 승자 예측 투표 결과 실시간 구독
    const rivalTopic = `rival-votes-${State.session.user.id}`;
    boakoLog(`채널 구독 시도: ${rivalTopic}`);
    const rivalChannel = client.channel(rivalTopic, { config: {} });
    rivalChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rival_match_votes', filter: `voter_id=eq.${State.session.user.id}` }, (payload) => {
      onRivalVoteUpdate(payload);
      broadcastToFollowers('rival-vote-update', payload);
    });
    rivalChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') boakoOk(`채널 구독 성공: ${rivalTopic}`);
      else if (status === 'CHANNEL_ERROR') boakoErr(`채널 구독 실패(CHANNEL_ERROR): ${rivalTopic}`, err);
      else if (status === 'TIMED_OUT') boakoErr(`채널 구독 타임아웃(TIMED_OUT): ${rivalTopic}`);
      else if (status === 'CLOSED') boakoWarn(`채널 닫힘(CLOSED): ${rivalTopic}`);
    });

    // 🌟 오늘의 추천 게임 보너스 지급 실시간 구독
    const recTopic = `recommend-bonus-${State.session.user.id}`;
    boakoLog(`채널 구독 시도: ${recTopic}`);
    const recChannel = client.channel(recTopic, { config: {} });
    recChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'daily_recommend_bonus_claims', filter: `user_id=eq.${State.session.user.id}` }, (payload) => {
      onRecommendBonusUpdate(payload);
      broadcastToFollowers('recommend-bonus-update', payload);
    });
    recChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') boakoOk(`채널 구독 성공: ${recTopic}`);
      else if (status === 'CHANNEL_ERROR') boakoErr(`채널 구독 실패(CHANNEL_ERROR): ${recTopic}`, err);
      else if (status === 'TIMED_OUT') boakoErr(`채널 구독 타임아웃(TIMED_OUT): ${recTopic}`);
      else if (status === 'CLOSED') boakoWarn(`채널 닫힘(CLOSED): ${recTopic}`);
    });
  }

  function disconnectRealtime() {
    State.intentionalDisconnect = true; // 🌟 로그아웃 등 의도적 해제 — 재연결 스케줄러가 다시 붙지 않도록
    if (State.reconnectTimer) {
      clearTimeout(State.reconnectTimer);
      State.reconnectTimer = null;
    }
    State.reconnectAttempts = 0;
    if (State.realtimeClient) {
      boakoLog('실시간 연결 해제');
      State.realtimeClient.disconnect();
      State.realtimeClient = null;
    }
    teardownRealtimeCoordination(); // 🌟 리더였다면 자리 비켜주고, 하트비트/방송 채널 정리
  }

  // ========================================================================
  // 토스트
  // ========================================================================
  function handleIncomingToast(kind, payload, isTeam) {
    const dndType = 'message';
    if (isInDnd(dndType)) {
      boakoLog(`방해금지 시간대(메시지) — 토스트 생략, 배지만 반영`);
      renderBadge();
      return;
    }
    const label = State.settings.showSenderName
      ? `${payload.sender_name_override || '팀원'} 님이 메시지를 보냈어요`
      : (isTeam ? '팀챗에 새 메시지가 도착했어요' : '새 쪽지가 도착했어요');
    const body = State.settings.showSenderName ? (payload.content || '') : '클릭해서 확인해보세요';
    showToast('message', '📬', label, body, () => {
      openPanel();
      showTab(isTeam ? 'teamchat' : 'messages');
    });
  }

  function fireNewsToast(title, body, url) {
    if (isInDnd('news')) {
      boakoLog('방해금지 시간대(소식) — 소식 토스트 생략');
      return;
    }
    showToast('news', '⭐', title, body, () => window.open(url || 'https://boakoarchive.co.kr/', '_blank'));
  }

  function showToast(type, icon, title, body, onClick) {
    ensureToastStack();
    const stack = document.getElementById('boako-toast-stack');
    const el = document.createElement('div');
    el.className = 'boako-toast';
    el.innerHTML = `<div class="boako-toast-icon">${icon}</div><div><div class="boako-toast-title">${title}</div><div class="boako-toast-body">${body}</div></div>`;
    if (onClick) { el.style.cursor = 'pointer'; el.addEventListener('click', onClick); }
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 4500);
  }

  function showSystemToast(icon, title, body) {
    showToast('system', icon, title, body, null);
  }

  // ========================================================================
  // 🌟 [신규] 전체화면 오버레이 (업적/라이벌전 결과/추천게임 보너스) — 사이트의 팝업들과 동일한
  // 톤(어두운 배경 + 중앙 카드)을 확장 프로그램에서도 재현. 여러 개가 한꺼번에 오면 겹치지 않게
  // 큐로 순서대로 보여줌. 표시 직전에 데이터를 조회하는 지연 실행 방식(buildHtmlFn).
  // ========================================================================
  const _fsOverlayQueue = [];
  let _fsOverlayShowing = false;

  function enqueueFullscreenOverlay(buildHtmlFn) {
    _fsOverlayQueue.push(buildHtmlFn);
    processFullscreenOverlayQueue();
  }

  async function processFullscreenOverlayQueue() {
    if (_fsOverlayShowing) return;
    const next = _fsOverlayQueue.shift();
    if (!next) return;
    _fsOverlayShowing = true;
    const result = await next();
    if (result?.html) await showFullscreenOverlay(result.html, result.dismissOnBackdrop);
    _fsOverlayShowing = false;
    processFullscreenOverlayQueue();
  }

  function showFullscreenOverlay(innerHtml, dismissOnBackdrop) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed; inset:0; z-index:1000000; display:flex; align-items:center; justify-content:center;
        background:rgba(15,23,42,${dismissOnBackdrop ? '0.6' : '0.75'}); backdrop-filter:blur(3px); opacity:0; transition:opacity .25s ease;
        ${dismissOnBackdrop ? 'cursor:pointer;' : ''}
      `;
      overlay.innerHTML = innerHtml;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => { overlay.style.opacity = '1'; });

      let dismissed = false;
      const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); resolve(); }, 250);
      };
      if (dismissOnBackdrop) {
        overlay.addEventListener('click', dismiss);
      } else {
        overlay.querySelector('[data-boako-dismiss]')?.addEventListener('click', dismiss);
      }
    });
  }

  // 🌟 사이트 achievements.js의 renderBadgeHTML과 동일한 합성 로직 (item_id 파싱 단계만 생략 —
  // 확장에선 achievement 객체를 이미 갖고 있어서 code로 바로 조회하면 됨). 정사각형 강제 없이
  // 높이만 고정하고 폭은 내용(로고/이모지) 비율 그대로.
  async function getAchievementByCode(code) {
    if (_achievementByCodeCache[code] !== undefined) return _achievementByCodeCache[code];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/achievements?code=eq.${encodeURIComponent(code)}&select=*`, { headers: authHeaders() });
    const [row] = await res.json();
    _achievementByCodeCache[code] = row || null;
    return row || null;
  }
  async function getSeasonLogo(seasonNo) {
    if (!seasonNo) return null;
    if (_seasonLogoCache[seasonNo] !== undefined) return _seasonLogoCache[seasonNo];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/seasons?season_no=eq.${seasonNo}&select=season_logo_url`, { headers: authHeaders() });
    const [row] = await res.json();
    _seasonLogoCache[seasonNo] = row?.season_logo_url || null;
    return _seasonLogoCache[seasonNo];
  }
  async function getGameLogo(gameName) {
    if (!gameName) return null;
    if (_gameLogoCache[gameName] !== undefined) return _gameLogoCache[gameName];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/games?game_name=eq.${encodeURIComponent(gameName)}&select=image_url`, { headers: authHeaders() });
    const [row] = await res.json();
    _gameLogoCache[gameName] = row?.image_url || null;
    return _gameLogoCache[gameName];
  }
  function getTierStyle(name) {
    if (name && name.includes('(금)')) return { bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', ring: '#fbbf24' };
    if (name && name.includes('(은)')) return { bg: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', ring: '#cbd5e1' };
    if (name && name.includes('(동)')) return { bg: 'linear-gradient(135deg,#fb923c,#c2703d)', ring: '#fb923c' };
    return { bg: 'linear-gradient(135deg,#8b5cf6,#4f46e5)', ring: '#8b5cf6' };
  }

  async function renderAchievementBadgeHTML(achievement, seasonNo, meta, sizePx) {
    sizePx = sizePx || 48;
    const fallbackEmoji = `<div style="height:${sizePx}px; display:inline-flex; align-items:center; justify-content:center; padding:0 ${Math.round(sizePx * 0.15)}px; font-size:${Math.round(sizePx * 0.6)}px; box-sizing:border-box;">🏅</div>`;
    if (!achievement) return fallbackEmoji;

    const gameName = meta && meta.game_name ? meta.game_name : null;

    if (achievement.code.startsWith('game_mania_')) {
      const tier = getTierStyle(achievement.name);
      const gameLogo = await getGameLogo(gameName);
      const pad = Math.max(2, Math.round(sizePx * 0.08));
      const innerPad = Math.max(2, Math.round(sizePx * 0.06));
      return `
        <div style="height:${sizePx}px; display:inline-flex; align-items:center; justify-content:center; border-radius:${Math.round(sizePx * 0.22)}px; background:${tier.bg}; padding:${pad}px; box-shadow:0 0 0 2px ${tier.ring}55; box-sizing:border-box;">
          <div style="height:100%; display:inline-flex; align-items:center; justify-content:center; border-radius:${Math.round(sizePx * 0.18)}px; background:#fff; padding:${innerPad}px; box-sizing:border-box;">
            ${gameLogo ? `<img src="${cdnUrl(gameLogo)}" style="height:100%; width:auto; display:block;">` : `<span style="font-size:${Math.round(sizePx * 0.5)}px;">🎲</span>`}
          </div>
        </div>
      `;
    }

    if (!achievement.badge_icon_url) return fallbackEmoji;

    let overlayHtml = '';
    if (achievement.season_logo_overlay && seasonNo) {
      const seasonLogo = await getSeasonLogo(seasonNo);
      if (seasonLogo) {
        const ov = achievement.season_logo_overlay;
        overlayHtml = `<img src="${cdnUrl(seasonLogo)}" style="position:absolute; top:${ov.top}; left:${ov.left}; width:${ov.width}; height:${ov.height}; object-fit:contain; transform:translate(-50%,-50%) rotate(${ov.rotate || 0}deg); pointer-events:none;">`;
      }
    }

    return `
      <div style="height:${sizePx}px; position:relative; display:inline-block; vertical-align:middle;">
        <img src="${cdnUrl(achievement.badge_icon_url)}" style="height:100%; width:auto; display:block;">
        ${overlayHtml}
      </div>
    `;
  }

  // 🌟 사이트 achievements.js showToast와 동일한 풀스크린 오버레이. 화면 아무데나 클릭하면 닫힘(버튼 없음).
  async function renderAchievementOverlay(achievement, meta, seasonNo) {
    ensureAchievementBadgeStyle();
    const gameName = meta && meta.game_name ? meta.game_name : null;
    const badgeHtml = await renderAchievementBadgeHTML(achievement, seasonNo, meta, 140);
    boakoSfx.achievementUnlock();

    const html = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; padding:20px; max-width:420px;">
        <div class="boako-achv-badge-pop" style="display:flex; align-items:center; justify-content:center;">${badgeHtml}</div>
        <div style="font-size:13px; font-weight:900; color:#c4b5fd; letter-spacing:0.12em; text-transform:uppercase;">업적 달성!</div>
        <div style="font-size:26px; font-weight:900; color:#fff; text-shadow:0 4px 14px rgba(0,0,0,0.45); line-height:1.35;">
          ${achievement.name}${gameName ? `<br><span style="font-size:16px; color:#cbd5e1; font-weight:700;">(${gameName})</span>` : ''}
        </div>
        <div style="font-size:16px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,0.3); padding:7px 20px; border-radius:999px;">
          +${Number(achievement.point_reward || 0).toLocaleString()} P 획득
        </div>
        <div style="font-size:11px; font-weight:700; color:rgba(255,255,255,0.6); margin-top:6px;">화면을 탭하면 닫혀요</div>
      </div>
    `;
    return { html, dismissOnBackdrop: true };
  }

  function ensureAchievementBadgeStyle() {
    if (document.getElementById('boako-achv-badge-style')) return;
    const style = document.createElement('style');
    style.id = 'boako-achv-badge-style';
    style.textContent = `
      @keyframes boako-achv-badge-pop {
        0%   { transform: scale(0.4) rotate(-10deg); opacity: 0; }
        60%  { transform: scale(1.15) rotate(4deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      .boako-achv-badge-pop { animation: boako-achv-badge-pop 0.5s cubic-bezier(.34,1.56,.64,1) 0.1s both; }
    `;
    document.head.appendChild(style);
  }

  // 🌟 사이트 rival_notify.js showToast와 동일한 VS 구도 오버레이 (승자 크게/패자 작게 + 프사 + 예측결과)
  async function renderRivalResultOverlay(voteRow) {
    let gameName = '라이벌전';
    let winner = null, loser = null;

    try {
      const matchRes = await fetch(`${SUPABASE_URL}/rest/v1/rival_matches?match_id=eq.${voteRow.match_id}&select=game_name,challenger_id,defender_id,winner_id`, { headers: authHeaders() });
      const [match] = await matchRes.json();
      if (match) {
        gameName = match.game_name || '라이벌전';
        const loserId = match.winner_id === match.challenger_id ? match.defender_id : match.challenger_id;

        const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${match.challenger_id},${match.defender_id})&select=id,full_name,profile_url,custom_avatar_url`, { headers: authHeaders() });
        const profiles = await profRes.json();
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        const buildPerson = (id) => {
          const p = profileMap[id];
          const avatar = p ? (p.custom_avatar_url || p.profile_url || null) : null;
          return { name: p?.full_name || '선수', avatar: avatar ? avatar.replace('http://', 'https://') : null };
        };
        winner = buildPerson(match.winner_id);
        loser = buildPerson(loserId);
      }
    } catch (e) {
      boakoErr('라이벌전 결과 정보 조회 실패:', e);
    }

    const isCorrect = !!voteRow.is_correct;
    const rewardPoint = Number(voteRow.reward_point || 0);
    if (isCorrect) boakoSfx.success(); else boakoSfx.click();

    const avatarHtml = (person, size) => person?.avatar
      ? `<img src="${person.avatar}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; display:block;">`
      : `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:${Math.round(size * 0.4)}px; font-weight:900;">${(person?.name || '?').charAt(0)}</div>`;

    const html = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:18px; text-align:center; padding:28px; max-width:440px;">
        <div style="font-size:12px; font-weight:900; color:#94a3b8; letter-spacing:0.14em; text-transform:uppercase;">${gameName} · 라이벌전 결과</div>

        <div style="display:flex; align-items:center; justify-content:center; gap:14px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div style="position:relative;">
              <div style="border-radius:50%; padding:4px; background:linear-gradient(135deg,#fbbf24,#f59e0b); box-shadow:0 0 24px rgba(251,191,36,0.5);">
                ${avatarHtml(winner, 84)}
              </div>
            </div>
            <div style="font-size:16px; font-weight:900; color:#fff;">${winner?.name || '승자'}</div>
            <div style="font-size:10px; font-weight:900; letter-spacing:0.1em; color:#78350f; background:linear-gradient(135deg,#fde68a,#fbbf24); padding:3px 12px; border-radius:999px;">🏆 WINNER</div>
          </div>

          <div style="font-size:20px; font-weight:900; color:#64748b; font-style:italic; padding-bottom:24px;">VS</div>

          <div style="display:flex; flex-direction:column; align-items:center; gap:6px; opacity:0.75;">
            <div style="border-radius:50%; padding:3px; background:#334155;">
              ${avatarHtml(loser, 56)}
            </div>
            <div style="font-size:13px; font-weight:800; color:#cbd5e1;">${loser?.name || '패자'}</div>
            <div style="font-size:9px; font-weight:900; letter-spacing:0.1em; color:#94a3b8; background:#1e293b; padding:2px 10px; border-radius:999px;">LOSER</div>
          </div>
        </div>

        <div style="width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:16px;">
          <div style="font-size:12px; font-weight:900; color:${isCorrect ? '#fbbf24' : '#c4b5fd'}; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;">
            ${isCorrect ? '🎉 내 예측 적중!' : '🙌 응원 참여 완료'}
          </div>
          <div style="font-size:15px; font-weight:900; color:#fff; background:rgba(0,0,0,0.3); display:inline-block; padding:6px 18px; border-radius:999px;">
            +${rewardPoint.toLocaleString()} P 획득
          </div>
        </div>

        <button data-boako-dismiss style="width:100%; background:#fff; color:#0f172a; font-weight:900; font-size:14px; padding:12px; border-radius:12px; border:none; cursor:pointer; margin-top:4px;">확인</button>
      </div>
    `;
    return { html, dismissOnBackdrop: false };
  }

  // 🌟 사이트 recommend_notify.js showToast와 동일 (게임 로고 실제 조회 포함)
  async function renderRecommendBonusOverlay(gameName, bonusPoint) {
    let logoUrl = null;
    try {
      const gl = await getGameLogo(gameName);
      logoUrl = gl ? cdnUrl(gl) : null;
    } catch (e) {
      boakoErr('추천 게임 로고 조회 실패:', e);
    }

    const html = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:380px;">
        <div style="font-size:12px; font-weight:900; color:#fbbf24; letter-spacing:0.14em; text-transform:uppercase;">⭐ 오늘의 추천 게임 보너스</div>
        <div style="width:96px; height:96px; border-radius:20px; background:#fff; display:flex; align-items:center; justify-content:center; padding:10px; box-shadow:0 0 24px rgba(251,191,36,0.35);">
          ${logoUrl ? `<img src="${logoUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span style="font-size:40px;">🎲</span>`}
        </div>
        <div style="font-size:19px; font-weight:900; color:#fff;">${escapeHtml(gameName)}</div>
        <p style="font-size:12px; font-weight:700; color:#cbd5e1; margin:-8px 0 0;">기록을 남겨주셔서 감사해요!</p>
        <div style="font-size:16px; font-weight:900; color:#fff; background:rgba(0,0,0,0.3); padding:7px 20px; border-radius:999px;">
          💎 +${Number(bonusPoint).toLocaleString()} P 획득
        </div>
        <button data-boako-dismiss style="width:100%; background:#fff; color:#0f172a; font-weight:900; font-size:14px; padding:12px; border-radius:12px; border:none; cursor:pointer; margin-top:4px;">확인</button>
      </div>
    `;
    boakoSfx.success();
    return { html, dismissOnBackdrop: false };
  }

  // ========================================================================
  // 🌟 [리팩토링] ④⑤⑥번 활성화 오버레이 — 로그인 시점 실시간 계산(fn_check_*) 방식에서
  // 크론(fn_enqueue_*) + 대기열(activation_overlay_queue) 방식으로 전환.
  // checkActivationOverlayQueue() 하나만 fn_get_my_activation_overlay()를 호출해서 대기열을 조회하고,
  // overlay_type에 따라 아래 세 렌더러(showRivalRecommendOverlay/showSocialActivationOverlay/showExtHelpOverlay)
  // 중 하나만 호출. 여러 BGA 탭이 열려있어도 리더 탭에서만 체크(claimLeadership() 참조)해서 중복 방지.
  // 🌟 업적/라이벌결과/추천보너스 실시간 오버레이(_fsOverlayShowing)가 떠 있으면 그게 끝날 때까지
  // 짧은 간격으로 대기했다가 표시 — 로그인 직후 실시간 이벤트와 겹쳐서 오버레이 두 개가 동시에
  // 뜨는 걸 방지 (사이트 activation_dispatch.js의 대기 패턴과 동일한 개념).
  // ========================================================================
  async function checkActivationOverlayQueue() {
    if (_fsOverlayShowing) {
      setTimeout(checkActivationOverlayQueue, 300);
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_get_my_activation_overlay`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({})
      });
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return; // 대기열에 없음

      const row = rows[0];
      boakoOk('활성화 오버레이 대기열 확인됨:', row);
      if (row.overlay_type === 'rival_recommend') {
        showRivalRecommendOverlay(row.meta || {});
      } else if (row.overlay_type === 'social_activation') {
        showSocialActivationOverlay((row.meta || {}).target_type);
      } else if (row.overlay_type === 'ext_help') {
        showExtHelpOverlay();
      }
    } catch (e) {
      boakoErr('활성화 오버레이 대기열 확인 실패:', e);
    }
  }

  function showRivalRecommendOverlay(rec) {
    const avatarHtml = (url, name, size) => url
      ? `<img src="${url}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; display:block;">`
      : `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:${Math.round(size * 0.4)}px; font-weight:900;">${(name || '?').charAt(0)}</div>`;

    const myName = State.session?.user?.nickname || '나';
    const myAvatar = (State.session?.user?.avatar || '').replace('http://', 'https://') || null;
    const gameLogo = rec.game_logo_url ? cdnUrl(rec.game_logo_url) : null;

    const html = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:400px;">
        <div style="font-size:12px; font-weight:900; color:#94a3b8; letter-spacing:0.14em; text-transform:uppercase;">⚔️ 라이벌전 추천</div>

        <div style="width:64px; height:64px; border-radius:16px; background:#fff; display:flex; align-items:center; justify-content:center; padding:8px;">
          ${gameLogo ? `<img src="${gameLogo}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span style="font-size:28px;">🎲</span>`}
        </div>
        <div style="font-size:20px; font-weight:900; color:#fff;">${escapeHtml(rec.game_name)}</div>

        <div style="display:flex; align-items:center; justify-content:center; gap:16px; margin-top:4px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
            ${avatarHtml(myAvatar, myName, 60)}
            <div style="font-size:13px; font-weight:800; color:#fff;">${escapeHtml(myName)}</div>
            <div style="font-size:11px; font-weight:700; color:#94a3b8;">${rec.my_record_count}판</div>
          </div>
          <div style="font-size:18px; font-weight:900; color:#64748b; font-style:italic;">VS</div>
          <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
            ${avatarHtml(rec.rival_profile_url, rec.rival_nickname, 60)}
            <div style="font-size:13px; font-weight:800; color:#fff;">${escapeHtml(rec.rival_nickname)}</div>
            <div style="font-size:11px; font-weight:700; color:#94a3b8;">${rec.rival_record_count}판</div>
          </div>
        </div>

        <p style="font-size:13px; font-weight:700; color:#cbd5e1; line-height:1.6; margin:4px 0 0;">
          ${escapeHtml(rec.rival_nickname)} 님과 라이벌전 한 번 해보실래요?<br>
          같은 게임을 즐기는 분과 라이벌전을 하면,<br>
          서로 응원하며 재밌게 승부를 겨룰 수 있어요!
        </p>

        <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
          <button id="boako-rival-recommend-reject" style="flex:1; background:rgba(255,255,255,0.08); color:#cbd5e1; font-weight:800; font-size:13px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); cursor:pointer;">
            다음에 할게요
          </button>
          <button id="boako-rival-recommend-accept" style="flex:1.4; background:#fff; color:#0f172a; font-weight:900; font-size:13px; padding:12px; border-radius:12px; border:none; cursor:pointer;">
            도전장 보내기
          </button>
        </div>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:1000000; display:flex; align-items:center; justify-content:center;
      background:rgba(15,23,42,0.75); backdrop-filter:blur(3px); opacity:0; transition:opacity .25s ease;
    `;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    };

    async function respondRivalRecommend(accept, rivalId, gameName) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_respond_rival_recommend`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ p_accept: accept, p_rival_id: rivalId || null, p_game_name: gameName || null })
      });
      if (!res.ok) throw new Error(await res.text());
    }

    document.getElementById('boako-rival-recommend-accept').addEventListener('click', async () => {
      const btn = document.getElementById('boako-rival-recommend-accept');
      btn.disabled = true;
      btn.innerText = '전송 중...';
      try {
        await respondRivalRecommend(true, rec.rival_id, rec.game_name);
        boakoSfx.success();
        showToast('system', '⚔️', '도전장 전송 완료', `${rec.rival_nickname}님에게 도전장을 보냈어요!`);
      } catch (e) {
        boakoErr('라이벌전 도전장 전송 실패:', e);
        showToast('system', '❌', '전송 실패', '잠시 후 다시 시도해주세요.');
      }
      dismiss();
    });

    document.getElementById('boako-rival-recommend-reject').addEventListener('click', async () => {
      try {
        await respondRivalRecommend(false);
      } catch (e) {
        boakoErr('라이벌전 추천 거절 처리 실패:', e);
      }
      dismiss();
      // 🌟 거절해도 흥미가 있을 수 있으니, 아카이브 라이벌전 메뉴로 유도 (확장에선 사이트 새 탭으로 열기)
      setTimeout(() => {
        showToast('system', '👀', '다른 라이벌전도 둘러보세요', '아카이브에서 다른 상대도 확인해보실 수 있어요.', () => {
          window.open('https://boakoarchive.co.kr/', '_blank');
        });
      }, 300);
    });
  }

  function showSocialActivationOverlay(targetType) {
    const isTeam = targetType === 'team';
    const badgeText = isTeam ? '🛡️ 팀 창단 제안' : '🏅 토너먼트 제안';
    const emoji = isTeam ? '🛡️' : '🏅';
    const title = isTeam ? '이제 팀을 만들어보실래요?' : '토너먼트도 한번 참가해보실래요?';
    const bodyText = isTeam
      ? '활발하게 활동하시네요!<br>팀을 만들어서 리그에 도전해보는 건 어떠세요?'
      : '라이벌전까지 즐기셨다면, 더 큰 무대인<br>토너먼트에서 다른 유저들과 실력을 겨뤄보세요!';
    const acceptLabel = isTeam ? '팀 만들러 가기' : '토너먼트 둘러보기';

    const html = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:400px;">
        <div style="font-size:12px; font-weight:900; color:#94a3b8; letter-spacing:0.14em; text-transform:uppercase;">${badgeText}</div>

        <div style="width:64px; height:64px; border-radius:16px; background:#fff; display:flex; align-items:center; justify-content:center;">
          <span style="font-size:30px;">${emoji}</span>
        </div>

        <div style="font-size:19px; font-weight:900; color:#fff; line-height:1.4;">${title}</div>

        <p style="font-size:13px; font-weight:700; color:#cbd5e1; line-height:1.6; margin:0;">
          ${bodyText}
        </p>

        <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
          <button id="boako-social-activation-accept" style="flex:1.4; background:#fff; color:#0f172a; font-weight:900; font-size:13px; padding:12px; border-radius:12px; border:none; cursor:pointer;">
            ${acceptLabel}
          </button>
          <button id="boako-social-activation-reject" style="flex:1; background:rgba(255,255,255,0.08); color:#cbd5e1; font-weight:800; font-size:13px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); cursor:pointer;">
            다음에 할게요
          </button>
        </div>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:1000000; display:flex; align-items:center; justify-content:center;
      background:rgba(15,23,42,0.75); backdrop-filter:blur(3px); opacity:0; transition:opacity .25s ease;
    `;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    };

    async function respondSocialActivation() {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_respond_social_activation`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ p_target_type: targetType })
      });
      if (!res.ok) throw new Error(await res.text());
    }

    // 🌟 수락 = 30일 쿨다운 기록 후, 확장에선 SPA 이동이 불가능하니 아카이브 사이트를 새 탭으로 열어줌
    // (사이트 쪽 social_activation.js는 같은 화면 안에서 render()로 바로 이동하지만, 확장은 별도 탭 오픈으로 대체)
    document.getElementById('boako-social-activation-accept').addEventListener('click', async () => {
      try {
        await respondSocialActivation();
      } catch (e) {
        boakoErr('개인 소셜형 활성화 응답 처리 실패:', e);
      }
      dismiss();
      window.open('https://boakoarchive.co.kr/', '_blank');
    });

    document.getElementById('boako-social-activation-reject').addEventListener('click', async () => {
      try {
        await respondSocialActivation();
      } catch (e) {
        boakoErr('개인 소셜형 활성화 응답 처리 실패:', e);
      }
      dismiss();
    });
  }

  function showExtHelpOverlay() {
    const html = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:380px;">
        <div style="font-size:40px;">🤔</div>
        <div style="font-size:19px; font-weight:900; color:#fff;">확장 사용에 어려움이 있으신가요?</div>
        <p style="font-size:13px; font-weight:700; color:#cbd5e1; line-height:1.6; margin:0;">
          기록기를 며칠째 사용 중이신데, 아직 저장된 게임 기록이 안 보이는 것 같아요.<br>
          혹시 어려운 부분이 있으시면 알려주세요!
        </p>
        <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
          <button id="boako-ext-help-reject" style="flex:1; background:rgba(255,255,255,0.08); color:#cbd5e1; font-weight:800; font-size:13px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); cursor:pointer;">
            괜찮아요
          </button>
          <button id="boako-ext-help-accept" style="flex:1.4; background:#fff; color:#0f172a; font-weight:900; font-size:13px; padding:12px; border-radius:12px; border:none; cursor:pointer;">
            네, 도움이 필요해요
          </button>
        </div>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:1000000; display:flex; align-items:center; justify-content:center;
      background:rgba(15,23,42,0.75); backdrop-filter:blur(3px); opacity:0; transition:opacity .25s ease;
    `;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    };

    async function respondExtHelp(accept) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_respond_ext_help`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ p_accept: accept })
      });
      if (!res.ok) throw new Error(await res.text());
    }

    document.getElementById('boako-ext-help-accept').addEventListener('click', async () => {
      try {
        await respondExtHelp(true);
      } catch (e) {
        boakoErr('확장 도움 요청 응답 처리 실패:', e);
      }
      dismiss();
      // 🌟 소장님이 눈으로 확인할 수 있게, 요청 게시판으로 바로 이동 (사이트 새 탭에서 카테고리 자동 선택)
      window.open(`https://boakoarchive.co.kr/?open=BOARD_CATEGORY&id=${encodeURIComponent('요청')}`, '_blank');
    });

    document.getElementById('boako-ext-help-reject').addEventListener('click', async () => {
      try {
        await respondExtHelp(false);
      } catch (e) {
        boakoErr('확장 도움 요청 응답 처리 실패:', e);
      }
      dismiss();
    });
  }

  // ========================================================================
  // 🌟 [신규] 시즌 스플래시 — 사이트 js/season_splash.js와 완전히 동일한 디자인/애니메이션/사운드를
  // 확장에서도 재현. 팀 소속자 전용, 하루 1회(profiles.tutorial_status.season_splash_last_shown — 사이트와
  // 같은 필드를 공유하므로 사이트에서 이미 봤으면 확장에서 또 안 뜨고, 그 반대도 마찬가지).
  // enqueueFullscreenOverlay 큐에 태워서 업적/라이벌결과/추천보너스/④⑤⑥⑦활성화 오버레이와 자동으로 안 겹침.
  // ========================================================================
  function _todayStrKST() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  }

  async function checkSeasonSplash() {
    if (!State.teamId) return; // 🌟 팀 소속자 전용 — 무소속은 확장에서 노출 안 함
    try {
      const today = _todayStrKST();
      const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${State.session.user.id}&select=tutorial_status`, { headers: authHeaders() });
      const [profile] = await profRes.json();
      const status = profile?.tutorial_status || {};
      if (status.season_splash_last_shown === today) return; // 오늘 이미 봄(사이트든 확장이든)

      enqueueFullscreenOverlay(async () => {
        const built = await buildSeasonSplashOverlay();
        if (!built) return {}; // 보여줄 시즌/우승팀 데이터가 없으면 큐만 소비하고 아무것도 안 띄움(하루 소진 처리 안 함)
        return built; // 하루 소진 기록은 buildSeasonSplashOverlay 내부에서 이미 처리함
      });
    } catch (e) {
      boakoErr('시즌 스플래시 확인 실패:', e);
    }
  }

  async function buildSeasonSplashOverlay() {
    let season = null, champion = null;
    try {
      const nowIso = new Date().toISOString();

      const liveRes = await fetch(`${SUPABASE_URL}/rest/v1/seasons?select=season_no,title,start_date,end_date,season_logo_url&start_date=lte.${nowIso}&end_date=gte.${nowIso}&limit=1`, { headers: authHeaders() });
      const liveSeasons = await liveRes.json();
      season = liveSeasons?.[0];

      if (!season) {
        const pastRes = await fetch(`${SUPABASE_URL}/rest/v1/seasons?select=season_no,title,start_date,end_date,season_logo_url&end_date=lt.${nowIso}&order=end_date.desc&limit=1`, { headers: authHeaders() });
        const pastSeasons = await pastRes.json();
        season = pastSeasons?.[0];
        if (!season) return null;

        const finalRes = await fetch(`${SUPABASE_URL}/rest/v1/season_final_rankings?select=team_name,logo_url&season_no=eq.${season.season_no}&final_rank=eq.1&limit=1`, { headers: authHeaders() });
        const finals = await finalRes.json();
        champion = finals?.[0] || null;
        if (!champion) return null;
      }
    } catch (e) {
      boakoErr('시즌 스플래시 데이터 조회 실패:', e);
      return null;
    }

    const logoUrl = champion ? champion.logo_url : season.season_logo_url;
    if (!logoUrl) return null;

    ensureSeasonSplashStyle();

    const fmtDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
    };

    let eyebrowClass, eyebrowText, titleHtml, subText, badgeText;
    if (champion) {
      eyebrowClass = 'champion';
      eyebrowText = '🏆 시즌 종료';
      titleHtml = `${escapeHtml(champion.team_name)}<br><span style="font-size:16px; color:#fde68a; font-weight:700;">시즌 ${season.season_no} 우승팀</span>`;
      subText = '치열했던 이번 시즌, 축하드려요!';
      badgeText = '🎉 최종 우승';
    } else {
      eyebrowClass = 'ongoing';
      eyebrowText = '🌀 이번 시즌';
      titleHtml = escapeHtml(season.title) || `시즌 ${season.season_no} 진행 중`;
      subText = '지금 리그가 한창이에요';
      badgeText = `📅 ${fmtDate(season.start_date)} ~ ${fmtDate(season.end_date)}`;
    }

    const html = `
      <div class="ss-wipe-panel ss-left"></div>
      <div class="ss-wipe-panel ss-right"></div>
      <div class="ss-impact-flash" id="ss-impact-flash"></div>
      <div class="ss-card">
        <div class="ss-logo-stage">
          <div class="ss-logo-fly" id="ss-logo-fly"><img src="${cdnUrl(logoUrl)}" alt="시즌 로고"></div>
        </div>
        <div class="ss-eyebrow ${eyebrowClass}">${eyebrowText}</div>
        <div class="ss-title">${titleHtml}</div>
        <div class="ss-sub">${subText}</div>
        <div class="ss-badge">${badgeText}</div>
        <button class="ss-confirm" data-boako-dismiss>확인</button>
      </div>
    `;

    setTimeout(() => {
      const flash = document.getElementById('ss-impact-flash');
      if (flash) flash.style.animation = 'ss-impact-flash-anim 0.5s ease 1.06s both';
      playSeasonSplashWhoosh(1.15);
      playSeasonSplashImpact(1.06);
    }, 0);

    // 🌟 실제 표시 직전에 하루 소진 기록 (여기서 실패해도 오버레이 자체는 뜸 — 다음날 다시 볼 수 있는 정도의 손해)
    try {
      const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${State.session.user.id}&select=tutorial_status`, { headers: authHeaders() });
      const [freshProfile] = await profRes.json();
      const newStatus = { ...(freshProfile?.tutorial_status || {}), season_splash_last_shown: _todayStrKST() };
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${State.session.user.id}`, {
        method: 'PATCH', headers: { ...authHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ tutorial_status: newStatus })
      });
    } catch (e) {
      boakoErr('시즌 스플래시 확인 상태 저장 실패:', e);
    }

    return { html, dismissOnBackdrop: false };
  }

  function ensureSeasonSplashStyle() {
    if (document.getElementById('boako-season-splash-style')) return;
    const style = document.createElement('style');
    style.id = 'boako-season-splash-style';
    style.textContent = `
      .ss-wipe-panel { position: absolute; top: 0; bottom: 0; width: 60%; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); z-index: 3; }
      .ss-wipe-panel.ss-left { left: 0; clip-path: polygon(0 0, 100% 0, 78% 100%, 0% 100%); animation: ss-wipe-in-left 0.5s cubic-bezier(.76,0,.24,1) forwards, ss-wipe-out-left 0.4s cubic-bezier(.76,0,.24,1) 0.85s forwards; }
      .ss-wipe-panel.ss-right { right: 0; clip-path: polygon(22% 0, 100% 0, 100% 100%, 0% 100%); animation: ss-wipe-in-right 0.5s cubic-bezier(.76,0,.24,1) forwards, ss-wipe-out-right 0.4s cubic-bezier(.76,0,.24,1) 0.85s forwards; }
      @keyframes ss-wipe-in-left  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      @keyframes ss-wipe-out-left { to   { transform: translateX(-100%); } }
      @keyframes ss-wipe-in-right  { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes ss-wipe-out-right { to   { transform: translateX(100%); } }
      .ss-wipe-panel.ss-left::after, .ss-wipe-panel.ss-right::after { content: ''; position: absolute; top: 0; bottom: 0; width: 6px; }
      .ss-wipe-panel.ss-left::after { right: -3px; background: #fbbf24; transform: skewX(-12deg); }
      .ss-wipe-panel.ss-right::after { left: -3px; background: #fbbf24; transform: skewX(-12deg); }

      .ss-impact-flash {
        position: absolute; left: calc(50% - 20px); top: 110px; width: 40px; height: 40px; border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%);
        opacity: 0; z-index: 5; pointer-events: none;
      }
      @keyframes ss-impact-flash-anim {
        0%   { transform: scale(0.2); opacity: 0; }
        12%  { transform: scale(7); opacity: 1; }
        45%  { transform: scale(11); opacity: 0; }
        100% { transform: scale(11); opacity: 0; }
      }

      .ss-card { position: relative; z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: 28px; max-width: 420px; }

      .ss-logo-stage { position: relative; width: 214px; height: 100px; }
      .ss-logo-fly { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; animation: ss-fly-curve-in 1.15s linear both; }
      .ss-logo-fly img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 0 24px rgba(99,102,241,.55)); }

      @keyframes ss-fly-curve-in {
            0.0%  { transform: translate(434px, -230px) scale(0.140, 0.140); opacity: 0; }
        2.6%  { transform: translate(404px, -218px) scale(0.143, 0.162); opacity: 1; }
        5.1%  { transform: translate(373px, -207px) scale(0.105, 0.184); }
        7.7%  { transform: translate(342px, -196px) scale(0.025, 0.206); }
        10.3%  { transform: translate(311px, -186px) scale(-0.083, 0.228); }
        12.8%  { transform: translate(280px, -177px) scale(-0.186, 0.250); }
        15.4%  { transform: translate(249px, -167px) scale(-0.264, 0.272); }
        17.9%  { transform: translate(218px, -159px) scale(-0.286, 0.294); }
        20.5%  { transform: translate(186px, -150px) scale(-0.237, 0.316); }
        23.1%  { transform: translate(154px, -142px) scale(-0.118, 0.338); }
        25.6%  { transform: translate(123px, -134px) scale(0.041, 0.361); }
        28.2%  { transform: translate(91px, -125px) scale(0.217, 0.383); }
        30.8%  { transform: translate(59px, -118px) scale(0.360, 0.405); }
        33.3%  { transform: translate(28px, -109px) scale(0.427, 0.427); }
        35.9%  { transform: translate(-4px, -100px) scale(0.397, 0.449); }
        38.5%  { transform: translate(-35px, -91px) scale(0.265, 0.471); }
        41.0%  { transform: translate(-66px, -82px) scale(0.062, 0.493); }
        43.6%  { transform: translate(-98px, -73px) scale(-0.184, 0.515); }
        46.2%  { transform: translate(-129px, -64px) scale(-0.405, 0.537); }
        48.7%  { transform: translate(-160px, -54px) scale(-0.542, 0.559); }
        51.3%  { transform: translate(-191px, -43px) scale(-0.564, 0.581); }
        53.8%  { transform: translate(-222px, -32px) scale(-0.455, 0.603); }
        56.4%  { transform: translate(-252px, -19px) scale(-0.223, 0.625); }
        59.0%  { transform: translate(-282px, -6px) scale(0.081, 0.647); }
        61.5%  { transform: translate(-312px, 7px) scale(0.376, 0.669); }
        64.1%  { transform: translate(-341px, 22px) scale(0.612, 0.691); }
        66.7%  { transform: translate(-369px, 38px) scale(0.713, 0.713); }
        69.2%  { transform: translate(-388px, 62px) scale(0.653, 0.735); }
        71.8%  { transform: translate(-366px, 82px) scale(0.511, 0.900); }
        74.4%  { transform: translate(-334px, 88px) scale(0.152, 1.350); }
        76.9%  { transform: translate(-301px, 89px) scale(-0.701, 2.000); }
        79.5%  { transform: translate(-268px, 88px) scale(-1.313, 1.750); }
        82.1%  { transform: translate(-236px, 85px) scale(-1.460, 1.500); }
        84.6%  { transform: translate(-204px, 80px) scale(-1.283, 1.320); }
        87.2%  { transform: translate(-171px, 74px) scale(-0.880, 1.180); }
        89.7%  { transform: translate(-140px, 66px) scale(-0.399, 1.100); }
        92.3%  { transform: translate(-108px, 57px) scale(0.124, 1.040); }
        94.9%  { transform: translate(-77px, 48px) scale(0.584, 1.020); }
        97.4%  { transform: translate(-47px, 36px) scale(0.882, 1.000); }
        100.0%  { transform: translate(0px, 0px) scale(1.000, 1.000); }
      }

      .ss-eyebrow { font-size: 12px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; margin-top: 4px; }
      .ss-eyebrow.ongoing { color: #93c5fd; }
      .ss-eyebrow.champion { color: #fbbf24; }

      .ss-title { font-size: 25px; font-weight: 900; color: #fff; line-height: 1.35; clip-path: inset(0 100% 0 0); animation: ss-text-wipe 0.32s ease 1.06s forwards; }
      .ss-sub { font-size: 12.5px; font-weight: 700; color: #cbd5e1; margin: -6px 0 0; clip-path: inset(0 100% 0 0); animation: ss-text-wipe 0.32s ease 1.16s forwards; }
      @keyframes ss-text-wipe { to { clip-path: inset(0 0 0 0); } }

      .ss-badge { font-size: 15px; font-weight: 900; color: #fff; background: rgba(0,0,0,0.3); padding: 7px 20px; border-radius: 999px; opacity: 0; transform: translateY(6px); animation: ss-badge-pop 0.3s ease 1.28s forwards; }
      @keyframes ss-badge-pop { to { opacity: 1; transform: translateY(0); } }

      .ss-confirm { width: 100%; background: #fff; color: #0f172a; font-weight: 900; font-size: 14px; padding: 12px; border-radius: 12px; border: none; cursor: pointer; margin-top: 6px; opacity: 0; animation: ss-badge-pop 0.3s ease 1.38s forwards; }
    `;
    document.head.appendChild(style);
  }

  // 🌟 사이트 season_splash.js의 Web Audio 합성 사운드 그대로 이식 (외부 음원 파일 없음)
  let _seasonSplashAudioCtx = null;
  function _getSeasonSplashAudioCtx() {
    if (!_seasonSplashAudioCtx) {
      _seasonSplashAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_seasonSplashAudioCtx.state === 'suspended') _seasonSplashAudioCtx.resume();
    return _seasonSplashAudioCtx;
  }

  function playSeasonSplashWhoosh(duration) {
    try {
      const ctx = _getSeasonSplashAudioCtx();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(2600, ctx.currentTime + duration * 0.5);
      filter.frequency.linearRampToValueAtTime(900, ctx.currentTime + duration * 0.92);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + duration * 0.15);
      gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + duration * 0.7);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration * 0.95);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + duration);
    } catch (e) { /* 조용히 무시 */ }
  }

  function _seasonSplashTone(freq, dur, type, startGain, delay) {
    const ctx = _getSeasonSplashAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + (delay || 0));
    gain.gain.setValueAtTime(startGain, ctx.currentTime + (delay || 0));
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (delay || 0) + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + (delay || 0));
    osc.stop(ctx.currentTime + (delay || 0) + dur);
  }

  function playSeasonSplashImpact(delaySec) {
    try {
      const t = _seasonSplashTone;
      t(70, 0.35, 'triangle', 0.35, delaySec);
      t(140, 0.28, 'sawtooth', 0.2, delaySec);
      t(523.25, 0.5, 'triangle', 0.22, delaySec + 0.03);
      t(659.25, 0.5, 'triangle', 0.2, delaySec + 0.03);
      t(783.99, 0.5, 'triangle', 0.2, delaySec + 0.03);
      t(1046.5, 0.6, 'sine', 0.14, delaySec + 0.05);
    } catch (e) { /* 조용히 무시 */ }
  }

  // ========================================================================
  // UI 렌더링
  // ========================================================================
  function ensureStyles() {
    if (document.getElementById('boako-widget-style')) return;
    const style = document.createElement('style');
    style.id = 'boako-widget-style';
    style.textContent = `
      #boako-widget-icon { position: fixed !important; left: 20px; top: calc(100vh - 72px); width: 52px; height: 52px; border-radius: 50%;
        background: #4f46e5; box-shadow: 0 4px 14px rgba(79,70,229,.4); cursor: grab; display:flex; align-items:center;
        justify-content:center; font-size: 24px; z-index: 999000; user-select:none; }
      #boako-widget-icon.boako-dragging { cursor: grabbing; box-shadow: 0 8px 22px rgba(0,0,0,.35); }
      #boako-widget-icon.boako-logged-out { background:#64748b; box-shadow:0 4px 14px rgba(100,116,139,.35); }
      #boako-widget-badge { position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:11px;
        font-weight:900; min-width:20px; height:20px; border-radius:999px; display:flex; align-items:center; justify-content:center;
        border:2px solid #eef0f3; padding:0 4px; }
      #boako-widget-badge.hidden { display:none; }
      #boako-widget-panel { position:fixed; width:340px; max-height:480px; background:#fff;
        border-radius:14px; box-shadow:0 12px 34px rgba(0,0,0,.22); z-index:999001; display:none; flex-direction:column;
        overflow:hidden; border:1px solid #e2e8f0; font-family:-apple-system,"Malgun Gothic",sans-serif; }
      #boako-widget-panel.open { display:flex; }
      .boako-panel-header { background:#0f172a; color:#fff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; }
      .boako-panel-header .boako-title { font-size:13px; font-weight:800; }
      .boako-panel-header .boako-close { cursor:pointer; opacity:.7; font-size:16px; }
      .boako-panel-tabs { display:flex; border-bottom:1px solid #e2e8f0; }
      .boako-panel-tab { flex:1; text-align:center; padding:10px; font-size:12px; font-weight:800; color:#64748b; cursor:pointer; }
      .boako-panel-tab.active { color:#4f46e5; border-bottom:2px solid #4f46e5; }
      .boako-panel-body { flex:1; overflow-y:auto; padding:10px 12px; background:#f1f5f9; }
      .boako-msg-item { background:#fff; border-radius:10px; padding:10px 12px; margin-bottom:8px; box-shadow:0 1px 2px rgba(0,0,0,.04); cursor:pointer; }
      .boako-msg-item .boako-sender { font-size:12px; font-weight:800; color:#0f172a; margin-bottom:2px; }
      .boako-msg-item .boako-preview { font-size:12px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .boako-panel-footer { padding:10px 12px; border-top:1px solid #e2e8f0; background:#fff; }
      .boako-reply-row { display:flex; gap:6px; }
      .boako-reply-row input { flex:1; border:1px solid #e2e8f0; border-radius:20px; padding:9px 14px; font-size:12.5px; outline:none; }
      .boako-reply-row button { background:#4f46e5; color:#fff; border:none; border-radius:20px; padding:0 16px; font-size:12px; font-weight:800; cursor:pointer; }
      .boako-thread-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
      .boako-thread-header .boako-back { cursor:pointer; font-size:16px; color:#64748b; }
      .boako-login-required { text-align:center; padding:40px 20px; }
      .boako-login-required .boako-icon { font-size:34px; margin-bottom:10px; }
      .boako-login-required button { background:#4f46e5; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:800; font-size:13px; cursor:pointer; }
      .boako-settings-row { display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px 12px; border-radius:8px; margin-bottom:6px; }
      #boako-toast-stack { position:fixed; top:16px; right:16px; z-index:999999; display:flex; flex-direction:column; gap:8px; width:300px; }
      .boako-toast { background:#1e293b; color:#fff; border-radius:10px; padding:12px 14px; box-shadow:0 8px 24px rgba(0,0,0,.3);
        display:flex; gap:10px; align-items:flex-start; opacity:0; transform:translateX(20px); transition:all .25s ease; }
      .boako-toast.show { opacity:1; transform:translateX(0); }
      .boako-toast-icon { font-size:20px; flex-shrink:0; }
      .boako-toast-title { font-size:12px; font-weight:900; margin-bottom:2px; }
      .boako-toast-body { font-size:11.5px; color:#cbd5e1; }
    `;
    document.head.appendChild(style);
  }

  function ensureToastStack() {
    if (!document.getElementById('boako-toast-stack')) {
      const stack = document.createElement('div');
      stack.id = 'boako-toast-stack';
      document.body.appendChild(stack);
    }
  }

  function ensureDom() {
    if (document.getElementById('boako-widget-icon')) return;
    ensureStyles();
    ensureToastStack();

    const icon = document.createElement('div');
    icon.id = 'boako-widget-icon';
    icon.innerHTML = `📬<div id="boako-widget-badge" class="hidden">0</div>`;
    document.body.appendChild(icon);

    // 🌟 저장된 위치가 있으면 복원 (없으면 기본값: 좌측 하단)
    const savedPos = localStorage.getItem('boako_widget_position');
    if (savedPos) {
      try {
        const { left, top } = JSON.parse(savedPos);
        icon.style.left = clampToViewport(left, icon.offsetWidth, window.innerWidth) + 'px';
        icon.style.top = clampToViewport(top, icon.offsetHeight, window.innerHeight) + 'px';
      } catch (e) { /* 저장된 값이 이상하면 기본 위치(CSS) 그대로 둠 */ }
    }

    makeIconDraggable(icon);

    // 🌟 [수정] 게임 페이지 등에서 가끔 아이콘이 화면 아래로 밀려나 보이는 현상에 대한 방어 로직.
    // 처음엔 "3초마다 무한 반복"으로 만들었는데, 탭을 여러 개 띄워두는 BGA 특성상 탭 하나당 타이머가
    // 영원히 도는 건 낭비라서 — 드리프트는 보통 페이지 초기 렌더링/스케일링이 끝나는 시점에 생길 걸로
    // 추정되니, 로드 직후 몇 번(1초/3초/6초/10초)만 확인하고 그 뒤로는 완전히 멈추게 변경.
    // resize 이벤트는 원래도 그 순간에만 실행되는 가벼운 방식이라 그대로 유지.
    window.addEventListener('resize', () => reclampIconPosition(icon));
    [1000, 3000, 6000, 10000].forEach(delay => setTimeout(() => reclampIconPosition(icon), delay));

    const panel = document.createElement('div');
    panel.id = 'boako-widget-panel';
    panel.innerHTML = `
      <div class="boako-panel-header">
        <span class="boako-title" id="boako-panel-title">BOAKO 쪽지함</span>
        <span class="boako-close">✕</span>
      </div>
      <div class="boako-panel-tabs">
        <div class="boako-panel-tab active" data-tab="messages">📬 쪽지함</div>
        <div class="boako-panel-tab" data-tab="teamchat">💬 팀챗</div>
        <div class="boako-panel-tab" data-tab="settings">⚙️ 설정</div>
      </div>
      <div class="boako-panel-body" id="boako-panel-body"></div>
      <div class="boako-panel-footer" id="boako-panel-footer"></div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.boako-close').addEventListener('click', () => closePanel());
    panel.querySelectorAll('.boako-panel-tab').forEach(tabEl => {
      tabEl.addEventListener('click', () => showTab(tabEl.dataset.tab));
    });

    // 🌟 [신규] 일정제안/도전장/팀가입/스카웃 "액션 카드" 버튼 클릭 위임 — #boako-panel-body는
    // innerHTML만 매 렌더마다 바뀌고 이 div 자체는 재사용되므로, 여기서 딱 한 번만 바인딩하면
    // 이후 렌더링되는 모든 액션 카드 버튼(동적으로 생김)에 대해 계속 작동함.
    document.getElementById('boako-panel-body').addEventListener('click', handleThreadActionClick);
  }

  function clampToViewport(value, size, viewportSize) {
    return Math.max(4, Math.min(value, viewportSize - size - 4));
  }

  // 🌟 [신규] 아이콘이 화면 범위를 벗어나 있으면(드래그 중이 아닐 때) 강제로 다시 안쪽으로 당겨옴
  function reclampIconPosition(icon) {
    if (icon.classList.contains('boako-dragging')) return; // 드래그 중엔 건드리지 않음
    const rect = icon.getBoundingClientRect();
    const clampedLeft = clampToViewport(rect.left, rect.width || 52, window.innerWidth);
    const clampedTop = clampToViewport(rect.top, rect.height || 52, window.innerHeight);
    if (Math.abs(clampedLeft - rect.left) > 1 || Math.abs(clampedTop - rect.top) > 1) {
      boakoWarn('아이콘이 화면 범위를 벗어나 있어 위치를 다시 보정했어요.', { before: { left: rect.left, top: rect.top }, after: { left: clampedLeft, top: clampedTop } });
      icon.style.left = clampedLeft + 'px';
      icon.style.top = clampedTop + 'px';
    }
  }

  // 🌟 [신규] 아이콘 드래그 이동 — content.js의 사이드바 드래그(makeDraggable)와 같은 패턴:
  // 5px 이상 움직여야 "드래그"로 인식하고, 그 미만이면 그냥 클릭(패널 토글)으로 처리함.
  function makeIconDraggable(icon) {
    let startX, startY, startLeft, startTop, isDragging = false, isDragReady = false;

    function onMouseMove(e) {
      if (!isDragReady) return;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (!isDragging && dist > 5) {
        isDragging = true;
        icon.classList.add('boako-dragging');
      }
      if (isDragging) {
        const newLeft = clampToViewport(startLeft + (e.clientX - startX), icon.offsetWidth, window.innerWidth);
        const newTop = clampToViewport(startTop + (e.clientY - startY), icon.offsetHeight, window.innerHeight);
        icon.style.left = newLeft + 'px';
        icon.style.top = newTop + 'px';
        if (State.panelOpen) positionPanelNearIcon();
      }
    }

    function onMouseUp() {
      isDragReady = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (isDragging) {
        isDragging = false;
        icon.classList.remove('boako-dragging');
        const rect = icon.getBoundingClientRect();
        localStorage.setItem('boako_widget_position', JSON.stringify({ left: rect.left, top: rect.top }));
        boakoLog('아이콘 위치 저장됨:', { left: Math.round(rect.left), top: Math.round(rect.top) });
      } else {
        // 드래그가 아니라 그냥 클릭이었던 경우
        togglePanel();
      }
    }

    icon.addEventListener('mousedown', (e) => {
      isDragReady = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = icon.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });
  }

  // 🌟 [신규] 패널을 아이콘 바로 옆(가능하면 위쪽)에 붙여서 표시. 아이콘이 화면 어디로 옮겨져도
  // 항상 패널이 화면 밖으로 안 나가게 위/아래·좌/우를 자동으로 뒤집어줌.
  function positionPanelNearIcon() {
    const icon = document.getElementById('boako-widget-icon');
    const panel = document.getElementById('boako-widget-panel');
    if (!icon || !panel) return;

    const iconRect = icon.getBoundingClientRect();
    const panelW = 340, panelH = Math.min(480, panel.scrollHeight || 480);
    const gap = 8;

    // 세로: 아이콘 위 공간이 충분하면 위쪽에, 아니면 아래쪽에
    const spaceAbove = iconRect.top;
    const openUpward = spaceAbove >= panelH + gap;
    const top = openUpward ? iconRect.top - panelH - gap : iconRect.bottom + gap;

    // 가로: 아이콘 좌측 기준으로 두되, 화면 밖으로 나가면 우측 정렬로 전환
    let left = iconRect.left;
    if (left + panelW > window.innerWidth - 4) left = window.innerWidth - panelW - 4;
    if (left < 4) left = 4;

    panel.style.left = left + 'px';
    panel.style.top = clampToViewport(top, panelH, window.innerHeight) + 'px';
  }

  function openPanel() { State.panelOpen = true; render(); }
  function closePanel() { State.panelOpen = false; render(); }
  function togglePanel() {
    if (!State.session) { doLogin(); return; }
    State.panelOpen = !State.panelOpen;
    render();
  }
  function showTab(tab) {
    if (!State.session) { doLogin(); return; }
    State.activeTab = tab;
    State.activeConversation = null;
    State.panelOpen = true;
    render();
  }

  function renderBadge() {
    const badge = document.getElementById('boako-widget-badge');
    const icon = document.getElementById('boako-widget-icon');
    if (!badge || !icon) return;
    icon.classList.toggle('boako-logged-out', !State.session);
    if (State.unread > 0) {
      badge.textContent = State.unread > 99 ? '99+' : String(State.unread);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function render() {
    ensureDom();
    renderBadge();

    const panel = document.getElementById('boako-widget-panel');
    panel.classList.toggle('open', State.panelOpen);
    if (State.panelOpen) positionPanelNearIcon();
    panel.querySelectorAll('.boako-panel-tab').forEach(tabEl => {
      tabEl.classList.toggle('active', tabEl.dataset.tab === State.activeTab);
    });

    renderBody();
    renderFooter();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str || '';
    return div.innerHTML;
  }

  function renderBody() {
    const body = document.getElementById('boako-panel-body');
    const title = document.getElementById('boako-panel-title');
    if (!body) return;

    if (!State.session) {
      title.textContent = 'BOAKO 쪽지함';
      body.innerHTML = `
        <div class="boako-login-required">
          <div class="boako-icon">🔒</div>
          <p style="font-size:12px;color:#64748b;font-weight:700;line-height:1.6;margin:0 0 16px;">로그인하면 쪽지함과 팀챗을<br>바로 확인할 수 있어요.</p>
          <button id="boako-login-btn">🟡 카카오 계정으로 로그인</button>
        </div>
      `;
      document.getElementById('boako-login-btn').addEventListener('click', doLogin);
      return;
    }

    if (State.activeTab === 'messages') {
      title.textContent = 'BOAKO 쪽지함';
      if (State.activeConversation) {
        body.innerHTML = renderThread(State.activeConversation);
        const loadMoreBtn = document.getElementById('boako-load-more-thread');
        if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMoreThread);
        // 렌더 직후 맨 아래(최신 메시지)로 스크롤 (더 불러오기 시엔 openConversation/loadMoreThread 쪽에서 별도 보정함)
        body.scrollTop = body.scrollHeight;
        return;
      }
      if (State.messages.length === 0) {
        body.innerHTML = `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:12px;font-weight:700;">받은 쪽지가 없어요</div>`;
        return;
      }
      body.innerHTML = State.messages.map((m, i) => `
        <div class="boako-msg-item" data-idx="${i}" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="min-width:0;">
            <div class="boako-sender">${escapeHtml(m.otherName || '알 수 없음')}</div>
            <div class="boako-preview">${escapeHtml(m.lastMessage)}</div>
          </div>
          ${m.unread > 0 ? `<span style="flex-shrink:0; background:#ef4444; color:#fff; font-size:10.5px; font-weight:900; min-width:18px; height:18px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 4px;">${m.unread > 99 ? '99+' : m.unread}</span>` : ''}
        </div>
      `).join('');
      body.querySelectorAll('.boako-msg-item').forEach(el => {
        el.addEventListener('click', () => {
          const m = State.messages[Number(el.dataset.idx)];
          openConversation(m.otherId, m.otherName);
        });
      });
    } else if (State.activeTab === 'teamchat') {
      title.textContent = '팀 작전 회의실';
      if (!State.teamId) {
        body.innerHTML = `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:12px;font-weight:700;">소속된 팀이 없어요</div>`;
        return;
      }
      body.innerHTML = State.teamChats.map(m => `
        <div class="boako-msg-item">
          <div class="boako-sender">${escapeHtml(m.sender_id === State.session.user.id ? '나' : '팀원')}</div>
          <div class="boako-preview">${escapeHtml(m.content)}</div>
        </div>
      `).join('') || `<div style="text-align:center;padding:30px;color:#94a3b8;font-size:12px;font-weight:700;">아직 팀챗 메시지가 없어요</div>`;
    } else if (State.activeTab === 'settings') {
      title.textContent = '알림 설정';
      body.innerHTML = renderSettings();
      bindSettingsEvents();
    }
  }

  // 🌟 [버그수정] 예전엔 실제 메시지 없이 고정 안내 문구만 보여주던 걸, 실제 대화 내역을
  // 말풍선(내 메시지는 우측/보라, 상대 메시지는 좌측/흰색)으로 그리도록 수정.
  // 🌟 [버그수정] 사이트 messenger.js엔 "액션 카드"(일정제안/도전장/팀가입/스카웃) 메시지가
  // 버튼이 달린 특수 카드로 렌더링되는데, 확장의 간이 쪽지함은 이걸 몰라서 그냥 텍스트로만
  // 보여주고 있었음 — 그래서 "확장 대화창에서 클릭해야 하는 것들이 반응을 못 하는" 문제가 있었음.
  // action_type별로 사이트와 동일한 카드+버튼을 그리고, 클릭은 handleThreadActionClick()이 위임 처리.
  function renderThread(conv) {
    const myId = String(State.session.user.id);
    const bubbles = State.threadMessages.map(m => {
      const isMe = m.sender_id === State.session.user.id;
      const time = new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

      if (m.action_type === 'SCHEDULE_PROPOSE') return renderScheduleCard(m, isMe, time);
      if (m.action_type === 'CHALLENGE_CARD') return renderChallengeCard(m, isMe, time);
      if (m.action_type === 'TEAM_JOIN' || m.action_type === 'TEAM_INVITE') return renderTeamActionCard(m, isMe, time);

      return `
        <div style="display:flex; margin-bottom:8px; ${isMe ? 'justify-content:flex-end;' : 'justify-content:flex-start;'}">
          <div>
            <div style="max-width:220px; padding:8px 12px; border-radius:14px; font-size:12.5px; line-height:1.4;
              ${isMe ? 'background:#4f46e5; color:#fff; border-bottom-right-radius:4px;' : 'background:#fff; color:#0f172a; border-bottom-left-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,.05);'}">
              ${escapeHtml(m.content)}
            </div>
            <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0; text-align:${isMe ? 'right' : 'left'};">${time}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="boako-thread-header">
        <span class="boako-back" id="boako-thread-back">←</span>
        <span style="font-size:13px;font-weight:900;">${escapeHtml(conv.otherName || '대화')}</span>
      </div>
      ${State.threadHasMore ? `<div style="text-align:center; margin-bottom:10px;"><button id="boako-load-more-thread" style="background:#e2e8f0; color:#475569; border:none; border-radius:999px; padding:6px 14px; font-size:11px; font-weight:800; cursor:pointer;">↑ 이전 대화 더 보기</button></div>` : ''}
      ${bubbles || `<div style="font-size:11px;color:#94a3b8;text-align:center;padding:16px 0;">불러오는 중...</div>`}
    `;
  }

  // 🌟 [신규] 일정 제안 카드 — metadata.proposed_times(후보 시각 배열), action_status로 상태 판단.
  function renderScheduleCard(m, isMe, time) {
    const times = Array.isArray(m.metadata?.proposed_times) ? m.metadata.proposed_times : [];
    const status = m.action_status || 'PENDING';
    const fmt = (iso) => new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    let bodyHtml = '', statusBadge = '';
    if (status === 'PENDING') {
      if (!isMe) {
        const optionButtons = times.map(t => `
          <button class="boako-thread-action-btn" data-action="schedule-accept" data-msg-id="${m.message_id}" data-time="${escapeHtml(t)}"
            style="width:100%; text-align:left; background:#fff; border:1px solid #c7d2fe; color:#334155; font-size:11.5px; font-weight:800; padding:8px 10px; border-radius:8px; margin-bottom:5px; cursor:pointer;">
            🟢 ${fmt(t)}
          </button>
        `).join('');
        bodyHtml = `
          <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-bottom:6px;">아래 후보 중 하나를 선택하면 바로 확정돼요.</div>
          ${optionButtons}
          <button class="boako-thread-action-btn" data-action="schedule-reject" data-msg-id="${m.message_id}"
            style="width:100%; background:#f1f5f9; color:#64748b; font-size:11px; font-weight:800; padding:7px; border:none; border-radius:8px; margin-top:2px; cursor:pointer;">
            ❌ 전부 거절
          </button>
        `;
      } else {
        bodyHtml = times.map(t => `<div style="font-size:12px; font-weight:800; color:#334155; background:#fff; padding:6px; border-radius:8px; border:1px solid #e0e7ff; text-align:center; margin-bottom:5px;">${fmt(t)}</div>`).join('');
        statusBadge = `<div style="font-size:10.5px; color:#94a3b8; font-weight:800; text-align:center; background:rgba(255,255,255,0.5); padding:6px; border-radius:8px;">상대방의 선택 대기 중...</div>`;
      }
    } else if (status === 'ACCEPTED') {
      const chosen = m.metadata?.chosen_time;
      bodyHtml = `<div style="font-size:12.5px; font-weight:900; color:#065f46; background:#fff; padding:8px; border-radius:8px; border:1px solid #a7f3d0; text-align:center; margin-bottom:6px;">${chosen ? fmt(chosen) : '확정됨'}</div>`;
      statusBadge = `<div style="font-size:10.5px; color:#059669; font-weight:800; text-align:center; background:#ecfdf5; padding:6px; border-radius:8px; border:1px solid #d1fae5;">✅ 수락됨 (캘린더 등록 완료)</div>`;
    } else if (status === 'REJECTED') {
      statusBadge = `<div style="font-size:10.5px; color:#e11d48; font-weight:800; text-align:center; background:#fff1f2; padding:6px; border-radius:8px; border:1px solid #fecdd3;">❌ 거절됨</div>`;
    }

    return `
      <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:8px;">
        <div style="max-width:250px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:14px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,.05);">
          <div style="font-size:12px; font-weight:900; color:#3730a3; margin-bottom:8px;">📅 일정 제안 (${times.length}개 후보)</div>
          ${bodyHtml}${statusBadge}
        </div>
        <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0;">${time}</div>
      </div>
    `;
  }

  // 🌟 [신규] 라이벌전 도전장 카드 — metadata.game_name/reward_points, match_id, action_status
  function renderChallengeCard(m, isMe, time) {
    const gameName = m.metadata?.game_name || '종목미정';
    const points = m.metadata?.reward_points || 0;
    const status = m.action_status || 'PENDING';

    let cardContent = '';
    if (status === 'PENDING') {
      if (!isMe) {
        cardContent = `
          <div style="display:flex; gap:6px; margin-top:8px;">
            <button class="boako-thread-action-btn" data-action="challenge-accept" data-msg-id="${m.message_id}" data-match-id="${m.match_id || ''}"
              style="flex:1; background:#ef4444; color:#fff; font-size:11px; font-weight:900; padding:8px; border:none; border-radius:8px; cursor:pointer;">🔥 수락</button>
            <button class="boako-thread-action-btn" data-action="challenge-reject" data-msg-id="${m.message_id}" data-match-id="${m.match_id || ''}"
              style="flex:1; background:#475569; color:#fff; font-size:11px; font-weight:800; padding:8px; border:none; border-radius:8px; cursor:pointer;">거절</button>
          </div>
        `;
      } else {
        cardContent = `<div style="margin-top:8px; font-size:10.5px; color:#94a3b8; font-weight:800; text-align:center; background:rgba(255,255,255,0.06); padding:6px; border-radius:8px;">응답 대기 중... ⏳</div>`;
      }
    } else if (status === 'ACCEPTED') {
      cardContent = `<div style="margin-top:8px; font-size:11px; color:#fca5a5; font-weight:900; text-align:center; background:rgba(239,68,68,0.1); padding:6px; border-radius:8px; border:1px solid rgba(239,68,68,0.2);">🔥 매치 수락됨</div>`;
    } else if (status === 'REJECTED') {
      cardContent = `<div style="margin-top:8px; font-size:10.5px; color:#94a3b8; font-weight:800; text-align:center; background:rgba(255,255,255,0.06); padding:6px; border-radius:8px;">❌ 거절됨</div>`;
    }

    return `
      <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:8px;">
        <div style="max-width:240px; background:linear-gradient(135deg,#1e293b,#0f172a); border:1px solid #334155; border-radius:14px; padding:12px; box-shadow:0 4px 10px rgba(0,0,0,.2); color:#fff;">
          <div style="font-size:11px; font-weight:900; color:#f87171; margin-bottom:8px;">⚔️ 라이벌 매치 도착</div>
          <div style="font-size:12.5px; font-weight:900; color:#0f172a; background:#fff; padding:7px; border-radius:8px; text-align:center; margin-bottom:6px;">${escapeHtml(gameName)}</div>
          <div style="text-align:center; font-size:10.5px; font-weight:800; color:#fbbf24;">보상: <span style="font-size:13px;">${points} P</span></div>
          ${cardContent}
        </div>
        <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0;">${time}</div>
      </div>
    `;
  }

  // 🌟 [신규] 팀 가입신청/스카웃제안 카드 — content가 JSON 문자열({team_name}), action_status
  function renderTeamActionCard(m, isMe, time) {
    const isJoin = m.action_type === 'TEAM_JOIN';
    let pData = {};
    try { pData = JSON.parse(m.content); } catch (e) { pData = { team_name: '오류' }; }
    const status = m.action_status || 'PENDING';
    const actionPrefix = isJoin ? 'teamjoin' : 'teaminvite';

    let btnHtml = '';
    if (status === 'PENDING' && !isMe) {
      btnHtml = `
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="boako-thread-action-btn" data-action="${actionPrefix}-accept" data-msg-id="${m.message_id}"
            style="flex:1; background:#2563eb; color:#fff; font-size:11px; font-weight:900; padding:8px; border:none; border-radius:8px; cursor:pointer;">✅ 수락</button>
          <button class="boako-thread-action-btn" data-action="${actionPrefix}-reject" data-msg-id="${m.message_id}"
            style="flex:1; background:#e2e8f0; color:#475569; font-size:11px; font-weight:800; padding:8px; border:none; border-radius:8px; cursor:pointer;">거절</button>
        </div>
      `;
    } else if (status === 'PENDING') {
      btnHtml = `<div style="margin-top:8px; font-size:10.5px; color:#64748b; font-weight:800; text-align:center; background:#f1f5f9; padding:6px; border-radius:8px;">결재 대기 중...</div>`;
    } else if (status === 'ACCEPTED') {
      btnHtml = `<div style="margin-top:8px; font-size:10.5px; color:#2563eb; font-weight:900; text-align:center; background:#eff6ff; padding:6px; border-radius:8px;">✅ 승인됨</div>`;
    } else {
      btnHtml = `<div style="margin-top:8px; font-size:10.5px; color:#e11d48; font-weight:800; text-align:center; background:#fff1f2; padding:6px; border-radius:8px;">❌ 거절됨</div>`;
    }

    return `
      <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:8px;">
        <div style="max-width:240px; background:#fff; border:1px solid #bfdbfe; border-radius:14px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,.05);">
          <div style="font-size:11px; font-weight:900; color:#2563eb; margin-bottom:8px;">${isJoin ? '🛡️ 입단 지원' : '💌 스카웃 제안'}</div>
          <div style="font-size:12px; font-weight:800; color:#334155; background:#f8fafc; padding:7px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">[${escapeHtml(pData.team_name || '')}] 합류</div>
          ${btnHtml}
        </div>
        <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0;">${time}</div>
      </div>
    `;
  }

  // 🌟 [신규] 액션 카드 버튼 클릭 위임 처리 — ensureDom()에서 #boako-panel-body에 한 번만 바인딩됨
  function handleThreadActionClick(e) {
    const btn = e.target.closest('.boako-thread-action-btn');
    if (!btn) return;
    const action = btn.dataset.action;
    const messageId = btn.dataset.msgId;

    if (action === 'schedule-accept') replySchedule(messageId, 'ACCEPTED', btn.dataset.time);
    else if (action === 'schedule-reject') replySchedule(messageId, 'REJECTED');
    else if (action === 'challenge-accept') replyChallenge(messageId, btn.dataset.matchId, 'ACCEPTED');
    else if (action === 'challenge-reject') replyChallenge(messageId, btn.dataset.matchId, 'REJECTED');
    else if (action === 'teamjoin-accept') replyTeamJoin(messageId, 'ACCEPTED');
    else if (action === 'teamjoin-reject') replyTeamJoin(messageId, 'REJECTED');
    else if (action === 'teaminvite-accept') replyTeamInvite(messageId, 'ACCEPTED');
    else if (action === 'teaminvite-reject') replyTeamInvite(messageId, 'REJECTED');
  }

  // 액션 처리 후 목록/스레드/배지를 전부 최신 상태로 다시 불러옴 (사이트 messenger.js와 동일한 후처리)
  async function refreshAfterThreadAction() {
    await fetchUnreadCount();
    await fetchMessages();
    if (State.activeConversation) await fetchThreadMessages(State.activeConversation.otherId);
    render();
  }

  async function replySchedule(messageId, status, chosenTime) {
    if (!confirm(`이 일정을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/messages?message_id=eq.${messageId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ action_status: status })
      });
      if (status === 'ACCEPTED') {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/confirm_direct_match_schedule`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ p_message_id: messageId, p_chosen_time: chosenTime })
        });
        if (!res.ok) throw new Error(await res.text());
        boakoSfx.success();
        showToast('system', '🎉', '일정 확정', '캘린더에 공식 등록되었어요!');
      }
    } catch (e) {
      boakoErr('일정 응답 처리 실패:', e);
      showToast('system', '❌', '처리 실패', '캘린더 등록에 실패했습니다.');
    }
    await refreshAfterThreadAction();
  }

  async function replyChallenge(messageId, matchId, status) {
    if (!confirm(`라이벌 도전을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/respond_to_rival_match`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ p_match_id: matchId, p_action: status })
      });
      if (!res.ok) throw new Error(await res.text());
      if (status === 'ACCEPTED') boakoSfx.success();
      showToast('system', '✅', '처리 완료', '라이벌 도전을 처리했어요!');
    } catch (e) {
      boakoErr('라이벌 도전 응답 처리 실패:', e);
      showToast('system', '❌', '처리 실패', '오류가 발생했습니다.');
    }
    await refreshAfterThreadAction();
  }

  async function replyTeamJoin(messageId, status) {
    if (!confirm(`가입 신청을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/respond_to_team_join`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ p_message_id: messageId, p_action: status })
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('system', '✅', '처리 완료', '가입 신청을 처리했어요!');
    } catch (e) {
      boakoErr('가입신청 응답 처리 실패:', e);
      showToast('system', '❌', '처리 실패', '오류가 발생했습니다.');
    }
    await refreshAfterThreadAction();
  }

  async function replyTeamInvite(messageId, status) {
    if (!confirm(`스카웃 제안을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/respond_to_team_invite`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ p_message_id: messageId, p_action: status })
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('system', '✅', '처리 완료', '영입 제안을 처리했어요!');
    } catch (e) {
      boakoErr('스카웃 응답 처리 실패:', e);
      showToast('system', '❌', '처리 실패', '오류가 발생했습니다.');
    }
    await refreshAfterThreadAction();
  }

  function renderFooter() {
    const footer = document.getElementById('boako-panel-footer');
    if (!footer) return;
    if (!State.session || State.activeTab === 'settings') { footer.innerHTML = ''; return; }

    if (State.activeTab === 'messages' && State.activeConversation) {
      footer.innerHTML = `<div class="boako-reply-row"><input type="text" id="boako-reply-input" placeholder="답장을 입력하세요"><button id="boako-reply-send">전송</button></div>`;
      const send = async () => {
        const input = document.getElementById('boako-reply-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await sendMessageReply(State.activeConversation.otherId, State.activeConversation.otherName, text);
        await Promise.all([fetchMessages(), fetchThreadMessages(State.activeConversation.otherId)]);
        render();
        const body = document.getElementById('boako-panel-body');
        if (body) body.scrollTop = body.scrollHeight;
      };
      document.getElementById('boako-reply-send').addEventListener('click', send);
      document.getElementById('boako-reply-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    } else if (State.activeTab === 'teamchat' && State.teamId) {
      footer.innerHTML = `<div class="boako-reply-row"><input type="text" id="boako-team-input" placeholder="팀챗 메시지 입력"><button id="boako-team-send">전송</button></div>`;
      const send = async () => {
        const input = document.getElementById('boako-team-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await sendTeamChatMessage(text);
        await fetchTeamChats();
        render();
      };
      document.getElementById('boako-team-send').addEventListener('click', send);
      document.getElementById('boako-team-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    } else {
      footer.innerHTML = `<button style="width:100%;background:#f1f5f9;border:none;border-radius:8px;padding:9px;font-size:12px;font-weight:800;color:#334155;cursor:pointer;" id="boako-open-archive">🔗 아카이브에서 전체 보기</button>`;
      const btn = document.getElementById('boako-open-archive');
      if (btn) btn.addEventListener('click', () => window.open('https://boakoarchive.co.kr/', '_blank'));
    }

    // 뒤로가기 버튼(스레드 뷰)은 body 쪽에 있어서 여기서 별도 바인딩
    const back = document.getElementById('boako-thread-back');
    if (back) back.addEventListener('click', () => { State.activeConversation = null; render(); });
  }

  function renderSettings() {
    const d = State.settings;
    return `
      <div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;margin:0 0 8px;">메시지 미리보기</div>
      <div class="boako-settings-row">
        <div style="font-size:12px;font-weight:700;">발신자 이름 표시</div>
        <input type="checkbox" id="boako-set-showsender" ${d.showSenderName ? 'checked' : ''}>
      </div>

      <div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;margin:14px 0 8px;">메시지 방해금지</div>
      <div class="boako-settings-row">
        <div style="font-size:12px;font-weight:700;">방해금지 사용</div>
        <input type="checkbox" id="boako-set-dnd-msg" ${d.dnd.message.enabled ? 'checked' : ''}>
      </div>
      <div class="boako-settings-row">
        <input type="time" id="boako-set-dnd-msg-start" value="${d.dnd.message.start}">
        <span>~</span>
        <input type="time" id="boako-set-dnd-msg-end" value="${d.dnd.message.end}">
      </div>

      <div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;margin:14px 0 8px;">아카이브 소식 방해금지</div>
      <div class="boako-settings-row">
        <div style="font-size:12px;font-weight:700;">방해금지 사용</div>
        <input type="checkbox" id="boako-set-dnd-news" ${d.dnd.news.enabled ? 'checked' : ''}>
      </div>
      <div class="boako-settings-row">
        <input type="time" id="boako-set-dnd-news-start" value="${d.dnd.news.start}">
        <span>~</span>
        <input type="time" id="boako-set-dnd-news-end" value="${d.dnd.news.end}">
      </div>

      <div class="boako-settings-row" style="margin-top:14px;">
        <button id="boako-logout-btn" style="width:100%;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;padding:9px;font-size:12px;font-weight:800;cursor:pointer;">로그아웃</button>
      </div>
    `;
  }

  function bindSettingsEvents() {
    const d = State.settings;
    document.getElementById('boako-set-showsender').addEventListener('change', (e) => { d.showSenderName = e.target.checked; saveSettings(); });

    document.getElementById('boako-set-dnd-msg').addEventListener('change', (e) => {
      d.dnd.message.enabled = e.target.checked;
      saveSettings();
      if (e.target.checked) showSystemToast('🔕', '메시지 방해금지 켜짐', `${d.dnd.message.start}~${d.dnd.message.end} 동안 알림이 표시되지 않아요. 배지 숫자는 계속 반영돼요.`);
      else showSystemToast('🔔', '메시지 방해금지 꺼짐', '이제부터 다시 알림이 표시됩니다.');
    });
    document.getElementById('boako-set-dnd-msg-start').addEventListener('change', (e) => { d.dnd.message.start = e.target.value; saveSettings(); });
    document.getElementById('boako-set-dnd-msg-end').addEventListener('change', (e) => { d.dnd.message.end = e.target.value; saveSettings(); });

    document.getElementById('boako-set-dnd-news').addEventListener('change', (e) => {
      d.dnd.news.enabled = e.target.checked;
      saveSettings();
      if (e.target.checked) showSystemToast('🔕', '아카이브 소식 방해금지 켜짐', `${d.dnd.news.start}~${d.dnd.news.end} 동안 알림이 표시되지 않아요.`);
      else showSystemToast('🔔', '아카이브 소식 방해금지 꺼짐', '이제부터 다시 알림이 표시됩니다.');
    });
    document.getElementById('boako-set-dnd-news-start').addEventListener('change', (e) => { d.dnd.news.start = e.target.value; saveSettings(); });
    document.getElementById('boako-set-dnd-news-end').addEventListener('change', (e) => { d.dnd.news.end = e.target.value; saveSettings(); });

    document.getElementById('boako-logout-btn').addEventListener('click', doLogout);
  }

  // ========================================================================
  // 초기화
  // ========================================================================
  async function initAfterLogin() {
    boakoLog('로그인 이후 초기화 시작...');
    await Promise.all([fetchUnreadCount()]);
    State.teamId = await fetchTeamId();
    boakoLog('소속 팀 id:', State.teamId || '(없음)');
    await Promise.all([fetchMessages(), fetchTeamChats()]);
    initRealtimeCoordination(); // 🌟 탭 리더 선출 후, 리더 탭만 실제 웹소켓 연결을 만듦
    render();
  }

  async function init() {
    boakoLog('위젯 초기화 시작');
    ensureDom();
    await loadSettings();
    await checkSession();
    render();
    if (State.session) {
      await initAfterLogin();
    }
    boakoOk('위젯 초기화 완료');
  }

  // 🌟 백그라운드 탭은 브라우저가 타이머를 느리게 만들어서(전력 절약) 하트비트가
  // 제때 안 나가 연결이 끊기는 경우가 흔함. 탭이 다시 화면에 보이는 순간, 예약된 백오프 대기를
  // 기다리지 않고 바로 재연결을 시도해서 복구 속도를 최대한 앞당김.
  // 🌟 [수정] 리더 탭일 때만 직접 재연결하고, 팔로워 탭이면 리더가 진짜 죽었을 때만 승격 시도
  // (팔로워가 무작정 _doConnect()를 부르면 탭마다 중복 연결이 생겨 리더선출 의미가 없어짐).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!State.session) return;

    if (isRealtimeLeader) {
      if (State.realtimeClient) return; // 이미 연결 살아있으면 할 일 없음
      boakoLog('탭이 다시 활성화됨(리더) — 실시간 연결 상태 확인 중...');
      if (State.reconnectTimer) {
        clearTimeout(State.reconnectTimer);
        State.reconnectTimer = null;
      }
      State.intentionalDisconnect = false;
      _doConnect();
    } else {
      // 팔로워: 리더가 그 사이 죽었는지만 확인하고, 죽었으면 즉시 승격 시도
      const info = getLeaderInfo();
      if (!isLeaderInfoAlive(info)) {
        boakoLog('탭이 다시 활성화됨(팔로워) — 리더 하트비트 확인 결과 죽어있어 승격 시도');
        tryClaimWithJitter();
      }
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
