/**
 * 🌟 [신규 2026-11-28] 📖 룰 가이드 — 깃뿔(룰 마스터) 위젯을 아카이브 메뉴 안에 넣은 화면
 *
 * - 게임 목록은 깃뿔 GET /v1/games (공개 위젯 키, 허용 도메인 boakoarchive.co.kr)에서 본판만 골라 칩으로 보여 준다.
 * - 로그인 회원: rulemaster-proxy 의 wiki_token 으로 받은 회원 토큰을 위젯에 넘긴다
 *   → 질문·제보·위키 고치기가 회원 가명으로 기록되고, 위젯 안에서 바로 고칠 수 있다.
 * - 비로그인: 공개 위젯 키로 보기·질문만. 고치기는 아카이브 로그인 안내(wiki_edit.js)로 간다.
 * PC(view.js 'rule_guide')와 모바일(MobileShell.openRuleGuide) 둘 다 render(container)를 부른다.
 */
Boako.RuleGuide = (() => {
    const API = 'https://jxunyqtfteynvuweafdy.supabase.co/functions/v1/rulemaster-api';
    const WIDGET_KEY = 'rmw_54d0fe651a2ac60f8794814e'; // 공개용 위젯 키 (브라우저에 두는 값, 비밀 아님)
    const LAST = 'boako.ruleGuide.game';
    const esc = (s) => Boako.Util.escapeHtml(s);

    async function loadWidget() {
        if (!window.RuleMaster) await Boako.Util.loadScript('/js/rulemaster-widget.js');
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

    async function render(container) {
        if (!container) return;
        container.innerHTML = `<div style="max-width:880px; margin:0 auto; padding:16px 12px;">
            <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
                <div>
                    <div style="font-size:20px; font-weight:900;">📖 룰 가이드</div>
                    <div style="font-size:13px; color:#64748b; margin-top:2px;">게임 준비부터 헷갈리는 규칙까지 그림으로 보고, 상황을 물어보세요.</div>
                </div>
            </div>
            <div data-games style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;"><span style="color:#94a3b8; font-size:13px;">게임 불러오는 중...</span></div>
            <div data-widget></div>
            <div data-note style="font-size:12px; color:#94a3b8; margin-top:10px;"></div>
        </div>`;
        const gamesEl = container.querySelector('[data-games]');
        const slot = container.querySelector('[data-widget]');
        const note = container.querySelector('[data-note]');

        let games = [];
        try {
            await loadWidget();
            const res = await fetch(API + '/v1/games', { headers: { 'x-widget-key': WIDGET_KEY } });
            const b = await res.json();
            if (res.status !== 200) throw new Error(b.message || res.status);
            games = (b.games || []).filter((g) => !g.parent_game_id && g.game_type !== 'expansion');
        } catch (e) {
            gamesEl.innerHTML = `<span style="color:#dc2626; font-size:13px;">룰 가이드를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</span>`;
            return;
        }
        if (!games.length) { gamesEl.innerHTML = '<span style="color:#94a3b8; font-size:13px;">아직 정리된 게임이 없어요.</span>'; return; }

        const { data: { session } } = await Boako.db.auth.getSession();
        note.innerHTML = session
            ? '로그인한 회원은 글을 바로 고칠 수 있어요. 고친 기록에는 이름 대신 가명만 남아요.'
            : '로그인하면 틀린 내용을 직접 고칠 수 있어요.';

        let saved = null;
        try { saved = localStorage.getItem(LAST); } catch (e) { /* 무시 */ }
        let current = games.some((g) => g.id === saved) ? saved : games[0].id;

        const drawChips = () => {
            gamesEl.innerHTML = games.map((g) => {
                const on = g.id === current;
                return `<button type="button" data-id="${esc(g.id)}" style="padding:8px 14px; border-radius:999px; border:1px solid ${on ? '#7c3aed' : '#e2e8f0'}; background:${on ? '#7c3aed' : '#fff'}; color:${on ? '#fff' : '#334155'}; font-weight:800; font-size:13px; cursor:pointer;">${esc(g.title)}</button>`;
            }).join('');
        };
        const mountGame = () => {
            // 위젯은 자리마다 한 번만 붙이므로 게임을 바꿀 때 새 자리를 만든다
            slot.innerHTML = '<div></div>';
            const opts = { api: API, gameId: current, widgetKey: WIDGET_KEY, brand: '룰 가이드', accent: '#7c3aed' };
            if (session) opts.getToken = getToken;
            window.RuleMaster.mount(slot.firstChild, opts);
        };
        gamesEl.onclick = (e) => {
            const b = e.target.closest('button[data-id]');
            if (!b || b.dataset.id === current) return;
            current = b.dataset.id;
            try { localStorage.setItem(LAST, current); } catch (err) { /* 무시 */ }
            drawChips(); mountGame();
        };
        drawChips(); mountGame();
    }

    return { render };
})();
