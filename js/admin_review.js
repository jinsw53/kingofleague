/**
 * [ADMIN REVIEW SYSTEM - V7.0]
 * 이미지 업로드 및 미리보기 기능 추가
 * 🌟 [신규] BGA 카탈로그 동기화(북마클릿)에서 이름을 못 뽑은 게임들 수동 매칭 큐(openBgaMatchQueue) 추가
 * 🌟 [수정] BGA 페이지 CSP 때문에 북마클릿 직접 호출이 막혀서, 붙여넣기+동기화 실행 UI(runBgaSync) 추가.
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
                <img id="image-preview" src="${Boako.Util.cdn(game.image_url) || ''}" 
                     style="max-width:150px; margin:0 auto 15px; border-radius:12px; display:${game.image_url ? 'block' : 'none'}; box-shadow:0 8px 15px rgba(0,0,0,0.1);">
                <label for="file-upload" style="cursor:pointer; background:#fff; padding:8px 16px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; font-weight:700; color:#64748b;">
                    📷 이미지 선택 (WebP 권장)
                </label>
                <input id="file-upload" type="file" accept="image/*" style="display:none;" onchange="Boako.AdminReview.handleFileSelect(event)">
            </div>

            <div style="margin-bottom:20px;">
                <label for="edit-game-name" style="font-size:11px; font-weight:900; color:#64748b; display:block; margin-bottom:8px;">게임명</label>
                <input id="edit-game-name" type="text" value="${game.game_name || ''}" style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:800;">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                <div>
                    <label for="edit-min-players" style="font-size:11px; font-weight:900; color:#64748b;">최소</label>
                    <input id="edit-min-players" type="number" value="${game.min_players || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;">
                </div>
                <div>
                    <label for="edit-max-players" style="font-size:11px; font-weight:900; color:#64748b;">최대</label>
                    <input id="edit-max-players" type="number" value="${game.max_players || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;">
                </div>
                <div>
                    <label for="edit-playtime" style="font-size:11px; font-weight:900; color:#64748b;">시간(분)</label>
                    <input id="edit-playtime" type="number" value="${game.playtime || 0}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px;">
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label for="edit-weight" style="font-size:11px; font-weight:900; color:#64748b;">웨이트 (Weight)</label>
                    <label for="edit-weight-unknown" style="font-size:12px; font-weight:800; color:#ef4444; cursor:pointer; display:flex; align-items:center; gap:5px;">
                        <input type="checkbox" id="edit-weight-unknown" ${game.is_weight_unknown ? 'checked' : ''} 
                            onchange="const wInput = document.getElementById('edit-weight'); wInput.disabled = this.checked; if(this.checked) wInput.value = 1;"> 웨이트 미정
                    </label>
                </div>
                <input id="edit-weight" type="number" step="0.1" value="${game.is_weight_unknown ? 1 : (game.weight || 0)}" 
                       ${game.is_weight_unknown ? 'disabled' : ''} style="width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:12px; font-weight:700;">
            </div>

            <div style="margin-bottom:30px; background:#f8fafc; padding:15px; border-radius:12px;">
                 <label for="edit-cooperative" style="cursor:pointer; display:flex; align-items:center; gap:10px; font-weight:700;">
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
    },

    // 🌟 [신규] BGA 카탈로그 동기화(북마클릿)에서 이름을 못 뽑은(로고 이미지형) 게임들 수동 매칭 큐
    // 🌟 [수정] BGA 페이지의 CSP 때문에 북마클릿에서 직접 슈파베이스 호출이 불가능해서,
    // 북마클릿은 클립보드 복사만 하고, 여기(보아코 사이트 내부, 관리자 세션)에서 붙여넣어 동기화 실행하는 방식으로 변경.
    openBgaMatchQueue: async function() {
        const { data, error } = await Boako.db.rpc('fn_get_pending_bga_matches');
        if (error) return Boako.Util.toast('❌ 로드 실패: ' + error.message);

        const list = data || [];
        const modalHtml = `
            <div id="bga-match-overlay" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-black text-lg">🎮 BGA 카탈로그 동기화</h3>
                        <button onclick="document.getElementById('bga-match-overlay').remove()" class="text-slate-400 font-black text-xl">×</button>
                    </div>

                    <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-5">
                        <p class="text-xs font-bold text-indigo-700 mb-2">📋 북마클릿으로 긁은 결과(클립보드에 자동 복사됨)를 여기 붙여넣으세요.</p>
                        <textarea id="bga-sync-paste" rows="3" placeholder="여기에 Ctrl+V" class="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs font-mono"></textarea>
                        <button onclick="Boako.AdminReview.runBgaSync()" class="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2 rounded-lg">🔄 동기화 실행</button>
                    </div>

                    <h3 class="font-black text-sm mb-2">🧩 매칭 대기 (${list.length}건)</h3>
                    <p class="text-xs text-slate-500 font-bold mb-4">이름을 텍스트로 못 뽑은(로고 이미지형) 게임들이에요. 링크 열어서 확인 후, 우리 아카이브의 어떤 게임인지 검색해서 매칭해주세요.</p>
                    <div id="bga-match-list" class="flex flex-col gap-3">
                        ${list.length === 0 ? `<div class="text-center py-10 text-slate-400 font-bold text-sm">대기 중인 항목이 없습니다.</div>` : list.map(p => `
                            <div class="border border-slate-200 rounded-xl p-3" id="bga-match-row-${p.id}">
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <a href="${p.url}" target="_blank" class="text-xs font-bold text-indigo-600 hover:underline truncate">${p.slug} 🔗</a>
                                    ${p.is_beta ? `<span class="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">🚧 베타</span>` : ''}
                                </div>
                                <div class="relative mb-2">
                                    <input type="text" placeholder="게임 이름 검색해서 매칭..." oninput="Boako.AdminReview.searchGameForMatch(${p.id}, this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold">
                                    <div id="bga-match-results-${p.id}" class="hidden absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto"></div>
                                </div>
                                <button onclick="Boako.AdminReview.dismissBgaMatch(${p.id})" class="text-[10px] font-bold text-slate-400 hover:text-rose-500">해당 없음 (건너뛰기)</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 🌟 [신규] 붙여넣은 JSON을 파싱해서 fn_sync_bga_catalog_admin 호출 (auth.uid() 관리자 세션으로 인증)
    runBgaSync: async function() {
        const textarea = document.getElementById('bga-sync-paste');
        const raw = textarea?.value.trim();
        if (!raw) return Boako.Util.toast('붙여넣은 내용이 없어요.');

        let entries;
        try {
            entries = JSON.parse(raw);
        } catch (e) {
            return Boako.Util.toast('❌ JSON 형식이 아니에요. 북마클릿 결과를 그대로 붙여넣었는지 확인해주세요.');
        }

        try {
            const { data, error } = await Boako.db.rpc('fn_sync_bga_catalog_admin', { p_entries: entries });
            if (error) throw error;
            Boako.Util.toast(`✅ 동기화 완료! URL 백필 ${data.url_backfilled} · 신규베타 ${data.newly_beta} · 베타졸업 ${data.graduated_to_normal} · 매칭대기 등록 ${data.pending_unmatched}`);
            document.getElementById('bga-match-overlay')?.remove();
            Boako.AdminReview.openBgaMatchQueue();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '동기화에 실패했습니다.'));
        }
    },

    searchGameForMatch: async function(pendingId, query) {
        const resultsBox = document.getElementById(`bga-match-results-${pendingId}`);
        if (!resultsBox) return;
        if (!query || query.trim().length === 0) {
            resultsBox.classList.add('hidden');
            resultsBox.innerHTML = '';
            return;
        }
        const { data } = await Boako.db.from('games').select('id, game_name').ilike('game_name', `%${query.trim()}%`).limit(8);
        if (!data || data.length === 0) {
            resultsBox.innerHTML = `<div class="p-2 text-xs text-slate-400 font-bold">검색 결과가 없습니다.</div>`;
            resultsBox.classList.remove('hidden');
            return;
        }
        resultsBox.innerHTML = data.map(g => `
            <div class="p-2 text-xs font-bold text-slate-700 hover:bg-violet-50 cursor-pointer" onclick="Boako.AdminReview.resolveBgaMatch(${pendingId}, '${g.id}', '${g.game_name.replace(/'/g, "\\'")}')">${g.game_name}</div>
        `).join('');
        resultsBox.classList.remove('hidden');
    },

    resolveBgaMatch: async function(pendingId, gameId, gameName) {
        try {
            const { error } = await Boako.db.rpc('fn_resolve_bga_pending_match', { p_pending_id: pendingId, p_game_id: gameId });
            if (error) throw error;
            Boako.Util.toast(`✅ "${gameName}"에 매칭했어요.`);
            document.getElementById(`bga-match-row-${pendingId}`)?.remove();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '매칭에 실패했습니다.'));
        }
    },

    dismissBgaMatch: async function(pendingId) {
        try {
            const { error } = await Boako.db.rpc('fn_dismiss_bga_pending_match', { p_pending_id: pendingId });
            if (error) throw error;
            document.getElementById(`bga-match-row-${pendingId}`)?.remove();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '처리에 실패했습니다.'));
        }
    }
};
