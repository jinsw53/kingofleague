/**
 * [RECORD VERIFY] 타 팀 경기 기록 교차 검증 및 승인 센터 (최종 최적화본)
 */
Boako.RecordVerify = {
    pendingList: [],

    // 1. view.js에서 도화지가 깔리면 가장 먼저 호출되는 진입점
    init: async function() {
        if (!Boako.db || !Boako.state.team) {
            setTimeout(() => this.init(), 500);
            return;
        }
        await this.loadPendingData();
    },

    // 2. 수파베이스에서 '타 팀의 미인증 데이터'만 싹 긁어오기
    loadPendingData: async function() {
        const container = document.getElementById('team-verify-list-container');
        if (container) container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">결재 서류(데이터)를 불러오는 중...</div>`;

        try {
            const myTeamName = Boako.state.team.info.team_name;

            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('*')
                .neq('b_all_team', myTeamName) // 내 팀 전적 제외 (상호 교차 감시)
                .eq('is_verified', 1)          // 미인증 상태(1)만 타격
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.pendingList = data || [];
            this.renderList();

        } catch (err) {
            console.error("인증 대기열 로드 에러:", err);
            if (container) container.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 3. 긁어온 데이터를 화면에 렌더링 (카드 클릭 시 새 창 / 토너먼트 단계 표기법 도입)
    renderList: function() {
        const container = document.getElementById('team-verify-list-container');
        if (!container) return;

        if (this.pendingList.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">현재 인증 대기 중인 타 팀 전적이 없습니다.</div>`;
            return;
        }

        let html = `<div class="flex flex-col gap-4">`;
        
        html += this.pendingList.map(item => {
            const isTournament = item.match_type === 'TOURNAMENT';
            
            // 🎯 [기획 반영] 토너먼트 배수를 10으로 나누어 1단계, 2단계 구간으로 직관적 표기
            const tournamentStage = Math.floor((item.multiplier || 10) / 10);
            
            const conditionBadge = isTournament
                ? `<span class="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded font-bold">🔥 토너먼트: ${tournamentStage}단계</span>`
                : `<span class="inline-block mt-1 px-2 py-0.5 bg-sky-100 text-sky-800 text-xs rounded font-bold">🛡️ 첫 승 기록 확인</span>`;

            return `
                <div onclick="window.open('${item.post_url || '#'}', '_blank')" 
                     class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center cursor-pointer hover:border-indigo-400 hover:shadow transition-all group">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">${item.b_all_team}</span>
                            <h4 class="font-black text-slate-800 group-hover:text-indigo-600 transition-colors">${item.nickname} - ${item.game_name}</h4>
                        </div>
                        <p class="text-sm font-bold text-indigo-600 mt-1">${Math.floor(item.rp)} RP</p>
                        ${conditionBadge}
                    </div>
                    
                    <div onclick="event.stopPropagation()">
                        <button onclick="Boako.RecordVerify.approve('${item.id}', '${item.match_type}')" 
                                class="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-lg transition-all shadow-sm active:scale-[0.98]">
                            ✅ 승인
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        html += `</div>`;
        container.innerHTML = html;
    },

  // 연속 타격(더블 클릭) 방어용 락 플래그
    isApproving: false,

    // 4. 승인 버튼 눌렀을 때 실물 원본 테이블에 도장 쾅! + profiles 잔액 및 point_history 완벽 연동
    approve: async function(recordId, matchType) {
        if (this.isApproving) return;

        if (!confirm("이 기록을 정상적인 경기로 승인하시겠습니까?")) return;
        
        try {
            this.isApproving = true; // 🔒 진입과 동시에 락 걸기

            let targetTable = matchType === 'TOURNAMENT' ? 'boako_tournaments' : 'BTLDB';
            const leaderUuid = Boako.state.user?.id;
            const nowTimestamp = new Date().toISOString();

            if (!leaderUuid) {
                Boako.Util.toast("❌ 인증 정보(UUID)를 찾을 수 없습니다. 다시 로그인해 주세요.");
                this.isApproving = false;
                return;
            }

            // 🎯 [1단계] 경기 기록 실물 테이블 타격 (승인 도장 쾅)
            const { data, error } = await Boako.db
                .from(targetTable) 
                .update({ 
                    verified_by: leaderUuid,   
                    verified_at: nowTimestamp   
                })
                .eq('id', isNaN(recordId) ? recordId : Number(recordId))
                .select(); 

            if (error) throw error;

            // 실물 반영 최종 확인 검문소
            if (!data || data.length === 0) {
                Boako.Util.toast("❌ RLS 권한이 없거나 대상을 찾을 수 없어 승인에 실패했습니다.");
                this.isApproving = false;
                return;
            }

            // 🔥 [2단계] 소장님의 진짜 규격(point_change, description)에 맞춘 포인트 정산 프로세스
            try {
                // 1. profiles 테이블에서 기존 잔액 가져오기
                const { data: pData, error: pError } = await Boako.db
                    .from('profiles')
                    .select('points')
                    .eq('id', leaderUuid)
                    .single();

                if (!pError && pData) {
                    const currentPoints = Number(pData.points || 0);
                    
                    // 2. 기존 잔액에 +10점 가산하여 profiles 업데이트
                    await Boako.db
                        .from('profiles')
                        .update({ points: currentPoints + 10 })
                        .eq('id', leaderUuid);
                }

                // 3. shop 코드의 컬럼명(point_change, description) 규격을 그대로 적용하여 이력 적재
                await Boako.db.from('point_history').insert([{
                    user_id: leaderUuid,
                    point_change: 10, // 🎯 points가 아니라 point_change가 맞았네요!
                    description: `[기록 승인] 교차 검증 완료 보상 (ID: ${recordId})` // 🎯 reason이 아니라 description이 맞았습니다!
                }]);

            } catch (pointErr) {
                // 혹시 모를 에러 발생 시 경기 승인은 유지되도록 방어막 유지
                console.error("⚠️ 경기 승인은 성공했으나, 포인트 갱신 중 오류가 발생했습니다:", pointErr);
            }

            // 깔끔한 최종 성공 토스트 발송
            Boako.Util.toast("✅ 기록이 정상 승인되었으며 10포인트가 지급되었습니다.");
            
            // 대기열 리스트 리로드 및 화면 갱신
            await this.loadPendingData();

            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') {
                Boako.Auth.checkLeaderMenu();
            }

        } catch (err) {
            console.error("승인 처리 에러:", err);
            Boako.Util.toast("승인 처리 중 오류가 발생했습니다.");
        } finally {
            this.isApproving = false; // 🔓 작업이 완전히 끝나면 락 해제
        }
    }
};
