/**
 * [STATE RESTORE] 새로고침 시 "보던 화면 그대로" 복원 (PC / 모바일 공용)
 *
 * 동작 원리
 *  1) 사용자가 화면을 옮기거나(Boako.View.render / MobileShell.open*·switchTab) 탭·필터·페이지 번호 등을
 *     누를 때마다 "어떤 화면 + 거기서 누른 상태 변경 함수들(순서 그대로)"을 sessionStorage에 기록한다.
 *  2) 새로고침으로 부팅할 때, 원래 그리던 첫 화면(소식지) 대신 기록된 화면을 그리고
 *     기록된 동작을 같은 순서로 다시 재생한다. → 데이터는 항상 서버에서 새로 가져오므로
 *     새 기록이 들어왔으면 그 최신 값 위에서 같은 탭/필터/페이지 번호가 복원된다.
 *  3) 복원 도중엔 화면을 숨겨서 소식지가 잠깐 비치는 깜빡임을 막고, 끝나면 스크롤 위치까지 되돌린다.
 *
 * 안전장치
 *  - 복원은 "조회용 상태 변경 함수"(ALLOW 목록)만 재생한다. 저장/삭제/구매/전송류는 절대 재생하지 않는다.
 *  - 쓰기 모달·채팅 입력창·비밀번호 등은 기록하지 않는다.
 *  - 주소에 ?view= / ?open= 딥링크가 있으면 복원하지 않고 딥링크를 우선한다.
 *  - sessionStorage(탭 단위)라서 새 탭/브라우저를 새로 열면 기존처럼 소식지에서 시작한다.
 *  - 복원 중 어떤 단계가 실패해도 그 단계만 건너뛰고 계속 진행한다.
 */
