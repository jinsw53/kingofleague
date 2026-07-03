/**
 * [SHOP] 포인트 샵 기능 (지연 로딩 아키텍처 적용)
 */
Boako.Shop = {
    // 구매 로직
    buyItem: async (itemId) => {
        const user = Boako.state.user;
        if (!user) return Boako.Util.toast("🔒 로그인이 필요합니다.");

        try {
            // 1) DB에서 아이템 정보 가져오기 (item_id 기준)
            const { data: targetItem, error: itemErr } = await Boako.db.from('shop_items')
                .select('*')
                .eq('item_id', itemId)
                .single();
                
if (itemErr || !targetItem) return Boako.Util.toast("판매하지 않는 아이템입니다.");
            if (!targetItem.is_active) return Boako.Util.toast("현재 판매가 중단된 아이템입니다.");

            // 서포터즈 뱃지는 완전히 다른 흐름(팀 선택 모달)으로 분기
            if (targetItem.item_type === 'SUPPORTER') {
                return Boako.Shop.openSupporterModal(targetItem);
            }

            // 도전권은 팀 포인트(t_price)로, 팀장만 구매 가능한 흐름으로 분기
            if (targetItem.item_type === 'CHALLENGE_TOKEN') {
                return Boako.Shop.openChallengeTokenModal(targetItem);
            }

            // 2) 내 포인트 및 현재 슬롯 개수 같이 조회
            const { data: profile, error: profErr } = await Boako.db.from('profiles')
                .select('points, unlocked_badge_slots')
                .eq('id', user.id)
                .single();
            if (profErr) throw profErr;

            const currentPoints = profile.points || 0;
            const currentSlots = profile.unlocked_badge_slots || 1;

            // 3) 잔액 부족 체크
            if (currentPoints < targetItem.price) {
                return Boako.Util.toast(`❌ 포인트가 부족합니다. (필요: ${targetItem.price} P)`);
            }

            // 4) 아이템 타입에 따른 구매 프로세스 분기
            
            // ==========================================
            // ⚡ [티켓 / 업그레이드] 즉시 실행 (지연 로딩 방식)
            // ==========================================
            if (targetItem.item_type === 'TICKET' || targetItem.item_type === 'UPGRADE') {
                if (!confirm(`[경고] ${targetItem.name}은(는) 즉시 사용/적용됩니다.\n${targetItem.price} P를 사용하여 진행하시겠습니까?`)) {
                    return; 
                }

                // ① 서랍에 기능이 있는지 확인
                let actionFunc = Boako.ItemActions[targetItem.item_id];
                
                // ② 서랍에 없다면? 지금 바로 파일을 다운로드한다! (지연 로딩)
                if (!actionFunc) {
                    try {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = `js/actions/${targetItem.item_id}.js`; // 아이템 ID와 동일한 파일명 호출
                            script.onload = resolve;
                            script.onerror = () => reject(new Error("스크립트 파일을 찾을 수 없습니다."));
                            document.head.appendChild(script);
                        });
                        // 파일이 다운로드되며 서랍을 채웠을 테니 다시 꺼냄
                        actionFunc = Boako.ItemActions[targetItem.item_id];
                    } catch (e) {
                        console.error("액션 파일 로드 실패:", e);
                        return Boako.Util.toast("해당 아이템의 기능을 불러오지 못했습니다.");
                    }
                }

                // ③ 서랍에서 기능을 무사히 꺼냈다면 실행!
                if (actionFunc) {
                    try {
                        // 액션 함수 실행 (취소 시 여기서 Error를 던짐)
                        await actionFunc(user, targetItem, currentSlots);
                        
                        // 성공적으로 실행되었으니 결제 진행
                        await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                        await Boako.db.from('point_history').insert([{
                            user_id: user.id, point_change: -targetItem.price, description: `[아이템 즉시 사용] ${targetItem.name}`
                        }]);
                        
if (window.sfx) window.sfx.buy();
                        Boako.Util.toast(`✅ ${targetItem.name} 사용 완료!`);
                        Boako.Auth.renderWidget(); 
                        Boako.View.render('shop');

                    } catch (error) {
                        // 액션 로직 내부에서 취소했거나 에러가 났을 때 방어
                        if (error.message !== "취소") {
                            Boako.Util.toast("실행 오류: " + error.message);
                        }
                    }
                } else {
                    return Boako.Util.toast("아직 시스템에 구현되지 않은 아이템입니다.");
                }

            } 
            // ==========================================
            // 🎒 [배지, 색상 등] 인벤토리 보관형
            // ==========================================
            else {
                if (confirm(`[${targetItem.name}] 아이템을 ${targetItem.price} P에 구매하시겠습니까?`)) {
                    
                    // 결제 진행
                    await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                    await Boako.db.from('point_history').insert([{
                        user_id: user.id, point_change: -targetItem.price, description: `[상점 구매] ${targetItem.name}`
                    }]);

                    // 인벤토리 저장 로직
                    const { data: existItem } = await Boako.db.from('inventory')
                        .select('*').eq('user_id', user.id).eq('item_id', itemId).maybeSingle();

                    if (existItem) {
                        await Boako.db.from('inventory').update({ quantity: existItem.quantity + 1 }).eq('id', existItem.id);
                    } else {
                        await Boako.db.from('inventory').insert([{
                            user_id: user.id, item_id: itemId, item_type: targetItem.item_type, quantity: 1
                        }]);
                    }

                    if (window.sfx) window.sfx.buy();
                    Boako.Util.toast("🎁 구매 완료! 인벤토리에 지급되었습니다.");
                    Boako.View.render('shop');
                }
            }
        } catch (err) {
            console.error(err);
            Boako.Util.toast("오류가 발생했습니다: " + err.message);
        }
    },

    // 서포터즈 팀 선택/금액 입력 모달
    openSupporterModal: async (targetItem) => {
        const user = Boako.state.user;

        const { data: teams } = await Boako.db.from('teams').select('id, team_name, logo_url').order('team_name');
        const { data: profile } = await Boako.db.from('profiles').select('points').eq('id', user.id).single();
        const myPoints = profile?.points || 0;

        const teamOptionsHtml = (teams || []).map(t =>
            `<option value="${t.id}">${t.team_name}</option>`
        ).join('');

        const modalHtml = `
            <div id="supporter-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onclick="if(event.target===this) Boako.Shop.closeSupporterModal()">
                <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div class="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 flex items-center justify-between">
                        <h3 class="font-black text-white text-base flex items-center gap-2">🎗️ 팀 서포터즈 되기</h3>
                        <button onclick="Boako.Shop.closeSupporterModal()" class="text-white/70 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <div class="p-6 space-y-5">
                        <div>
                            <label class="block text-xs font-black text-slate-700 mb-1.5">🛡️ 응원할 팀</label>
                            <select id="supporter-team-select" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-violet-500 cursor-pointer shadow-inner">
                                ${teamOptionsHtml}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-black text-slate-700 mb-1.5">💰 후원 금액 (1000P 단위)</label>
                            <input type="number" id="supporter-amount-input" min="1000" step="1000" value="1000" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-violet-500 shadow-inner" oninput="Boako.Shop.updateSupporterPreview()">
                            <p class="text-[10px] text-slate-400 font-bold mt-1.5">내 보유 포인트: ${myPoints.toLocaleString()} P</p>
                        </div>
                        <div id="supporter-preview" class="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs font-bold text-violet-700">
                            1000P 후원 시 <span class="text-violet-900">30일</span>간 유효한 뱃지를 받습니다.
                        </div>
                        <button onclick="Boako.Shop.confirmSupporterPurchase()" class="w-full bg-slate-900 hover:bg-black text-white font-black text-sm py-3.5 rounded-xl shadow-lg transition-all">
                            🎗️ 서포터즈 되기
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
    },

    closeSupporterModal: () => {
        document.getElementById('supporter-modal-backdrop')?.remove();
    },

    // 도전권 구매 모달 (팀장 전용, t_price로 팀 포인트 사용)
    openChallengeTokenModal: async (targetItem) => {
        const isLeader = Boako.state.team?.type === 'LEADER';
        if (!isLeader) {
            return Boako.Util.toast("🔒 팀장만 도전권을 구매할 수 있습니다.");
        }

        const teamId = Boako.state.team.info.id;
        const { data: teamInfo } = await Boako.db.from('teams').select('tpoint, challengetokens').eq('id', teamId).single();
        const teamPoints = teamInfo?.tpoint || 0;
        const currentTokens = teamInfo?.challengetokens || 0;

        const modalHtml = `
            <div id="token-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onclick="if(event.target===this) Boako.Shop.closeTokenModal()">
                <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div class="bg-gradient-to-r from-amber-500 to-orange-600 p-5 flex items-center justify-between">
                        <h3 class="font-black text-white text-base flex items-center gap-2">
                            <img src="${targetItem.icon}" class="w-6 h-6"> 도전권 구매
                        </h3>
                        <button onclick="Boako.Shop.closeTokenModal()" class="text-white/70 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <div class="p-6 space-y-5">
                        <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <div class="text-[10px] font-black text-amber-500 uppercase tracking-wider">우리 팀 금고</div>
                                <div class="text-lg font-black text-amber-800">${teamPoints.toLocaleString()} P</div>
                            </div>
                            <div class="text-right">
                                <div class="text-[10px] font-black text-slate-400 uppercase tracking-wider">보유 도전권</div>
                                <div class="text-lg font-black text-slate-700 flex items-center gap-1 justify-end">
                                    <img src="${targetItem.icon}" class="w-4 h-4">${currentTokens}개
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-black text-slate-700 mb-1.5">구매 개수 (개당 ${Number(targetItem.t_price).toLocaleString()}P)</label>
                            <input type="number" id="token-amount-input" min="1" step="1" value="1" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 shadow-inner" oninput="Boako.Shop.updateTokenPreview(${targetItem.t_price})">
                        </div>

                        <div id="token-preview" class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-600">
                            총 <span class="text-amber-600">${Number(targetItem.t_price).toLocaleString()} P</span> 소모하여 도전권 <span class="text-amber-600">1개</span>를 획득합니다.
                        </div>

                        <button onclick="Boako.Shop.confirmTokenPurchase()" class="w-full bg-slate-900 hover:bg-black text-white font-black text-sm py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            <img src="${targetItem.icon}" class="w-4 h-4"> 도전권 구매하기
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
    },

    closeTokenModal: () => {
        document.getElementById('token-modal-backdrop')?.remove();
    },

    updateTokenPreview: (pricePerToken) => {
        const input = document.getElementById('token-amount-input');
        const preview = document.getElementById('token-preview');
        const amount = parseInt(input?.value, 10);

        if (!amount || amount <= 0) {
            preview.innerHTML = `<span class="text-rose-600">1개 이상 입력해주세요.</span>`;
            return;
        }
        const cost = amount * pricePerToken;
        preview.innerHTML = `총 <span class="text-amber-600">${cost.toLocaleString()} P</span> 소모하여 도전권 <span class="text-amber-600">${amount}개</span>를 획득합니다.`;
    },

    confirmTokenPurchase: async () => {
        const input = document.getElementById('token-amount-input');
        const amount = parseInt(input?.value, 10);

        if (!amount || amount <= 0) return Boako.Util.toast('구매 개수를 입력해주세요.');

        try {
            const { data, error } = await Boako.db.rpc('purchase_challenge_token', { p_amount: amount });
            if (error) throw error;

            if (window.sfx) window.sfx.buy();
            Boako.Util.toast(`✅ 도전권 ${data.purchased_tokens}개 구매 완료! (${data.total_cost.toLocaleString()}P 소모)`);
            Boako.Shop.closeTokenModal();
            Boako.Auth.renderWidget();

        } catch (err) {
            console.error(err);
            Boako.Util.toast('구매 실패: ' + err.message);
        }
    },

    updateSupporterPreview: () => {
        const input = document.getElementById('supporter-amount-input');
        const preview = document.getElementById('supporter-preview');
        const amount = parseInt(input?.value, 10);

        if (!amount || amount < 1000 || amount % 1000 !== 0) {
            preview.innerHTML = `<span class="text-rose-600">1000의 배수로 입력해주세요.</span>`;
            return;
        }
        const days = (amount / 1000) * 30;
        preview.innerHTML = `${amount.toLocaleString()}P 후원 시 <span class="text-violet-900">${days}일</span>간 유효한 뱃지를 받습니다.`;
    },

    confirmSupporterPurchase: async () => {
        const teamSelect = document.getElementById('supporter-team-select');
        const amountInput = document.getElementById('supporter-amount-input');
        const teamId = Number(teamSelect?.value);
        const amount = parseInt(amountInput?.value, 10);

        if (!teamId) return Boako.Util.toast('응원할 팀을 선택해주세요.');
        if (!amount || amount < 1000 || amount % 1000 !== 0) return Boako.Util.toast('1000P 단위로 입력해주세요.');

        try {
            const { data, error } = await Boako.db.rpc('purchase_supporter_badge', {
                p_target_team_id: teamId,
                p_amount: amount
            });
            if (error) throw error;

            if (window.sfx) window.sfx.buy();
            Boako.Util.toast(`✅ 서포터즈 등록 완료! ${data.net_to_team.toLocaleString()}P가 팀에 후원되었습니다.`);
            Boako.Shop.closeSupporterModal();
            Boako.Auth.renderWidget();
            Boako.View.render('shop');

        } catch (err) {
            console.error(err);
            Boako.Util.toast('구매 실패: ' + err.message);
        }
    }
};
