/**
 * [GAMES] 게임 목록 (PC) — games 테이블 조회(검색·정렬·페이지) + 관리자 수정
 * - 누구나: 이름 검색 / 정렬 / 상태 필터 / 협력만 보기 / 20개씩 페이지 / BGA 링크
 * - 관리자(profiles.is_admin): ✏️ 수정 (이름·웨이트·플레이타임·인원·협력·웨이트 미확정·상태)
 *   · 서버(RLS)가 관리자만 UPDATE 허용 → 화면에서 버튼을 숨기는 것은 편의용
 *   · 이름은 모든 연관 테이블이 ON UPDATE CASCADE 라서 함께 바뀜
 *   · 웨이트/플레이타임을 바꾸면 DB 트리거가 기존 전적에도 전파함
 */
Boako.Games = {
    State: { page: 1, pageSize: 20, total: 0, query: '', sort: 'name', status: '', coopOnly: false, isAdmin: false, rows: [], editing: null, loading: false },
    _searchTimer: null,

    SORTS: {
        name:     { col: 'game_name', asc: true },
        weight:   { col: 'weight', asc: false },
        playtime: { col: 'playtime', asc: false }
    },

    // 진입점 (view.js 에서 호출)
    init: async function() {
        const S = Boako.Games.State;
        S.page = 1; S.query = ''; S.sort = 'name'; S.status = ''; S.coopOnly = false;
        S.isAdmin = false;
        try {
            if (Boako.state.user) {
                const { data } = await Boako.db.from('profiles').select('is_admin').eq('id', Boako.state.user.id).single();
                S.isAdmin = !!(data && data.is_admin);
            }
        } catch (e) { console.warn('관리자 여부 조회 실패:', e); }
        Boako.Games.renderShell();
        await Boako.Games.load();
    },

    renderShell: function() {
        const root = document.getElementById('games-root');
        if (!root) return;
        const S = Boako.Games.State;
        root.innerHTML = `
            <div class="main-banner" style="flex-direction:column; gap:6px;">
                <h1>🎲 게임 목록</h1>
                <p id="games-sub" style="margin:0;">아카이브에 등록된 게임 · 웨이트와 협력 여부가 점수 계산에 반영됩니다</p>
            </div>
            <div class="section-card" style="padding:20px;">
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
                    <input id="games-q" oninput="Boako.Games.onSearchInput(this.value)" placeholder="게임 이름 검색" autocomplete="off"
                        style="flex:1; min-width:180px; border:2px solid #e2e8f0; border-radius:12px; padding:10px 14px; font-size:14px; font-weight:700; outline:none;">
                    <select onchange="Boako.Games.setSort(this.value)" style="border:2px solid #e2e8f0; border-radius:12px; padding:10px 12px; font-size:13px; font-weight:700; color:#475569;">
                        <option value="name">정렬: 이름순</option>
                        <option value="weight">웨이트 높은 순</option>
                        <option value="playtime">플레이타임 긴 순</option>
                    </select>
                    <select onchange="Boako.Games.setStatus(this.value)" style="border:2px solid #e2e8f0; border-radius:12px; padding:10px 12px; font-size:13px; font-weight:700; color:#475569;">
                        <option value="">전체 상태</option>
                        <option value="NORMAL">NORMAL</option>
                        <option value="BETA">BETA</option>
                        <option value="ALPHA">ALPHA</option>
                    </select>
                    <label style="display:flex; align-items:center; gap:6px; font-size:12px; font-weight:900; color:#475569; border:2px solid #e2e8f0; border-radius:12px; padding:0 12px; cursor:pointer;">
                        <input type="checkbox" onchange="Boako.Games.setCoop(this.checked)"> 협력만
                    </label>
                </div>
                <div id="games-list"></div>
                <div id="games-pager" style="margin-top:20px;"></div>
            </div>
            <div id="games-modal"></div>
        `;
    },

    onSearchInput: function(v) {
        clearTimeout(Boako.Games._searchTimer);
        Boako.Games._searchTimer = setTimeout(() => {
            Boako.Games.State.query = String(v || '').trim();
            Boako.Games.State.page = 1;
            Boako.Games.load();
        }, 300);
    },
    setSort: function(v) { Boako.Games.State.sort = Boako.Games.SORTS[v] ? v : 'name'; Boako.Games.State.page = 1; Boako.Games.load(); },
    setStatus: function(v) { Boako.Games.State.status = v; Boako.Games.State.page = 1; Boako.Games.load(); },
    setCoop: function(on) { Boako.Games.State.coopOnly = !!on; Boako.Games.State.page = 1; Boako.Games.load(); },
    goPage: function(p) { Boako.Games.State.page = p; Boako.Games.load(); const r = document.getElementById('games-root'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); },

    load: async function() {
        const S = Boako.Games.State;
        if (S.loading) return;
        S.loading = true;
        const listEl = document.getElementById('games-list');
        if (listEl) listEl.innerHTML = `<div style="text-align:center; padding:40px 0; color:#94a3b8; font-weight:700;">불러오는 중...</div>`;
        try {
            const sort = Boako.Games.SORTS[S.sort] || Boako.Games.SORTS.name;
            let q = Boako.db.from('games')
                .select('id, game_name, weight, min_players, max_players, playtime, is_cooperative, is_weight_unknown, game_status, image_url, bga_url', { count: 'exact' });
            if (S.query) q = q.ilike('game_name', '%' + S.query.replace(/[\\%_]/g, c => '\\' + c) + '%');
            if (S.status) q = q.eq('game_status', S.status);
            if (S.coopOnly) q = q.eq('is_cooperative', true);
            const from = (S.page - 1) * S.pageSize;
            const { data, count, error } = await q
                .order(sort.col, { ascending: sort.asc, nullsFirst: false })
                .order('game_name', { ascending: true })
                .range(from, from + S.pageSize - 1);
            if (error) throw error;
            S.rows = data || [];
            S.total = count || 0;
            Boako.Games.renderList();
        } catch (err) {
            console.error('게임 목록 로드 에러:', err);
            if (listEl) listEl.innerHTML = `<div style="text-align:center; padding:40px 0; color:#f87171; font-weight:700;">게임 목록을 불러오지 못했습니다.</div>`;
        } finally {
            S.loading = false;
        }
    },

    renderList: function() {
        const S = Boako.Games.State;
        const esc = Boako.Util.escapeHtml;
        const sub = document.getElementById('games-sub');
        if (sub) sub.textContent = `아카이브에 등록된 게임 ${S.total.toLocaleString()}개 · 웨이트와 협력 여부가 점수 계산에 반영됩니다`;

        const listEl = document.getElementById('games-list');
        if (!listEl) return;
        if (S.rows.length === 0) {
            listEl.innerHTML = `<div style="text-align:center; padding:50px 0; color:#94a3b8; font-weight:700;">검색 결과가 없습니다.</div>`;
        } else {
            listEl.innerHTML = S.rows.map(g => {
                const img = g.image_url ? Boako.Util.cdn(g.image_url) : '';
                const thumb = img
                    ? `<img src="${img}" loading="lazy" style="width:56px; height:56px; border-radius:12px; object-fit:cover; background:#f1f5f9;" onerror="this.outerHTML='<div style=&quot;width:56px;height:56px;border-radius:12px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:24px;&quot;>🎲</div>'">`
                    : `<div style="width:56px; height:56px; border-radius:12px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:24px;">🎲</div>`;
                const statusBadge = g.game_status && g.game_status !== 'NORMAL'
                    ? `<span style="font-size:10px; font-weight:900; padding:2px 6px; border-radius:6px; background:#fef3c7; color:#92400e;">${esc(g.game_status)}</span>` : '';
                const coopBadge = g.is_cooperative
                    ? `<span style="font-size:10px; font-weight:900; padding:2px 6px; border-radius:6px; background:#d1fae5; color:#065f46;">🤝 협력</span>` : '';
                const w = g.weight != null ? Number(g.weight).toFixed(2) : '-';
                const players = (g.min_players && g.max_players) ? `${g.min_players}~${g.max_players}인` : '-';
                const bga = g.bga_url && Boako.Util.safeUrl(g.bga_url)
                    ? `<a href="${Boako.Util.safeHref(g.bga_url)}" target="_blank" rel="noopener noreferrer" title="BGA 게임 페이지" class="p-2 hover:bg-indigo-600 hover:text-white bg-slate-50 rounded-lg text-slate-400 transition-all inline-block border border-slate-100 shadow-sm"><i data-lucide="external-link" class="w-3 h-3"></i></a>` : '';
                const edit = S.isAdmin
                    ? `<button onclick="Boako.Games.openEdit('${esc(String(g.id))}')" style="padding:8px 12px; font-size:12px; font-weight:900; border-radius:8px; border:1px solid #e2e8f0; color:#475569; background:#fff; cursor:pointer;">✏️ 수정</button>` : '';
                return `
                    <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid #f1f5f9;">
                        ${thumb}
                        <div style="min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-weight:900; color:#1e293b;">${esc(g.game_name)}</span>${statusBadge}${coopBadge}
                            </div>
                            <div style="font-size:12px; font-weight:700; color:#64748b; margin-top:4px;">
                                ⚖️ 웨이트 ${w}${g.is_weight_unknown ? ' <span style="color:#d97706;">(미확정)</span>' : ''} · 👥 ${players} · ⏱ ${g.playtime ? g.playtime + '분' : '-'}
                            </div>
                        </div>
                        ${bga}${edit}
                    </div>`;
            }).join('');
        }
        Boako.Games.renderPager();
        if (window.lucide) lucide.createIcons();
    },

    renderPager: function() {
        const S = Boako.Games.State;
        const el = document.getElementById('games-pager');
        if (!el) return;
        const last = Math.max(1, Math.ceil(S.total / S.pageSize));
        if (last <= 1) { el.innerHTML = ''; return; }
        const btn = (label, p, active, disabled) =>
            `<button ${disabled ? 'disabled' : `onclick="Boako.Games.goPage(${p})"`} style="padding:6px 12px; border-radius:8px; border:none; font-size:13px; font-weight:900; cursor:${disabled ? 'default' : 'pointer'};
                ${active ? 'background:#4f46e5; color:#fff;' : 'background:#f1f5f9; color:' + (disabled ? '#cbd5e1' : '#475569') + ';'}">${label}</button>`;
        const nums = new Set([1, last, S.page - 1, S.page, S.page + 1]);
        const arr = [...nums].filter(n => n >= 1 && n <= last).sort((a, b) => a - b);
        let html = btn('‹', S.page - 1, false, S.page <= 1);
        let prev = 0;
        arr.forEach(n => {
            if (n - prev > 1) html += `<span style="color:#94a3b8; font-weight:900;">…</span>`;
            html += btn(n, n, n === S.page, false);
            prev = n;
        });
        html += btn('›', S.page + 1, false, S.page >= last);
        el.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap;">${html}</div>
            <p style="text-align:center; font-size:11px; font-weight:700; color:#94a3b8; margin-top:8px;">${S.pageSize}개씩 · ${S.page}/${last} 쪽</p>`;
    },

    // ───────── 관리자 수정 ─────────
    openEdit: function(id) {
        const S = Boako.Games.State;
        if (!S.isAdmin) return;
        const g = S.rows.find(r => String(r.id) === String(id));
        if (!g) return;
        S.editing = g;
        const esc = Boako.Util.escapeHtml;
        const inp = 'width:100%; border:2px solid #e2e8f0; border-radius:12px; padding:10px 12px; font-size:14px; font-weight:700; box-sizing:border-box;';
        const lbl = 'display:block; font-size:12px; font-weight:900; color:#475569; margin-bottom:4px;';
        document.getElementById('games-modal').innerHTML = `
            <div style="position:fixed; inset:0; background:rgba(15,23,42,.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px; z-index:9999;">
                <div style="background:#fff; border-radius:16px; box-shadow:0 20px 50px rgba(0,0,0,.3); width:100%; max-width:440px; padding:24px; max-height:92vh; overflow:auto;">
                    <h3 style="font-size:18px; font-weight:900; color:#1e293b; margin:0 0 16px;">✏️ 게임 정보 수정</h3>
                    <label style="${lbl}">게임 이름</label>
                    <input id="gm-name" value="${esc(g.game_name)}" maxlength="60" style="${inp} margin-bottom:6px;">
                    <p style="font-size:11px; font-weight:700; color:#b45309; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px; margin:0 0 12px; line-height:1.5;">
                        이름을 바꾸면 전적·첫 승·토너먼트 등 모든 기록의 게임 이름이 함께 바뀝니다. 확장 프로그램이 BGA 원래 이름으로 보내는 경우 새 게임이 중복 등록될 수 있으니 주의하세요.
                    </p>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                        <div><label style="${lbl}">웨이트</label><input id="gm-weight" type="number" step="0.01" min="0" max="10" value="${g.weight != null ? Number(g.weight) : ''}" style="${inp}"></div>
                        <div><label style="${lbl}">플레이타임(분)</label><input id="gm-playtime" type="number" step="1" min="1" value="${g.playtime ?? ''}" style="${inp}"></div>
                        <div><label style="${lbl}">최소 인원</label><input id="gm-min" type="number" step="1" min="1" value="${g.min_players ?? ''}" style="${inp}"></div>
                        <div><label style="${lbl}">최대 인원</label><input id="gm-max" type="number" step="1" min="1" value="${g.max_players ?? ''}" style="${inp}"></div>
                    </div>
                    <p style="font-size:11px; font-weight:700; color:#64748b; margin:0 0 12px;">웨이트·플레이타임을 바꾸면 이 게임의 기존 전적 점수에도 반영됩니다.</p>
                    <div style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; margin-bottom:20px; font-size:14px; font-weight:700; color:#334155;">
                        <label style="display:flex; align-items:center; gap:6px;"><input id="gm-coop" type="checkbox" ${g.is_cooperative ? 'checked' : ''}> 협력 게임</label>
                        <label style="display:flex; align-items:center; gap:6px;"><input id="gm-unknown" type="checkbox" ${g.is_weight_unknown ? 'checked' : ''}> 웨이트 미확정</label>
                        <select id="gm-status" style="border:2px solid #e2e8f0; border-radius:12px; padding:6px 10px; font-size:14px; font-weight:700;">
                            ${['NORMAL', 'BETA', 'ALPHA'].map(s => `<option value="${s}" ${g.game_status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="Boako.Games.closeEdit()" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; font-size:14px; font-weight:900; border:none; border-radius:12px; cursor:pointer;">취소</button>
                        <button id="gm-save" onclick="Boako.Games.saveEdit()" style="flex:1; padding:12px; background:#4f46e5; color:#fff; font-size:14px; font-weight:900; border:none; border-radius:12px; cursor:pointer;">저장</button>
                    </div>
                </div>
            </div>`;
    },

    closeEdit: function() {
        const m = document.getElementById('games-modal');
        if (m) m.innerHTML = '';
        Boako.Games.State.editing = null;
    },

    saveEdit: async function() {
        const S = Boako.Games.State;
        const g = S.editing;
        if (!S.isAdmin || !g) return;
        const val = id => document.getElementById(id);

        const name = val('gm-name').value.trim();
        const unknown = val('gm-unknown').checked;
        const weight = unknown ? 1 : parseFloat(val('gm-weight').value);
        const playtime = parseInt(val('gm-playtime').value, 10);
        const minP = parseInt(val('gm-min').value, 10);
        const maxP = parseInt(val('gm-max').value, 10);

        if (!name || name.length > 60 || /[<>"]/.test(name)) { Boako.Util.toast('게임 이름을 확인해 주세요. (1~60자, < > " 사용 불가)'); return; }
        if (!(weight > 0 && weight <= 10)) { Boako.Util.toast('웨이트는 0보다 크고 10 이하여야 합니다.'); return; }
        if (!(playtime >= 1 && playtime <= 1000)) { Boako.Util.toast('플레이타임은 1~1000분으로 입력해 주세요.'); return; }
        if (!(minP >= 1 && maxP >= minP && maxP <= 99)) { Boako.Util.toast('인원 범위를 확인해 주세요.'); return; }

        if (name !== g.game_name && !confirm(`게임 이름을 변경합니다.\n\n"${g.game_name}" → "${name}"\n\n모든 전적·첫 승·토너먼트의 게임 이름이 함께 바뀝니다. 계속할까요?`)) return;

        const btn = val('gm-save');
        if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
        try {
            const { data, error } = await Boako.db.from('games').update({
                game_name: name,
                weight: weight,
                is_weight_unknown: unknown,
                playtime: playtime,
                min_players: minP,
                max_players: maxP,
                is_cooperative: val('gm-coop').checked,
                game_status: val('gm-status').value,
                updated_by: Boako.state.user.id,
                updated_at: new Date().toISOString()
            }).eq('id', g.id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('수정 권한이 없거나 대상을 찾을 수 없습니다.');
            Boako.Games.closeEdit();
            Boako.Util.toast('✅ 게임 정보를 저장했습니다.');
            await Boako.Games.load();
        } catch (err) {
            console.error('게임 수정 에러:', err);
            Boako.Util.toast('❌ 저장에 실패했습니다: ' + (err.message || ''));
            if (btn) { btn.disabled = false; btn.textContent = '저장'; }
        }
    }
};
