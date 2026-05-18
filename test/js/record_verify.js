/**
 * [RECORD VERIFY] 타 팀 경기 기록 교차 검증 및 승인 센터
 */
Boako.RecordVerify = {
    pendingList: [],

    // 1. view.js에서 도화지가 깔리면 가장 먼저 호출되는 녀석
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
                .neq('b_all_team', myTeamName) // 내 팀 제외
                .eq('is_verified', 1)          // 미인증 상태만
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.pendingList = data || [];
            this.renderList();

        } catch (err) {
            console.error("인증 대기열 로드 에러:", err);
            if (container) container.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 3. 긁어온 데이터를 화면에 [승인/반려] 버튼과 함께 예쁘게 그려주기
    renderList: function() {
        const container = document.getElementById('team-verify-list-container');
        if (!container) return;

        if (this.pendingList.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">현재 인증 대기 중인 타 팀 전적이 없습니다.</div>`;
            return;
        }

        // 🌟 여기서 map을 돌려서 껍데기 안에 들어갈 진짜 리스트와 버튼들을 조립합니다.
        let html = `<div class="flex flex-col gap-4">`;
        
        html += this.pendingList.map(item => `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                    <span class="text-xs font-bold text-slate-400">${item.b_all_team}</span>
                    <h4 class="font-black text-slate-800">${item.nickname} - ${item.game_name}</h4>
                    <p class="text-sm font-bold text-indigo-600 mt-1">${Math.floor(item.rp)} RP</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="Boako.RecordVerify.approve('${item.id}')" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition-all">✅ 승인</button>
                    <button onclick="Boako.RecordVerify.reject('${item.id}')" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-all">❌ 반려</button>
                </div>
            </div>
        `).join('');

        html += `</div>`;
        container.innerHTML = html;
    },

    // 4. 승인 버튼 눌렀을 때 DB 업데이트 (is_verified = 0)
    approve: async function(recordId) {
        if (!confirm("이 기록을 정상적인 경기로 승인하시겠습니까?")) return;
        // 내일 여기에 승인 업데이트 로직 작성...
    },

    // 5. 반려 버튼 눌렀을 때 DB 업데이트 또는 삭제
    reject: async function(recordId) {
        if (!confirm("어뷰징 또는 오류가 확인되어 반려하시겠습니까?")) return;
        // 내일 여기에 반려 처리 로직 작성...
    }
};
