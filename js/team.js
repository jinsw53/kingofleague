/**
 * [TEAM] 팀 관리 (창단, 정보수정, 멤버관리, 밴 투표, 작전판, 채팅 등)
 * 🌟 [수정] 팀챗 배지가 하드코딩된 'N' 글자만 뜨던 버그 수정 — Chat.unreadCount로 실제 개수 표시
 * 🌟 [신규] 팀챗에 카카오톡 스타일 "안읽음 인원수" 추가 — team_chat_reads 테이블 기반,
 *    채팅방 입장 시점 기준으로 읽음 처리, 내 메시지 옆에 아직 안 읽은 팀원 수 표시
 * 🌟 [리팩토링] Chat 네임스페이스의 실시간 채널(team-chat-*, team-chat-reads-*)을 탭 리더 선출
 *    방식으로 전환 — 사이트를 여러 탭으로 띄우고 팀챗을 각 탭에서 열면 탭 수만큼 소켓이 늘어나던
 *    문제 방지. 단, messenger.js 등과 달리 이 채널은 로그인 시 항상 켜져있는 전역 채널이 아니라
 *    "팀챗 화면을 실제로 열어본 탭"에서만 필요한 lazy 채널이라, js/realtime_coordinator.js의
 *    전역 리더 선출을 그대로 재사용하면 안 됨(전역 리더가 팀챗을 한 번도 안 열어봤으면 다른 탭이
 *    영원히 이벤트를 못 받는 문제 발생) — 그래서 "지금 팀챗을 열어본 탭들"끼리만 별도로 리더를
 *    선출하는 전용 미니 코디네이터를 팀 id별로 둠(localStorage 하트비트 + BroadcastChannel).
 */