(function () {
    'use strict';
    window.Boako = window.Boako || {};
    if (Boako.StateRestore) return;

    const KEY = 'boako_restore_v1';
    const MAX_AGE_MS = 12 * 60 * 60 * 1000;
    const MAX_LOG = 60;
    const MOBILE = !!document.getElementById('mobile-content-area');
    const AREA_ID = MOBILE ? 'mobile-content-area' : 'main-content-area';
    const qs = new URLSearchParams(location.search);
    const HAS_DEEPLINK = qs.has('view') || qs.has('open');

    // 재생 허용 목록 (조회용 상태 변경 함수만).
    //  set  : 같은 함수의 이전 호출을 덮어씀 (마지막 값만 의미 있음)
    //  set0 : 같은 함수 + 같은 첫 번째 인자의 이전 호출만 덮어씀 (예: selectFilter('season'|'round', 값))
    //  rel  : 상대 이동이라 호출 순서를 전부 보존
    const ALLOW = {
        'Boako.Archive.switchTab': 'set',
        'Boako.Archive.selectFilter': 'set0',
        'Boako.Archive.changePage': 'set',
        'Boako.Ranking.switchTab': 'set',
        'Boako.Ranking.changeSeason': 'set',
        'Boako.Ranking.changeHofSeason': 'set',
        'Boako.Rival.switchTab': 'set',
        'Boako.Rival.searchRivals': 'set',
        'Boako.Match.switchTab': 'set',
        'Boako.Match.selectSeason': 'set',
        'Boako.League.switchTab': 'set',
        'Boako.League.selectBingoSeason': 'set',
        'Boako.League.changeChallengeSeason': 'set',
        'Boako.League.filterChampions': 'set',
        'Boako.Tournament.switchTab': 'set',
        'Boako.MobileTournament.switchTab': 'set',
        'Boako.Together.switchTab': 'set',
        'Boako.Together.runFindGame': 'set',
        'Boako.Board.switchCategory': 'set',
        'Boako.Board.switchSort': 'set',
        'Boako.Board.goToPage': 'set',
        'Boako.Board.openDetail': 'set',
        'Boako.Board.renderList': 'set',
        'Boako.Board.selectGuideGame': 'set',
        'Boako.Board.backToGuideGrid': 'set',
        'Boako.TeamList.loadTeams': 'set',
        'Boako.Schedule.View.changeMonth': 'rel',
        'Boako.Schedule.View.selectDate': 'set',
        'Boako.Schedule.View.showAllSchedules': 'set',
        'Boako.Messenger.View.openRoom': 'set',
        'Boako.MobileMessenger.openRoom': 'set',
        'Boako.MobileMessenger.closeThread': 'set',
        'Boako.View.switchTeamTab': 'set',
        'Boako.MobileTeamHub.switchTab': 'set',
        'Boako.MobileTeam.changeSeason': 'set',
        'Boako.MobileSearch.runSearch': 'set'
    };

    // 입력값 기록에서 제외할 id (채팅/댓글/쪽지/비밀번호 등 "작성 중인 글")
    const INPUT_EXCLUDE = /chat|comment|reply|msg|message|password|write|draft|nick/i;

    // ---------- 저장소 ----------
    let state = null;      // { page, log, scroll, tab }
    let recording = false;
    let booting = true;

    function load() {
        try {
            const raw = sessionStorage.getItem(KEY);
            if (!raw) return null;
            const s = JSON.parse(raw);
            if (!s || !s.page || (Date.now() - (s.ts || 0)) > MAX_AGE_MS) return null;
            if (!Array.isArray(s.log)) s.log = [];
            return s;
        } catch (e) { return null; }
    }
    function save() {
        if (!state) return;
        try { state.ts = Date.now(); sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
    }
    function newPage(page, tab) {
        state = { page, log: [], scroll: { y: 0, a: 0 }, tab: tab || null, ts: Date.now() };
        save();
    }

    state = HAS_DEEPLINK ? null : load();
    if (HAS_DEEPLINK) { try { sessionStorage.removeItem(KEY); } catch (e) { } }

    const getArea = () => document.getElementById(AREA_ID);

    // ---------- 로딩 완료 감지 (fetch 카운터 + 화면 변화 멈춤) ----------
    let inflight = 0;
    const origFetch = window.fetch;
    if (typeof origFetch === 'function') {
        window.fetch = function () {
            inflight++;
            const p = origFetch.apply(this, arguments);
            const done = () => { inflight = Math.max(0, inflight - 1); };
            p.then(done, done);
            return p;
        };
    }
    function idle(max, quiet) {
        max = max || 8000; quiet = quiet || 350;
        return new Promise(resolve => {
            const target = getArea() || document.body;
            let last = Date.now();
            const t0 = last;
            const mo = new MutationObserver(() => { last = Date.now(); });
            mo.observe(target, { childList: true, subtree: true, characterData: true });
            const iv = setInterval(() => {
                const now = Date.now();
                if ((inflight === 0 && now - last >= quiet) || now - t0 > max) {
                    clearInterval(iv); mo.disconnect(); resolve();
                }
            }, 60);
        });
    }
    function waitEl(id, max) {
        max = max || 4000;
        return new Promise(resolve => {
            const t0 = Date.now();
            (function poll() {
                const el = document.getElementById(id);
                if (el) return resolve(el);
                if (Date.now() - t0 > max) return resolve(null);
                setTimeout(poll, 80);
            })();
        });
    }

    // ---------- 재생 ----------
    function resolvePath(path) {
        const parts = path.split('.');
        let ctx = window, cur = window;
        for (const p of parts) {
            if (cur == null) return null;
            ctx = cur; cur = cur[p];
        }
        return typeof cur === 'function' ? { fn: cur, ctx } : null;
    }
    function parseArgs(src) {
        if (!src) return [];
        try { return JSON.parse('[' + src + ']'); } catch (e) { }
        return new Function('return [' + src + ']')();
    }
    async function applyEntry(e) {
        if (e.t === 'c') {
            const r = resolvePath(e.n);
            if (!r) return;
            await r.fn.apply(r.ctx, parseArgs(e.a));
            return;
        }
        const el = await waitEl(e.id);
        if (!el) return;
        if (e.t === 'i') {
            if (el.type === 'checkbox' || el.type === 'radio') {
                if (el.checked !== !!e.c) {
                    el.checked = !!e.c;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                el.value = e.v;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (e.t === 'k') {
            el.value = e.v;
            ['keydown', 'keypress', 'keyup'].forEach(type => {
                el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            });
        }
    }
    async function replay(log) {
        for (const e of (log || [])) {
            try { await applyEntry(e); } catch (err) { console.warn('[StateRestore] 재생 건너뜀', e, err); }
            await idle(5000, 250);
        }
    }
    async function applyScroll(sc) {
        if (!sc) return;
        const go = () => {
            try { window.scrollTo(0, sc.y || 0); } catch (e) { }
            const a = getArea();
            if (a && sc.a) a.scrollTop = sc.a;
        };
        go();
        await new Promise(r => setTimeout(r, 400));
        go();
    }

    // ---------- 기록: 클릭 / 입력 ----------
    function inArea(el) {
        const a = getArea();
        return !!(a && el && a.contains(el));
    }
    function pushClick(n, a, mode) {
        if (!state) return;
        state.log = state.log.filter(x => {
            if (x.t !== 'c' || x.n !== n) return true;
            if (mode === 'set') return false;
            if (mode === 'set0') return String(x.a).split(',')[0] !== String(a).split(',')[0];
            return true;
        });
        state.log.push({ t: 'c', n, a });
        if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
        save();
    }
    function pushInput(entry) {
        if (!state) return;
        state.log = state.log.filter(x => !(x.t === entry.t && x.id === entry.id));
        state.log.push(entry);
        if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
        save();
    }
    function recordable(el) {
        if (!el || !el.id || !inArea(el)) return false;
        if (INPUT_EXCLUDE.test(el.id)) return false;
        if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') return false;
        if (el.closest('.fixed, [id*="modal" i], [id*="overlay" i], [id*="popup" i], [id*="sheet" i]')) return false;
        return true;
    }

    document.addEventListener('click', ev => {
        if (!recording || !state) return;
        const t = ev.target;
        if (!t || !t.closest) return;
        const host = t.closest('[onclick]');
        if (!host || !inArea(host)) return;
        const attr = host.getAttribute('onclick') || '';
        if (/confirm\(|prompt\(|=>|\bif\s*\(/.test(attr)) return;
        const re = /(Boako(?:\.\w+)+)\(((?:[^()]|\([^()]*\))*)\)/g;
        let m;
        while ((m = re.exec(attr))) {
            const mode = ALLOW[m[1]];
            if (!mode) continue;
            const a = m[2].trim();
            if (/\b(this|event)\b/.test(a)) continue;
            pushClick(m[1], a, mode);
        }
    }, true);

    function onInputLike(ev) {
        if (!recording || !state) return;
        const el = ev.target;
        if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || !recordable(el)) return;
        if (el.type === 'checkbox' || el.type === 'radio') pushInput({ t: 'i', id: el.id, c: el.checked });
        else pushInput({ t: 'i', id: el.id, v: el.value });
    }
    document.addEventListener('input', onInputLike, true);
    document.addEventListener('change', onInputLike, true);
    document.addEventListener('keydown', ev => {
        if (!recording || !state || ev.key !== 'Enter') return;
        const el = ev.target;
        if (!el || el.tagName !== 'INPUT' || !recordable(el)) return;
        pushInput({ t: 'k', id: el.id, v: el.value });
    }, true);

    // ---------- 기록: 스크롤 ----------
    let scrollTimer = null;
    function snapScroll() {
        if (!recording || !state) return;
        const a = getArea();
        state.scroll = { y: Math.round(window.scrollY || 0), a: a ? Math.round(a.scrollTop || 0) : 0 };
        save();
    }
    document.addEventListener('scroll', () => {
        if (!recording) return;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(snapScroll, 250);
    }, true);
    window.addEventListener('pagehide', snapScroll);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') snapScroll(); });

    // ---------- 화면 숨김(복원 중 깜빡임 방지) ----------
    function hideArea() {
        const a = getArea();
        if (a) a.style.visibility = 'hidden';
        setTimeout(showArea, 15000); // 안전장치
    }
    function showArea() {
        const a = getArea();
        if (a) a.style.visibility = '';
    }

    // ---------- PC ----------
    function safePayload(p) {
        if (p === undefined || p === null) return null;
        try {
            const s = JSON.stringify(p);
            if (s && s.length < 2000) return JSON.parse(s);
        } catch (e) { }
        return null;
    }

    function installPC() {
        const V = Boako.View;
        if (!V || typeof V.render !== 'function') return;
        const origRender = V.render;
        let first = true;

        V.render = async function (pageId, payload) {
            if (first) {
                first = false;
                const saved = state;
                if (pageId === 'main' && payload === undefined && saved && saved.page &&
                    saved.page.id && saved.page.id !== 'main') {
                    return restorePC(origRender, saved);
                }
                // 일반 부팅(저장된 화면 없음 / 소식지였음)
                if (!state) newPage({ id: pageId, payload: null });
                const r = await origRender.call(V, pageId, payload);
                recording = true;
                if (saved && saved.page && saved.page.id === 'main' && saved.scroll && saved.scroll.y) {
                    idle().then(() => applyScroll(saved.scroll));
                }
                return r;
            }
            if (recording) newPage({ id: pageId, payload: safePayload(payload) });
            return origRender.apply(V, arguments);
        };

        // 팀 화면 내부 탭 (채팅/대항전/챌린지 등)은 onclick 외에 코드에서도 호출되므로 함수 자체를 감쌈
        const origTab = V.switchTeamTab;
        if (typeof origTab === 'function') {
            V.switchTeamTab = function (tabId) {
                if (recording && state) pushClick('Boako.View.switchTeamTab', JSON.stringify(tabId), 'set');
                return origTab.apply(this, arguments);
            };
        }
    }

    async function restorePC(origRender, saved) {
        hideArea();
        recording = false;
        try {
            await origRender.call(Boako.View, saved.page.id, saved.page.payload === null ? undefined : saved.page.payload);
            await idle();
            await replay(saved.log);
            await idle(3000, 250);
            await applyScroll(saved.scroll);
        } catch (e) {
            console.warn('[StateRestore] 복원 실패, 소식지로 이동', e);
            try { await origRender.call(Boako.View, 'main'); } catch (e2) { }
            newPage({ id: 'main', payload: null });
            saved = state;
        } finally {
            state = saved;
            save();
            recording = true;
            showArea();
        }
    }

    // ---------- 모바일 ----------
    const M_FNS = ['switchTab', 'openTeamHub', 'openMessenger', 'openSearch', 'openPowerAnalysis',
        'openTeamList', 'openInventory', 'openTogether', 'openSchedule', 'openRival', 'openBoard',
        'openMatch', 'openLeague', 'openArchive', 'openShop'];

    function isFeedPage(p) { return p && p.fn === 'switchTab' && p.args && p.args[0] === 'feed'; }

    function installMobile() {
        const S = Boako.MobileShell;
        if (!S) return;
        const wantRestore = !!(state && state.page && state.page.fn && !isFeedPage(state.page));
        if (wantRestore) hideArea();

        M_FNS.forEach(fn => {
            const orig = S[fn];
            if (typeof orig !== 'function') return;
            S[fn] = function () {
                const args = Array.prototype.slice.call(arguments);
                // 부팅 시 init()이 자동으로 부르는 기본 탭(소식지)은, 복원할 화면이 있으면 건너뜀
                if (booting && fn === 'switchTab' && args[0] === 'feed' && wantRestore) return;
                if (recording) {
                    let a = args;
                    try { a = JSON.parse(JSON.stringify(args)); } catch (e) { a = []; }
                    const tab = fn === 'switchTab' ? args[0] : S.activeTab;
                    newPage({ fn, args: a }, tab);
                }
                return orig.apply(this, arguments);
            };
        });
    }

    async function restoreMobile(saved) {
        const S = Boako.MobileShell;
        recording = false;
        try {
            if (saved.tab) { S.activeTab = saved.tab; S.updateTabBarStyle && S.updateTabBarStyle(); }
            const fn = saved.page.fn;
            await S[fn].apply(S, saved.page.args || []);
            await idle();
            await replay(saved.log);
            await idle(3000, 250);
            await applyScroll(saved.scroll);
        } catch (e) {
            console.warn('[StateRestore] 복원 실패, 소식지로 이동', e);
            try { await S.switchTab('feed'); } catch (e2) { }
            newPage({ fn: 'switchTab', args: ['feed'] }, 'feed');
            saved = state;
        } finally {
            state = saved;
            save();
            recording = true;
            showArea();
        }
    }

    // 모바일: MobileShell.init()이 끝난 뒤 mobile_main.js가 호출
    function mobileReady() {
        const saved = state;
        const wantRestore = !!(saved && saved.page && saved.page.fn && !isFeedPage(saved.page));
        booting = false;
        if (wantRestore) { restoreMobile(saved); return; }
        if (!state) newPage({ fn: 'switchTab', args: ['feed'] }, 'feed');
        recording = true;
        if (saved && isFeedPage(saved.page) && saved.scroll && saved.scroll.y) {
            idle().then(() => applyScroll(saved.scroll));
        }
    }

    Boako.StateRestore = { mobileReady, _dump: () => state };

    if (MOBILE) installMobile();
    else installPC();
})();
