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

            // 2) 내 포인트는 화면 표시/사전 안내용으로만 조회 (실제 차감/검증은 서버 RPC가 원자적으로 처리)
            const { data: profile, error: profErr } = await Boako.db.from('profiles')
                .select('points, unlocked_badge_slots')
                .eq('id', user.id)
                .single();
            if (profErr) throw profErr;

            const currentPoints = profile.points || 0;
            const currentSlots = profile.unlocked_badge_slots || 1;

            // 3) 잔액 부족 사전 안내 (진짜 검증은 서버에서 한 번 더 원자적으로 함)
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
                        
                        // 🌟 [수정] 결제는 서버 RPC가 원자적으로 처리 (잔액 재검증 + 차감 + 내역 기록을 한 트랜잭션에서)
                        const { error: purchaseErr } = await Boako.db.rpc('fn_purchase_shop_item', { p_item_id: itemId });
                        if (purchaseErr) throw purchaseErr;
                        
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

                    // 🌟 [수정] 결제 + 인벤토리 지급을 서버 RPC 한 번으로 원자적 처리
                    // (예전엔 클라이언트가 직접 profiles.points를 계산해서 UPDATE했는데,
                    //  그러면 누구든 자기 포인트를 직접 조작할 수 있는 취약점이 있었음)
                    const { error: purchaseErr } = await Boako.db.rpc('fn_purchase_shop_item', { p_item_id: itemId });
                    if (purchaseErr) throw purchaseErr;

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

    // 서포터즈 팀 선택/금액 입력 모달 (검색형 카드 그리드 + 실시간 뱃지 미리보기)
    openSupporterModal: async (targetItem) => {
        const user = Boako.state.user;

        const { data: teams } = await Boako.db.from('teams').select('id, team_name, logo_url').order('team_name');
        const { data: profile } = await Boako.db.from('profiles').select('points').eq('id', user.id).single();
        const myPoints = profile?.points || 0;

        const now = new Date().toISOString();
        const { data: currentSeason } = await Boako.db
            .from('seasons')
            .select('season_no, uniform_image_url')
            .lte('start_date', now)
            .gte('end_date', now)
            .maybeSingle();

        const rankMap = {};
        if (currentSeason) {
            const { data: rankRows } = await Boako.db
                .from('v_season_current_ranking')
                .select('team_name, total_lp')
                .eq('season_no', currentSeason.season_no)
                .order('total_lp', { ascending: false });
            (rankRows || []).forEach((r, idx) => { rankMap[r.team_name] = idx + 1; });
        }

        Boako.Shop._supporterState = {
            teams: teams || [],
            rankMap,
            uniformImage: currentSeason?.uniform_image_url || null,
            selectedTeamId: null,
            myPoints
        };

        const modalHtml = `
            <div id="supporter-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onclick="if(event.target===this) Boako.Shop.closeSupporterModal()">
                <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div class="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 flex items-center justify-between shrink-0">
                        <h3 class="font-black text-white text-base flex items-center gap-2">📣 팀 서포터즈 되기</h3>
                        <button onclick="Boako.Shop.closeSupporterModal()" class="text-white/70 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>

                    <div class="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">

                        <div id="supporter-preview-card" class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                            <div id="supporter-preview-badge" class="w-20 h-20 shrink-0"></div>
                            <div class="flex-1 min-w-0">
                                <div id="supporter-preview-name" class="font-black text-slate-400 text-sm">응원할 팀을 선택하세요</div>
                                <div id="supporter-preview-rank" class="text-[11px] font-bold text-slate-400 mt-1"></div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-black text-slate-700 mb-1.5">🛡️ 응원할 팀 검색</label>
                            <div class="relative mb-3">
                                <input type="text" id="supporter-team-search" placeholder="팀 이름으로 검색..." class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-violet-500 shadow-inner" oninput="Boako.Shop.renderSupporterTeamGrid()">
                                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"></i>
                            </div>
                            <div id="supporter-team-grid" class="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar"></div>
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
                            📣 서포터즈 되기
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        Boako.Shop.renderSupporterTeamGrid();
        setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
    },

    closeSupporterModal: () => {
        document.getElementById('supporter-modal-backdrop')?.remove();
        Boako.Shop._supporterState = null;
    },

    getUniformPreviewHTML: (teamLogo, uniformImage, size) => {
        const uniformBg = uniformImage
            ? `background-image:url('${Boako.Util.cdn(uniformImage)}'); background-size:contain; background-repeat:no-repeat; background-position:center;`
            : '';
        const fallbackSilhouette = !uniformImage ? `
            <svg width="${size}" height="${size}" viewBox="0 0 100 100" style="position:absolute; top:0; left:0;">
                <path d="M50 22 L60 22 L74 30 L68 42 L60 37 L60 78 L40 78 L40 37 L32 42 L26 30 L40 22 Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
            </svg>
        ` : '';
        return `
            <div style="width:${size}; height:${size}; position:relative; display:flex; align-items:center; justify-content:center;">
                ${fallbackSilhouette}
                <div style="width:${size}; height:${size}; position:relative; ${uniformBg}">
                    ${teamLogo ? `<img src="${Boako.Util.cdn(teamLogo)}" style="position:absolute; top:48%; left:50%; transform:translate(-50%,-50%); width:42%; height:42%; object-fit:contain;">` : ''}
                </div>
            </div>
        `;
    },

    renderSupporterTeamGrid: () => {
        const state = Boako.Shop._supporterState;
        const grid = document.getElementById('supporter-team-grid');
        if (!state || !grid) return;

        const keyword = document.getElementById('supporter-team-search')?.value.trim().toLowerCase() || '';
        const filtered = keyword
            ? state.teams.filter(t => t.team_name.toLowerCase().includes(keyword))
            : state.teams;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-3 text-center py-8 text-slate-400 text-xs font-bold">검색된 팀이 없습니다.</div>`;
            return;
        }

        const DEFAULT_LOGO = Boako.Util.cdn('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png');

        grid.innerHTML = filtered.map(t => {
            const isSelected = state.selectedTeamId === t.id;
            const rank = state.rankMap[t.team_name];
            const rankBadge = rank
                ? `<span class="absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ${rank === 1 ? 'bg-amber-400 text-white' : rank === 2 ? 'bg-slate-400 text-white' : rank === 3 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'}">${rank}위</span>`
                : '';

            return `
                <div onclick="Boako.Shop.selectSupporterTeam(${t.id})" class="relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-violet-600 bg-violet-50 shadow-md' : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-sm'}">
                    ${rankBadge}
                    <img src="${Boako.Util.cdn(t.logo_url) || DEFAULT_LOGO}" class="w-10 h-10 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1">
                    <span class="text-[10px] font-black text-slate-700 text-center truncate w-full">${t.team_name}</span>
                </div>
            `;
        }).join('');
    },

    selectSupporterTeam: (teamId) => {
        const state = Boako.Shop._supporterState;
        if (!state) return;
        state.selectedTeamId = teamId;

        const team = state.teams.find(t => t.id === teamId);
        const rank = team ? state.rankMap[team.team_name] : null;

        const badgeEl = document.getElementById('supporter-preview-badge');
        const nameEl = document.getElementById('supporter-preview-name');
        const rankEl = document.getElementById('supporter-preview-rank');

        if (badgeEl && team) badgeEl.innerHTML = Boako.Shop.getUniformPreviewHTML(team.logo_url, state.uniformImage, '80px');
        if (nameEl && team) nameEl.innerHTML = `<span class="text-violet-700">${team.team_name}</span> 서포터즈 뱃지`;
        if (rankEl) rankEl.innerText = rank ? `현재 시즌 실시간 순위 🏅 ${rank}위` : '이번 시즌 아직 순위 집계 전';

        if (window.sfx) window.sfx.click();
        Boako.Shop.renderSupporterTeamGrid();
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
                            <img src="${Boako.Util.cdn(targetItem.icon)}" class="w-6 h-6"> 도전권 구매
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
                                    <img src="${Boako.Util.cdn(targetItem.icon)}" class="w-4 h-4">${currentTokens}개
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
                            <img src="${Boako.Util.cdn(targetItem.icon)}" class="w-4 h-4"> 도전권 구매하기
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
        const state = Boako.Shop._supporterState;
        const amountInput = document.getElementById('supporter-amount-input');
        const teamId = state?.selectedTeamId;
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
