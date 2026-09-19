/**
 * [REALTIME COORDINATOR] 사이트 전역 실시간 연결 탭 리더 선출
 * 🌟 [신규] 사이트를 여러 탭(팀 페이지/랭킹/게시판 등)으로 띄워두면, 각 탭이 로그인 시점에
 *    Boako.db.channel(...)로 각자 실시간 채널을 구독하면서 탭 수만큼 소켓이 늘어나던 문제를
 *    해결하기 위한 공용 모듈. 확장(보아코_확장2/boako-widget.js)의 탭 리더 선출 패턴
 *    (localStorage 하트비트 + BroadcastChannel 중계)을 사이트에도 동일하게 이식함.
 * 🌟 브라우저(same-origin) 안의 탭들 중 "리더" 탭 하나만 실제 Realtime 소켓을 열고, 나머지
 *    (팔로워)는 리더가 BroadcastChannel로 중계해주는 이벤트만 받아서 동일하게 반응(토스트/배지
 *    갱신 등은 각 탭이 알아서 그림). 리더 탭이 닫히면(하트비트 끊김 또는 beforeunload로 즉시
 *    통지) 남은 탭 중 하나가 자동 승격되어 그 즉시 실제 구독을 새로 시작함.
 * 🌟 사용법 (messenger.js/achievements.js/rival_notify.js/recommend_notify.js/auth.js 등):
 *    1) 이 탭이 리더가 됐을 때(최초 선출 또는 승격)만 실제 채널을 구독하려면
 *       Boako.RealtimeCoordinator.onBecomeLeader(() => { ...Boako.db.channel(...).subscribe()... })
 *    2) 리더가 실제 이벤트를 받으면 로컬 반응 처리와 함께 팔로워들에게 중계
 *       Boako.RealtimeCoordinator.broadcast('messenger:message-insert', payload)
 *    3) 모든 탭(리더/팔로워 공통)에서 위 이벤트를 동일하게 처리하려면
 *       Boako.RealtimeCoordinator.onRelay('messenger:message-insert', (payload) => { ...공통 반응 로직... })
 *       — 리더 탭에서도 자기 채널 콜백 안에서 이 공통 반응 함수를 직접 호출해주면 됨(중계는 팔로워 전용).
 * 🌟 확장과 다른 점: 사이트는 로그인 여부와 무관하게 로드되므로, 로그아웃 상태에서도 리더 선출
 *    자체는 동작함(구독은 각 모듈이 로그인 여부를 보고 onBecomeLeader 콜백 안에서 판단).
 * 🌟 localStorage 키/BroadcastChannel 이름을 확장(boako_realtime_leader, boako-realtime-relay)과
 *    다르게(boako_site_realtime_leader, boako-site-realtime-relay) 지정 — 사이트와 확장은 서로
 *    다른 origin(boakoarchive.co.kr vs boardgamearena.com)이라 원래 충돌할 일은 없지만, 향후
 *    같은 origin에서 쓰일 가능성까지 감안해 이름을 명확히 분리해둠.
 * 🌟 [보강] 리더가 죽은 직후 여러 탭이 거의 동시에 클레임을 시도하면(예: 탭 여러 개를 동시에
 *    열어둔 경우) localStorage 쓰기가 서로 덮어써져서 순간적으로 리더가 2개 이상 생길 수 있던
 *    레이스 컨디션을 보완 — claim() 직후 곧바로 리더 역할을 시작하지 않고, 600ms 뒤 내 tabId가
 *    여전히 기록돼있는지 재확인한 다음에만 실제로 하트비트/구독을 시작함. 진 탭은 조용히
 *    팔로워로 돌아감(createGroup 팩토리도 동일하게 적용).
 */
