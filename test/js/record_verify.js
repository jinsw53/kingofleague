/**
 * [RECORD VERIFY] 타 팀 경기 기록 교차 검증 및 승인 센터 (최종 최신화 마스터본)
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
            
            // 🌟 [소장님 기획 반영] 토너먼트 배수를 10으로 나누어 직관적인 '단계'로 가공 (기본값 10 대입으로 1단계 방어)
            const tournamentStage = Math.floor((item.multiplier || 10) / 10);
            
            // 🎯 토너먼트면 배수 대신 1단계, 2단계 구간 뱃지 노출 / 일반 매치는 첫 승 확인 노출
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

   // 4. 승인 버튼 눌렀을 때 DB 업데이트 (프로필 테이블 매칭 방식)
    approve: async function(recordId, matchType) {
        if (!confirm("이 기록을 정상적인 경기로 승인하시겠습니까?")) return;
        
        try {
            // 1. 현재 로그인한 유저의 닉네임 확인
            const myNickname = Boako.state.user?.nickname;
            if (!myNickname) {
                alert("❌ [인증 실패] 현재 유저의 닉네임(상태 정보)이 장부에 없습니다.");
                return;
            }

            // 🌟 2. [소장님 기획 반영] profiles 테이블에서 내 닉네임과 full_name이 일치하는 진짜 고유 ID 조회
            const { data: profile, error: profileError } = await Boako.db
                .from('profiles')
                .select('id')
                .eq('full_name', myNickname)
                .maybeSingle();

            if (profileError || !profile) {
                alert(`❌ [매칭 실패] profiles 테이블에서 full_name이 '${myNickname}'인 유저의 ID를 찾을 수 없습니다.`);
                return;
            }

            const leaderId = profile.id; // 🎯 프로필 장부에서 찾아낸 진짜 고유 ID
            const nowTimestamp = new Date().toISOString();
            
            // 출신 성분에 따른 타겟 테이블 결정
            let targetTable = matchType === 'TOURNAMENT' ? 'boako_tournaments' : 'BTLDB';

            // 🎯 3. 찾아낸 프로필 ID와 타임스탬프를 실물 테이블에 확실하게 주입!
            const { data, error } = await Boako.db
                .from(targetTable) 
                .update({ 
                    verified_by: leaderId,   // 👈 프로필 테이블의 고유 ID 주입!
                    verified_at: nowTimestamp   
                })
                .eq('id', isNaN(recordId) ? recordId : Number(recordId))
                .select(); // 실제 반영 결과를 받아오기 위해 추가

            if (error) throw error;

            // 4. 안전 검증: 실제로 업데이트가 일어났는지 체크
            if (!data || data.length === 0) {
                alert(`❌ [DB 반영 실패] '${targetTable}' 테이블에 ID가 [ ${recordId} ]인 데이터가 존재하지 않거나 수정되지 않았습니다.`);
                return;
            }

            // 5. 완벽하게 성공 시 후속 오토메이션 작동
            Boako.Util.toast("✅ 서명이 완료되어 기록이 정상 승인되었습니다.");
            await this.loadPendingData();

            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') {
                Boako.Auth.checkLeaderMenu();
            }

        } catch (err) {
            console.error("승인 처리 정밀 검증 에러:", err);
            Boako.Util.toast("승인 처리 중 오류가 발생했습니다.");
        }
    }
};
