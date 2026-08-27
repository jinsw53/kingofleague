/**
 * [MOBILE SHOP] 모바일 전용 — 포인트 샵
 * 🌟 [재사용 범위] js/shop.js는 순수 "구매 처리 로직"(Boako.Shop.buyItem 및 서포터즈/도전권/
 *    슬롯확장/타이틀스폰서 전용 모달들)만 담고 있고, 상품 목록 자체를 그리는 부분은 PC view.js의
 *    case 'shop' 안에 직접 박혀 있어서(별도 함수가 아님) 함수 호출로 재사용할 수 없음 — 그래서
 *    목록/포인트 내역 렌더링 부분만 PC와 동일한 쿼리로 이 파일에 재구현하고, 실제 구매 동작
 *    (Boako.Shop.buyItem 및 모든 하위 모달·확정 함수)은 전혀 손대지 않고 그대로 재사용함.
 * 🌟 [버그 회피 불필요] shop.js의 각 구매 확정 함수가 끝에서 부르는 Boako.Auth.renderWidget()/
 *    Boako.View.render('shop')는 mobile_shell.js에서 이미 모바일 세션 전체에 안전한 버전으로
 *    재정의해뒀음(드로어 갱신 / 조용히 무시) — 이 화면에서 개별적으로 우회할 필요가 없음. 다만
 *    Boako.View.render는 "현재 화면을 새로고침"하는 역할이었으므로, 구매 후 목록에 즉시 반영되게
 *    하려면 이 화면 자신의 render()를 다시 호출해주는 게 좋아 여기서만 별도로 재호출을 붙여둠.
 */