Boako.Team = {
    syncStatus: async () => {
        const user = Boako.state.user;
        const menuTxt = document.getElementById('team-menu-text');
        if (!user) { Boako.state.team = null; if (menuTxt) menuTxt.innerText = "팀 창단"; return; }
        
        try {
            // 1. 내 닉네임 확보
            const { data: profile } = await Boako.db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
            Boako.state.user.nickname = profile?.full_name || user.user_metadata?.full_name || "사용자";

            // 🌟 2. 파편화 방지: 팀 소속 여부는 오직 'team_members'만 뒤져서 확인
            const { data: memberEntry } = await Boako.db
                .from('team_members')
                .select('team_id, role') 
                .eq('player_name', Boako.state.user.nickname)
                .eq('is_active', true)
                .maybeSingle();

            if (memberEntry) {
                const { data: teamInfo } = await Boako.db.from('teams').select('*').eq('id', memberEntry.team_id).maybeSingle();
                if (teamInfo) {
                    // 팀장 여부 판단 (DB 스키마 구조에 따라 memberEntry.role === 'LEADER' 등을 사용해도 무방)
                    const isLeader = teamInfo.owner_id === user.id; 
                    Boako.state.team = { type: isLeader ? 'LEADER' : 'MEMBER', info: teamInfo };
                    if (menuTxt) menuTxt.innerText = "팀 메뉴";
                    return;
                }
            }
            
            Boako.state.team = null; 
            if (menuTxt) menuTxt.innerText = "팀 창단";
        } catch (e) { console.error(e); }
    },
    
    create: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn_f');
        const file = document.getElementById('team_logo').files[0];
        btn.disabled = true; btn.innerText = "창단 처리 중...";
        
        try {
            const fExt = file.name.split('.').pop();
            const fName = `${Date.now()}.${fExt}`;
            await Boako.db.storage.from('teams').upload(fName, file);
            const { data: uData } = Boako.db.storage.from('teams').getPublicUrl(fName);

            // 🌟 1. 내 닉네임 확실하게 검증해서 확보하기
            let myName = Boako.state.user.nickname;
            if (!myName) {
                const { data: profile } = await Boako.db.from('profiles')
                    .select('full_name')
                    .eq('id', Boako.state.user.id)
                    .maybeSingle();
                myName = profile?.full_name || Boako.state.user.user_metadata?.full_name || "이름없음";
                Boako.state.user.nickname = myName;
            }
            
            // 🌟 2. 팀 데이터 생성 (💡 백엔드 트리거를 위해 leader_name을 반드시 함께 보냅니다!)
            const { data: newTeam, error: teamError } = await Boako.db.from('teams').insert([{ 
                team_name: document.getElementById('team_name').value.trim(), 
                owner_id: Boako.state.user.id, 
                leader_name: myName, // 👈 [핵심] 이 값이 백엔드 NEW.leader_name으로 들어갑니다!
                team_motto: document.getElementById('team_motto').value.trim(),
                team_desc: document.getElementById('team_desc').value.trim(),
                logo_url: uData.publicUrl,
                logo_url_origin: uData.publicUrl 
            }]).select().single();

            if (teamError) throw teamError;

            // 프론트엔드에서의 team_members INSERT 로직은 백엔드 트리거가 대신해주므로 생략합니다!

            Boako.Util.toast("✅ 새로운 전설의 팀이 탄생했습니다!");
            Boako.View.render('team');
            
        } catch (err) { 
            Boako.Util.toast(err.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = "전설의 팀 창단하기"; 
        }
    },
    
    updateInfo: async (col) => {
        const val = col === 'team_motto' ? document.getElementById('input-motto').value : document.getElementById('textarea-desc').value;
        const { error } = await Boako.db.from('teams').update({ [col]: val }).eq('id', Boako.state.team.info.id);
        if (error) Boako.Util.toast("저장 실패: " + error.message);
        else { Boako.Util.toast("✅ 팀 정보가 업데이트되었습니다."); Boako.View.render('team'); }
    },

    // ========== 🌟 [신규] 우승 별 붙이기 ==========
    // 시즌 종료 후 우승 확정되면(view.js에서 season_final_rankings로 자격 판별) 팀장이 로고 위에
    // 직접 별 위치를 지정해서 붙일 수 있음. 매 우승마다 "현재 로고" 위에 별 1개를 누적 추가.
    // 별 위치를 다시 잡고 싶으면 초기화(원본 logo_url_origin 기준으로 champion_star_count만큼 재배치) 가능.

    // 드래그 가능한 별 아이콘 하나를 컨테이너 안에서만 움직이게 만듦 (위치는 0~1 상대좌표로 dataset에 저장)
    _makeDraggableStar: (el, container) => {
        let dragging = false;
        el.addEventListener('pointerdown', (e) => {
            dragging = true;
            el.setPointerCapture(e.pointerId);
            el.style.cursor = 'grabbing';
        });
        el.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const rect = container.getBoundingClientRect();
            let x = (e.clientX - rect.left) / rect.width;
            let y = (e.clientY - rect.top) / rect.height;
            x = Math.min(1, Math.max(0, x));
            y = Math.min(1, Math.max(0, y));
            el.style.left = (x * 100) + '%';
            el.style.top = (y * 100) + '%';
            el.dataset.relX = x;
            el.dataset.relY = y;
        });
        el.addEventListener('pointerup', (e) => {
            dragging = false;
            el.style.cursor = 'grab';
        });
    },

    // 캔버스에 5각 별을 벡터로 직접 그림 (이미지 합성이 아니라 경로 채우기라 배경이 완전히 투명하게 유지됨)
    _drawStar: (ctx, cx, cy, outerRadius) => {
        const innerRadius = outerRadius * 0.5;
        const spikes = 5;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            let x = cx + Math.cos(rot) * outerRadius;
            let y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = Math.max(1, outerRadius * 0.08);
        ctx.fill();
        ctx.stroke();
    },

    // baseImageUrl(로고) 위에 starPositions(상대좌표 0~1) 배열만큼 별을 합성해서 PNG Blob으로 반환
    // 배경은 원본 로고의 투명도를 그대로 유지 (정사각형 캔버스에 원본 비율 유지해서 중앙 배치 = object-fit:contain과 동일)
    _compositeStars: (baseImageUrl, starPositions) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const size = Math.max(img.naturalWidth, img.naturalHeight, 512);
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');

                    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
                    const dw = img.naturalWidth * scale;
                    const dh = img.naturalHeight * scale;
                    const dx = (size - dw) / 2;
                    const dy = (size - dh) / 2;
                    ctx.drawImage(img, dx, dy, dw, dh);

                    starPositions.forEach(pos => {
                        const starSize = size * (pos.relSize || 0.15);
                        Boako.Team._drawStar(ctx, pos.relX * size, pos.relY * size, starSize);
                    });

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('이미지 합성 실패'));
                    }, 'image/png');
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = () => reject(new Error('로고 이미지를 불러오지 못했습니다.'));
            img.src = baseImageUrl;
        });
    },

    // 합성된 Blob을 teams 버킷에 업로드하고 공개 URL 반환
    _uploadStarLogo: async (blob) => {
        const fName = `star_${Boako.state.team.info.id}_${Date.now()}.png`;
        const { error: upErr } = await Boako.db.storage.from('teams').upload(fName, blob, { contentType: 'image/png' });
        if (upErr) throw upErr;
        const { data: uData } = Boako.db.storage.from('teams').getPublicUrl(fName);
        return uData.publicUrl;
    },

    // 🌟 [통합] 우승 별 붙이기 + 초기화를 모달 하나로 합침 — 안에서 모드 전환 가능
    // winSeasonNo가 있으면 '새 별 추가' 모드로 시작, 없으면(자격 없이 기존 별만 있는 경우) '초기화' 모드로 바로 시작
    openStarModal: (winSeasonNo) => {
        if (!Boako.state.team) return;
        document.getElementById('boako-star-modal')?.remove();

        const modalHtml = `
            <div id="boako-star-modal" class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div class="bg-white rounded-2xl w-full max-w-md p-6">
                    <div class="flex justify-between items-center mb-3">
                        <h3 id="star-modal-title" class="font-black text-lg"></h3>
                        <button onclick="document.getElementById('boako-star-modal').remove()" class="text-slate-400 font-black text-xl">×</button>
                    </div>
                    <p id="star-modal-desc" class="text-xs text-slate-500 font-bold mb-4"></p>
                    <div id="star-canvas-wrap" style="position:relative; width:100%; aspect-ratio:1; background:repeating-conic-gradient(#f1f5f9 0% 25%, #ffffff 0% 50%) 50% / 20px 20px; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;"></div>
                    <div id="star-modal-switch" class="text-center mt-3"></div>
                    <button id="star-modal-confirm" class="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-xl transition-colors">확정하고 저장</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const initialMode = winSeasonNo ? 'add' : 'reset';
        Boako.Team._renderStarModalMode(initialMode, winSeasonNo);
    },

    // 모달 안에서 '새 별 추가' ↔ '전체 재배치' 모드를 전환하며 그 부분만 다시 그림
    _renderStarModalMode: (mode, winSeasonNo) => {
        const team = Boako.state.team.info;
        const titleEl = document.getElementById('star-modal-title');
        const descEl = document.getElementById('star-modal-desc');
        const wrap = document.getElementById('star-canvas-wrap');
        const switchEl = document.getElementById('star-modal-switch');
        const confirmBtn = document.getElementById('star-modal-confirm');
        const starSvg = `<svg viewBox="0 0 24 24" style="width:100%; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));"><path fill="#fbbf24" stroke="#b45309" stroke-width="1" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.9-6.2 3.9 1.6-7L2 9.2l7.1-.6z"/></svg>`;

        if (mode === 'add') {
            titleEl.innerText = `🌟 우승 별 붙이기 (시즌 ${winSeasonNo})`;
            descEl.innerText = '별을 드래그해서 로고 위 원하는 위치에 놓아주세요.';
            wrap.innerHTML = `
                <img src="${team.logo_url}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none;">
                <div class="star-drag" style="position:absolute; left:50%; top:15%; transform:translate(-50%,-50%); width:15%; cursor:grab; touch-action:none;" data-rel-x="0.5" data-rel-y="0.15">${starSvg}</div>
            `;
            switchEl.innerHTML = (team.champion_star_count > 0)
                ? `<button onclick="Boako.Team._renderStarModalMode('reset', ${winSeasonNo})" class="text-xs font-bold text-slate-400 hover:text-slate-600 underline">기존 별도 다시 배치하기</button>`
                : '';
            confirmBtn.onclick = () => Boako.Team.confirmStarPlacement(winSeasonNo);
        } else {
            const count = team.champion_star_count || 0;
            titleEl.innerText = `⭐ 별 위치 초기화 (총 ${count}개)`;
            descEl.innerText = `별 ${count}개를 원하는 위치로 각각 다시 배치해주세요. (원본 로고 기준으로 다시 그립니다)`;
            // 별들이 서로 겹치지 않도록 초기 위치를 가로로 살짝 흩어서 배치
            const initialStars = Array.from({ length: count }, (_, i) => {
                const spread = count > 1 ? (i / (count - 1)) : 0.5;
                const x = 0.2 + spread * 0.6;
                return `<div class="star-drag" style="position:absolute; left:${x * 100}%; top:15%; transform:translate(-50%,-50%); width:15%; cursor:grab; touch-action:none;" data-rel-x="${x}" data-rel-y="0.15">${starSvg}</div>`;
            }).join('');
            wrap.innerHTML = `
                <img src="${team.logo_url_origin}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none;">
                ${initialStars}
            `;
            switchEl.innerHTML = winSeasonNo
                ? `<button onclick="Boako.Team._renderStarModalMode('add', ${winSeasonNo})" class="text-xs font-bold text-slate-400 hover:text-slate-600 underline">새 별 추가로 돌아가기</button>`
                : '';
            confirmBtn.onclick = () => Boako.Team.confirmStarReset();
        }

        wrap.querySelectorAll('.star-drag').forEach(el => Boako.Team._makeDraggableStar(el, wrap));
        confirmBtn.disabled = false;
        confirmBtn.innerText = '확정하고 저장';
    },

    confirmStarPlacement: async (winSeasonNo) => {
        const team = Boako.state.team.info;
        const wrap = document.getElementById('star-canvas-wrap');
        const starEl = wrap.querySelector('.star-drag');
        const relX = parseFloat(starEl.dataset.relX);
        const relY = parseFloat(starEl.dataset.relY);

        const btn = document.getElementById('star-modal-confirm');
        btn.disabled = true; btn.innerText = '저장 중...';

        try {
            const blob = await Boako.Team._compositeStars(team.logo_url, [{ relX, relY, relSize: 0.16 }]);
            const newLogoUrl = await Boako.Team._uploadStarLogo(blob);

            const { error } = await Boako.db.from('teams').update({
                logo_url: newLogoUrl,
                champion_star_count: (team.champion_star_count || 0) + 1,
                last_star_season_no: winSeasonNo
            }).eq('id', team.id);
            if (error) throw error;

            document.getElementById('boako-star-modal')?.remove();
            Boako.Util.toast('🌟 우승 별이 로고에 새겨졌습니다!');
            if (window.sfx && window.sfx.success) window.sfx.success();
            Boako.View.render('team');
        } catch (err) {
            console.error('우승 별 저장 실패:', err);
            Boako.Util.toast('❌ ' + (err.message || '저장에 실패했습니다.'));
            btn.disabled = false; btn.innerText = '확정하고 저장';
        }
    },

    confirmStarReset: async () => {
        const team = Boako.state.team.info;
        const wrap = document.getElementById('star-canvas-wrap');
        const starEls = [...wrap.querySelectorAll('.star-drag')];
        const positions = starEls.map(el => ({
            relX: parseFloat(el.dataset.relX),
            relY: parseFloat(el.dataset.relY),
            relSize: 0.16
        }));

        const btn = document.getElementById('star-modal-confirm');
        btn.disabled = true; btn.innerText = '저장 중...';

        try {
            const blob = await Boako.Team._compositeStars(team.logo_url_origin, positions);
            const newLogoUrl = await Boako.Team._uploadStarLogo(blob);

            const { error } = await Boako.db.from('teams').update({ logo_url: newLogoUrl }).eq('id', team.id);
            if (error) throw error;

            document.getElementById('boako-star-modal')?.remove();
            Boako.Util.toast('✅ 별 위치가 초기화되었습니다.');
            Boako.View.render('team');
        } catch (err) {
            console.error('별 위치 초기화 실패:', err);
            Boako.Util.toast('❌ ' + (err.message || '저장에 실패했습니다.'));
            btn.disabled = false; btn.innerText = '확정하고 저장';
        }
    },

    addMember: () => {
        const existing = document.getElementById('boako-invite-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="boako-invite-modal" class="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style="animation: fadeIn 0.2s ease-out;">
                <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                    <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <h3 class="font-black text-lg text-slate-800 flex items-center gap-2">🔍 멤버 스카웃</h3>
                        <button onclick="document.getElementById('boako-invite-modal').remove()" class="text-slate-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">✕</button>
                    </div>
                    <div class="p-5">
                        <div class="flex gap-2 mb-4">
                            <input type="text" id="invite-search-input" class="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="닉네임으로 유저 검색" onkeypress="if(event.key==='Enter') Boako.Team.searchUser()">
                            <button onclick="Boako.Team.searchUser()" class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 shadow-sm transition-colors">검색</button>
                        </div>
                        <div id="invite-search-results" class="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            <div class="text-center text-slate-400 text-sm py-8 font-bold">찾고 싶은 팀원의 닉네임을 검색하세요.</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => {
            const input = document.getElementById('invite-search-input');
            if(input) input.focus();
        }, 100);
    },

    searchUser: async () => {
        const keyword = document.getElementById('invite-search-input').value.trim();
        const resultContainer = document.getElementById('invite-search-results');
        
        if (!keyword) {
            resultContainer.innerHTML = `<div class="text-center text-red-400 text-sm py-8 font-bold">검색어를 입력해주세요.</div>`;
            return;
        }

        resultContainer.innerHTML = `<div class="text-center text-slate-500 text-sm py-8 font-bold animate-pulse">데이터베이스 검색 중... ⏳</div>`;

        try {
            const { data: users, error } = await Boako.db
                .from('profiles')
                .select('id, full_name, profile_url, custom_avatar_url')
                .ilike('full_name', `%${keyword}%`)
                .limit(10);

            if (error) throw error;

            if (!users || users.length === 0) {
                resultContainer.innerHTML = `<div class="text-center text-slate-400 text-sm py-8 font-bold">일치하는 유저가 없습니다.</div>`;
                return;
            }

            let listHtml = '';
            users.forEach(u => {
                if (u.id === Boako.state.user.id) return;
                
                // 🌟 커스텀 프사 우선 + 보안 연결 처리 방어 코드 적용
                const avatarUrl = u.custom_avatar_url || u.profile_url;
                const secureProfileUrl = avatarUrl ? avatarUrl.replace(/^http:\/\//i, 'https://') : null;
                
                listHtml += `
                    <div class="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-indigo-100 transition-all group">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center border border-slate-200 flex-shrink-0">
                                ${secureProfileUrl ? `<img src="${Boako.Util.cdn(secureProfileUrl)}" class="w-full h-full object-cover">` : '<span class="text-xl">👤</span>'}
                            </div>
                            <span class="font-black text-slate-700 text-sm">${u.full_name}</span>
                        </div>
                        <button onclick="Boako.Team.executeInvite('${u.id}', '${u.full_name}')" class="bg-white border border-emerald-500 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow-sm whitespace-nowrap">
                            💌 스카웃
                        </button>
                    </div>
                `;
            });

            if (listHtml === '') listHtml = `<div class="text-center text-slate-400 text-sm py-8 font-bold">초대 가능한 유저가 없습니다.</div>`;
            resultContainer.innerHTML = listHtml;

        } catch (err) {
            resultContainer.innerHTML = `<div class="text-center text-red-500 text-sm py-8 font-bold">검색 중 오류 발생:<br>${err.message}</div>`;
        }
    },

    executeInvite: async (targetId, targetName) => {
        if (!confirm(`[${targetName}] 님에게 스카웃 제안을 발송하시겠습니까?`)) return;

        try {
            const payload = {
                sender_id: Boako.state.user.id,
                sender_name_override: Boako.state.user.nickname,
                receiver_id: targetId,
                receiver_name_override: targetName,
                content: JSON.stringify({
                    text: `👋 [${Boako.state.team.info.team_name}] 팀에서 귀하를 영입하고 싶어 합니다!`,
                    team_id: Boako.state.team.info.id,
                    team_name: Boako.state.team.info.team_name
                }),
                action_type: 'TEAM_INVITE'
            };

            const { error: msgErr } = await Boako.db.from('messages').insert([payload]);
            if (msgErr) throw msgErr;

            Boako.Util.toast(`🎉 ${targetName} 님에게 스카웃 제안서를 성공적으로 보냈습니다!`);
            const existing = document.getElementById('boako-invite-modal');
            if (existing) existing.remove();
            
        } catch (err) {
            Boako.Util.toast("❌ 초대 실패: " + err.message);
        }
    },

    kick: async (name) => {
        if (!confirm(`${name} 님을 방출하시겠습니까? 기록은 보존됩니다.`)) return;
        await Boako.db.from('team_members').update({ is_active: false, left_at: new Date().toISOString() })
            .eq('team_id', Boako.state.team.info.id).eq('player_name', name).eq('is_active', true);
        Boako.View.render('team');
    },
    
    leave: async () => {
        if (!confirm("정말 팀에서 탈퇴하시겠습니까? 이적 기록은 보존됩니다.")) return;
        await Boako.db.from('team_members').update({ is_active: false, left_at: new Date().toISOString() })
            .eq('team_id', Boako.state.team.info.id).eq('player_name', Boako.state.user.nickname).eq('is_active', true);
        location.reload();
    },

    openBanVote: async () => {
        const existingModal = document.getElementById('ban-vote-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="ban-vote-modal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onclick="if(event.target === this) this.remove()">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" style="max-height: 90vh;">
                    <div class="bg-red-600 px-6 py-4 flex justify-between items-center text-white">
                        <div>
                            <h2 class="text-xl font-black flex items-center gap-2"><span class="text-2xl">🚫</span> 대항전 밴(Ban) 투표소</h2>
                            <p class="text-red-100 text-sm font-bold mt-1">우리 팀을 대표하여 밴할 종목을 선택하세요.</p>
                        </div>
                        <button onclick="document.getElementById('ban-vote-modal').remove()" class="text-white hover:text-red-200 font-bold text-3xl transition-colors leading-none">&times;</button>
                    </div>

                    <div id="ban-vote-content" class="p-6 overflow-y-auto flex-1 bg-slate-50 custom-scrollbar">
                        <div class="text-center py-12">
                            <span class="text-4xl inline-block animate-bounce mb-3">⏳</span>
                            <h3 class="text-lg font-bold text-slate-600">투표 가능한 후보 종목을 불러오는 중...</h3>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => { Boako.Team.loadBanCandidates(); }, 500); 
    },

    loadBanCandidates: async () => {
        const contentArea = document.getElementById('ban-vote-content');
        if (!contentArea) return;

        console.log("========================================");
        console.log("🕵️‍♂️ [추적 시작] 밴 투표소 로드 및 팀장 밴픽 판별 로직");
        console.log("========================================");

        try {
            // 1. 시즌 번호 가져오기
            const { data: currentSeason } = await Boako.db.from('seasons')
                .select('season_no').lte('start_date', new Date().toISOString()).gte('end_date', new Date().toISOString()).maybeSingle();
            let seasonNo = currentSeason ? currentSeason.season_no : null;
            
            if (!seasonNo) {
                const { data: lastSeason } = await Boako.db.from('seasons')
                    .select('season_no').lt('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
                seasonNo = lastSeason ? lastSeason.season_no : null;
            }

            console.log("▶️ 1. 시즌 번호:", seasonNo);

            if (!seasonNo) {
                contentArea.innerHTML = `<div class="text-center py-12 text-slate-500 font-bold">진행 중인 시즌 정보가 없습니다.</div>`;
                return;
            }

            const teamId = Boako.state.team.info.id;
            const teamName = Boako.state.team.info.team_name;
            const myName = Boako.state.user.nickname;
            const isLeader = Boako.state.team.type === 'LEADER';

            console.log(`▶️ 2. 접속자 닉네임: [${myName}], 권한상태: [${Boako.state.team.type}]`);

            // 🌟 [소장님 로직 구현 1단계] 현재 팀의 모든 멤버 데이터를 가져옵니다.
            const { data: teamMembers, error: memErr } = await Boako.db
                .from('team_members')
                .select('player_name, role')
                .eq('team_id', teamId)
                .eq('is_active', true);

            if (memErr) throw memErr;
            console.log("▶️ 3. [team_members] 데이터 로드 완료:", teamMembers);

            // 🌟 [소장님 로직 구현 2단계] 투표 내역을 가져옵니다.
            const { data: teamVotes, error: voteError } = await Boako.db
                .from('grandprix_ban_votes')
                .select('banned_game_name, voter_name, updated_at')
                .eq('season_no', seasonNo)
                .eq('team_name', teamName);

            if (voteError) throw voteError;
            console.log("▶️ 4. [grandprix_ban_votes] 투표 내역 로드 완료:", teamVotes);

            // 🌟 3. 투표 대조 및 팀장 판별
            let myBannedGame = null;
            let leaderVotedGame = null;
            const voteCounts = {}; 
            const firstVoteTimes = {}; 

            console.log("▶️ 5. 투표자 ↔ 팀 멤버 직급 대조 시작");
            (teamVotes || []).forEach(v => {
                if (v.voter_name === myName) {
                    myBannedGame = v.banned_game_name;
                }

                // 🔥 [소장님 로직 구현 3단계] voter_name과 일치하는 player_name을 찾고, 그 사람의 role이 LEADER인지 확인
                const matchedMember = teamMembers.find(m => m.player_name === v.voter_name);
                
                if (matchedMember) {
                    console.log(`   👉 투표자 [${v.voter_name}] 매칭 성공 -> 직급(role): [${matchedMember.role}]`);
                    if (matchedMember.role === 'LEADER') {
                        leaderVotedGame = v.banned_game_name;
                        console.log(`      👑 [팀장 투표 감지!] 팀장 권한 밴 종목 확정: [${leaderVotedGame}]`);
                    }
                } else {
                    console.log(`   👉 투표자 [${v.voter_name}] 매칭 실패 (팀 멤버 목록에 없음)`);
                }

                // 다수결 집계
                if (!voteCounts[v.banned_game_name]) {
                    voteCounts[v.banned_game_name] = 0;
                    firstVoteTimes[v.banned_game_name] = new Date(v.updated_at).getTime();
                }
                voteCounts[v.banned_game_name] += 1;
                
                const vTime = new Date(v.updated_at).getTime();
                if (vTime < firstVoteTimes[v.banned_game_name]) {
                    firstVoteTimes[v.banned_game_name] = vTime;
                }
            });

            // 🌟 4. 전광판 렌더링 최우선순위 설정
            const isBanConfirmed = (leaderVotedGame !== null);
            let leadingGame = leaderVotedGame; 
            let leadingReason = isBanConfirmed ? 'LEADER' : '';
            
            // 팀장이 투표하지 않았을 때만 다수결 시뮬레이션
            if (!isBanConfirmed && Object.keys(voteCounts).length > 0) {
                let maxCount = 0;
                let earliestTime = Infinity;

                for (const [gameName, count] of Object.entries(voteCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        leadingGame = gameName;
                        earliestTime = firstVoteTimes[gameName];
                        leadingReason = 'MAJORITY';
                    } else if (count === maxCount) {
                        if (firstVoteTimes[gameName] < earliestTime) {
                            leadingGame = gameName;
                            earliestTime = firstVoteTimes[gameName];
                            leadingReason = 'FIRST_COME';
                        }
                    }
                }
            }

            console.log(`▶️ 6. 최종 판독 결과 -> 밴 확정 여부: [${isBanConfirmed}], 표기될 게임: [${leadingGame}], 사유: [${leadingReason}]`);

            const { data: games, error } = await Boako.db
                .from('grandprix_games')
                .select('id, game_name, game_logo_url')
                .eq('season_no', seasonNo)
                .order('selection_rank', { ascending: true });

            if (error) throw error;

            if (!games || games.length === 0) {
                contentArea.innerHTML = `<div class="text-center py-12 text-slate-400 font-bold">후보 종목이 없습니다.</div>`;
                return;
            }

            // 🌟 5. UI 렌더링
            let html = ``;
            const hasIVoted = myBannedGame !== null; 
            
            if (isBanConfirmed) {
                html += `
                    <div class="mb-5 p-4 bg-slate-800 border border-slate-700 rounded-xl text-center shadow-md">
                        <span class="text-yellow-400 font-black text-sm block mb-1">👑 팀장 권한으로 밴 확정됨</span>
                        <span class="text-red-500 font-black text-lg line-through decoration-red-600/50">🚫 ${leadingGame}</span>
                        <p class="text-xs text-slate-400 mt-2 font-bold">팀장 권한으로 밴이 확정되어 투표가 마감되었습니다.</p>
                    </div>`;
            } else if (leadingGame) {
                html += `
                    <div class="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center shadow-sm">
                        <span class="text-blue-600 font-black text-sm block mb-1">👥 현재 팀 밴 유력 종목 (다수결/선착순)</span>
                        <span class="text-red-600 font-black text-lg ${hasIVoted ? 'line-through decoration-red-600/50' : ''}">🚫 ${leadingGame}</span>
                        ${!hasIVoted ? `<p class="text-xs text-blue-500 mt-2 font-bold animate-pulse">투표를 완료해야 밴(Ban) 효과가 표시됩니다.</p>` : ''}
                    </div>`;
            } else {
                html += `
                    <div class="mb-5 p-4 bg-slate-100 border border-slate-200 rounded-xl text-center text-slate-500 font-bold text-sm shadow-sm">
                        아직 밴(Ban) 투표 내역이 없습니다. 가장 먼저 의견을 내주세요!
                    </div>`;
            }

            html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">`;
            
            games.forEach(game => {
                const isLeaderPick = isBanConfirmed && (game.game_name === leaderVotedGame);
                const isMyPick = myBannedGame === game.game_name;
                const isLeadingByMajority = (!isBanConfirmed) && (leadingGame === game.game_name);
                const currentVotes = voteCounts[game.game_name] || 0;
                
                const showBannedEffect = isLeaderPick || (isLeadingByMajority && hasIVoted);

                const cardClass = showBannedEffect 
                    ? 'bg-slate-200 border-2 border-red-600 shadow-none' 
                    : (isMyPick && !isBanConfirmed ? 'bg-indigo-50 border-2 border-indigo-400 shadow-md' : 'bg-white border border-slate-200 shadow-sm hover:shadow-md');
                
                let btnClass = '';
                let btnText = '';
                let disableVote = false;

                // 🔥 팀장/팀원 권한별 버튼 상태 분리
                if (isLeader) {
                    if (isMyPick) {
                        btnClass = 'w-full bg-slate-800 text-yellow-400 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-700 shadow-inner';
                        btnText = '👑 팀장 밴 확정됨';
                        disableVote = true; 
                    } else {
                        btnClass = 'w-full bg-slate-800 hover:bg-red-600 hover:text-white text-yellow-400 text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-700 shadow-sm active:scale-95';
                        btnText = '👑 이 종목으로 변경';
                        disableVote = false; 
                    }
                } else {
                    if (isBanConfirmed) {
                        if (isLeaderPick) {
                            btnClass = 'w-full bg-slate-800 text-yellow-400 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-700 shadow-inner';
                            btnText = '👑 팀장 밴 확정됨';
                        } else {
                            btnClass = 'w-full bg-slate-100 text-slate-400 text-xs font-bold py-2.5 rounded-lg cursor-not-allowed';
                            btnText = '🔒 투표 마감';
                        }
                        disableVote = true;
                    } else {
                        if (isMyPick) {
                            btnClass = 'w-full bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-lg cursor-default shadow-inner';
                            btnText = '✅ 내 투표 반영됨';
                            disableVote = true; 
                        } else if (showBannedEffect) {
                            btnClass = 'w-full bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-800';
                            btnText = '🛑 현재 밴 유력';
                            disableVote = false;
                        } else {
                            btnClass = 'w-full bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-600 text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-200 shadow-sm active:scale-95';
                            btnText = '✋ 이 종목 밴 투표';
                            disableVote = false;
                        }
                    }
                }

                const imgClass = showBannedEffect
                    ? 'w-full h-full object-contain p-3 grayscale opacity-30'
                    : 'w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-300';

                const textClass = showBannedEffect ? 'text-slate-400 line-through' : 'text-slate-700';

                html += `
                    <div class="rounded-xl overflow-hidden transition-all flex flex-col group ${cardClass} relative">
                        ${currentVotes > 0 && (hasIVoted || isBanConfirmed) && !showBannedEffect ? `
                            <div class="absolute top-2 right-2 z-10 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md">
                                👤 ${currentVotes}표
                            </div>
                        ` : ''}

                        <div class="aspect-square flex items-center justify-center relative overflow-hidden border-b ${showBannedEffect ? 'border-red-600 bg-slate-300' : 'border-slate-100 bg-slate-100'}">
                            ${game.game_logo_url 
                                ? `<img src="${Boako.Util.cdn(game.game_logo_url)}" class="${imgClass}">` 
                                : `<span class="text-5xl drop-shadow-md ${showBannedEffect ? 'grayscale opacity-30' : ''}">🎲</span>`
                            }
                            
                            ${showBannedEffect ? `
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                    <span class="text-red-600 font-black text-2xl tracking-widest rotate-[-15deg] border-4 border-red-600 px-2 py-1 rounded opacity-90 shadow-sm bg-white/50 backdrop-blur-sm">BANNED</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="p-4 text-center flex-1 flex flex-col justify-between gap-3 ${showBannedEffect ? 'bg-slate-200' : ''}">
                            <h4 class="font-black ${textClass} text-sm break-keep leading-tight">${game.game_name}</h4>
                            <button ${disableVote ? 'disabled' : `onclick="Boako.Team.submitBanVote('${game.id}', '${game.game_name}')"`} 
                                    class="${btnClass}">
                                ${btnText}
                            </button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            contentArea.innerHTML = html;
            console.log("========================================");
            console.log("🏁 [추적 종료] 렌더링 완료");
            console.log("========================================");

        } catch (err) {
            console.error("데이터 로드 실패:", err);
            contentArea.innerHTML = `<div class="text-center py-12 text-red-500 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    submitBanVote: async (gameId, gameName) => {
        const confirmVote = confirm(`정말 [${gameName}] 종목을 밴(Ban) 하시겠습니까?\n투표가 완료되면 결과가 반영됩니다.`);
        
        if (confirmVote) {
            try {
                const { error } = await Boako.db.rpc('fn_vote_grandprix_ban', {
                    p_season_no: null, 
                    p_banned_game_name: gameName
                });

                if (error) throw error;

                Boako.Util.toast(`[${gameName}] 밴 투표가 성공적으로 완료되었습니다!`);
                Boako.Team.loadBanCandidates();
                
            } catch (err) {
                console.error("투표 에러:", err);
                alert("투표 처리 중 오류가 발생했습니다:\n" + err.message);
            }
        }
    },

   // 🌟 1. 엔트리 작전판(모달) 열기 (팀장/팀원 권한 분리 적용)
    openEntryForm: async () => {
        try {
            // 1. 현재 시즌 및 팀 정보 가져오기
            const { data: currentSeason } = await Boako.db.from('seasons')
                .select('*')
                .lte('start_date', new Date().toISOString())
                .gte('end_date', new Date().toISOString())
                .maybeSingle();
            
            const seasonNo = currentSeason ? currentSeason.season_no : 1;
            const teamName = Boako.state.team.info.team_name;
            const isLeader = Boako.state.team.type === 'LEADER'; // 💡 팀장 여부 확인
            const myName = Boako.state.user.nickname; // 💡 내 닉네임

            // 2. 본선(FINAL) 확정된 종목만 가져오기
            const { data: finalGames } = await Boako.db.from('grandprix_games')
                .select('*')
                .eq('season_no', seasonNo)
                .eq('status', 'FINAL')
                .order('selection_rank', { ascending: true });

            if (!finalGames || finalGames.length === 0) {
                Boako.Util.toast('본선 확정 종목이 없습니다. 정산을 기다려주세요.', 'error');
                return;
            }

            // 3. 우리 팀 멤버 목록 (팀장용 드롭다운에 사용)
            const { data: members } = await Boako.db.from('team_members')
                .select('*')
                .eq('team_id', Boako.state.team.info.id)
                .eq('is_active', true);

            // 4. 기존에 저장해둔 엔트리가 있는지 불러오기
            const { data: existingEntries } = await Boako.db.from('grandprix_entries')
                .select('*')
                .eq('season_no', seasonNo)
                .eq('team_name', teamName);

            // 5. 모달 UI 생성
            let html = `
                <div id="entry-modal-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div class="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        
                        <div class="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h2 class="text-2xl font-black flex items-center gap-2">
                                    <span class="text-3xl">📝</span> 엔트리 작전판 ${isLeader ? '<span class="text-sm bg-yellow-500 text-black px-2 py-0.5 rounded ml-2">팀장 모드</span>' : ''}
                                </h2>
                                <p class="text-emerald-100 text-sm font-bold mt-1">
                                    ${isLeader ? '팀장은 전체 엔트리를 자유롭게 수정할 수 있습니다.' : '출전을 원하는 종목에 본인을 등록하세요.'}
                                </p>
                            </div>
                            <button onclick="document.getElementById('entry-modal-overlay').remove()" class="text-white hover:text-emerald-200 p-2 transition-colors">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div class="p-6 overflow-y-auto custom-scrollbar bg-slate-50 flex-1">
                            <form id="team-entry-form" onsubmit="Boako.Team.saveEntry(event, ${seasonNo}, '${teamName}')" class="space-y-4">
            `;

            finalGames.forEach(game => {
                const saved = existingEntries?.find(e => e.game_name === game.game_name);
                const savedPlayer = saved ? saved.player_name : '';
                
                let selectHtml = '';

                // 🔥 [핵심 로직] 권한에 따른 드롭다운 분기 처리
                if (isLeader) {
                    // 👑 1. 팀장: 모든 팀원을 선택할 수 있는 전권 드롭다운
                    const entryCId = `entry-${game.game_name}`.replace(/\s+/g, '_');
                    selectHtml = `
                        <input type="hidden" name="entry_game_${game.game_name}" id="hidden-${entryCId}" value="${savedPlayer}">
                        ${Boako.Util.renderCSelect(
                            entryCId,
                            [
                                { value: '', label: '미정 / 출전 포기' },
                                ...members.map(m => ({ value: m.player_name, label: `${m.player_name} ${m.role === 'LEADER' ? '(팀장)' : ''}` }))
                            ],
                            savedPlayer,
                            'w-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold py-3 pl-4 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm shadow-inner transition-all',
                            `Boako.Team.setEntryHidden_${entryCId}`
                        )}
                    `;
                    Boako.Team[`setEntryHidden_${entryCId}`] = (value) => {
                        const el = document.getElementById(`hidden-${entryCId}`);
                        if (el) el.value = value;
                    };
                } else {
                    // 👤 2. 일반 팀원 로직
                    if (savedPlayer && savedPlayer !== myName) {
                        // 다른 사람이 이미 선점한 경우 -> 수정 불가 (읽기 전용)
                        selectHtml = `
                            <select disabled class="w-full appearance-none bg-slate-100 border border-slate-200 text-slate-500 font-bold py-3 px-4 rounded-xl cursor-not-allowed text-sm">
                                <option>${savedPlayer} 출전 예정</option>
                            </select>
                            <div class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">🔒</div>
                            <!-- 폼 제출 시 빈값 날아가는 걸 방지하기 위해 hidden input으로 값 유지 -->
                            <input type="hidden" name="entry_game_${game.game_name}" value="${savedPlayer}">
                        `;
                    } else {
                        // 빈자리이거나, 내가 선점한 자리인 경우 -> 본인 선택 또는 취소(미정) 가능
                        const entryCId = `entry-${game.game_name}`.replace(/\s+/g, '_');
                        selectHtml = `
                            <input type="hidden" name="entry_game_${game.game_name}" id="hidden-${entryCId}" value="${savedPlayer}">
                            ${Boako.Util.renderCSelect(
                                entryCId,
                                [
                                    { value: '', label: '미정 (빈자리)' },
                                    { value: myName, label: `🙋‍♂️ ${myName} (본인 출전)` }
                                ],
                                savedPlayer,
                                'w-full bg-white border border-blue-200 text-blue-700 font-bold py-3 pl-4 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-sm shadow-sm transition-all hover:bg-blue-50',
                                `Boako.Team.setEntryHidden_${entryCId}`
                            )}
                        `;
                        Boako.Team[`setEntryHidden_${entryCId}`] = (value) => {
                            const el = document.getElementById(`hidden-${entryCId}`);
                            if (el) el.value = value;
                        };
                    }
                }

                html += `
                    <div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 hover:border-emerald-300 transition-colors shadow-sm">
                        <div class="w-16 h-16 shrink-0 bg-slate-100 rounded-xl flex items-center justify-center p-2 border border-slate-200 relative">
                            ${game.game_logo_url ? `<img src="${Boako.Util.cdn(game.game_logo_url)}" class="max-h-full max-w-full object-contain">` : '<span class="text-3xl">🎲</span>'}
                        </div>
                        <div class="flex-1 text-center sm:text-left w-full">
                            <h4 class="font-black text-slate-800 text-lg">${game.game_name}</h4>
                            <p class="text-slate-400 text-xs font-bold mt-1">출전 선수를 할당하세요.</p>
                        </div>
                        
                        <!-- 렌더링된 드롭다운 삽입 -->
                        <div class="w-full sm:w-48 shrink-0 relative">
                            ${selectHtml}
                        </div>
                    </div>
                `;
            });

            html += `
                            </form>
                        </div>
                        
                        <div class="p-6 bg-white border-t border-slate-100 shrink-0">
                            <button type="submit" form="team-entry-form" class="w-full bg-emerald-600 text-white font-black text-lg py-4 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2">
                                💾 작전판 임시 저장하기
                            </button>
                            <p class="text-center text-slate-400 text-xs font-bold mt-3">저장해도 마감 전까지 다른 팀에게는 🔒 비공개 처리됩니다.</p>
                        </div>

                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', html);

        } catch (err) {
            console.error("작전판 로드 에러:", err);
            Boako.Util.toast('엔트리 작전판을 여는 중 오류가 발생했습니다.', 'error');
        }
    },

    // 🌟 2. 엔트리 데이터 DB에 저장 (로딩 함수 제거)
    saveEntry: async (e, seasonNo, teamName) => {
        e.preventDefault();
        try {
            const formData = new FormData(e.target);
            const entries = [];

            for (const [key, value] of formData.entries()) {
                if (key.startsWith('entry_game_')) {
                    entries.push({
                        game_name: key.replace('entry_game_', ''),
                        player_name: value || null
                    });
                }
            }

            const { error } = await Boako.db.rpc('save_grandprix_entries', {
                p_season_no: seasonNo,
                p_entries: entries
            });
            if (error) throw error;

            if (window.sfx) window.sfx.rosterLock();
            Boako.Util.toast('✅ 엔트리가 성공적으로 업데이트 되었습니다!');
            document.getElementById('entry-modal-overlay').remove();
            
        } catch (err) {
            console.error("엔트리 저장 에러:", err);
            Boako.Util.toast('저장 실패: ' + (err.message || '다시 시도해 주세요.'), 'error');
        }
    },

openMatchRoom: async function(roomId) {
        await Boako.View.render('messenger');
        setTimeout(() => {
            if (Boako.Messenger && Boako.Messenger.View) {
                Boako.Messenger.View.openRoom(roomId);
            }
        }, 800);
    },

    loadMatchSchedule: async function() {
        const container = document.getElementById('team-match-schedule-container');
        if (!container) return;

        try {
            const teamName = Boako.state.team.info.team_name;

const { data: gameList } = await Boako.db.from('games').select('game_name, image_url');
            const gameLogoMap = {};
            (gameList || []).forEach(g => { gameLogoMap[g.game_name] = g.image_url; });

            const { data: gameScores } = await Boako.db.from('grandprix_game_scores').select('game_name, scores, source_url');
            const gameScoreMap = {};
            (gameScores || []).forEach(gs => { gameScoreMap[gs.game_name] = gs; });

            const { data: schedules } = await Boako.db
                .from('match_schedules')
                .select('*')
                .filter('participants', 'cs', `[{"team_name":"${teamName}"}]`)
                .eq('match_type', 'GRANDPRIX')
                .order('scheduled_time', { ascending: true });

            if (!schedules || schedules.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl bg-slate-50">
                        아직 확정된 대항전 경기 일정이 없습니다.<br>
                        <span class="text-xs mt-1 block">소통 채널에서 일정 조율을 진행해주세요.</span>
                    </div>`;
                return;
            }

            const statusMap = {
                UPCOMING: { label: '예정', cls: 'bg-blue-100 text-blue-700' },
                IN_PROGRESS: { label: '진행 중', cls: 'bg-amber-100 text-amber-700 animate-pulse' },
                COMPLETED: { label: '완료', cls: 'bg-emerald-100 text-emerald-700' }
            };

            const html = schedules.map(s => {
                const dt = new Date(s.scheduled_time).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const st = statusMap[s.status] || { label: s.status, cls: 'bg-slate-100 text-slate-500' };
                const logoUrl = gameLogoMap[s.game_name];
                const logoHtml = logoUrl
                    ? `<img src="${Boako.Util.cdn(logoUrl)}" class="w-10 h-10 rounded-xl object-contain bg-slate-50 border border-slate-100 shadow-sm flex-shrink-0 p-1">`
                    : `<div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">🎲</div>`;

                const opponent = (s.participants || []).find(p => p.team_name !== teamName);
                const opponentHtml = opponent ? `<div class="text-xs text-slate-400 font-bold">vs ${opponent.team_name}</div>` : '';

const isCompleted = s.status === 'COMPLETED';
                const scoreInfo = gameScoreMap[s.game_name];
                const lpEarned = isCompleted && scoreInfo ? (scoreInfo.scores?.[teamName] ?? null) : null;
                const tournamentUrl = isCompleted && scoreInfo ? scoreInfo.source_url : null;

                const cardClass = isCompleted
                    ? 'bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer'
                    : 'bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer';

                const onclickAttr = isCompleted && tournamentUrl
                    ? `onclick="window.open('${tournamentUrl}', '_blank')"`
                    : `onclick="Boako.Team.openMatchRoom('${s.reference_id}')"`;

                const lpBadge = isCompleted && lpEarned !== null
                    ? `<div class="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">🏆 ${lpEarned} LP</div>`
                    : '';

                return `
                    <div class="${cardClass}" ${onclickAttr}>
                        ${logoHtml}
                        <div class="flex-1 min-w-0">
                            <div class="font-black text-slate-800 text-sm truncate">${s.game_name}</div>
                            ${opponentHtml}
                            <div class="text-xs text-slate-500 font-bold mt-0.5">📅 ${dt}</div>
                            ${lpBadge}
                        </div>
                        <span class="text-xs font-black px-2.5 py-1 rounded-lg flex-shrink-0 ${st.cls}">${st.label}</span>
                    </div>`;
            }).join('');

            container.innerHTML = `<div class="flex flex-col gap-2">${html}</div>`;

        } catch (e) {
            console.error('대항전 일정 로드 실패:', e);
            container.innerHTML = `<div class="text-center py-6 text-red-400 font-bold">일정 로드 실패: ${e.message}</div>`;
        }
    },

    loadWalletTab: async function() {
        const container = document.getElementById('team-wallet-container');
        if (!container) return;

        container.innerHTML = `<div class="text-center py-10 font-black text-slate-400 animate-pulse">지갑 정보 로드 중...</div>`;

        try {
            const userId = Boako.state.user.id;
            const teamId = Boako.state.team.info.id;
            const teamName = Boako.state.team.info.team_name;

            const { data: profile } = await Boako.db.from('profiles').select('points').eq('id', userId).single();
            const { data: teamInfo } = await Boako.db.from('teams').select('tpoint').eq('id', teamId).single();

            const myPoints = profile?.points || 0;
            const teamPoints = teamInfo?.tpoint || 0;

            // 순위 배율까지 반영된 실제 요율을 직접 계산해서 가져옴 (하드코딩 아님, 화면 표시도 실제 요율과 일치)
            const { data: realFeeRate } = await Boako.db.rpc('fn_get_team_fee_rate', { p_team_name: teamName });
            const feeRate = realFeeRate != null ? realFeeRate : 0.2;
            const feeRatePercent = Math.round(feeRate * 100);

const isLeader = Boako.state.team.type === 'LEADER';

            container.innerHTML = `
                <style>
                    .wallet-drop-zone { transition: all .2s ease; }
                    .wallet-drop-zone.drag-over { border-color: #f59e0b !important; background: #fffbeb !important; transform: scale(1.01); }
                    .wallet-member-chip { display:flex; align-items:center; gap:6px; background:#fff; border:1px solid #e2e8f0; border-radius:9999px; padding:6px 14px; font-size:12px; font-weight:800; color:#334155; cursor:grab; user-select:none; transition: all .15s; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
                    .wallet-member-chip:hover { border-color:#6366f1; box-shadow: 0 2px 8px rgba(99,102,241,.15); transform: translateY(-1px); }
                    .wallet-member-chip.dragging { opacity: 0.4; }
                    .wallet-member-chip-role { font-size:10px; }
                    .wallet-target-chip { display:inline-flex; align-items:center; gap:6px; background:#fef3c7; border:1px solid #f59e0b; border-radius:9999px; padding:4px 12px; font-size:12px; font-weight:900; color:#92400e; }
                    .wallet-target-chip button { color:#b45309; font-weight:900; margin-left:2px; cursor:pointer; }
                </style>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div class="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">내 개인 포인트</div>
                        <div class="text-2xl font-black text-slate-800">${myPoints.toLocaleString()} <span class="text-sm text-slate-400">P</span></div>
                    </div>
                    <div class="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5 shadow-sm">
                        <div class="text-xs font-black text-indigo-400 uppercase tracking-wider mb-1">우리 팀 금고</div>
                        <div class="text-2xl font-black text-indigo-700">${teamPoints.toLocaleString()} <span class="text-sm text-indigo-400">P</span></div>
                    </div>
                </div>

                <div id="wallet-exchange-card" class="wallet-drop-zone bg-slate-50 border border-slate-200 rounded-2xl p-5"
                     ondragover="Boako.Team.onWalletDragOver(event)"
                     ondragleave="Boako.Team.onWalletDragLeave(event)"
                     ondrop="Boako.Team.onWalletDrop(event)">

                    <div id="wallet-mode-default">
                        <h5 class="font-black text-slate-800 text-sm mb-1 flex items-center gap-1.5">💱 팀으로 포인트 환전하기</h5>
                        <p class="text-xs text-slate-400 font-bold mb-1">내 포인트를 팀 금고로 보냅니다. <span class="inline-flex items-center bg-rose-100 text-rose-600 font-black px-2 py-0.5 rounded-md mx-0.5">⚠️ ${feeRatePercent}% 수수료</span> 가 차감됩니다.</p>
                        ${isLeader ? `<p class="text-[11px] text-indigo-500 font-bold mb-3">💡 아래 팀원을 이 카드 위로 드래그하면 그 팀원에게 지급하는 모드로 바뀌어요.</p>` : '<div class="mb-3"></div>'}
                    </div>

                    <div id="wallet-mode-target" class="hidden mb-3">
                        <h5 class="font-black text-amber-800 text-sm mb-1 flex items-center gap-1.5">👑 팀원에게 포인트 지급하기</h5>
                        <p class="text-xs text-amber-600 font-bold mb-3">팀 금고에서 아래 팀원에게 직접 지급합니다. <span class="inline-flex items-center bg-rose-100 text-rose-600 font-black px-2 py-0.5 rounded-md mx-0.5">⚠️ ${feeRatePercent}% 수수료</span> 가 차감됩니다.</p>
                        <div id="wallet-target-display" class="flex items-center gap-2"></div>
                    </div>

                    <div class="flex gap-2 mb-3">
                        <input type="number" id="wallet-amount-input" min="100" step="100" placeholder="100 단위로 입력" class="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" oninput="Boako.Team.updateWalletPreview(${feeRate})">
                        <button id="wallet-submit-btn" onclick="Boako.Team.submitWalletExchange(${feeRate})" class="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm px-6 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap">환전하기</button>
                    </div>

                    <div id="wallet-preview" class="text-xs font-bold text-slate-400 hidden">
                        수수료 <span id="wallet-preview-fee" class="text-rose-500">0</span> P 차감 → <span id="wallet-preview-target">팀에</span> <span id="wallet-preview-net" class="text-indigo-600">0</span> P 지급
                    </div>
                </div>


            `;

        } catch (e) {
            console.error('지갑 탭 로드 실패:', e);
            container.innerHTML = `<div class="text-center py-10 text-red-400 font-bold">오류: ${e.message}</div>`;
        }
    },

   loadTeamPointHistory: async function() {
        const container = document.getElementById('team-point-history-container');
        if (!container) return;

        try {
            const teamId = Boako.state.team.info.id;

            const { data: history, error } = await Boako.db
                .from('team_point_history')
                .select('*')
                .eq('team_id', teamId)
                .order('created_at', { ascending: false })
                .limit(15);

            if (error) throw error;

            if (!history || history.length === 0) {
                container.innerHTML = `
                    <h4 style="font-weight:950; font-size:20px; margin-bottom:20px;">🧾 팀 포인트 이용 내역</h4>
                    <div style="text-align:center; padding:30px; color:#94a3b8; font-weight:700; background:#f8fafc; border-radius:12px;">아직 이용 내역이 없습니다.</div>
                `;
                return;
            }

            const rowsHtml = history.map(log => {
                const date = new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                const isPlus = log.point_change > 0;
                const color = isPlus ? '#10b981' : '#ef4444';
                const sign = isPlus ? '+' : '';
                return `
                    <li style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #f1f5f9;">
                        <div>
                            <div style="font-size:12px; color:#94a3b8; font-weight:600; margin-bottom:3px;">${date}</div>
                            <div style="font-size:15px; font-weight:800; color:#334155;">${log.description}</div>
                        </div>
                        <div style="font-size:16px; font-weight:900; color:${color}; white-space:nowrap;">
                            ${sign}${log.point_change.toLocaleString()} P
                        </div>
                    </li>`;
            }).join('');

            container.innerHTML = `
                <h4 style="font-weight:950; font-size:20px; margin-bottom:20px;">🧾 팀 포인트 이용 내역</h4>
                <ul style="list-style:none; margin:0; padding:0; background:white; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
                    ${rowsHtml}
                </ul>
            `;

            Boako.Team.subscribePointHistoryRealtime(teamId);   // 👈 이 줄 추가

        } catch (e) {
            console.error('팀 포인트 내역 로드 실패:', e);
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444; font-weight:700;">내역 로드 실패: ${e.message}</div>`;
        }
    },

    // ---------- 팀 포인트 내역 실시간 구독 ----------
    pointHistoryChannel: null,

    subscribePointHistoryRealtime: function(teamId) {
        if (Boako.Team.pointHistoryChannel || !Boako.db) return;

        Boako.Team.pointHistoryChannel = Boako.db
            .channel(`team-point-history-${teamId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'team_point_history',
                filter: `team_id=eq.${teamId}`
            }, (payload) => {
                Boako.Team.loadTeamPointHistory();
            })
            .subscribe();
    },

    unsubscribePointHistoryRealtime: function() {
        if (Boako.Team.pointHistoryChannel && Boako.db) {
            Boako.db.removeChannel(Boako.Team.pointHistoryChannel);
            Boako.Team.pointHistoryChannel = null;
        }
    },

    // ---------- 드래그앤드롭 상태 ----------
    walletDragTarget: null,

    onMemberDragStart: function(e, playerName) {
        e.dataTransfer.setData('text/plain', playerName);
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
    },

    onMemberDragEnd: function(e) {
        e.target.classList.remove('dragging');
    },

    onWalletDragOver: function(e) {
        e.preventDefault();
        document.getElementById('wallet-exchange-card')?.classList.add('drag-over');
    },

    onWalletDragLeave: function(e) {
        document.getElementById('wallet-exchange-card')?.classList.remove('drag-over');
    },

    onWalletDrop: function(e) {
        e.preventDefault();
        document.getElementById('wallet-exchange-card')?.classList.remove('drag-over');
        const playerName = e.dataTransfer.getData('text/plain');
        if (!playerName) return;

        if (window.sfx) window.sfx.click();
        Boako.Team.walletDragTarget = playerName;

        document.getElementById('wallet-mode-default').classList.add('hidden');
        document.getElementById('wallet-mode-target').classList.remove('hidden');
        document.getElementById('wallet-target-display').innerHTML = `
            <span class="wallet-target-chip">
                ${playerName}
                <button onclick="Boako.Team.clearWalletTarget()">✕</button>
            </span>
        `;
        document.getElementById('wallet-submit-btn').innerText = '지급하기';

        // 미리보기 텍스트 갱신
        const previewTarget = document.getElementById('wallet-preview-target');
        if (previewTarget) previewTarget.innerText = `${playerName} 님에게`;
    },

    clearWalletTarget: function() {
        Boako.Team.walletDragTarget = null;
        document.getElementById('wallet-mode-default')?.classList.remove('hidden');
        document.getElementById('wallet-mode-target')?.classList.add('hidden');
        const submitBtn = document.getElementById('wallet-submit-btn');
        if (submitBtn) submitBtn.innerText = '환전하기';
        const previewTarget = document.getElementById('wallet-preview-target');
        if (previewTarget) previewTarget.innerText = '팀에';
    },

    updateWalletPreview: function(feeRate) {
        const input = document.getElementById('wallet-amount-input');
        const preview = document.getElementById('wallet-preview');
        const feeEl = document.getElementById('wallet-preview-fee');
        const netEl = document.getElementById('wallet-preview-net');
        if (!input || !preview) return;

        const amount = parseInt(input.value, 10);
        if (!amount || amount <= 0) {
            preview.classList.add('hidden');
            return;
        }

        const fee = Math.floor(amount * feeRate);
        const net = amount - fee;
        feeEl.innerText = fee.toLocaleString();
        netEl.innerText = net.toLocaleString();
        preview.classList.remove('hidden');
    },

    submitWalletExchange: async function(feeRate) {
        const input = document.getElementById('wallet-amount-input');
        const amount = parseInt(input?.value, 10);

        if (!amount || amount <= 0) {
            Boako.Util.toast('환전할 포인트를 입력해주세요.');
            return;
        }
        if (amount % 100 !== 0) {
            Boako.Util.toast('100 단위로만 환전할 수 있습니다.');
            return;
        }

        const target = Boako.Team.walletDragTarget;

        try {
            if (target) {
                // 팀 → 개인 (팀원에게 지급)
                if (!confirm(`${target} 님에게 ${amount.toLocaleString()}P를 지급하시겠습니까?`)) return;

                const { data, error } = await Boako.db.rpc('exchange_team_to_personal', {
                    p_target_player_name: target,
                    p_amount: amount
                });
                if (error) throw error;

                if (window.sfx) window.sfx.buy();
                Boako.Util.toast(`✅ 지급 완료! ${target} 님에게 ${data.net_to_member.toLocaleString()}P가 지급되었습니다.`);

            } else {
                // 개인 → 팀 (기본 환전)
                if (!confirm(`${amount.toLocaleString()}P를 팀으로 환전하시겠습니까?`)) return;

                const { data, error } = await Boako.db.rpc('exchange_personal_to_team', { p_amount: amount });
                if (error) throw error;

                if (window.sfx) window.sfx.buy();
                Boako.Util.toast(`✅ 환전 완료! 팀에 ${data.net_to_team.toLocaleString()}P가 적립되었습니다.`);
            }

            Boako.Team.walletDragTarget = null;
            Boako.Team.loadWalletTab();

        } catch (err) {
            Boako.Util.toast('처리 실패: ' + err.message);
            console.error('환전 실패:', err);
        }
    },

    updateTeamExchangeFeePreview: function(feeRate) {
        const input = document.getElementById('wallet-team-exchange-amount');
        const preview = document.getElementById('wallet-team-fee-preview');
        const feeEl = document.getElementById('wallet-team-fee-amount');
        const netEl = document.getElementById('wallet-team-net-amount');
        if (!input || !preview) return;

        const amount = parseInt(input.value, 10);
        if (!amount || amount <= 0) {
            preview.classList.add('hidden');
            return;
        }

        const fee = Math.floor(amount * feeRate);
        const net = amount - fee;
        feeEl.innerText = fee.toLocaleString();
        netEl.innerText = net.toLocaleString();
        preview.classList.remove('hidden');
    },

    submitExchangeToMember: async function() {
        const targetSelect = document.getElementById('wallet-target-member');
        const input = document.getElementById('wallet-team-exchange-amount');
        const targetPlayer = targetSelect?.value;
        const amount = parseInt(input?.value, 10);

        if (!targetPlayer) {
            Boako.Util.toast('환전해줄 팀원을 선택해주세요.');
            return;
        }

        if (!amount || amount <= 0) {
            Boako.Util.toast('환전할 포인트를 입력해주세요.');
            return;
        }

        if (amount % 100 !== 0) {
            Boako.Util.toast('100 단위로만 환전할 수 있습니다.');
            return;
        }

        if (!confirm(`${targetPlayer} 님에게 ${amount.toLocaleString()}P를 환전해주시겠습니까?`)) return;

        try {
            const { data, error } = await Boako.db.rpc('exchange_team_to_personal', {
                p_target_player_name: targetPlayer,
                p_amount: amount
            });
            if (error) throw error;

            if (window.sfx) window.sfx.buy();
            Boako.Util.toast(`✅ 환전 완료! ${targetPlayer} 님에게 ${data.net_to_member.toLocaleString()}P가 지급되었습니다.`);
            Boako.Team.loadWalletTab();

        } catch (err) {
            Boako.Util.toast('환전 실패: ' + err.message);
            console.error('환전 실패:', err);
        }
    },

    loadChallengeTab: async function() {
        const container = document.getElementById('team-challenge-container');
        if (!container) return;

        container.innerHTML = `<div class="text-center py-10 font-black text-slate-400 animate-pulse">챌린지 데이터 로드 중...</div>`;

        try {
            if (!Boako.League || !Boako.League.renderChallenges) {
                await Boako.Util.loadScript('js/league.js');
            }

            const teamId = Boako.state.team.info.id;

            const { data: challenges, error } = await Boako.db
                .from('challenges')
                .select('*')
                .or(`attacker_team_id.eq.${teamId},defender_team_id.eq.${teamId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const { data: games } = await Boako.db.from('games').select('game_name, game_logo_url:image_url');
            Boako.League.State.availableGames = games || [];
            Boako.League.State.challenges = challenges || [];

            container.innerHTML = `<div id="challenge-list" class="flex flex-col gap-4 pb-4"></div>`;

            Boako.League.renderChallenges();

            if (window.lucide) window.lucide.createIcons();

        } catch (e) {
            console.error('챌린지 탭 로드 실패:', e);
            container.innerHTML = `<div class="text-center py-10 text-red-400 font-bold">오류: ${e.message}</div>`;
        }
    },

    // 🌟 [리팩토링] 팀챗 화면을 여러 탭에서 동시에 열어두면 탭마다 각자 채널을 구독해서 Realtime
    // 동시연결 한도를 탭 수만큼 잡아먹는 문제 방지. 다만 이 채널은 messenger.js/achievements.js처럼
    // "로그인하면 항상 켜져있는" 전역 채널이 아니라 "팀챗 화면을 실제로 열어본 탭"에서만 필요한
    // lazy 채널이라, js/realtime_coordinator.js의 전역 리더 선출을 그대로 재사용하면 안 됨 —
    // 전역 리더로 뽑힌 탭이 팀챗 화면을 한 번도 안 열어봤으면, 다른 탭에서 팀챗을 열어도 실제
    // 구독을 아무도 안 하고 있어서 실시간 이벤트 자체가 영원히 발생하지 않는 문제가 생김.
    // 그래서 "지금 이 세션에서 팀챗 화면을 열어본 탭들"끼리만 별도로 리더를 선출하는 전용
    // 미니 코디네이터를 팀 id별로 둠(localStorage 하트비트 + BroadcastChannel, 확장의 패턴과 동일).
    Chat: {
        channel: null,
        readsChannel: null,
        unreadCount: 0, // 🌟 안 읽은 메시지 개수 — 배지에 실제 숫자를 표시하기 위해 추가
        activeMemberCount: 0, // 🌟 안읽음 인원수 계산에 필요한 팀 전체 활성 인원 수
        readRows: [], // 🌟 { user_id, last_read_message_id }[] — 팀원별 읽음 상태

        // ---- 🌟 팀챗 전용 미니 리더 선출 (teamId별로 격리) ----
        _tabId: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
        _isLeader: false,
        _leaderKey: null,
        _heartbeatTimer: null,
        _followerTimer: null,
        _bc: null,
        _coordTeamId: null,

        _getLeaderInfo: function() {
            try { return JSON.parse(localStorage.getItem(Boako.Team.Chat._leaderKey)); } catch (e) { return null; }
        },
        _isLeaderInfoAlive: function(info) {
            return !!info && (Date.now() - info.ts) < 6000;
        },
        _claimLeadership: function(teamId) {
            if (Boako.Team.Chat._followerTimer) { clearInterval(Boako.Team.Chat._followerTimer); Boako.Team.Chat._followerTimer = null; }
            localStorage.setItem(Boako.Team.Chat._leaderKey, JSON.stringify({ tabId: Boako.Team.Chat._tabId, ts: Date.now() }));
            Boako.Team.Chat._isLeader = true;
            Boako.Team.Chat._heartbeatTimer = setInterval(() => {
                localStorage.setItem(Boako.Team.Chat._leaderKey, JSON.stringify({ tabId: Boako.Team.Chat._tabId, ts: Date.now() }));
            }, 2000);
            Boako.Team.Chat._subscribeAsLeader(teamId);
        },
        _becomeFollower: function(teamId) {
            Boako.Team.Chat._isLeader = false;
            if (!Boako.Team.Chat._followerTimer) {
                Boako.Team.Chat._followerTimer = setInterval(() => {
                    const info = Boako.Team.Chat._getLeaderInfo();
                    if (!Boako.Team.Chat._isLeaderInfoAlive(info)) Boako.Team.Chat._tryClaimWithJitter(teamId);
                }, 2000);
            }
        },
        _tryClaimWithJitter: function(teamId) {
            const jitter = Math.random() * 400;
            setTimeout(() => {
                const info = Boako.Team.Chat._getLeaderInfo();
                if (!Boako.Team.Chat._isLeaderInfoAlive(info)) Boako.Team.Chat._claimLeadership(teamId);
                else Boako.Team.Chat._becomeFollower(teamId);
            }, jitter);
        },
        _startCoordination: function(teamId) {
            // 팀을 바꿔서(=다른 teamId로) 다시 들어온 경우 이전 코디네이터를 확실히 정리하고 새로 시작
            if (Boako.Team.Chat._coordTeamId && Boako.Team.Chat._coordTeamId !== teamId) {
                Boako.Team.Chat._teardownCoordination();
            }
            if (Boako.Team.Chat._coordTeamId === teamId) return; // 이미 이 팀으로 코디네이션 진행 중

            Boako.Team.Chat._coordTeamId = teamId;
            Boako.Team.Chat._leaderKey = `boako_teamchat_leader_${teamId}`;
            Boako.Team.Chat._bc = new BroadcastChannel(`boako-teamchat-relay-${teamId}`);
            Boako.Team.Chat._bc.onmessage = (e) => {
                if (Boako.Team.Chat._isLeader) return; // 리더는 자기 방송을 무시
                const { type, payload } = e.data || {};
                if (type === 'chat-insert') Boako.Team.Chat._onChatInsert(payload);
                else if (type === 'reads-change') Boako.Team.Chat._onReadsChange(teamId);
            };
            Boako.Team.Chat._tryClaimWithJitter(teamId);
        },
        _teardownCoordination: function() {
            if (Boako.Team.Chat._heartbeatTimer) { clearInterval(Boako.Team.Chat._heartbeatTimer); Boako.Team.Chat._heartbeatTimer = null; }
            if (Boako.Team.Chat._followerTimer) { clearInterval(Boako.Team.Chat._followerTimer); Boako.Team.Chat._followerTimer = null; }
            if (Boako.Team.Chat._isLeader && Boako.Team.Chat._leaderKey) {
                try {
                    const info = Boako.Team.Chat._getLeaderInfo();
                    if (info && info.tabId === Boako.Team.Chat._tabId) localStorage.removeItem(Boako.Team.Chat._leaderKey);
                } catch (e) { /* noop */ }
            }
            if (Boako.Team.Chat.channel && Boako.db) { Boako.db.removeChannel(Boako.Team.Chat.channel); Boako.Team.Chat.channel = null; }
            if (Boako.Team.Chat.readsChannel && Boako.db) { Boako.db.removeChannel(Boako.Team.Chat.readsChannel); Boako.Team.Chat.readsChannel = null; }
            if (Boako.Team.Chat._bc) { try { Boako.Team.Chat._bc.close(); } catch (e) {} Boako.Team.Chat._bc = null; }
            Boako.Team.Chat._isLeader = false;
            Boako.Team.Chat._coordTeamId = null;
        },

        // ---- 🌟 실제 반응 로직(리더의 로컬 콜백/팔로워의 중계 수신 양쪽에서 동일하게 호출) ----
        async _onChatInsert(newMsg) {
            if (newMsg.sender_id === Boako.state.user.id) return;
            newMsg.profiles = { full_name: "팀원" };
            Boako.Team.Chat.renderMessage(newMsg);
            Boako.Team.Chat.scrollToBottom();
            Boako.Team.Chat.showNotification();
            Boako.Util.toast("💬 팀 작전 회의실에 새로운 메시지가 있습니다!");
            // 🌟 방을 계속 보고 있는 동안 온 메시지도 곧바로 읽음 처리 (카카오톡과 동일한 체감)
            await Boako.Team.Chat.markRead(Boako.Team.Chat._coordTeamId);
        },
        async _onReadsChange(teamId) {
            await Boako.Team.Chat.fetchReadRows(teamId);
            Boako.Team.Chat.updateAllUnreadBadges();
        },

        // 🌟 이 탭이 리더일 때만 실제 채널 구독
        _subscribeAsLeader: function(teamId) {
            if (!Boako.Team.Chat._isLeader) return;
            if (Boako.Team.Chat.channel) return; // 이미 구독 중이면 중복 방지

            Boako.Team.Chat.channel = Boako.db.channel(`team-chat-${teamId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'team_chats',
                    filter: `team_id=eq.${teamId}`
                }, (payload) => {
                    Boako.Team.Chat._onChatInsert(payload.new);
                    if (Boako.Team.Chat._bc) Boako.Team.Chat._bc.postMessage({ type: 'chat-insert', payload: payload.new });
                })
                .subscribe();

            Boako.Team.Chat.readsChannel = Boako.db.channel(`team-chat-reads-${teamId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'team_chat_reads',
                    filter: `team_id=eq.${teamId}`
                }, () => {
                    Boako.Team.Chat._onReadsChange(teamId);
                    if (Boako.Team.Chat._bc) Boako.Team.Chat._bc.postMessage({ type: 'reads-change' });
                })
                .subscribe();
        },

        showNotification: () => {
            const badge = document.getElementById('team-chat-badge');
            if (badge) {
                Boako.Team.Chat.unreadCount += 1;
                badge.textContent = Boako.Team.Chat.unreadCount;
                badge.classList.remove('hidden');
                badge.style.display = 'flex';
            }
        },
        clearNotification: () => {
            const badge = document.getElementById('team-chat-badge');
            if (badge) {
                Boako.Team.Chat.unreadCount = 0;
                badge.textContent = '';
                badge.classList.add('hidden');
                badge.style.display = 'none';
            }
        },

        // 🌟 팀 전체 활성 인원 수 (안읽음 계산의 분모)
        fetchActiveMemberCount: async (teamId) => {
            const { count } = await Boako.db
                .from('team_members')
                .select('id', { count: 'exact', head: true })
                .eq('team_id', teamId)
                .eq('is_active', true);
            Boako.Team.Chat.activeMemberCount = count || 0;
        },

        // 🌟 팀원별 읽음 상태 전체를 다시 가져와 State에 채움
        fetchReadRows: async (teamId) => {
            const { data } = await Boako.db
                .from('team_chat_reads')
                .select('user_id, last_read_message_id')
                .eq('team_id', teamId);
            Boako.Team.Chat.readRows = data || [];
        },

        // 🌟 채팅방 입장(또는 방을 보고 있는 동안 새 메시지 수신) 시 "여기까지 읽었다" 갱신 —
        // 카카오톡처럼 스크롤 위치가 아니라 "입장 시점"에 그때까지의 메시지를 한 번에 읽음 처리
        markRead: async (teamId) => {
            try {
                const { error } = await Boako.db.rpc('fn_mark_team_chat_read', { p_team_id: teamId });
                if (error) throw error;
                await Boako.Team.Chat.fetchReadRows(teamId);
                Boako.Team.Chat.updateAllUnreadBadges();
            } catch (err) {
                console.error('읽음 처리 실패:', err);
            }
        },

        // 🌟 특정 메시지 id 기준 "아직 안 읽은 사람 수" 계산 (발신자 본인 제외)
        computeUnreadCount: (msgId, senderId) => {
            const others = (Boako.Team.Chat.readRows || []).filter(r => r.user_id !== senderId);
            const readCount = others.filter(r => r.last_read_message_id != null && r.last_read_message_id >= msgId).length;
            const totalOthers = Math.max(0, (Boako.Team.Chat.activeMemberCount || 1) - 1);
            return Math.max(0, totalOthers - readCount);
        },

        // 🌟 화면에 이미 그려진 내 메시지들의 안읽음 숫자를 전부 다시 계산해서 갱신
        updateAllUnreadBadges: () => {
            document.querySelectorAll('.own-msg-wrap').forEach(el => {
                const msgId = Number(el.dataset.msgId);
                const senderId = el.dataset.senderId;
                if (!msgId) return;
                const badge = el.querySelector('.own-msg-unread');
                if (!badge) return;
                const unread = Boako.Team.Chat.computeUnreadCount(msgId, senderId);
                badge.textContent = unread > 0 ? unread : '';
            });
        },

        init: async (containerId) => {
            if (!Boako.state.team) return;
            const teamId = Boako.state.team.info.id;
            
            const chatHtml = `
                <div class="flex flex-col h-[400px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-6">
                    <div class="bg-slate-800 text-white px-4 py-3 font-bold text-sm flex justify-between">
                        <span>💬 팀 작전 회의실</span>
                    </div>
                    <div id="chat-messages" class="flex-1 p-4 overflow-y-auto flex flex-col gap-3"></div>
                    <div class="p-3 bg-white border-t border-slate-200 flex gap-2">
                        <input type="text" id="chat-input" placeholder="메시지를 입력하세요..." class="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onkeypress="if(event.key === 'Enter') Boako.Team.Chat.send()">
                        <button onclick="Boako.Team.Chat.send()" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700">전송</button>
                    </div>
                </div>
            `;
            document.getElementById(containerId).innerHTML = chatHtml;

            // 🌟 안읽음 계산에 필요한 값들 먼저 확보
            await Boako.Team.Chat.fetchActiveMemberCount(teamId);
            await Boako.Team.Chat.fetchReadRows(teamId);

            try {
                const { data: messages, error } = await Boako.db
                    .from('team_chats')
                    .select('*, profiles(full_name, profile_url)')
                    .eq('team_id', teamId)
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                if (messages) {
                    messages.reverse().forEach(msg => Boako.Team.Chat.renderMessage(msg));
                    Boako.Team.Chat.scrollToBottom();
                }
            } catch (err) { console.error("채팅 로드 실패:", err); }

            // 🌟 입장 = 지금까지의 메시지를 전부 읽음 처리 (카카오톡 방식)
            await Boako.Team.Chat.markRead(teamId);

            // 🌟 팀챗 전용 리더 선출 시작 — 실제 소켓은 리더 탭에서만 생성됨
            Boako.Team.Chat._startCoordination(teamId);
        },
        renderMessage: (msg) => {
            const container = document.getElementById('chat-messages');
            if (!container) return;

            const isMe = msg.sender_id === Boako.state.user.id;
            const senderName = msg.profiles?.full_name || "알 수 없음";

            // 🌟 내 메시지에는 안읽음 인원수 배지(own-msg-unread)를 붙임. msg.id가 아직 없으면(전송 직후 낙관적 렌더링)
            // data-msg-id를 비워두고, send()에서 실제 id를 받은 후 채워넣음.
            const html = isMe ? `
                <div class="flex justify-end items-end gap-1.5 own-msg-wrap" data-msg-id="${msg.id || ''}" data-sender-id="${msg.sender_id}">
                    <span class="own-msg-unread text-[10px] font-bold text-amber-500 mb-0.5"></span>
                    <div class="bg-blue-600 text-white rounded-l-xl rounded-tr-xl px-4 py-2 max-w-[70%] text-sm shadow-sm break-words">
                        ${msg.content}
                    </div>
                </div>
            ` : `
                <div class="flex flex-col items-start gap-1">
                    <span class="text-[11px] font-bold text-slate-500 ml-1">${senderName}</span>
                    <div class="bg-white border border-slate-200 text-slate-800 rounded-r-xl rounded-tl-xl px-4 py-2 max-w-[70%] text-sm shadow-sm break-words">
                        ${msg.content}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);

            if (isMe && msg.id) {
                const unread = Boako.Team.Chat.computeUnreadCount(msg.id, msg.sender_id);
                const wrap = container.lastElementChild;
                const badge = wrap?.querySelector('.own-msg-unread');
                if (badge) badge.textContent = unread > 0 ? unread : '';
            }
        },
        send: async () => {
            const input = document.getElementById('chat-input');
            const content = input.value.trim();
            if (!content || !Boako.state.team) return;

            input.value = '';

            const payload = {
                team_id: Boako.state.team.info.id,
                sender_id: Boako.state.user.id,
                content: content
            };

            // 🌟 전송 직후 아직 아무도 안 읽었을 게 확실하므로 낙관적으로 먼저 그림 (id는 잠시 비워둠)
            const tempMsg = { ...payload, profiles: { full_name: Boako.state.user.nickname } };
            Boako.Team.Chat.renderMessage(tempMsg);
            Boako.Team.Chat.scrollToBottom();
            const container = document.getElementById('chat-messages');
            const tempWrap = container?.lastElementChild;

            const { data, error } = await Boako.db.from('team_chats').insert([payload]).select().single();
            if (error) {
                Boako.Util.toast("전송 실패: " + error.message);
                console.error("채팅 전송 실패:", error);
                return;
            }

            // 🌟 실제 DB에 저장된 id를 받아서 방금 그린 말풍선에 채워넣고, 안읽음 숫자도 계산해서 표시
            if (data && tempWrap && tempWrap.classList.contains('own-msg-wrap')) {
                tempWrap.dataset.msgId = data.id;
                const unread = Boako.Team.Chat.computeUnreadCount(data.id, data.sender_id);
                const badge = tempWrap.querySelector('.own-msg-unread');
                if (badge) badge.textContent = unread > 0 ? unread : '';
            }
        },
        scrollToBottom: () => {
            const el = document.getElementById('chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
        }
    }
};
