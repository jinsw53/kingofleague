/**
 * 🌟 [신규 2026-11-28] 깃뿔 규칙 위키 고치기 창
 *
 * 어느 사이트의 깃뿔 위젯이든 "고치기 ↗"를 누르면 아카이브의 /?wiki_type=chapter|answer&wiki_id=<id> 로 온다.
 *   1) 주소의 대상을 localStorage 에 잠깐 적어 두고 주소에서는 지운다 (카카오 로그인 후 돌아와도 이어서 열리게)
 *   2) 로그인 안 했으면 "카카오로 로그인하고 고치기" 안내
 *   3) 로그인했으면 rulemaster-proxy 의 wiki_token 으로 깃뿔 회원 토큰을 받는다
 *      (깃뿔에는 회원 ID 대신 서버에서 만든 가명만 간다 — 개인정보처리방침 제3조)
 *   4) 깃뿔 API 에서 글 하나(/v1/wiki-item)를 읽어 고치고(/v1/edit) 저장한다
 * PC(Auth.init)와 모바일(mobile_main) 둘 다 Boako.WikiEdit.check() 를 부른다.
 */
Boako.WikiEdit = (() => {
    const KEY = 'boako.wikiEdit';
    const PROXY = () => Boako.config.url + '/functions/v1/rulemaster-proxy';
    const esc = (s) => Boako.Util.escapeHtml(s);

    function readPending() {
        try {
            const p = JSON.parse(localStorage.getItem(KEY) || 'null');
            // 하루 지난 건 버림
            if (p && p.type && p.id && Date.now() - (p.at || 0) < 86400000) return p;
        } catch (e) { /* 저장소를 못 쓰는 브라우저 */ }
        return null;
    }
    function savePending(p) { try { localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() })); } catch (e) { /* 무시 */ } }
    function clearPending() { try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } }

    function close() {
        const el = document.getElementById('wiki-edit-modal');
        if (el) el.remove();
    }
    function shell(inner) {
        close();
        const el = document.createElement('div');
        el.id = 'wiki-edit-modal';
        el.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:16px;';
        el.innerHTML = `<div style="background:#fff; color:#1e293b; width:100%; max-width:640px; max-height:92vh; overflow:auto; border-radius:16px; padding:22px 20px; box-shadow:0 20px 50px rgba(0,0,0,.25); font-size:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px;">
                <div style="font-size:17px; font-weight:900;">📖 규칙 위키 고치기</div>
                <button type="button" data-x="close" style="border:none; background:none; font-size:20px; cursor:pointer; color:#94a3b8;">✕</button>
            </div>
            <div data-body>${inner}</div>
        </div>`;
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.closest('[data-x="close"]')) { clearPending(); close(); }
        });
        document.body.appendChild(el);
        return el.querySelector('[data-body]');
    }

    async function proxy(action, extra = {}) {
        const { data: { session } } = await Boako.db.auth.getSession();
        const res = await fetch(PROXY(), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(session ? { authorization: 'Bearer ' + session.access_token } : {}) },
            body: JSON.stringify({ action, ...extra }),
        });
        let body = {};
        try { body = await res.json(); } catch (e) { /* 빈 응답 */ }
        return { status: res.status, body };
    }

    async function open(p) {
        const { data: { session } } = await Boako.db.auth.getSession();
        if (!session) {
            const b = shell(`<p style="margin:0 0 14px; line-height:1.7;">보드게임 규칙 위키 <b>깃뿔</b>의 글은 보아코 아카이브 회원이 고칩니다.<br>로그인하면 이 글을 바로 고칠 수 있어요.</p>
                <button type="button" data-x="login" style="width:100%; padding:13px; border:none; border-radius:12px; background:#fee500; color:#191600; font-weight:800; font-size:15px; cursor:pointer;">🟡 카카오로 로그인하고 고치기</button>
                <p style="margin:12px 0 0; font-size:12px; color:#64748b;">고친 기록에는 이름 대신 가명만 남아요. <a href="/privacy.html" target="_blank" rel="noopener" style="color:#64748b;">개인정보처리방침</a></p>`);
            b.querySelector('[data-x="login"]').onclick = () => Boako.Auth.login();
            return;
        }
        const b = shell('<p style="color:#64748b;">불러오는 중...</p>');
        const tk = await proxy('wiki_token');
        if (tk.status !== 200) { b.innerHTML = `<p>위키 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요. (${esc(tk.body.error || tk.status)})</p>`; return; }
        const api = tk.body.api_url, headers = { 'content-type': 'application/json', 'x-widget-token': tk.body.token };
        const r = await fetch(`${api}/v1/wiki-item?type=${encodeURIComponent(p.type)}&id=${encodeURIComponent(p.id)}`, { headers });
        const it = await r.json().catch(() => ({}));
        if (r.status !== 200) { clearPending(); b.innerHTML = `<p>고칠 글을 찾지 못했어요. (${esc(it.message || r.status)})</p>`; return; }
        if (it.locked) { clearPending(); b.innerHTML = '<p>🔒 운영자가 잠근 글이라 지금은 고칠 수 없어요.</p>'; return; }

        const isChapter = it.type === 'chapter';
        const field = 'width:100%; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:10px; padding:9px 11px; font:inherit; font-size:14px;';
        b.innerHTML = `<div style="font-size:12px; color:#7c3aed; font-weight:800; margin-bottom:6px;">${esc(it.game_title || '')}</div>
            ${it.question ? `<div style="background:#f8fafc; border-radius:10px; padding:10px 12px; margin-bottom:10px;"><b>질문</b> ${esc(it.question)}</div>` : ''}
            <form style="display:flex; flex-direction:column; gap:8px;">
                ${isChapter ? `<input name="t" maxlength="200" placeholder="제목" style="${field}">` : ''}
                <textarea name="x" maxlength="${isChapter ? 20000 : 4000}" style="${field} min-height:240px; line-height:1.6; resize:vertical;"></textarea>
                <input name="n" maxlength="300" placeholder="고친 이유 (선택)" style="${field}">
                <p style="margin:0; font-size:12px; color:#64748b; line-height:1.6;">고친 내용은 깃뿔을 쓰는 다른 사이트에도 보이고, 기록에는 가명만 남아요. 저장하면 <a href="/terms.html" target="_blank" rel="noopener" style="color:#64748b;">이용약관</a> 제5조(위키 수정)에 동의한 것으로 봐요.</p>
                <div data-msg style="font-size:13px; font-weight:700; color:#dc2626;"></div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" data-x="close" style="padding:10px 16px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; cursor:pointer;">취소</button>
                    <button type="submit" style="padding:10px 18px; border-radius:10px; border:none; background:#7c3aed; color:#fff; font-weight:800; cursor:pointer;">저장</button>
                </div>
            </form>`;
        const f = b.querySelector('form'), msg = b.querySelector('[data-msg]');
        if (f.t) f.t.value = it.title || '';
        f.x.value = it.text || '';
        f.onsubmit = async (e) => {
            e.preventDefault();
            const text = f.x.value.trim();
            if (text.length < 2) { msg.textContent = '내용이 너무 짧아요.'; return; }
            const sb = f.querySelector('[type=submit]'); sb.disabled = true;
            const body = { type: it.type, id: it.id, text, note: f.n.value.trim() || undefined };
            if (f.t) body.title = f.t.value.trim() || undefined;
            const res = await fetch(`${api}/v1/edit`, { method: 'POST', headers, body: JSON.stringify(body) });
            const out = await res.json().catch(() => ({}));
            sb.disabled = false;
            if (res.status === 200) {
                clearPending(); close();
                Boako.Util.toast(out.unchanged ? '바뀐 내용이 없어요.' : '고쳤어요! 깃뿔 위키에 바로 반영됐어요. 🙌');
            } else {
                msg.textContent = res.status === 423 ? '운영자가 잠근 글이라 고칠 수 없어요.'
                    : res.status === 429 ? '오늘 고칠 수 있는 횟수를 다 썼어요.'
                    : res.status === 401 ? '로그인이 만료됐어요. 창을 닫고 다시 시도해 주세요.'
                    : (out.message || '저장하지 못했어요.');
            }
        };
    }

    // 주소에 고칠 대상이 있거나, 로그인하러 갔다 돌아온 경우 창을 연다
    async function check() {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('wiki_type'), id = params.get('wiki_id');
        if ((type === 'chapter' || type === 'answer') && /^[0-9a-f-]{36}$/i.test(id || '')) {
            savePending({ type, id });
            params.delete('wiki_type'); params.delete('wiki_id');
            const q = params.toString();
            history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
        }
        const p = readPending();
        if (p) await open(p);
    }

    return { check, open };
})();
