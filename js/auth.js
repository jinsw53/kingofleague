/**
 * [AUTH] 인증 및 프로필 관리 (최종 통합본 - 데드락 방지 + 메신저 연결 + 상점 지연로딩 + BGA 닉네임 모달 + 🌟팀쳇 고속도로 + 🌟배지 디스플레이 + 🌟커스텀 프로필 사진 + 🌟기록기 설치 가이드 + 🌟공지사항 모달)
 * 온보딩 노출 순서: 닉네임 모달 → 기록기 설치 가이드 → 공지사항 모달
 */
Boako.Auth = {
    init: async () => {
        Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);

        // 1. 최초 접속 시 정상 로드
        const { data: { session } } = await Boako.db.auth.getSession();
        if (session?.user) {
            Boako.state.user = session.user;
            Boako.Auth.saveKakaoToken(session);
            if (!Boako.Team.syncStatus) await Boako.Util.loadScript('js/team.js');
            await Boako.Team.syncStatus();
            await Boako.Auth.checkAdminMenu();
            await Boako.Auth.checkLeaderMenu();

            if (Object.keys(Boako.Messenger).length === 0) await Boako.Util.loadScript('js/messenger.js');
            if (Boako.Messenger.fetchUnreadCount) await Boako.Messenger.fetchUnreadCount();
            // 🌟 로그인 즉시 실시간 쪽지 감지 시작 (메신저 페이지를 안 열어도 위젯 배지가 실시간으로 갱신되도록)
            if (Boako.Messenger.startRealtime) Boako.Messenger.startRealtime();

            // 🌟 순서: 닉네임 모달 → 기록기 설치 가이드 → 공지사항 모달
            await Boako.Auth.requireBgaNickname();
            Boako.Auth.requireExtensionGuide();
            Boako.Auth.requireNoticeModal();
        } else {
            // 🌟 로그인 안 한 방문객은 계정이 없어 DB에 기록할 수 없으므로 브라우저 기준으로만 판단
            Boako.Auth.requireExtensionGuideAnonymous();
        }
        await Boako.Auth.renderWidget();
        Boako.View.render('main'); 

        // 🌟 토너먼트 개최 요청 미해결 건수 — 로그인 여부 무관하게 항상 표시
        Boako.Auth.checkTournamentBadge();
        Boako.Auth.subscribeTournamentBadge(); 

        // 🌟 같이하자 모집중인 글 개수 — 로그인 여부 무관하게 항상 표시
        Boako.Auth.checkTogetherBadge();
        Boako.Auth.subscribeTogetherBadge();

        // 🌟 게시판 요청 미답변 개수 — 로그인 여부 무관하게 항상 표시
        Boako.Auth.checkBoardRequestBadge();
        Boako.Auth.subscribeBoardRequestBadge(); 

        // 2. 상태 변화 감지 (탭 복귀 시)
        Boako.db.auth.onAuthStateChange(async (e, s) => {
            if (e === 'INITIAL_SESSION') return;

            if (s?.user) {
                if (e === 'SIGNED_IN' && Boako.state.user?.id === s.user.id) {
                    return; 
                }

                Boako.state.user = s.user;
                Boako.Auth.saveKakaoToken(s);
                if (!Boako.Team.syncStatus) await Boako.Util.loadScript('js/team.js');
                await Boako.Team.syncStatus();
                await Boako.Auth.checkAdminMenu();
                await Boako.Auth.checkLeaderMenu();
                
                if (Object.keys(Boako.Messenger).length === 0) await Boako.Util.loadScript('js/messenger.js');
                if (Boako.Messenger.fetchUnreadCount) await Boako.Messenger.fetchUnreadCount();
                // 🌟 로그인 즉시 실시간 쪽지 감지 시작
                if (Boako.Messenger.startRealtime) Boako.Messenger.startRealtime();

                await Boako.Auth.renderWidget();
                // 🌟 순서: 닉네임 모달 → 기록기 설치 가이드 → 공지사항 모달
                await Boako.Auth.requireBgaNickname();
                Boako.Auth.requireExtensionGuide();
                Boako.Auth.requireNoticeModal();
                
            } else {
                Boako.state.user = null;
                Boako.state.team = null;
                const adminMenu = document.getElementById('menu-admin-review');
                if (adminMenu) adminMenu.style.display = 'none';
                const verifyMenu = document.getElementById('menu-record-verify');
                if (verifyMenu) verifyMenu.style.display = 'none';
                
                Boako.Auth.renderWidget();
            }
        });
    },

    login: () => Boako.db.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: window.location.origin + window.location.pathname, scopes: 'talk_calendar' } }),

    // 🌟 카카오 액세스/리프레시 토큰을 DB에 저장 (톡캘린더 API 호출용)
    saveKakaoToken: async (session) => {
        if (!session?.provider_token) return;
        try {
            await Boako.db.rpc('fn_save_kakao_token', {
                p_access_token: session.provider_token,
                p_refresh_token: session.provider_refresh_token || null,
                p_expires_in: 21600 // 카카오 액세스 토큰 기본 유효시간(6시간), 초 단위
            });
        } catch (err) {
            console.error('카카오 토큰 저장 실패:', err);
        }
    },
    
    logout: async () => {
        await Boako.db.auth.signOut();
        // 🌟 카카오 세션도 같이 로그아웃 (다음 로그인 시 계정 전환/재동의 가능하게)
        const logoutRedirectUri = encodeURIComponent(window.location.origin + '/');
        window.location.href = `https://kauth.kakao.com/oauth/logout?client_id=${Boako.config.kakaoRestApiKey}&logout_redirect_uri=${logoutRedirectUri}`;
    },

    // 🌟 [수정됨] 로그인 위젯 렌더링 + 팀 멤버 배지 + 인벤토리 배지 영역 + 커스텀 프사 클릭 변경
    renderWidget: async () => {
        const area = document.getElementById('login-widget-area');
        const user = Boako.state.user;
        if (!user) {
            area.innerHTML = `<button class="btn-kakao" onclick="Boako.Auth.login()">🟡 카카오 로그인</button>`;
        } else {
            const kakaoAvatarUrl = user.user_metadata?.avatar_url?.replace('http://', 'https://') || null;

            // 🌟 커스텀 프사가 있으면 그걸 우선 표시 (카톡 프사는 profiles.profile_url에 로그인마다 자동 동기화되므로 여긴 안 건드림)
            let customAvatarUrl = null;
            try {
                const { data: profileRow } = await Boako.db.from('profiles').select('custom_avatar_url').eq('id', user.id).single();
                customAvatarUrl = profileRow?.custom_avatar_url || null;
            } catch (err) {
                console.error('커스텀 프사 조회 실패:', err);
            }

            // 팝업에서 재사용할 수 있게 상태에 캐시
            Boako.state.kakaoAvatarUrl = kakaoAvatarUrl;
            Boako.state.customAvatarUrl = customAvatarUrl;

            const displayAvatarUrl = customAvatarUrl || kakaoAvatarUrl;
            
            const unreadBadge = (Boako.Messenger && Boako.Messenger.unreadCount > 0) 
                ? `<span style="background:#ef4444; color:white; border-radius:50%; padding:2px 6px; font-size:11px; margin-left:4px; font-weight:bold;">${Boako.Messenger.unreadCount}</span>` 
                : '';

            // 소속 여부에 따른 팀 배지 동적 생성
            let membershipBadgeHtml = `<span class="badge-premium" style="display:inline-flex; align-items:center; justify-content:center; gap:4px; margin-top:12px; padding:4px 8px; background:#f1f5f9; border-radius:6px; font-size:11px; font-weight:700; color:#64748b;">🛡️ 아카이브 멤버</span>`;
            
            if (Boako.state.team && Boako.state.team.info) {
                const teamName = Boako.state.team.info.team_name;
                const teamLogo = Boako.state.team.info.logo_url || 'https://via.placeholder.com/16';
                membershipBadgeHtml = `
                <span class="badge-premium" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; margin-top:12px; padding:4px 10px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; font-size:12px; font-weight:900; color:#1e40af; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <img src="${Boako.Util.cdn(teamLogo)}" style="width:16px; height:16px; border-radius:50%; object-fit:cover; border:1px solid #93c5fd;"> 
                    ${teamName} 멤버
                </span>`;
            }

            area.innerHTML = `
            <div class="user-avatar" onclick="Boako.Auth.openAvatarModal()" title="클릭해서 프로필 사진 변경" style="display: flex; align-items: center; justify-content: center; overflow: hidden; p-0; cursor:pointer; position:relative;">
                ${displayAvatarUrl ? `<img src="${displayAvatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Profile">` : '👤'}
                <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.45); color:#fff; font-size:9px; font-weight:800; text-align:center; padding:2px 0; opacity:0; transition:opacity .15s;" class="avatar-hover-hint">사진 변경</div>
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                <strong>${user.nickname || '사용자'}</strong>
                <button class="btn-edit-small" onclick="(async () => { if (!window.Boako.Shop) await Boako.Util.loadScript('js/shop.js'); Boako.Shop.buyItem('item_ticket_nick'); })()">수정</button>
            </div>
            <div style="margin-top: 8px; display: flex; justify-content: center; gap: 5px;">
                <button class="btn-inventory" onclick="Boako.View.render('inventory')" style="cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 12px;">🎒 인벤토리</button>
                <button class="btn-messenger" onclick="Boako.View.render('messenger')" style="cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 12px;">📬 쪽지${unreadBadge}</button>

                <div id="team-chat-nav" style="position: relative; display: inline-block;">
                    <button class="btn-teamchat" style="cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid #c7d2fe; background: #e0e7ff; color: #4f46e5; font-size: 12px; font-weight: 800; transition: all 0.2s;" 
                            onclick="(async () => { await Boako.View.render('team'); if(Boako.View.switchTeamTab) Boako.View.switchTeamTab('chat'); if(Boako.Team && Boako.Team.Chat) Boako.Team.Chat.clearNotification(); })()">
                        💬 팀쳇
                    </button>
                    <div id="team-chat-badge" class="hidden absolute" style="top: -6px; right: -6px; background: #ef4444; color: white; font-size: 10px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; border: 1px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        N
                    </div>
                </div>
            </div>
            
            ${membershipBadgeHtml}
            
            <div id="widget-badge-area" style="margin-top: 12px; min-height: 28px; display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap;">
                </div>

            <button class="btn-logout" style="width:100%; padding:12px; color:#94a3b8; font-size:13px; font-weight:600; border:1px solid #e2e8f0; border-radius:10px; margin-top:15px;" onclick="Boako.Auth.logout()">로그아웃</button>`;

            // 아바타 hover 시 "사진 변경" 힌트 보이게
            if (!document.getElementById('avatar-hover-hint-style')) {
                const style = document.createElement('style');
                style.id = 'avatar-hover-hint-style';
                style.innerHTML = `.user-avatar:hover .avatar-hover-hint { opacity: 1 !important; }`;
                document.head.appendChild(style);
            }
            
            // 🌟 HTML 렌더링 직후 DB에서 장착 중인 배지를 비동기로 불러오기
            Boako.Auth.loadWidgetBadges();
        }
    },

    // ========== 🌟 [신규] 커스텀 프로필 사진 변경 팝업 ==========

    openAvatarModal: () => {
        if (!Boako.state.user) return;
        const kakaoAvatarUrl = Boako.state.kakaoAvatarUrl;
        const customAvatarUrl = Boako.state.customAvatarUrl;
        const currentAvatar = customAvatarUrl || kakaoAvatarUrl;

        document.getElementById('avatar-modal-root')?.remove();

        const modalHtml = `
            <div id="avatar-modal-root">
                <div id="avatar-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onclick="if(event.target===this) Boako.Auth.closeAvatarModal()">
                    <div class="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
                        <div class="p-5 flex items-center justify-between border-b border-slate-100">
                            <h3 class="font-black text-slate-800 text-sm">프로필 사진</h3>
                            <button onclick="Boako.Auth.closeAvatarModal()" class="text-slate-400 hover:text-slate-600 font-black text-lg leading-none">×</button>
                        </div>
                        <div class="p-6 flex flex-col items-center gap-4">
                            <div class="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-100 shadow-inner bg-slate-50 flex items-center justify-center">
                                ${currentAvatar ? `<img id="avatar-modal-preview" src="${currentAvatar}" class="w-full h-full object-cover">` : `<span id="avatar-modal-preview" class="text-4xl">👤</span>`}
                            </div>
                            <div id="avatar-modal-status" class="text-[11px] font-bold text-slate-400 -mt-1">${customAvatarUrl ? '커스텀 사진 사용 중' : '카카오 프로필 사진 사용 중'}</div>

                            <label class="w-full bg-slate-800 hover:bg-slate-900 text-white font-black text-xs py-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                                📷 새 사진 업로드
                                <input type="file" accept="image/*" id="avatar-file-input" style="display:none;" onchange="Boako.Auth.handleAvatarFileSelect(this)">
                            </label>

                            ${customAvatarUrl ? `
                                <button onclick="Boako.Auth.resetToKakaoAvatar()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs py-2.5 rounded-xl transition-colors">
                                    카카오 프로필 사진으로 되돌리기
                                </button>
                            ` : ''}

                            <div id="avatar-upload-indicator" class="hidden text-xs font-bold text-indigo-500">업로드 중...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    closeAvatarModal: () => {
        document.getElementById('avatar-modal-root')?.remove();
    },

    handleAvatarFileSelect: async (inputEl) => {
        const file = inputEl.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            Boako.Util.toast('❌ 이미지 파일만 업로드할 수 있어요.');
            return;
        }

        const indicator = document.getElementById('avatar-upload-indicator');
        if (indicator) indicator.classList.remove('hidden');

        try {
            // 🌟 아바타는 작게(정사각형 400px)로 압축해서 용량을 최소화
            const compressedBlob = await Boako.Auth.compressAvatarImage(file);

            const { data: sessionData } = await Boako.db.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error('로그인 세션이 만료되었습니다.');

            const uploadRes = await fetch('https://qrredwrxdnvqwdxzanba.supabase.co/functions/v1/r2-upload-url?purpose=profile', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/webp' },
                body: compressedBlob
            });
            const result = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(result.error || '업로드 실패');

            const { error: updateErr } = await Boako.db.from('profiles')
                .update({ custom_avatar_url: result.publicUrl })
                .eq('id', Boako.state.user.id);
            if (updateErr) throw updateErr;

            Boako.state.customAvatarUrl = result.publicUrl;
            Boako.Util.toast('✅ 프로필 사진이 변경되었습니다!');
            Boako.Auth.closeAvatarModal();
            await Boako.Auth.renderWidget();

        } catch (err) {
            console.error(err);
            Boako.Util.toast('❌ ' + (err.message || '업로드에 실패했습니다.'));
        } finally {
            if (indicator) indicator.classList.add('hidden');
        }
    },

    // 아바타 전용 압축: 정사각형으로 크롭 후 400x400으로 축소 (게시판 이미지보다 훨씬 가볍게)
    compressAvatarImage: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const size = 400;
                    const minSide = Math.min(img.width, img.height);
                    const sx = (img.width - minSide) / 2;
                    const sy = (img.height - minSide) / 2;

                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('이미지 압축 실패'));
                    }, 'image/webp', 0.85);
                };
                img.onerror = () => reject(new Error('이미지 로드 실패'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsDataURL(file);
        });
    },

    resetToKakaoAvatar: async () => {
        if (!confirm('카카오 프로필 사진으로 되돌리시겠습니까?')) return;
        try {
            const { error } = await Boako.db.from('profiles')
                .update({ custom_avatar_url: null })
                .eq('id', Boako.state.user.id);
            if (error) throw error;

            Boako.state.customAvatarUrl = null;
            Boako.Util.toast('카카오 프로필 사진으로 되돌렸습니다.');
            Boako.Auth.closeAvatarModal();
            await Boako.Auth.renderWidget();
        } catch (err) {
            Boako.Util.toast('❌ ' + (err.message || '되돌리기에 실패했습니다.'));
        }
    },

    // 🌟 [신규 추가] 소장님 스키마에 완벽히 맞춘 인벤토리 배지 로드 함수
    loadWidgetBadges: async () => {
        if (!Boako.state.user) return;
        const badgeArea = document.getElementById('widget-badge-area');
        if (!badgeArea) return;

        if (!document.getElementById('badge-zoom-style')) {
            const style = document.createElement('style');
            style.id = 'badge-zoom-style';
            style.innerHTML = `
                .badge-zoom-wrap { display:inline-block; position:relative; transition: transform .18s ease; transform-origin:center; cursor:help; }
                .badge-zoom-wrap:hover { z-index:999; }
                .badge-zoom-sm:hover { transform: scale(3); }
            `;
            document.head.appendChild(style);
        }

        try {
            // inventory 테이블에서 is_equipped가 true인 것을 가져옵니다. (FK 없이 수동 조인)
            const { data: equippedItems, error } = await Boako.db
                .from('inventory')
                .select('item_id, season_no')
                .eq('user_id', Boako.state.user.id)
                .eq('is_equipped', true);

            if (error) throw error;

            // 서포터즈가 아닌 일반 배지들의 상점 정보를 별도로 조회해서 합침
            const normalItemIds = [...new Set((equippedItems || [])
                .filter(row => !(row.item_id && row.item_id.startsWith('item_supporter_badge_')))
                .map(row => row.item_id))];

            let shopItemsMap = {};
            if (normalItemIds.length > 0) {
                const { data: shopRows } = await Boako.db.from('shop_items').select('item_id, name, icon').in('item_id', normalItemIds);
                (shopRows || []).forEach(s => { shopItemsMap[s.item_id] = s; });
            }
            (equippedItems || []).forEach(row => { row.shop_items = shopItemsMap[row.item_id] || null; });

            if (equippedItems && equippedItems.length > 0) {
                // 🌟 서포터즈 배지(item_supporter_badge_<teamId>)는 팀/시즌 정보를 따로 조인해야 함
                const supporterRows = equippedItems.filter(row => row.item_id && row.item_id.startsWith('item_supporter_badge_'));
                const supporterTeamIds = [...new Set(supporterRows.map(row => Number(row.item_id.split('_').pop())))];
                const supporterSeasonNos = [...new Set(supporterRows.map(row => row.season_no).filter(Boolean))];

                let teamsMap = {};
                if (supporterTeamIds.length > 0) {
                    const { data: teamsData } = await Boako.db.from('teams').select('id, team_name, logo_url').in('id', supporterTeamIds);
                    (teamsData || []).forEach(t => { teamsMap[t.id] = t; });
                }

                let seasonsMap = {};
                if (supporterSeasonNos.length > 0) {
                    const { data: seasonsData } = await Boako.db.from('seasons').select('season_no, uniform_image_url').in('season_no', supporterSeasonNos);
                    (seasonsData || []).forEach(s => { seasonsMap[s.season_no] = s; });
                }

                const buildUniformHtml = (teamLogo, uniformImage, size) => {
                    const uniformBg = uniformImage
                        ? `background-image:url('${Boako.Util.cdn(uniformImage)}'); background-size:contain; background-repeat:no-repeat; background-position:center;`
                        : '';
                    const fallbackSilhouette = !uniformImage ? `
                        <svg width="${size}" height="${size}" viewBox="0 0 100 100" style="position:absolute; top:0; left:0;">
                            <path d="M50 22 L60 22 L74 30 L68 42 L60 37 L60 78 L40 78 L40 37 L32 42 L26 30 L40 22 Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
                        </svg>
                    ` : '';
                    return `
                        <div style="width:${size}; height:${size}; position:relative; display:flex; align-items:center; justify-content:center;">
                            ${fallbackSilhouette}
                            <div style="width:${size}; height:${size}; position:relative; ${uniformBg}">
                                ${teamLogo ? `<img src="${Boako.Util.cdn(teamLogo)}" style="position:absolute; top:48%; left:50%; transform:translate(-50%,-50%); width:60%; height:60%; object-fit:contain;">` : ''}
                            </div>
                        </div>
                    `;
                };

                // 아이콘 타입(이미지 vs 이모지 vs 서포터즈)에 맞춰 HTML 생성
                badgeArea.innerHTML = equippedItems.map(item => {
                    const isSupporter = item.item_id && item.item_id.startsWith('item_supporter_badge_');

                    if (isSupporter) {
                        const teamId = Number(item.item_id.split('_').pop());
                        const team = teamsMap[teamId];
                        const season = seasonsMap[item.season_no];
                        const name = team ? `${team.team_name} 서포터즈` : '서포터즈 배지';
                        return `<div class="badge-zoom-wrap badge-zoom-sm" title="${name}">${buildUniformHtml(team?.logo_url, season?.uniform_image_url, '26px')}</div>`;
                    }

                    const icon = item.shop_items?.icon || '🏅';
                    const name = item.shop_items?.name || '배지';

                    if (icon.startsWith('http')) {
                        return `<div class="badge-zoom-wrap badge-zoom-sm" title="${name}"><img src="${Boako.Util.cdn(icon)}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"></div>`;
                    } else {
                        return `<div class="badge-zoom-wrap badge-zoom-sm" title="${name}"><span style="font-size: 22px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">${icon}</span></div>`;
                    }
                }).join('');
            } else {
                // 장착된 배지가 없는 경우 (공간만 차지하도록 처리하거나 연한 글씨 출력)
                badgeArea.innerHTML = `<span style="font-size:11px; color:#cbd5e1; font-weight:600;">장착된 배지가 없습니다</span>`;
            }
        } catch (err) {
            console.error("위젯 배지 로드 오류:", err);
            badgeArea.innerHTML = `<span style="font-size:11px; color:#ef4444;">배지 로드 실패</span>`;
        }
    },

    checkAdminMenu: async function() {
        if (!Boako.state.user) return;
        try {
            const { data: profile } = await Boako.db.from('profiles').select('is_admin').eq('id', Boako.state.user.id).single();
            if (profile && profile.is_admin) {
                const adminMenu = document.getElementById('menu-admin-review');
                if (adminMenu) {
                    adminMenu.style.display = 'list-item'; 
                    const { count } = await Boako.db.from('view_pending_review_games').select('*', { count: 'exact', head: true });
                    if (count > 0) { adminMenu.style.background = '#fff1f2'; adminMenu.style.borderLeft = '4px solid #f43f5e'; adminMenu.style.fontWeight = '800'; } 
                    else { adminMenu.style.background = 'transparent'; adminMenu.style.borderLeft = 'none'; adminMenu.style.fontWeight = 'normal'; }
                }
            }
        } catch (err) { console.error(err); }
    },

    checkTournamentBadge: async function() {
        try {
            const { count } = await Boako.db.from('tournament_posts').select('*', { count: 'exact', head: true }).eq('type', 'REQUEST').eq('status', 'OPEN');
            const badge = document.getElementById('menu-tournament-badge');
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (err) { console.error("토너먼트 배지 갱신 실패:", err); }
    },

    subscribeTournamentBadge: function() {
        if (Boako.Auth._tournamentBadgeChannel) return; // 중복 구독 방지
        Boako.Auth._tournamentBadgeChannel = Boako.db.channel('tournament-badge-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_posts' }, () => {
                Boako.Auth.checkTournamentBadge();
            })
            .subscribe();
    },

    // 🌟 [추가] 요청 게시판 중 아직 답변(댓글) 안 달린 글 개수 배지
    checkBoardRequestBadge: async function() {
        try {
            const { data: posts } = await Boako.db.from('board_posts')
                .select('id')
                .eq('category', '요청')
                .eq('is_deleted', false)
                .eq('is_draft', false);

            const postIds = (posts || []).map(p => p.id);
            if (postIds.length === 0) {
                const badge = document.getElementById('menu-board-badge');
                if (badge) badge.style.display = 'none';
                return;
            }

            const { data: comments } = await Boako.db.from('board_comments')
                .select('post_id')
                .eq('is_deleted', false)
                .in('post_id', postIds);

            const answeredIds = new Set((comments || []).map(c => c.post_id));
            const unansweredCount = postIds.filter(id => !answeredIds.has(id)).length;

            const badge = document.getElementById('menu-board-badge');
            if (!badge) return;
            if (unansweredCount > 0) {
                badge.textContent = unansweredCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (err) { console.error("게시판 요청 배지 갱신 실패:", err); }
    },

    subscribeBoardRequestBadge: function() {
        if (Boako.Auth._boardRequestBadgeChannel) return;
        Boako.Auth._boardRequestBadgeChannel = Boako.db.channel('board-request-badge-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'board_posts' }, () => {
                Boako.Auth.checkBoardRequestBadge();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'board_comments' }, () => {
                Boako.Auth.checkBoardRequestBadge();
            })
            .subscribe();
    },

    // 🌟 [추가] 같이하자 모집중인 글 개수 배지
    checkTogetherBadge: async function() {
        try {
            const { count } = await Boako.db.from('together_posts')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'RECRUITING')
                .gt('scheduled_date', new Date().toISOString());
            const badge = document.getElementById('menu-together-badge');
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (err) { console.error("같이하자 배지 갱신 실패:", err); }
    },

    subscribeTogetherBadge: function() {
        if (Boako.Auth._togetherBadgeChannel) return; // 중복 구독 방지
        Boako.Auth._togetherBadgeChannel = Boako.db.channel('together-badge-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, () => {
                Boako.Auth.checkTogetherBadge();
            })
            .subscribe();
    },

    checkLeaderMenu: async function() {
        if (!Boako.state.user || !Boako.state.team) return;
        try {
            const myTeamName = Boako.state.team.info.team_name;
            const isLeader = Boako.state.team.type === 'LEADER';
            const verifyMenu = document.getElementById('menu-record-verify');
            if (!verifyMenu) return;

            if (!isLeader) { verifyMenu.style.display = 'none'; return; }
            verifyMenu.style.display = 'list-item';

            const { count } = await Boako.db.from('v_boako_total_records').select('*', { count: 'exact', head: true }).neq('b_all_team', myTeamName).eq('is_verified', 1);
            if (count > 0) { verifyMenu.style.background = '#fff1f2'; verifyMenu.style.borderLeft = '4px solid #10b981'; verifyMenu.style.fontWeight = '800'; } 
            else { verifyMenu.style.background = 'transparent'; verifyMenu.style.borderLeft = 'none'; verifyMenu.style.fontWeight = 'normal'; }
        } catch (err) { console.error(err); }
    },

    requireBgaNickname: async () => {
        if (document.getElementById('bga-nick-modal')) return;

        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('is_nick_changed')
                .eq('id', Boako.state.user.id)
                .single();

            if (profile && profile.is_nick_changed === 1) return;

        } catch (err) {
            console.error("닉네임 변경 여부 확인 실패:", err);
        }

        const modalHtml = `
            <div id="bga-nick-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity">
                <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 transform transition-transform">
                    <div class="bg-indigo-600 p-6 text-center relative">
                        <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <i data-lucide="gamepad-2" class="w-8 h-8 text-white"></i>
                        </div>
                        <h3 class="text-xl font-black text-white">BGA 닉네임 설정</h3>
                        <p class="text-indigo-100 text-xs mt-2 font-bold">리그 기록 연동을 위해 꼭 필요합니다!</p>
                    </div>
                    <div class="p-6">
                        <p class="text-slate-600 text-sm mb-3 font-bold text-center leading-relaxed">
                            현재 보드게임 아레나에서 사용 중인<br><span class="text-red-500 underline decoration-red-200 underline-offset-4">정확한 닉네임</span>을 입력해 주세요.
                        </p>

                        <a href="https://boardgamearena.com/" target="_blank" rel="noopener" class="flex items-center justify-center gap-1.5 text-indigo-600 text-xs font-black mb-5 hover:text-indigo-700 hover:underline">
                            <i data-lucide="external-link" class="w-3.5 h-3.5"></i> BGA에서 내 닉네임 확인하러 가기
                        </a>

                        <input type="text" id="bga-nick-input" value="${Boako.state.user.nickname || ''}" placeholder="대소문자 구별하여 정확히 입력" class="w-full border-2 border-slate-200 rounded-xl p-3.5 text-center font-black text-lg text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all mb-5 placeholder:text-sm placeholder:font-normal">
                        
                        <button onclick="Boako.Auth.saveInitialNick()" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                            <i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i> 확인 및 설정 완료
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    saveInitialNick: async () => {
        const inputEl = document.getElementById('bga-nick-input');
        const newValue = inputEl.value.trim();
        
        if (!newValue) {
            Boako.Util.toast("닉네임을 입력해 주세요!");
            inputEl.focus();
            return;
        }

        try {
            const { error: updateErr } = await Boako.db.from('profiles').update({ 
                full_name: newValue,
                is_nick_changed: 1 
            }).eq('id', Boako.state.user.id);

            if (updateErr) throw new Error(updateErr.message);
            
            Boako.state.user.nickname = newValue; 
            
            const modalEl = document.getElementById('bga-nick-modal');
            if (modalEl) modalEl.remove();
            
            Boako.Auth.renderWidget();
            Boako.Util.toast("🎉 BGA 닉네임이 완벽하게 연동되었습니다!");
            
        } catch (err) {
            Boako.Util.toast("수정 실패: " + err.message);
        }
    },

    // ========== 🌟 [신규] 첫 방문자용 "기록기 설치" 스포트라이트 가이드 ==========
    // CSS(.ext-guide-*, @keyframes)는 index.html의 <style> 블록에 정의되어 있음

    // 실제 오버레이(스포트라이트 + 말풍선)를 만드는 공용 함수. onDismiss는 "확인 처리" 완료 시 호출됨
    showExtensionGuideOverlay: (onDismiss) => {
        if (document.getElementById('ext-guide-overlay')) return;
        const btn = document.getElementById('btn-extension-install');
        if (!btn) return;

        let resizeHandler = null;

        function positionGuide() {
            const rect = btn.getBoundingClientRect();
            const padding = 6;
            const highlight = document.getElementById('ext-guide-highlight');
            const tooltip = document.getElementById('ext-guide-tooltip');
            if (!highlight || !tooltip) return;

            highlight.style.top = (rect.top - padding) + 'px';
            highlight.style.left = (rect.left - padding) + 'px';
            highlight.style.width = (rect.width + padding * 2) + 'px';
            highlight.style.height = (rect.height + padding * 2) + 'px';

            const tooltipTop = rect.bottom + 14;
            const tooltipRight = Math.max(16, window.innerWidth - rect.right);
            tooltip.style.top = tooltipTop + 'px';
            tooltip.style.right = tooltipRight + 'px';
            tooltip.style.left = '';
        }

        function dismiss() {
            document.getElementById('ext-guide-overlay')?.remove();
            document.getElementById('ext-guide-highlight')?.remove();
            document.getElementById('ext-guide-tooltip')?.remove();
            if (resizeHandler) {
                window.removeEventListener('resize', resizeHandler);
                window.removeEventListener('scroll', resizeHandler);
            }
            btn.style.position = '';
            btn.style.zIndex = '';
            if (onDismiss) onDismiss();
        }

        const overlay = document.createElement('div');
        overlay.id = 'ext-guide-overlay';
        overlay.onclick = dismiss;

        const highlight = document.createElement('div');
        highlight.id = 'ext-guide-highlight';

        const tooltip = document.createElement('div');
        tooltip.id = 'ext-guide-tooltip';
        tooltip.innerHTML = `
            <div style="font-weight:900; font-size:14px; color:#1e293b; margin-bottom:6px;">👋 처음 오셨네요!</div>
            <div style="font-size:12.5px; color:#64748b; font-weight:600; line-height:1.6; margin-bottom:14px;">
                보드게임아레나(BGA) 전적을 자동으로 기록하려면 먼저 <b style="color:#7c3aed;">기록기 확장 프로그램</b>을 설치해주세요!
            </div>
            <button id="ext-guide-dismiss" style="width:100%; background:#1e293b; color:white; font-weight:800; font-size:12.5px; padding:10px; border-radius:10px; cursor:pointer;">확인했어요</button>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(highlight);
        document.body.appendChild(tooltip);

        // 실제 버튼을 오버레이보다 위로 끌어올려서 스포트라이트 안에서 계속 클릭 가능하게
        btn.style.position = 'relative';
        btn.style.zIndex = '99999';

        positionGuide();

        resizeHandler = positionGuide;
        window.addEventListener('resize', resizeHandler);
        window.addEventListener('scroll', resizeHandler, { passive: true });

        document.getElementById('ext-guide-dismiss').addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });
        btn.addEventListener('click', dismiss, { once: true });
    },

    // 🌟 [신규] 기록기 가이드가 (표시할지 판단 중 or 실제로 떠 있는) 진행 상태를 나타내는 플래그.
    // 공지사항 모달이 이 플래그를 보고 순서를 기다린다.
    _extGuidePending: false,

    // 🌟 로그인 사용자: profiles.tutorial_status(JSONB)에 ext_guide_seen 플래그로 계정 기준 판별
    requireExtensionGuide: async () => {
        if (!Boako.state.user) return;
        Boako.Auth._extGuidePending = true;

        // BGA 닉네임 모달이 떠 있으면 겹치지 않도록, 닫힐 때까지 대기했다가 다시 시도
        if (document.getElementById('bga-nick-modal')) {
            setTimeout(() => Boako.Auth.requireExtensionGuide(), 400);
            return;
        }
        if (document.getElementById('ext-guide-overlay')) return; // 이미 떠 있음 (pending 유지)

        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();

            const status = profile?.tutorial_status || {};
            if (status.ext_guide_seen) { Boako.Auth._extGuidePending = false; return; } // 이미 확인한 사람 — 다시 안 띄움

            Boako.Auth.showExtensionGuideOverlay(async () => {
                try {
                    const { data: freshProfile } = await Boako.db.from('profiles')
                        .select('tutorial_status')
                        .eq('id', Boako.state.user.id)
                        .single();
                    let newStatus = freshProfile?.tutorial_status || {};
                    newStatus.ext_guide_seen = true;
                    await Boako.db.from('profiles').update({ tutorial_status: newStatus }).eq('id', Boako.state.user.id);
                } catch (err) {
                    console.error('기록기 가이드 확인 상태 저장 실패:', err);
                } finally {
                    Boako.Auth._extGuidePending = false;
                }
            });
        } catch (err) {
            console.error('기록기 가이드 확인 상태 조회 실패:', err);
            Boako.Auth._extGuidePending = false;
        }
    },

    // 🌟 비로그인 방문객: 계정이 없어 DB에 기록할 수 없으므로 브라우저 기준(localStorage)으로만 판별
    requireExtensionGuideAnonymous: () => {
        const STORAGE_KEY = 'boako_ext_guide_seen_anon';
        if (localStorage.getItem(STORAGE_KEY)) return;
        if (document.getElementById('ext-guide-overlay')) return;

        // 다른 초기화 스크립트가 레이아웃을 잡을 시간을 살짝 준 뒤 노출
        setTimeout(() => {
            Boako.Auth.showExtensionGuideOverlay(() => {
                localStorage.setItem(STORAGE_KEY, '1');
            });
        }, 900);
    },

    // ========== 🌟 [신규] 로그인 시 미확인 공지사항 모달 (닉네임 모달 → 기록기 가이드 다음 순서) ==========
    // board_posts.is_notice = true 인 글 중, profiles.tutorial_status.confirmed_notice_ids에
    // 없는(=아직 확인 안 한) 것들을 오래된 순으로 하나씩 모달로 띄운다.

    _noticeQueue: [],

    requireNoticeModal: async () => {
        if (!Boako.state.user) return;
        if (document.getElementById('notice-modal')) return;

        // 닉네임 모달이나 기록기 설치 가이드가 아직 진행 중이면, 끝난 뒤에 순서대로 노출
        if (document.getElementById('bga-nick-modal') || Boako.Auth._extGuidePending || document.getElementById('ext-guide-overlay')) {
            setTimeout(() => Boako.Auth.requireNoticeModal(), 400);
            return;
        }

        try {
            const { data: notices } = await Boako.db.from('board_posts')
                .select('id, title, content, created_at')
                .eq('is_notice', true)
                .eq('is_deleted', false)
                .eq('is_draft', false)
                .order('created_at', { ascending: true });

            if (!notices || notices.length === 0) return;

            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();

            const status = profile?.tutorial_status || {};
            const confirmedIds = new Set(status.confirmed_notice_ids || []);

            const unconfirmed = notices.filter(n => !confirmedIds.has(n.id));
            if (unconfirmed.length === 0) return;

            Boako.Auth._noticeQueue = unconfirmed;
            Boako.Auth.showNextNoticeModal();
        } catch (err) {
            console.error('공지사항 확인 상태 조회 실패:', err);
        }
    },

    showNextNoticeModal: () => {
        const queue = Boako.Auth._noticeQueue;
        if (!queue || queue.length === 0) return;
        const notice = queue[0];

        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.innerText = str || '';
            return div.innerHTML;
        };

        const modalHtml = `
            <div id="notice-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[85vh] flex flex-col">
                    <div class="bg-amber-500 p-5 flex items-center gap-3 shrink-0">
                        <span class="text-2xl">📢</span>
                        <div class="min-w-0">
                            <div class="text-[10px] font-black text-amber-100 uppercase tracking-widest">공지사항</div>
                            <h3 class="text-lg font-black text-white leading-tight truncate">${escapeHtml(notice.title)}</h3>
                        </div>
                    </div>
                    <div class="p-6 overflow-y-auto text-sm text-slate-700 leading-relaxed prose max-w-none">${notice.content}</div>
                    <div class="p-5 border-t border-slate-100 shrink-0">
                        <button onclick="Boako.Auth.confirmNotice(${notice.id})" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 rounded-xl transition-all shadow-lg active:scale-95">
                            확인했습니다${queue.length > 1 ? ` (${queue.length}개 중 1번째)` : ''}
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    confirmNotice: async (noticeId) => {
        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();
            let status = profile?.tutorial_status || {};
            const confirmedIds = new Set(status.confirmed_notice_ids || []);
            confirmedIds.add(noticeId);
            status.confirmed_notice_ids = [...confirmedIds];
            await Boako.db.from('profiles').update({ tutorial_status: status }).eq('id', Boako.state.user.id);
        } catch (err) {
            console.error('공지사항 확인 상태 저장 실패:', err);
        }

        document.getElementById('notice-modal')?.remove();
        Boako.Auth._noticeQueue = (Boako.Auth._noticeQueue || []).filter(n => n.id !== noticeId);

        if (Boako.Auth._noticeQueue.length > 0) {
            Boako.Auth.showNextNoticeModal();
        }
    }
};
