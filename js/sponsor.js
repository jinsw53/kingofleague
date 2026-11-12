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

    // 🌟 [개선] 노출 중인 후원 배너가 여러 장이면 같은 자리에서 display_order 순서대로 돌아가며 보여줌
    //   (예전엔 첫 번째 1장만 고정 노출했음). 1장이면 그대로 고정. 한 장당 노출 시간: ROTATE_MS.
    ROTATE_MS: 5000,
    _timer: null,
    _index: 0,

    render: function() {
        const area = document.getElementById('sponsor-banner-area');
        if (!area) return;

        if (Boako.Sponsor._timer) { clearInterval(Boako.Sponsor._timer); Boako.Sponsor._timer = null; }

        const list = Boako.Sponsor.banners || [];
        if (list.length === 0) { area.innerHTML = ''; return; }

        // 모든 배너를 같은 자리(높이 56px)에 겹쳐 놓고 투명도로 전환 — 배너가 바뀌어도 헤더 레이아웃이 움직이지 않음
        const itemsHtml = list.map((b, i) => `
            <a class="sponsor-slide" data-idx="${i}" href="${Boako.Util.safeHref(b.link_url)}" target="${b.link_url ? '_blank' : '_self'}" rel="noopener"
               style="position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-end; transition:opacity .6s ease; opacity:${i === 0 ? 1 : 0}; pointer-events:${i === 0 ? 'auto' : 'none'};">
                <img src="${Boako.Util.cdn(b.image_url)}" alt="${Boako.Util.escapeHtml(b.name)}" style="max-height:56px; max-width:200px; object-fit:contain;">
            </a>`).join('');

        area.innerHTML = `<div id="sponsor-rotator" style="position:relative; height:56px; width:200px;">${itemsHtml}</div>`;

        Boako.Sponsor._index = 0;
        if (list.length < 2) return;

        const show = (next) => {
            const slides = area.querySelectorAll('.sponsor-slide');
            slides.forEach((el, i) => {
                const on = i === next;
                el.style.opacity = on ? 1 : 0;
                el.style.pointerEvents = on ? 'auto' : 'none';
            });
            Boako.Sponsor._index = next;
        };

        let hovering = false;
        const box = document.getElementById('sponsor-rotator');
        box.addEventListener('mouseenter', () => { hovering = true; });
        box.addEventListener('mouseleave', () => { hovering = false; });

        Boako.Sponsor._timer = setInterval(() => {
            if (document.hidden || hovering) return;        // 탭이 가려져 있거나 마우스를 올려둔 동안은 멈춤
            if (!document.getElementById('sponsor-rotator')) { clearInterval(Boako.Sponsor._timer); Boako.Sponsor._timer = null; return; }
            show((Boako.Sponsor._index + 1) % list.length);
        }, Boako.Sponsor.ROTATE_MS);
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