Boako.RealtimeCoordinator = (function () {
    const TAB_ID = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    const LEADER_KEY = 'boako_site_realtime_leader';
    const LEADER_TTL_MS = 6000;       // 이 시간 넘게 하트비트가 없으면 리더가 죽은 것으로 간주
    const HEARTBEAT_INTERVAL_MS = 2000;
    const BC_NAME = 'boako-site-realtime-relay';

    let isLeader = false;
    let heartbeatTimer = null;
    let followerWatchTimer = null;
    let bc = null;
    let started = false;
    const leaderCallbacks = [];     // 리더가 될 때(최초 선출 or 승격) 호출할 콜백들
    const relayHandlers = {};       // type -> [handler, handler, ...]

    function log(msg) { console.log(`%c[BOAKO REALTIME] ${msg}`, 'color:#4f46e5;font-weight:bold;'); }
    function warn(msg) { console.warn(`%c[BOAKO REALTIME] ⚠️ ${msg}`, 'color:#f59e0b;font-weight:bold;'); }

    function getLeaderInfo() {
        try {
            const raw = localStorage.getItem(LEADER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function isAlive(info) {
        return !!info && (Date.now() - info.ts) < LEADER_TTL_MS;
    }

    function dispatchRelay(type, payload) {
        (relayHandlers[type] || []).forEach(fn => {
            try { fn(payload); } catch (e) { console.error(`[BOAKO REALTIME] relay 핸들러 오류 (${type}):`, e); }
        });
    }

    // 🌟 [레이스 방지] 여러 탭이 거의 동시에 리더가 비었다고 판단해서 각자 localStorage에 자기
    // tabId를 쓰면, 마지막에 쓴 탭 하나만 남고 나머지는 자기도 모르게 "졌는데도" 그대로 리더
    // 역할(실제 채널 구독)을 시작해버릴 수 있음(순간적으로 리더가 2개 이상 존재). 그래서 쓰자마자
    // 바로 리더 역할을 시작하지 않고, 짧게 기다렸다가 localStorage에 남은 값이 여전히 내 tabId인지
    // 재확인한 뒤에만 실제로 하트비트/구독을 시작함 — 졌으면 조용히 팔로워로 전환.
    const CLAIM_CONFIRM_DELAY_MS = 600;

    function claim() {
        if (followerWatchTimer) { clearInterval(followerWatchTimer); followerWatchTimer = null; }
        localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
        setTimeout(() => {
            const info = getLeaderInfo();
            if (!info || info.tabId !== TAB_ID) {
                // 다른 탭의 클레임이 내 것을 덮어씀 — 이 탭은 경합에서 진 것이므로 팔로워로 전환
                becomeFollower();
                return;
            }
            isLeader = true;
            log(`이 탭이 사이트 실시간 연결 리더로 선출됨 (id: ${TAB_ID.slice(0, 8)})`);
            heartbeatTimer = setInterval(() => {
                localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
            }, HEARTBEAT_INTERVAL_MS);
            // 🌟 이미 등록된(먼저 로드된 모듈들의) 콜백을 전부 실행 — 최초 선출/승격 공통 경로
            leaderCallbacks.forEach(fn => {
                try { fn(); } catch (e) { console.error('[BOAKO REALTIME] onBecomeLeader 콜백 오류:', e); }
            });
        }, CLAIM_CONFIRM_DELAY_MS);
    }

    function becomeFollower() {
        isLeader = false;
        log('다른 탭이 이미 사이트 실시간 연결 리더 — 이 탭은 팔로워로 대기 (중계 이벤트만 수신, 별도 연결 안 만듦)');
        if (!followerWatchTimer) {
            followerWatchTimer = setInterval(() => {
                const info = getLeaderInfo();
                if (!isAlive(info)) {
                    warn('리더 탭의 하트비트가 끊김 — 리더 승격 시도');
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
            if (!isAlive(info)) claim(); else becomeFollower();
        }, jitter);
    }

    function init() {
        if (started) return;
        started = true;

        bc = new BroadcastChannel(BC_NAME);
        bc.onmessage = (e) => {
            if (isLeader) return; // 리더는 이벤트의 원본 발신자이므로 자기 방송은 무시
            const { type, payload } = e.data || {};
            if (type) dispatchRelay(type, payload);
        };

        window.addEventListener('beforeunload', () => {
            // 리더가 사라진다는 걸 즉시 localStorage에서 지워서, 팔로워가 하트비트 타임아웃(최대 6초)까지
            // 안 기다리고 다음 감시 주기(2초 이내)에 바로 승격하도록 함. isLeader 확정 전(확인 대기 중)에
            // 닫히는 경우에도 내 tabId가 남아있으면 정리해서 유령 클레임이 남지 않게 함.
            try {
                const info = getLeaderInfo();
                if (info && info.tabId === TAB_ID) localStorage.removeItem(LEADER_KEY);
            } catch (e) { /* noop */ }
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        });

        // 🌟 백그라운드 탭은 브라우저가 타이머를 느리게 만들어 하트비트가 늦어질 수 있음 —
        // 탭이 다시 보이는 순간 리더가 그 사이 죽었는지만 확인하고, 죽었으면 즉시 승격 시도
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            if (isLeader) return; // 리더는 소켓을 그대로 유지 (재연결은 supabase-js 내부 로직에 맡김)
            const info = getLeaderInfo();
            if (!isAlive(info)) tryClaimWithJitter();
        });

        tryClaimWithJitter();
    }

    return {
        // 🌟 auth.js 로드 직후 1회 호출 (로그인 여부와 무관하게 항상 시작 — 구독 여부는 각 모듈이 판단)
        init,
        isLeader: () => isLeader,
        // 🌟 리더가 될 때(최초 선출 or 승격) 실행할 콜백 등록. 등록 시점에 이미 리더로 확정돼 있으면
        // (모듈 로드 타이밍이 리더 선출보다 늦은 경우) 즉시 한 번 실행해줌.
        onBecomeLeader: (fn) => {
            leaderCallbacks.push(fn);
            if (isLeader) {
                try { fn(); } catch (e) { console.error('[BOAKO REALTIME] onBecomeLeader 콜백 오류:', e); }
            }
        },
        // 🌟 리더 탭에서만 실제로 방송함 (팔로워가 호출해도 조용히 무시됨)
        broadcast: (type, payload) => {
            if (!isLeader || !bc) return;
            try { bc.postMessage({ type, payload }); } catch (e) { /* noop */ }
        },
        onRelay: (type, fn) => {
            if (!relayHandlers[type]) relayHandlers[type] = [];
            relayHandlers[type].push(fn);
        }
    };
})();

// 🌟 [범용 미니 코디네이터] team.js 팀챗 전용 리더 선출(2026-08-28)과 동일한 개념을 일반화한 팩토리.
// 위 전역 RealtimeCoordinator는 "로그인하면 항상 켜져있는" 채널(메신저/업적/전광판 등) 전용이라,
// 특정 화면을 열어본 탭에서만 필요한 lazy 채널(같이하자 게시판, 토너먼트 탭, 매치방 등)에 그대로
// 재사용하면 안 됨 — 전역 리더로 뽑힌 탭이 그 화면을 한 번도 안 열어봤으면, 다른 탭에서 그 화면을
// 열어도 실제 구독을 아무도 안 하고 있어서 실시간 이벤트가 영원히 발생하지 않는 사각지대가 생김
// (team.js 팀챗에서 처음 발견된 문제). 그래서 "지금 이 화면을 열어본 탭들"끼리만 격리된 리더
// 선출을 하는 인스턴스를 만들어 씀.
// 사용법: const g = Boako.RealtimeCoordinator.createGroup('together');  // 대상이 하나뿐인 화면
//         const g = Boako.RealtimeCoordinator.createGroup('match-chat', roomId); // id별로 격리
//         g.start();                              // 화면 렌더 시 1회
//         g.onBecomeLeader(() => { ...channel 구독... });
//         g.broadcast('type', payload);            // 리더 콜백 안에서 팔로워에 중계
//         g.onRelay('type', payload => {...});     // 리더/팔로워 공통 반응 로직
Boako.RealtimeCoordinator.createGroup = function (namespace, instanceId) {
    const key = instanceId ? `${namespace}_${instanceId}` : namespace;
    const TAB_ID = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    const LEADER_KEY = `boako_grp_leader_${key}`;
    const BC_NAME = `boako-grp-relay-${key}`;
    const LEADER_TTL_MS = 6000;
    const HEARTBEAT_INTERVAL_MS = 2000;

    let isLeader = false;
    let heartbeatTimer = null;
    let followerTimer = null;
    let confirmTimer = null;
    let bc = null;
    let started = false;
    const leaderCallbacks = [];
    const relayHandlers = {};

    function getLeaderInfo() {
        try { return JSON.parse(localStorage.getItem(LEADER_KEY)); } catch (e) { return null; }
    }
    function isAlive(info) { return !!info && (Date.now() - info.ts) < LEADER_TTL_MS; }
    function dispatchRelay(type, payload) {
        (relayHandlers[type] || []).forEach(fn => {
            try { fn(payload); } catch (e) { console.error(`[BOAKO REALTIME:${key}] relay 핸들러 오류 (${type}):`, e); }
        });
    }
    // 🌟 [레이스 방지] 여러 탭이 거의 동시에 클레임을 시도해 localStorage를 서로 덮어쓸 수 있으므로,
    // 쓰자마자 바로 리더 역할을 시작하지 않고 짧게 기다렸다가 내 tabId가 여전히 남아있는지
    // 재확인한 뒤에만 실제로 하트비트/구독을 시작함 — 졌으면 조용히 팔로워로 전환(전역 버전과 동일한 패턴).
    const CLAIM_CONFIRM_DELAY_MS = 600;

    function claim() {
        if (followerTimer) { clearInterval(followerTimer); followerTimer = null; }
        localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
        confirmTimer = setTimeout(() => {
            confirmTimer = null;
            // 🌟 확인 대기 중에 화면을 벗어나 teardown()이 먼저 호출됐으면 아무 것도 시작하지 않고 조용히 중단
            if (!started) return;
            const info = getLeaderInfo();
            if (!info || info.tabId !== TAB_ID) {
                becomeFollower();
                return;
            }
            isLeader = true;
            heartbeatTimer = setInterval(() => {
                localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
            }, HEARTBEAT_INTERVAL_MS);
            leaderCallbacks.forEach(fn => {
                try { fn(); } catch (e) { console.error(`[BOAKO REALTIME:${key}] onBecomeLeader 콜백 오류:`, e); }
            });
        }, CLAIM_CONFIRM_DELAY_MS);
    }
    function becomeFollower() {
        isLeader = false;
        if (!followerTimer) {
            followerTimer = setInterval(() => {
                const info = getLeaderInfo();
                if (!isAlive(info)) tryClaimWithJitter();
            }, 2000);
        }
    }
    function tryClaimWithJitter() {
        const jitter = Math.random() * 400;
        setTimeout(() => {
            const info = getLeaderInfo();
            if (!isAlive(info)) claim(); else becomeFollower();
        }, jitter);
    }
    function start() {
        if (started) return;
        started = true;
        bc = new BroadcastChannel(BC_NAME);
        bc.onmessage = (e) => {
            if (isLeader) return;
            const { type, payload } = e.data || {};
            if (type) dispatchRelay(type, payload);
        };
        window.addEventListener('beforeunload', () => {
            try {
                const info = getLeaderInfo();
                if (info && info.tabId === TAB_ID) localStorage.removeItem(LEADER_KEY);
            } catch (e) { /* noop */ }
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        });
        tryClaimWithJitter();
    }
    function teardown() {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        if (followerTimer) { clearInterval(followerTimer); followerTimer = null; }
        if (confirmTimer) { clearTimeout(confirmTimer); confirmTimer = null; }
        // 🌟 확정되기 전(확인 대기 중)에 teardown되면 isLeader는 아직 false지만 localStorage엔
        // 이미 내 tabId가 임시로 남아있을 수 있음 — isLeader 여부와 무관하게 내 tabId면 정리해서
        // 다른 탭이 TTL(6초)까지 기다리지 않고 바로 새로 클레임할 수 있게 함.
        try {
            const info = getLeaderInfo();
            if (info && info.tabId === TAB_ID) localStorage.removeItem(LEADER_KEY);
        } catch (e) { /* noop */ }
        if (bc) { try { bc.close(); } catch (e) { /* noop */ } bc = null; }
        isLeader = false;
        started = false;
    }

    return {
        start,
        teardown,
        isLeader: () => isLeader,
        onBecomeLeader: (fn) => {
            leaderCallbacks.push(fn);
            if (isLeader) {
                try { fn(); } catch (e) { console.error(`[BOAKO REALTIME:${key}] onBecomeLeader 콜백 오류:`, e); }
            }
        },
        broadcast: (type, payload) => {
            if (!isLeader || !bc) return;
            try { bc.postMessage({ type, payload }); } catch (e) { /* noop */ }
        },
        onRelay: (type, fn) => {
            if (!relayHandlers[type]) relayHandlers[type] = [];
            relayHandlers[type].push(fn);
        }
    };
};

Boako.RealtimeCoordinator.init();
