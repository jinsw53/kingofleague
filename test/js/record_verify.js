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

  // 4. 승인 버튼 눌렀을 때 DB 업데이트 (인증자 UUID 및 인증 일시 기입)
    approve: async function(recordId) {
        if (!confirm("이 기록을 정상적인 경기로 승인하시겠습니까?")) return;
        
        try {
            // 🌟 글로벌 상태 장부에서 현재 로그인한 리더의 UUID와 현재 시간(ISO) 확보
            const leaderUuid = Boako.state.user.id;
            const nowTimestamp = new Date().toISOString();

            // 가상 뷰의 바탕이 되는 원본 테이블을 타격합니다.
            const { error } = await Boako.db
                .from('원본_테이블명_입력') // 👈 여기에 실제 전적 행이 쌓이는 원본 테이블명 적어주세요!
                .update({ 
                    verified_by: leaderUuid,   // 승인 버튼을 누른 리더의 고유 UUID
                    verified_at: nowTimestamp   // 승인 도장이 찍힌 실시간 날짜/시간
                    // 💡 is_verified: 0 은 DB 내부 트리거가 알아서 처리하므로 전송 안 함!
                })
                .eq('id', recordId);

            if (error) throw error;

            // 1. 성공 토스트 팝업
            Boako.Util.toast("✅ 서명이 완료되어 기록이 정상 승인되었습니다.");

            // 2. 대기열 화면 새로고침 (트리거에 의해 상태가 변했으므로 대기열 뷰에서 알아서 샥 빠집니다)
            await this.loadPendingData();

            // 3. 상단 메뉴바의 타 팀 결재 경고등 불빛 실시간 갱신
            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') {
                Boako.Auth.checkLeaderMenu();
            }

        } catch (err) {
            console.error("승인 처리(서명 기입) 에러:", err);
            Boako.Util.toast("승인 처리 중 오류가 발생했습니다.");
        }
    },

    // 5. 반려 버튼 눌렀을 때 DB 업데이트 또는 삭제
    reject: async function(recordId) {
        if (!confirm("어뷰징 또는 오류가 확인되어 반려하시겠습니까?")) return;
        // 내일 여기에 반려 처리 로직 작성...
    }
};
