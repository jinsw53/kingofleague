/**
 * [ADMIN REVIEW SYSTEM - V5.0]
 * 1. 웨이트 미정 시 기본값 1 저장
 * 2. 승인 후 다음 카드 전환 로직 보강
 */
Boako.AdminReview = {
    pendingGames: [],
    currentIndex: 0,

    init: async function() {
        if (!Boako.db) {
            setTimeout(() => this.init(), 500);
            return;
        }
        if (!Boako.state.user) return;

        this.loadQueue();
    },

    loadQueue: async function() {
        const { data, error } = await Boako.db
            .from('view_pending_review_games')
            .select('*');

        if (error) return console.error("데이터 로드 실패:", error);

        this.pendingGames = data || [];
        this.currentIndex = 0; // 로드 시 인덱스 초기화
        this.render();
    },

    render: function() {
        const container = document.getElementById('review-container');
        if (!container) return;

        // 1. 대기 리스트가 없으면 종료 화면
        if (this.pendingGames.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:100px 20px;">
                    <h2 style="color:#cbd5e1;">☕ 모든 검수가 완료되었습니다!</h2>
                    <button onclick="Boako.AdminReview.loadQueue()" style="margin-top:20px; padding:10px 20px; border-radius:10px; border:1px solid #e2e8f0; cursor:pointer;">새로고침</button>
                </div>`;
            return;
        }

        const game = this.pendingGames[this.currentIndex];

        container.innerHTML = `
            <div style="max-width:550px; margin:20px auto; background:white; border-radius:24px; box-shadow:0 20px 40px rgba(0,0,0,0.1); border:1px solid #f1f5f9; overflow:hidden;">
                <div style="background:#1e293b; padding:15px 25px; color:white; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:800;">ARCHIVE ID #${game.id}</span>
                    <span style="font-size:12px; background:#10b981; padding:4px 10px; border-radius:20px;">${this.currentIndex + 1} / ${this.pendingGames.length}</span>
                </div>
                
                <div style="padding:30px;">
                    <div style="margin-bottom:20px;">
                        <label style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:8px;">게임명</label>
                        <input id="edit-game-name" type="text" value="${game.game_name || ''}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:800;">
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                        <div><label style="font-size:11px; font-weight:900; color:#64748b;">최소</label>
                        <input id="edit-min-players" type="number" value="${game.min_players || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;"></div>
                        <div><label style="font-size:11px; font-weight:900; color:#64748b;">최대</label>
                        <input id="edit-max-players" type="number" value="${game.max_players || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;"></div>
                        <div><label style="font-size:11px; font-weight:900; color:#64748b;">시간</label>
                        <input id="edit-playtime" type="number" value="${game.playtime || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;"></div>
                    </div>

                    <div style="margin-bottom:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <label style="font-size:11px; font-weight:900; color:#64748b;">웨이트 (Weight)</label>
                            <label style="font-size:12px; font-weight:800; color:#ef4444; cursor:pointer; display:flex; align-items:center; gap:5px;">
                                <input type="checkbox" id="edit-weight-unknown" ${game.is_weight_unknown ? 'checked' : ''} 
                                    onchange="const wInput = document.getElementById('edit-weight'); wInput.disabled = this.checked; if(this.checked) wInput.value = 1;"> 웨이트 미정
                            </label>
                        </div>
                        <input id="edit-weight" type="number" step="0.1" value="${game.is_weight_unknown ? 1 : (game.weight || 0)}" 
                               ${game.is_weight_unknown ? 'disabled' : ''}
                               style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:700;">
                    </div>

                    <div style="margin-bottom:30px; background:#f8fafc; padding:15px; border-radius:12px;">
                         <label style="cursor:pointer; display:flex; align-items:center; gap:10px; font-weight:700;">
                            <input id="edit-cooperative" type="checkbox" ${game.is_cooperative ? 'checked' : ''}> 협력 게임 여부
                         </label>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1.5fr; gap:12px;">
                        <button onclick="Boako.AdminReview.next()" style="padding:16px; background:#f1f5f9; border:none; border-radius:16px; font-weight:800; cursor:pointer;">건너뛰기</button>
                        <button onclick="Boako.AdminReview.submit('${game.id}')" style="padding:16px; background:#1e293b; border:none; border-radius:16px; font-weight:800; color:white; cursor:pointer;">수정 및 승인</button>
                    </div>
                </div>
            </div>
        `;
    },

    submit: async function(gameId) {
        if (!confirm("검수를 완료하고 아카이브에 반영할까요?")) return;

        const isUnknown = document.getElementById('edit-weight-unknown').checked;

        const updateData = {
            game_name: document.getElementById('edit-game-name').value,
            // 🌟 미정일 때 소장님 요청대로 1로 저장!
            weight: isUnknown ? 1 : parseFloat(document.getElementById('edit-weight').value),
            is_weight_unknown: isUnknown,
            playtime: parseInt(document.getElementById('edit-playtime').value),
            min_players: parseInt(document.getElementById('edit-min-players').value),
            max_players: parseInt(document.getElementById('edit-max-players').value),
            is_cooperative: document.getElementById('edit-cooperative').checked,
            is_reviewed: true,
            updated_by: Boako.state.user.id,
            updated_at: new Date()
        };

        try {
            const { error } = await Boako.db.from('games').update(updateData).eq('id', gameId);
            if (error) throw error;

            alert("성공적으로 승인되었습니다! ✅");

            // 🌟 [다음 카드로 넘기기 로직]
            // 현재 배열에서 처리한 항목을 삭제
            this.pendingGames.splice(this.currentIndex, 1);

            // 마지막 장을 지웠다면 인덱스를 앞으로 당김
            if (this.currentIndex >= this.pendingGames.length) {
                this.currentIndex = 0;
            }

            // UI 갱신 (리스트가 비었으면 종료화면이 뜸)
            this.render();

        } catch (err) {
            alert("오류 발생: " + err.message);
        }
    },

    next: function() {
        if (this.pendingGames.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.pendingGames.length;
        this.render();
    }
};
