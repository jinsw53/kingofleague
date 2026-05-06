/**
 * [ADMIN REVIEW SYSTEM]
 * 관리자 전용 게임 검수 및 수정 시스템
 * 컬럼명: game_name 및 언더바(_) 형식 완벽 대응
 */
Boako.AdminReview = {
    pendingGames: [],
    currentIndex: 0,

    // [A] 초기화: DB 연결 확인 및 권한 체크
    init: async function() {
        if (!Boako.db) {
            console.log("DB 로드 대기 중...");
            setTimeout(() => this.init(), 500);
            return;
        }

        if (!Boako.state.user) return;

        // 관리자 여부 최종 확인
        const { data: profile } = await Boako.db
            .from('profiles')
            .select('is_admin')
            .eq('id', Boako.state.user.id)
            .single();

        if (!profile || !profile.is_admin) {
            alert("관리자 권한이 없습니다.");
            Boako.View.render('main');
            return;
        }

        this.loadQueue();
    },

    // [B] 검수 데이터 로드 (가상 뷰)
    loadQueue: async function() {
        const { data, error } = await Boako.db
            .from('view_pending_review_games')
            .select('*');

        if (error) {
            console.error("데이터 로드 실패:", error);
            return;
        }

        this.pendingGames = data || [];
        this.render();
    },

    // [C] 카드 UI 렌더링
    render: function() {
        const container = document.getElementById('review-container');
        if (!container) return;

        if (this.pendingGames.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:100px 20px;">
                    <h2 style="color:#cbd5e1;">☕ 검수할 항목이 더 이상 없습니다!</h2>
                    <p style="color:#94a3b8; margin-top:10px;">모든 아카이브 데이터가 깨끗합니다.</p>
                </div>`;
            return;
        }

        const game = this.pendingGames[this.currentIndex];

        container.innerHTML = `
            <div style="max-width:550px; margin:20px auto; background:white; border-radius:24px; box-shadow:0 20px 40px rgba(0,0,0,0.1); border:1px solid #f1f5f9; overflow:hidden;">
                <!-- 헤더 영역 -->
                <div style="background:#1e293b; padding:15px 25px; color:white; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:800; opacity:0.8;">ARCHIVE ID #${game.id}</span>
                    <span style="font-size:12px; background:#10b981; padding:4px 10px; border-radius:20px;">${this.currentIndex + 1} / ${this.pendingGames.length}</span>
                </div>
                
                <div style="padding:30px;">
                    <!-- 게임 제목 (game_name 적용) -->
                    <div style="margin-bottom:20px;">
                        <label style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:8px; text-transform:uppercase;">게임명 (Game Name)</label>
                        <input id="edit-game-name" type="text" value="${game.game_name || ''}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:800; font-size:16px; color:#1e293b;">
                    </div>

                    <!-- 게임 상세 정보 그리드 -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                        <div>
                            <label style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:5px;">최소 인원</label>
                            <input id="edit-min-players" type="number" value="${game.min_players || 0}" style="width:100%; padding:10px; border:2px solid #e2e8f0; border-radius:10px;">
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:5px;">최대 인원</label>
                            <input id="edit-max-players" type="number" value="${game.max_players || 0}" style="width:100%; padding:10px; border:2px solid #e2e8f0; border-radius:10px;">
                        </div>
                        <div>
                            <label style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:5px;">플레이 시간</label>
                            <input id="edit-playtime" type="number" value="${game.playtime || 0}" style="width:100%; padding:10px; border:2px solid #e2e8f0; border-radius:10px;">
                        </div>
                    </div>

                    <!-- 난이도 및 속성 -->
                    <div style="margin-bottom:20px;">
                        <label style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:8px;">웨이트 (Weight / 5.0)</label>
                        <input id="edit-weight" type="number" step="0.1" value="${game.weight || 0}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:700;">
                    </div>

                    <!-- 협력 여부 체크박스 -->
                    <div style="margin-bottom:30px; background:#f8fafc; padding:15px; border-radius:12px;">
                         <label style="font-size:14px; font-weight:700; color:#334155; cursor:pointer; display:flex; align-items:center; gap:10px;">
                            <input id="edit-cooperative" type="checkbox" style="width:18px; height:18px;" ${game.is_cooperative ? 'checked' : ''}> 🤝 이 게임은 협력 게임입니다.
                         </label>
                    </div>

                    <!-- 하단 액션 버튼 -->
                    <div style="display:grid; grid-template-columns:1fr 1.5fr; gap:12px;">
                        <button onclick="Boako.AdminReview.next()" style="padding:16px; background:#f1f5f9; border:none; border-radius:16px; font-weight:800; color:#64748b; cursor:pointer; transition:0.2s;">건너뛰기</button>
                        <button onclick="Boako.AdminReview.submit('${game.id}')" style="padding:16px; background:#1e293b; border:none; border-radius:16px; font-weight:800; color:white; cursor:pointer; box-shadow:0 10px 20px rgba(30, 41, 59, 0.2);">수정 및 아카이브 승인</button>
                    </div>
                </div>
            </div>
        `;
    },

    // [D] DB 업데이트 수행
    submit: async function(gameId) {
        if (!confirm("검수를 완료하고 아카이브에 반영하시겠습니까?")) return;

        const updateData = {
            game_name: document.getElementById('edit-game-name').value, // game_name 반영
            weight: parseFloat(document.getElementById('edit-weight').value),
            playtime: parseInt(document.getElementById('edit-playtime').value),
            min_players: parseInt(document.getElementById('edit-min-players').value),
            max_players: parseInt(document.getElementById('edit-max-players').value),
            is_cooperative: document.getElementById('edit-cooperative').checked,
            is_reviewed: true,              // 검수 상태 업데이트
            updated_by: Boako.state.user.id, // 소장님 ID 기록
            updated_at: new Date()
        };

        try {
            const { error } = await Boako.db
                .from('games')
                .update(updateData)
                .eq('id', gameId);

            if (error) throw error;

            alert("성공적으로 승인되었습니다! ✅");
            
            // 리스트에서 제거하고 다음 카드 보여주기
            this.pendingGames.splice(this.currentIndex, 1);
            if (this.currentIndex >= this.pendingGames.length) this.currentIndex = 0;
            this.render();
            
        } catch (err) {
            console.error("업데이트 오류:", err);
            alert("수정 실패: " + err.message);
        }
    },

    // [E] 다음 카드로 넘기기
    next: function() {
        if (this.pendingGames.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.pendingGames.length;
        this.render();
    }
};
