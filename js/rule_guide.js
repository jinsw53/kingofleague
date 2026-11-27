/**
 * 🌟 [신규 2026-11-28] 📖 룰 가이드 — 게시판 '공략' 탭 안에 깃뿔(룰 마스터) 위젯을 넣는다
 *
 * - 공략 탭 게임 그리드: 깃뿔에 가이드가 있는 게임에 "📖 가이드" 표시, 공략글이 없어도 가이드가 있으면 목록에 나온다.
 * - 게임을 고르면 맨 위에 접힌 "룰 가이드" 카드 → 펼치면 깃뿔 위젯 (그 아래는 기존 공략글 목록).
 * - 로그인 회원: rulemaster-proxy 의 wiki_token 으로 받은 회원 토큰을 위젯에 넘겨 위젯 안에서 바로 고친다 (기록엔 가명만).
 *   비로그인: 공개 위젯 키(허용 도메인 boakoarchive.co.kr)로 보기·질문만, 고치기는 로그인 안내(wiki_edit.js)로 간다.
 * - 위젯 파일은 깃뿔 서버(rulemaster-widget)에서 받아 위젯이 바뀌면 저절로 반영된다. 못 받으면 아카이브 사본으로 대신한다.
 * - 게시판 게임 이름과 깃뿔 게임 제목은 띄어쓰기·대소문자를 무시하고 맞춘다.
 */
Boako.RuleGuide = (() => {
    const BASE = 'https://jxunyqtfteynvuweafdy.supabase.co/functions/v1';
    const API = BASE + '/rulemaster-api';
    const WIDGET_SRC = BASE + '/rulemaster-widget';
    const WIDGET_FALLBACK = '/js/rulemaster-widget.js';
    const WIDGET_KEY = 'rmw_54d0fe651a2ac60f8794814e'; // 공개용 위젯 키 (브라우저에 두는 값, 비밀 아님)
    const esc = (s) => Boako.Util.escapeHtml(s);
    const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

    let gamesPromise = null;
    const openState = {}; // 게임별 펼침 상태 (이번 방문 동안)

    // 깃뿔에 가이드가 있는 본판 목록 [{id, title}] — 실패하면 빈 목록 (게시판은 그대로 동작)
    function listGames() {
        if (!gamesPromise) {
            gamesPromise = fetch(API + '/v1/games', { headers: { 'x-widget-key': WIDGET_KEY } })
                .then((r) => (r.ok ? r.json() : { games: [] }))
                .then((b) => (b.games || []).filter((g) => !g.parent_game_id && g.game_type !== 'expansion').map((g) => ({ id: g.id, title: g.title })))
                .catch(() => { gamesPromise = null; return []; });
        }
        return gamesPromise;
    }
    async function findByName(name) {
        const n = norm(name);
        if (!n) return null;
        return (await listGames()).find((g) => norm(g.title) === n) || null;
    }

    function loadWidget() {
        if (window.RuleMaster) return Promise.resolve();
        const add = (src) => new Promise((ok, no) => {
            const s = document.createElement('script');
            s.src = src; s.onload = ok; s.onerror = () => { s.remove(); no(new Error(src)); };
            document.head.appendChild(s);
        });
        return add(WIDGET_SRC).catch(() => add(WIDGET_FALLBACK));
    }

    async function getToken() {
        const { data: { session } } = await Boako.db.auth.getSession();
        if (!session) return null;
        const res = await fetch(Boako.config.url + '/functions/v1/rulemaster-proxy', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + session.access_token },
            body: JSON.stringify({ action: 'wiki_token' }),
        });
        const b = await res.json().catch(() => ({}));
        if (res.status !== 200 || !b.token) throw new Error('토큰을 받지 못했어요');
        return b.token;
    }

    // 접힌 룰 가이드 카드를 el 안에 그린다
    async function renderCard(el, game) {
        if (!el || !game) return;
        const open = !!openState[game.id];
        el.innerHTML = `<div style="background:#fff; border:1px solid #ddd6fe; border-radius:14px; margin-bottom:14px; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:14px; padding:14px 16px; flex-wrap:wrap;">
                <span style="width:44px; height:44px; border-radius:12px; background:#f5f3ff; display:flex; align-items:center; justify-content:center; font-size:22px; flex:none;">📖</span>
                <div style="flex:1; min-width:180px;">
                    <div style="font-size:16px; font-weight:900; color:#1e293b;">${esc(game.title)} 룰 가이드</div>
                    <div style="font-size:13px; color:#64748b; margin-top:2px;">규칙을 그림으로 보고, 헷갈리는 상황은 AI에게 물어보세요. AI는 정리된 규칙만 근거로 답해요.</div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                        ${['게임 준비', '게임 방법', '헷갈리는 규칙', '게임 정보'].map((t) => `<span style="font-size:12px; font-weight:700; color:#6d28d9; background:#f5f3ff; padding:3px 9px; border-radius:999px;">${t}</span>`).join('')}
                        <span style="font-size:12px; font-weight:700; color:#fff; background:#7c3aed; padding:3px 9px; border-radius:999px;">🤖 AI 규칙 질문</span>
                    </div>
                </div>
                <button type="button" data-rg-toggle style="border:0; border-radius:10px; padding:10px 16px; font-weight:800; font-size:14px; cursor:pointer; white-space:nowrap; ${open ? 'background:#ede9fe; color:#5b21b6;' : 'background:#7c3aed; color:#fff;'}">${open ? '접기' : '📖 룰 가이드 펼치기'}</button>
            </div>
            <div data-rg-body style="border-top:1px solid #ede9fe; padding:12px;" ${open ? '' : 'hidden'}>
                <div data-rg-widget><div style="color:#94a3b8; font-size:13px; padding:8px;">불러오는 중...</div></div>
                <div data-rg-note style="font-size:12px; color:#64748b; padding:8px 4px 0;"></div>
            </div>
        </div>`;
        el.querySelector('[data-rg-toggle]').onclick = () => { openState[game.id] = !open; renderCard(el, game); };
        if (!open) return;

        const slot = el.querySelector('[data-rg-widget]');
        const note = el.querySelector('[data-rg-note]');
        try {
            await loadWidget();
            const { data: { session } } = await Boako.db.auth.getSession();
            note.textContent = session
                ? '로그인한 회원이라 글마다 ✎ 고치기가 바로 열려요. 고친 기록에는 이름 대신 가명만 남아요.'
                : '틀린 내용이 있으면 ✎ 고치기를 눌러 로그인하고 고칠 수 있어요.';
            slot.innerHTML = '<div></div>';
            const opts = { api: API, gameId: game.id, widgetKey: WIDGET_KEY, brand: '룰 가이드', accent: '#7c3aed' };
            if (session) opts.getToken = getToken;
            window.RuleMaster.mount(slot.firstChild, opts);
        } catch (e) {
            slot.innerHTML = '<div style="color:#dc2626; font-size:13px; padding:8px;">룰 가이드를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>';
        }
    }

    return { listGames, findByName, renderCard };
})();
