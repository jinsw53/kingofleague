/**
 * [ADMIN REVIEW SYSTEM - V7.0]
 * 이미지 업로드 및 미리보기 기능 추가
 */
Boako.AdminReview = {
    pendingGames: [],
    currentIndex: 0,
    selectedFile: null, // 선택된 파일을 임시 저장

    init: async function() {
        if (!Boako.db) {
            setTimeout(() => this.init(), 500);
            return;
        }
        if (!Boako.state.user) return;
        this.loadQueue();
    },

    loadQueue: async function() {
        const { data, error } = await Boako.db.from('view_pending_review_games').select('*');
        if (error) return console.error("데이터 로드 실패:", error);
        this.pendingGames = data || [];
        
        // 메뉴 스타일 업데이트 (기존 로직 유지)
        const menu = document.getElementById('menu-admin-review');
        if (menu) {
            menu.style.background = this.pendingGames.length > 0 ? '#fff1f2' : 'transparent';
            menu.style.borderLeft = this.pendingGames.length > 0 ? '4px solid #f43f5e' : 'none';
        }

        this.currentIndex = 0;
        this.render();
    },

    // 파일 선택 시 미리보기 처리
    handleFileSelect: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.selectedFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    render: function() {
        const container = document.getElementById('review-container');
        if (!container || this.pendingGames.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:100px 20px;"><h2 style="color:#cbd5e1;">☕ 모든 검수가 완료되었습니다!</h2></div>`;
            return;
        }

        const game = this.pendingGames[this.currentIndex];
        this.selectedFile = null; // 카드 바뀔 때마다 선택 파일 초기화

        container.innerHTML = `
            <div style="max-width:550px; margin:20px auto; background:white; border-radius:24px; box-shadow:0 20px 40px rgba(0,0,0,0.1); border:1px solid #f1f5f9; overflow:hidden;">
                <div style="background:#1e293b; padding:15px 25px; color:white; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:800;">ARCHIVE ID #${game.id}</span>
                    <span style="font-size:12px; background:#10b981; padding:4px 10px; border-radius:20px;">${this.currentIndex + 1} / ${this.pendingGames.length}</span>
                </div>
                
                <div style="padding:30px;">
                    <!-- 🖼️ 이미지 업로드 구역 -->
                    <div style="margin-bottom:25px; text-align:center; border:2px dashed #e2e8f0; padding:20px; border-radius:16px; background:#f8fafc;">
                        <img id="image-preview" src="${game.image_url || ''}" 
                             style="max-width:150px; margin:0 auto 15px; border-radius:12px; display:${game.image_url ? 'block' : 'none'}; box-shadow:0 8px 15px rgba(0,0,0,0.1);">
                        <label for="file-upload" style="cursor:pointer; background:#fff; padding:8px 16px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; font-weight:700; color:#64748b;">
                            📷 이미지 선택 (WebP 권장)
                        </label>
                        <input id="file-upload" type="file" accept="image/*" style="display:none;" onchange="Boako.AdminReview.handleFileSelect(event)">
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:8px;">게임명</label>
                        <input id="edit-game-name" type="text" value="${game.game_name || ''}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:800;">
                    </div>

                    <!-- ... 중략 (인원, 시간, 웨이트 입력창은 기존과 동일) ... -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                        <div><label style="font-size:11px; font-weight:900; color:#64748b;">최소</label>
                        <input id="edit-min-players" type="number" value="${game.min_players || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;"></div>
                        <div><label style="font-size:11px; font-weight:900; color:#64748b;">최대</label>
                        <input id="edit-max-players" type="number" value="${game.max_players || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;"></div>
                        <div><label style="font-size:11px; font-weight:900; color:#64748b;">시간(분)</label>
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
                               ${game.is_weight_unknown ? 'disabled' : ''} style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:700;">
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
        if (!confirm("이미지를 포함하여 업데이트하시겠습니까?")) return;

        let imageUrl = this.pendingGames[this.currentIndex].image_url;

        // 1. 이미지가 새로 선택되었다면 Storage에 업로드
        if (this.selectedFile) {
            const file = this.selectedFile;
            const fileExt = file.name.split('.').pop();
            const fileName = `${gameId}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { data: uploadData, error: uploadError } = await Boako.db.storage
                .from('game-images')
                .upload(filePath, file);

            if (uploadError) return alert("이미지 업로드 실패: " + uploadError.message);

            // 공용 URL 가져오기
            const { data: publicUrlData } = Boako.db.storage
                .from('game-images')
                .getPublicUrl(filePath);
            
            imageUrl = publicUrlData.publicUrl;
        }

        // 2. DB 업데이트
        const isUnknown = document.getElementById('edit-weight-unknown').checked;
        const updateData = {
            game_name: document.getElementById('edit-game-name').value,
            weight: isUnknown ? 1 : parseFloat(document.getElementById('edit-weight').value),
            is_weight_unknown: isUnknown,
            playtime: parseInt(document.getElementById('edit-playtime').value),
            min_players: parseInt(document.getElementById('edit-min-players').value),
            max_players: parseInt(document.getElementById('edit-max-players').value),
            is_cooperative: document.getElementById('edit-cooperative').checked,
            image_url: imageUrl, // 🌟 이미지 주소 저장!
            updated_by: Boako.state.user.id,
            updated_at: new Date()
        };

        try {
            const { error } = await Boako.db.from('games').update(updateData).eq('id', gameId);
            if (error) throw error;
            alert("업데이트 완료! 📸");
            await this.loadQueue();
        } catch (err) { alert("오류: " + err.message); }
    },

    next: function() {
        if (this.pendingGames.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.pendingGames.length;
        this.render();
    }
};
