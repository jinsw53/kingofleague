/**
 * [ADMIN REVIEW SYSTEM]
 * 관리자 전용 게임 검수 및 수정 시스템
 */
Boako.AdminReview = {
    pendingGames: [],
    currentIndex: 0,

    // [A] 검수 대기 리스트 로드
    init: async function() {
        // 관리자 권한 최종 확인 (보안)
        const { data: profile } = await Boako.db
            .from('profiles')
            .select('is_admin')
            .eq('id', Boako.state.user.id)
            .single();

        if (!profile || !profile.is_admin) {
            alert("관리자 권한이 없습니다.");
            window.location.href = "index.html"; // 권한 없으면 쫓아내기
            return;
        }

        this.loadQueue();
    },

    loadQueue: async function() {
        const { data, error } = await Boako.db
            .from('view_pending_review_games') // 소장님의 가상 뷰
            .select('*');

        if (error) {
            console.error("데이터 로드 실패:", error);
            return;
        }

        this.pendingGames = data || [];
        this.render();
    },

    // [B] 카드 UI 렌더링
    render: function() {
        const container = document.getElementById('review-container');
        if (!container) return;

        if (this.pendingGames.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:100px 20px;">
                    <h2 style="color:#cbd5e1;">☕ 모든 검수가 완료되었습니다!</h2>
                    <p style="color:#94a3b8;">대기 중인 게임이 없습니다.</p>
                </div>`;
            return;
        }

        const game = this.pendingGames[this.currentIndex];

        container.innerHTML = `
            <div style="max-width:500px; margin:40px auto; background:white; border-radius:24px; box-shadow:0 20px 40px rgba(0,0,0,0.1); overflow:hidden; border:1px solid #f1f5f9;">
                <div style="background:#1e293b; padding:20px; color:white; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:800; opacity:0.8;">검수 대기 번호 #${game.id}</span>
                    <span style="font-size:12px; background:#10b981; padding:4px 8px; border-radius:6px;">${this.currentIndex + 1} / ${this.pendingGames.length}</span>
                </div>
                
                <div style="padding:30px;">
                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:11px; font-weight:900; color:#64748b; margin-bottom:8px; text-transform:uppercase;">게임 제목</label>
                        <input id="edit-title" type="text" value="${game.title || ''}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:800; font-size:16px;">
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-size:11px; font-weight:900; color:#64748b; margin-bottom:8px; text-transform:uppercase;">장르 및 태그</label>
                        <input id="edit-genre" type="text" value="${game.genre || ''}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-size:14px;">
                    </div>

                    <div style="margin-bottom:30px;">
                        <label style="display:block; font-size:11px; font-weight:900; color:#64748b; margin-bottom:8px; text-transform:uppercase;">게임 설명 (아카이브용)</label>
                        <textarea id="edit-desc" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; height:120px; font-size:14px; resize:none;">${game.description || ''}</textarea>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <button onclick="Boako.AdminReview.next()" style="padding:16px; background:#f1f5f9; border:none; border-radius:14px; font-weight:800; color:#64748b; cursor:pointer;">건너뛰기</button>
                        <button onclick="Boako.AdminReview.submit('${game.id}')" style="padding:16px; background:#1e293b; border:none; border-radius:14px; font-weight:800; color:white; cursor:pointer;">수정 및 승인</button>
                    </div>
                </div>
            </div>
        `;
    },

    // [C] 승인 및 로그 남기기
    submit: async function(gameId) {
        if (!confirm("이 내용으로 아카이브를 업데이트할까요?")) return;

        const updateData = {
            title: document.getElementById('edit-title').value,
            genre: document.getElementById('edit-genre').value,
            description: document.getElementById('edit-desc').value,
            is_reviewed: true,              // 검수 완료 플래그
            updated_by: Boako.state.user.id, // 🌟 소장님(수정자) ID 기록
            updated_at: new Date()
        };

        try {
            const { error } = await Boako.db
                .from('games')
                .update(updateData)
                .eq('id', gameId);

            if (error) throw error;

            alert("업데이트 완료! ✅");
            this.pendingGames.splice(this.currentIndex, 1); // 목록에서 제거
            if (this.currentIndex >= this.pendingGames.length) this.currentIndex = 0;
            this.render();

        } catch (err) {
            alert("수정 실패: " + err.message);
        }
    },

    next: function() {
        this.currentIndex = (this.currentIndex + 1) % this.pendingGames.length;
        this.render();
    }
};
