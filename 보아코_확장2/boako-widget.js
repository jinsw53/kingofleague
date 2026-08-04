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
 *    resize 이벤트 + 3초 주기로 화면 범위를 재확인해서 벗어나 있으면 자동으로 되돌림 (!important도 추가).
 * 🌟 [수정] 대화 스레드를 한 번에(limit=100) 불러오던 것 → 카톡처럼 최근 30개만 먼저 불러오고
 *    "이전 대화 더 보기" 버튼을 눌러야 그 이전 30개를 추가로 불러오는 방식으로 변경 (리소스 절약).
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

  const State = {
    session: null,       // { access_token, refresh_token, expires_at, user: {id, nickname, avatar} }
    teamId: null,
    unread: 0,
    panelOpen: false,
    activeTab: 'messages',
    activeConversation: null, // { otherId, otherName }
    realtimeClient: null,
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
    } else {
      boakoLog('로그인 안 된 상태');
    }
    return State.session;
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
      let url = `${SUPABASE_URL}/rest/v1/messages?or=(and(sender_id.eq.${State.session.user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${State.session.user.id}))&order=created_at.desc&limit=${THREAD_PAGE_SIZE}&select=message_id,sender_id,content,created_at`;
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
  // 🌟 실시간 연결 (핵심 디버깅 대상) — 이 단계에서 CSP 문제가 있으면 아래 로그로 바로 드러남
  // ========================================================================
  function connectRealtime() {
    if (typeof BoakoRealtimeClient === 'undefined') {
      boakoErr('BoakoRealtimeClient 없음 — 실시간 연결 시도 자체를 할 수 없음');
      return;
    }
    if (State.realtimeClient) {
      boakoLog('이미 연결된 realtime 클라이언트가 있어 재사용');
      return;
    }

    const wsUrl = `${SUPABASE_URL.replace('https://', 'wss://')}/realtime/v1`;
    boakoLog('웹소켓 연결 시도:', wsUrl);

    const client = new BoakoRealtimeClient(wsUrl, { params: { apikey: SUPABASE_KEY } });
    State.realtimeClient = client;

    // 🌟 [버그수정] onOpen/onClose/onError는 client(RealtimeClient) 최상위가 아니라
    // client.socketAdapter(내부 소켓 래퍼)에 있음 — 연결 단계별 상태를 전부 로그로 남김.
    // CSP가 막으면 보통 onError가 뜨거나, onOpen이 영원히 안 뜸
    client.socketAdapter.onOpen(() => boakoOk('웹소켓 연결 성공! (CSP 문제 없음)'));
    client.socketAdapter.onClose((e) => boakoWarn('웹소켓 연결 종료됨:', e));
    client.socketAdapter.onError((e) => boakoErr('웹소켓 연결 오류 발생 — BGA 페이지의 CSP가 Supabase 연결을 막고 있을 가능성이 있음. 개발자 도구 콘솔에 "Refused to connect" 또는 "violates the following Content Security Policy" 에러가 같이 떠 있는지 확인해보세요.', e));

    client.setAuth(State.session.access_token);
    client.connect();

    // 내 쪽지함 실시간 구독
    const msgTopic = `messages-${State.session.user.id}`;
    boakoLog(`채널 구독 시도: ${msgTopic}`);
    const msgChannel = client.channel(msgTopic, { config: {} });
    msgChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${State.session.user.id}` }, async (payload) => {
      boakoOk('새 쪽지 실시간 수신:', payload.new);
      State.unread += 1;
      await fetchMessages();
      // 🌟 지금 그 상대방과의 대화를 이미 보고 있으면, 목록뿐 아니라 열린 대화창에도 바로 반영 + 읽음 처리
      const isViewingThisThread = State.panelOpen && State.activeTab === 'messages' && State.activeConversation?.otherId === payload.new.sender_id;
      if (isViewingThisThread) {
        await fetchThreadMessages(payload.new.sender_id);
        await markThreadAsRead(payload.new.sender_id);
      }
      render();
      // 이미 그 대화를 보고 있는 중이면 토스트까지 띄울 필요는 없음
      if (!isViewingThisThread) handleIncomingToast('message', payload.new);
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
        if (payload.new.sender_id === State.session.user.id) return; // 내가 보낸 건 알림 제외
        boakoOk('새 팀챗 실시간 수신:', payload.new);
        fetchTeamChats().then(render);
        handleIncomingToast('message', payload.new, true);
      });
      teamChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') boakoOk(`채널 구독 성공: ${teamTopic}`);
        else if (status === 'CHANNEL_ERROR') boakoErr(`채널 구독 실패(CHANNEL_ERROR): ${teamTopic}`, err);
        else if (status === 'TIMED_OUT') boakoErr(`채널 구독 타임아웃(TIMED_OUT): ${teamTopic}`);
        else if (status === 'CLOSED') boakoWarn(`채널 닫힘(CLOSED): ${teamTopic}`);
      });
    }
  }

  function disconnectRealtime() {
    if (State.realtimeClient) {
      boakoLog('실시간 연결 해제');
      State.realtimeClient.disconnect();
      State.realtimeClient = null;
    }
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

    // 🌟 [신규] 게임 페이지 등에서 가끔 아이콘이 화면 아래로 밀려나 보이는 현상에 대한 방어 로직.
    // 정확한 원인(BGA 페이지 자체의 동적 레이아웃/스케일링 가능성)을 100% 재현은 못 했지만,
    // 창 크기 변화 시 + 주기적으로 "화면 안에 있는지"를 다시 확인해서 벗어나 있으면 되돌려놓음.
    window.addEventListener('resize', () => reclampIconPosition(icon));
    setInterval(() => reclampIconPosition(icon), 3000);

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
  function renderThread(conv) {
    const bubbles = State.threadMessages.map(m => {
      const isMe = m.sender_id === State.session.user.id;
      const time = new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
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
    connectRealtime();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
