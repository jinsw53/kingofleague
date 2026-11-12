/**
 * [SPONSOR] 헤더 검색창 옆 후원 배너 — 노출 + 관리자 전용 관리창
 */
Boako.Sponsor = {
    banners: [],
    isAdmin: false,

    init: async function() {
        if (!Boako.db) {
            setTimeout(() => Boako.Sponsor.init(), 500);
            return;
        }
        await Boako.Sponsor.loadActive();
        Boako.Sponsor.render();   // 관리자 여부 조회를 기다리지 않고 먼저 노출

        if (Boako.state.user) {
            const { data: profile } = await Boako.db.from('profiles').select('is_admin').eq('id', Boako.state.user.id).single();
            Boako.Sponsor.isAdmin = !!(profile && profile.is_admin);
        }
    },

    loadActive: async function() {
        const { data } = await Boako.db.from('sponsor_banners')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        Boako.Sponsor.banners = data || [];
    },

    // 🌟 [개선] 노출 중인 후원 배너를 검색바 오른쪽의 남는 공간 전체를 써서 전광판처럼 오른쪽→왼쪽으로 흘려보냄
    //   (예전엔 첫 번째 1장만 고정 노출했음). 배너가 1장이면 그대로 고정. 마우스를 올리면 멈춤.
    SCROLL_PX_PER_SEC: 45,   // 흐르는 속도
    GAP_PX: 56,              // 배너 사이 간격

    render: function() {
        const area = document.getElementById('sponsor-banner-area');
        if (!area) return;

        const list = Boako.Sponsor.banners || [];
        if (list.length === 0) { area.innerHTML = ''; return; }

        // 남는 공간을 모두 차지(검색바는 자기 크기 그대로) — 넘치는 부분은 잘리고 양쪽 끝은 서서히 투명해짐
        area.style.flex = '1 1 0';
        area.style.minWidth = '0';
        area.style.overflow = 'hidden';

        const itemHtml = (b) => `
            <a class="sponsor-item" href="${Boako.Util.safeHref(b.link_url)}" target="${b.link_url ? '_blank' : '_self'}" rel="noopener"
               style="flex:0 0 auto; display:flex; align-items:center; height:56px;">
                <img src="${Boako.Util.cdn(b.image_url)}" alt="${Boako.Util.escapeHtml(b.name)}" style="max-height:56px; max-width:200px; object-fit:contain; display:block;" draggable="false">
            </a>`;

        // 1장이면 오른쪽 끝에 고정
        if (list.length === 1) {
            area.style.webkitMaskImage = area.style.maskImage = '';
            area.innerHTML = `<div style="display:flex; justify-content:flex-end; align-items:center; height:56px;">${itemHtml(list[0])}</div>`;
            return;
        }

        const setHtml = list.map(itemHtml).join('');
        area.style.webkitMaskImage = area.style.maskImage = 'linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)';
        area.innerHTML = `<div id="sponsor-track" style="display:flex; align-items:center; gap:${Boako.Sponsor.GAP_PX}px; width:max-content; height:56px; will-change:transform;">${setHtml}</div>`;

        const track = document.getElementById('sponsor-track');
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        track.addEventListener('mouseenter', () => { track.style.animationPlayState = 'paused'; });
        track.addEventListener('mouseleave', () => { track.style.animationPlayState = 'running'; });

        // 이미지 크기를 알아야 폭을 계산할 수 있으므로 모두 불러온 뒤(실패한 이미지는 제외) 흐름 시작
        const imgs = Array.from(track.querySelectorAll('img'));
        Promise.all(imgs.map(img => img.complete ? Promise.resolve() :
            new Promise(res => { img.onload = res; img.onerror = () => { const a2 = img.closest('.sponsor-item'); if (a2) a2.remove(); res(); }; })
        )).then(() => {
            if (!document.getElementById('sponsor-track') || reduceMotion) return;
            const oneSetW = track.scrollWidth + Boako.Sponsor.GAP_PX;      // 1세트 폭(마지막 간격 포함)
            const boxW = area.clientWidth || 300;
            if (!oneSetW || track.children.length === 0) return;
            // 한 줄이 보이는 영역보다 짧으면 이어 붙이는 틈이 보이므로 세트를 반복해서 채움
            const repeat = Math.max(1, Math.ceil(boxW / oneSetW));
            const half = setHtml.repeat(repeat);
            track.innerHTML = half + half;                                  // 앞 절반만큼 이동하면 제자리로 돌아와 끊김 없이 순환
            track.querySelectorAll('img').forEach(i => { i.onerror = () => { const a3 = i.closest('.sponsor-item'); if (a3) a3.style.display = 'none'; }; });
            const distance = oneSetW * repeat;
            const dur = Math.max(8, distance / Boako.Sponsor.SCROLL_PX_PER_SEC);
            const styleId = 'sponsor-marquee-style';
            let st = document.getElementById(styleId);
            if (!st) { st = document.createElement('style'); st.id = styleId; document.head.appendChild(st); }
            st.textContent = `@keyframes sponsor-marquee { from { transform: translateX(0); } to { transform: translateX(-${distance}px); } }`;
            track.style.animation = `sponsor-marquee ${dur}s linear infinite`;
        });
    },

    openManageModal: async function() {
        const { data: all } = await Boako.db.from('sponsor_banners').select('*').order('display_order', { ascending: true });
        const list = all || [];

        const modalHtml = `
            <div id="sponsor-manage-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-black text-lg">⚙ 후원 배너 관리</h3>
                        <button onclick="document.getElementById('sponsor-manage-overlay').remove()" class="text-slate-400 font-black text-xl">×</button>
                    </div>

                    <div id="sponsor-manage-list" class="flex flex-col gap-2 mb-4">
                        ${list.length === 0 ? `<div class="text-center py-6 text-slate-400 font-bold text-sm">등록된 배너가 없습니다.</div>` : list.map(b => `
                            <div class="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2">
                                <img src="${Boako.Util.cdn(b.image_url)}" style="width:40px; height:40px; object-fit:contain; background:#f8fafc; border-radius:6px;">
                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-sm truncate">${Boako.Util.escapeHtml(b.name)}</div>
                                    <div class="text-[11px] text-slate-400">${b.is_active ? '노출중' : '숨김'} · 순서 ${b.display_order}</div>
                                </div>
                                <button onclick="Boako.Sponsor.editBanner(${b.id})" class="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg">수정</button>
                                <button onclick="Boako.Sponsor.deleteBanner(${b.id})" class="text-xs font-bold bg-rose-50 text-rose-500 px-3 py-1.5 rounded-lg">삭제</button>
                            </div>
                        `).join('')}
                    </div>

                    <button onclick="Boako.Sponsor.editBanner(null)" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-2.5 rounded-xl text-sm">+ 새 배너 추가</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    editBanner: async function(id) {
        let banner = { id: null, name: '', image_url: '', link_url: '', is_active: true, display_order: 0 };
        if (id) {
            const { data } = await Boako.db.from('sponsor_banners').select('*').eq('id', id).single();
            if (data) banner = data;
        }

        const formHtml = `
            <div id="sponsor-edit-overlay" class="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-sm p-6">
                    <h3 class="font-black text-base mb-4">${id ? '배너 수정' : '새 배너 추가'}</h3>
                    <input type="hidden" id="sponsor-form-id" value="${banner.id || ''}">
                    <label class="text-xs font-bold text-slate-500 block mb-1">후원사명</label>
                    <input type="text" id="sponsor-form-name" value="${Boako.Util.escapeHtml(banner.name)}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                    <label class="text-xs font-bold text-slate-500 block mb-1">이미지 URL</label>
                    <input type="text" id="sponsor-form-image" value="${banner.image_url}" placeholder="https://..." class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                    <label class="text-xs font-bold text-slate-500 block mb-1">클릭 시 이동 링크 (선택)</label>
                    <input type="text" id="sponsor-form-link" value="${banner.link_url || ''}" placeholder="https://..." class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                    <label class="text-xs font-bold text-slate-500 block mb-1">노출 순서 (낮을수록 먼저)</label>
                    <input type="number" id="sponsor-form-order" value="${banner.display_order}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                    <label class="flex items-center gap-2 text-sm font-bold text-slate-600 mb-4">
                        <input type="checkbox" id="sponsor-form-active" ${banner.is_active ? 'checked' : ''}> 노출 중
                    </label>
                    <div class="flex gap-2">
                        <button onclick="document.getElementById('sponsor-edit-overlay').remove()" class="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-sm">취소</button>
                        <button onclick="Boako.Sponsor.saveBanner()" class="flex-[2] bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 rounded-xl text-sm">저장</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', formHtml);
    },

    saveBanner: async function() {
        const id = document.getElementById('sponsor-form-id').value || null;
        const name = document.getElementById('sponsor-form-name').value.trim();
        const image_url = document.getElementById('sponsor-form-image').value.trim();
        const link_url = document.getElementById('sponsor-form-link').value.trim() || null;
        const display_order = parseInt(document.getElementById('sponsor-form-order').value) || 0;
        const is_active = document.getElementById('sponsor-form-active').checked;

        if (!name || !image_url) { Boako.Util.toast('후원사명과 이미지 URL은 필수입니다.'); return; }

        try {
            const { error } = await Boako.db.rpc('fn_upsert_sponsor_banner', {
                p_id: id ? Number(id) : null,
                p_name: name,
                p_image_url: image_url,
                p_link_url: link_url,
                p_is_active: is_active,
                p_display_order: display_order
            });
            if (error) throw error;

            Boako.Util.toast('✅ 저장되었습니다.');
            document.getElementById('sponsor-edit-overlay').remove();
            document.getElementById('sponsor-manage-overlay')?.remove();
            await Boako.Sponsor.loadActive();
            Boako.Sponsor.render();
            await Boako.Sponsor.openManageModal();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '저장에 실패했습니다.'));
        }
    },

    deleteBanner: async function(id) {
        if (!confirm('이 배너를 삭제하시겠어요?')) return;
        try {
            const { error } = await Boako.db.rpc('fn_delete_sponsor_banner', { p_id: id });
            if (error) throw error;
            Boako.Util.toast('삭제되었습니다.');
            document.getElementById('sponsor-manage-overlay')?.remove();
            await Boako.Sponsor.loadActive();
            Boako.Sponsor.render();
            await Boako.Sponsor.openManageModal();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '삭제에 실패했습니다.'));
        }
    }
};

window.addEventListener('load', () => {
    setTimeout(() => Boako.Sponsor.init(), 800);
});
