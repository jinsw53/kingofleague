/**
 * [RECORD VERIFY] 타 팀 경기 기록 교차 검증 및 승인 센터 (다이렉트 새 창 오픈형)
 */
Boako.RecordVerify = {
    pendingList: [],

    // 1. 초기 진입점
    init: async function() {
        if (!Boako.db || !Boako.state.team) {
            setTimeout(() => this.init(), 500);
            return;
        }
        await this.loadPendingData();
    },

    // 2. 대기열 데이터 로드
    loadPendingData: async function() {
        const container = document.getElementById('team-verify-list-container');
        if (container) container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">결재 서류를 불러오는 중...</div>`;

        try {
            const myTeamName = Boako.state.team.info.team_name;

            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('*')
                .neq('b_all_team', myTeamName)
                .eq('is_verified', 1)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.pendingList = data || [];
            this.renderList();

        } catch (err) {
            console.error("인증 대기열 로드 에러:", err);
            if (container) container.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 3. 다이렉트 오픈 리스트 렌더링
    renderList: function() {
        const container = document.getElementById('team-verify-list-container');
        if (!container) return;

        if (this.pendingList.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">현재 인증 대기 중인 타 팀 전적이 없습니다.</div>`;
            return;
        }

        let html = `<div class="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-2" style="scrollbar-width: thin;">`;
        
        html += this.pendingList.map(item => {
            const isTournament = item.match_type === 'TOURNAMENT';
            
            // 🎯 [조건부 배지] 토너먼트면 배수 값, 아니면 첫 승 기록 확인 뱃지
            const conditionBadge = isTournament
                ? `<span class="inline-block mt-2 px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] rounded-md font-black">🔥 배수: ${item.multiplier || 1}배</span>`
                : `<span class="inline-block mt-2 px-2.5 py-1 bg-sky-100 text-sky-800 text-[11px] rounded-md font-black">🛡️ 첫 승 기록 확인</span>`;

            return `
                <div onclick="window.open('${item.post_url || '#'}', '_blank')" 
                     class="bg-white p-5 rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group">
                    
                    <div class="flex flex-col">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded">${item.b_all_team}</span>
                            <strong class="text-slate-800 text-[15px] font-black">${item.nickname}</strong>
                        </div>
                        <div class="text-slate-600 text-sm font-bold group-hover:text-indigo-600 transition-colors">
                            🎮 ${item.game_name}
                        </div>
                        ${conditionBadge}
                    </div>

                    <div class="flex gap-2" onclick="event.stopPropagation()">
                        <button onclick="Boako.RecordVerify.approve('${item.id}', '${item.match_type}')" 
                                class="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-lg transition-all shadow-sm">
                            ✅ 승인
                        </button>
                        <button onclick="Boako.RecordVerify.reject('${item.id}', '${item.match_type}')" 
                                class="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-black rounded-lg transition-all shadow-sm">
                            ❌ 반려
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        html += `</div>`;
        container.innerHTML = html;
    },

    // 4. 승인 처리 엔진
    approve: async function(recordId, matchType) {
        if (!confirm("이 기록을 정상적인 경기로 승인하시겠습니까?")) return;
        
        try {
            let targetTable = matchType === 'TOURNAMENT' ? 'boako_tournaments' : 'BTLDB';
            const leaderUuid = Boako.state.user.id;
            const nowTimestamp = new Date().toISOString();

            const { error } = await Boako.db
                .from(targetTable) 
                .update({ verified_by: leaderUuid, verified_at: nowTimestamp })
                .eq('id', recordId);

            if (error) throw error;

            Boako.Util.toast("✅ 기록이 정상 승인되었습니다.");
            await this.loadPendingData();
            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') Boako.Auth.checkLeaderMenu();

        } catch (err) {
            console.error("승인 에러:", err);
            Boako.Util.toast("승인 처리 중 오류가 발생했습니다.");
        }
    },

    // 5. 반려 처리 엔진
    reject: async function(recordId, matchType) {
        if (!confirm("어뷰징 또는 오류가 확인되어 반려하시겠습니까?\n(반려 시 해당 기록은 삭제됩니다)")) return;
        
        try {
            let targetTable = matchType === 'TOURNAMENT' ? 'boako_tournaments' : 'BTLDB';

            const { error } = await Boako.db
                .from(targetTable) 
                .delete()
                .eq('id', recordId);

            if (error) throw error;

            Boako.Util.toast("❌ 해당 기록이 반려(삭제) 되었습니다.");
            await this.loadPendingData();
            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') Boako.Auth.checkLeaderMenu();

        } catch (err) {
            console.error("반려 에러:", err);
            Boako.Util.toast("반려 처리 중 오류가 발생했습니다.");
        }
    }
};