window.Boako = window.Boako || {};
Boako.MobileShop = {

    render: async (container) => {
        if (!Boako.state.user) {
            container.innerHTML = `
                <div style="background:linear-gradient(135deg,#f59e0b,#d97706); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff;">
                    <div style="font-size:17px; font-weight:900;">🛒 포인트 샵</div>
                </div>
                <div style="padding:60px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">🔒 로그인 후 이용할 수 있어요.</div>
            `;
            return;
        }

        // 🌟 core.js가 미리 Boako.Shop = {}로 이름을 예약해두는 구조라, 반드시 구체적 메서드
        // (.buyItem) 존재 여부로 체크해야 함 (mobile_team_list.js에서 겪은 것과 동일한 함정)
        if (!Boako.Shop || !Boako.Shop.buyItem) await Boako.Util.loadScript('/js/shop.js');

        // 🌟 구매 완료 후 이 화면을 다시 그려서 상품 목록/포인트 내역이 즉시 갱신되도록 대상 저장
        // (실제 재호출은 파일 하단의 Boako.View.render 래핑이 담당)
        Boako.MobileShop._reRenderTarget = container;

        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;

        try {
            const { data: myProfile } = await Boako.db.from('profiles').select('points').eq('id', Boako.state.user.id).single();
            const myPoints = myProfile?.points || 0;

            const { data: pointHistory } = await Boako.db.from('point_history')
                .select('*')
                .eq('user_id', Boako.state.user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            const { data: shopItems } = await Boako.db.from('shop_items')
                .select('*')
                .eq('is_active', true)
                .order('price', { ascending: true, nullsFirst: false });

            // 🌟 서포터즈 카드용: 현재 진행 중인 시즌의 유니폼 이미지 조회 (PC와 동일 로직)
            let currentSeasonUniform = null;
            const hasSupporterItem = (shopItems || []).some(i => i.item_type === 'SUPPORTER');
            if (hasSupporterItem) {
                const now = new Date().toISOString();
                const { data: currentSeasonRow } = await Boako.db.from('seasons')
                    .select('uniform_image_url').lte('start_date', now).gte('end_date', now).maybeSingle();
                currentSeasonUniform = currentSeasonRow?.uniform_image_url || null;
            }

            // 🌟 타이틀 스폰서 카드용: 입찰 대상 시즌(마감 전, 가장 가까운 시즌)의 로고 조회 (PC와 동일 로직)
            let titleSponsorSeasonLogo = null;
            const hasTitleSponsorItem = (shopItems || []).some(i => i.item_type === 'TITLE_SPONSOR');
            if (hasTitleSponsorItem) {
                const deadlineCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                const { data: sponsorSeasonRow } = await Boako.db.from('seasons')
                    .select('season_logo_url').gt('start_date', deadlineCutoff)
                    .order('start_date', { ascending: true }).limit(1).maybeSingle();
                titleSponsorSeasonLogo = sponsorSeasonRow?.season_logo_url || null;
            }

            const itemCardsHtml = (shopItems || []).map(item => {
                const isSupporter = item.item_type === 'SUPPORTER';
                const isTitleSponsor = item.item_type === 'TITLE_SPONSOR';

                const supporterIconHtml = `
                    <div style="width:100%; height:100%; position:relative; ${currentSeasonUniform ? `background-image:url('${Boako.Util.cdn(currentSeasonUniform)}'); background-size:contain; background-repeat:no-repeat; background-position:center;` : ''}">
                        ${!currentSeasonUniform ? `<svg width="100%" height="100%" viewBox="0 0 100 100" style="position:absolute; top:0; left:0;"><path d="M50 22 L60 22 L74 30 L68 42 L60 37 L60 78 L40 78 L40 37 L32 42 L26 30 L40 22 Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/></svg>` : ''}
                    </div>
                `;
                const titleSponsorIconHtml = `
                    <div style="width:100%; height:100%; position:relative; background-image:url('${Boako.Util.cdn(item.icon)}'); background-size:contain; background-repeat:no-repeat; background-position:center;">
                        ${titleSponsorSeasonLogo ? `<img src="${Boako.Util.cdn(titleSponsorSeasonLogo)}" style="position:absolute; top:50%; left:14%; width:48%; height:87%; object-fit:contain; transform:translate(-50%, -50%) rotate(-90deg);">` : ''}
                    </div>
                `;

                return `
                    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; display:flex; flex-direction:column; text-align:center;">
                        <div style="flex:1; padding:20px;">
                            <div style="width:70px; height:70px; font-size:50px; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                ${isSupporter ? supporterIconHtml
                                    : isTitleSponsor ? titleSponsorIconHtml
                                    : (item.icon && item.icon.startsWith('http')
                                        ? `<img src="${Boako.Util.cdn(item.icon)}" style="width:100%; height:100%; object-fit:contain;">`
                                        : (item.icon || '❓'))}
                            </div>
                            <div style="font-size:16px; font-weight:900; margin-bottom:6px; color:#1e293b;">${Boako.MobileShop.escapeHtml(item.name)}</div>
                            <div style="color:#64748b; font-size:12.5px; word-break:keep-all; line-height:1.5;">${Boako.MobileShop.escapeHtml(item.description || '')}</div>
                        </div>
                        <div style="padding:14px; border-top:1px solid #f1f5f9; background:#fafafa;">
                            <button onclick="Boako.Shop.buyItem('${item.item_id}')" style="width:100%; padding:12px; font-size:13.5px; font-weight:900; color:#fff; background:linear-gradient(135deg,#f59e0b,#d97706); border-radius:10px;">
                                ${item.t_price != null
                                    ? `🛡️ 팀 포인트 ${Number(item.t_price).toLocaleString()} P`
                                    : `💎 ${Number(item.price).toLocaleString()} P 구매`}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            const historyHtml = (!pointHistory || pointHistory.length === 0)
                ? `<div style="text-align:center; padding:30px 0; color:#94a3b8; font-weight:700; font-size:12.5px;">이용 내역이 없습니다.</div>`
                : pointHistory.map(log => {
                    const date = new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                    const isPlus = log.point_change > 0;
                    const color = isPlus ? '#10b981' : '#ef4444';
                    const sign = isPlus ? '+' : '';
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9;">
                            <div>
                                <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-bottom:3px;">${date}</div>
                                <div style="font-size:13px; font-weight:800; color:#334155;">${Boako.MobileShop.escapeHtml(log.description)}</div>
                            </div>
                            <div style="font-size:14px; font-weight:900; color:${color}; flex-shrink:0; padding-left:10px;">${sign}${log.point_change.toLocaleString()} P</div>
                        </div>
                    `;
                }).join('');

            container.innerHTML = `
                <div style="background:linear-gradient(135deg,#f59e0b,#d97706); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff;">
                    <div style="font-size:17px; font-weight:900;">🛒 프리미엄 포인트 샵</div>
                    <div style="margin-top:10px; font-size:14px; font-weight:800; background:rgba(0,0,0,0.2); padding:6px 14px; border-radius:20px; display:inline-block;">
                        내 지갑: <span style="color:#fde047;">${myPoints.toLocaleString()} P</span>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
                    ${itemCardsHtml}
                </div>

                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:16px;">
                    <div style="font-size:14px; font-weight:900; color:#1e293b; margin-bottom:8px;">🧾 최근 포인트 이용 내역</div>
                    ${historyHtml}
                </div>
            `;
        } catch (e) {
            console.error('모바일 포인트 샵 로드 실패:', e);
            container.innerHTML = `<div style="text-align:center; padding:40px 16px; color:#ef4444; font-weight:700; font-size:13px;">불러오지 못했습니다.</div>`;
        }
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};

// 🌟 [버그 회피] shop.js의 각 구매 확정 함수가 끝에서 부르는 Boako.View.render('shop')는
// mobile_shell.js에서 전역적으로 "조용히 무시"하도록 재정의돼있어 에러는 안 나지만, 그러면
// 구매 후에도 화면이 그대로 남아있어(포인트 차감/내역 갱신이 안 보임) 사용자가 성공 여부를
// 헷갈릴 수 있음 — Boako.View.render를 한 번 더 감싸서, 'shop' 페이지 요청이 오면 지금 보고
// 있는 모바일 포인트 샵 화면도 같이 다시 그려주도록 연결(다른 페이지 요청은 기존처럼 무시).
// 이 파일은 항상 mobile_shell.js의 init()이 Boako.View.render를 정의한 뒤에만 지연 로딩되므로
// (openShop()을 통해서만 로드됨) 그 시점엔 이미 정의돼있는 게 보장됨.
if (Boako.View && Boako.View.render && !Boako.View.render._mobileShopWrapped) {
    const originalViewRender = Boako.View.render;
    const wrappedViewRender = async (page, payload) => {
        await originalViewRender(page, payload);
        if (page === 'shop' && Boako.MobileShop._reRenderTarget) {
            await Boako.MobileShop.render(Boako.MobileShop._reRenderTarget);
        }
    };
    wrappedViewRender._mobileShopWrapped = true;
    Boako.View.render = wrappedViewRender;
}
