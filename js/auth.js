/**
 * [AUTH] 인증 및 프로필 관리 (최종 통합본 - 데드락 방지 + 메신저 연결 + 상점 지연로딩 + BGA 닉네임 모달 + 🌟팀쳇 고속도로 + 🌟배지 디스플레이)
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

            await Boako.Auth.requireBgaNickname();
        }
        Boako.Auth.renderWidget();
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

                Boako.Auth.renderWidget();
                await Boako.Auth.requireBgaNickname();
                
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

    // 🌟 [수정됨] 로그인 위젯 렌더링 + 팀 멤버 뱃지 + 인벤토리 배지 영역 추가
    renderWidget: () => {
        const area = document.getElementById('login-widget-area');
        const user = Boako.state.user;
        if (!user) {
            area.innerHTML = `<button class="btn-kakao" onclick="Boako.Auth.login()">🟡 카카오 로그인</button>`;
        } else {
            const avatarUrl = user.user_metadata?.avatar_url?.replace('http://', 'https://');
            
            const unreadBadge = (Boako.Messenger && Boako.Messenger.unreadCount > 0) 
                ? `<span style="background:#ef4444; color:white; border-radius:50%; padding:2px 6px; font-size:11px; margin-left:4px; font-weight:bold;">${Boako.Messenger.unreadCount}</span>` 
                : '';

            // 소속 여부에 따른 팀 뱃지 동적 생성
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
            <div class="user-avatar" style="display: flex; align-items: center; justify-content: center; overflow: hidden; p-0">
                ${avatarUrl ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Profile">` : '👤'}
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
            
            // 🌟 HTML 렌더링 직후 DB에서 장착 중인 배지를 비동기로 불러오기
            Boako.Auth.loadWidgetBadges();
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
                        const name = team ? `${team.team_name} 서포터즈` : '서포터즈 뱃지';
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
        } catch (err) { console.error("토너먼트 뱃지 갱신 실패:", err); }
    },

    subscribeTournamentBadge: function() {
        if (Boako.Auth._tournamentBadgeChannel) return; // 중복 구독 방지
        Boako.Auth._tournamentBadgeChannel = Boako.db.channel('tournament-badge-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_posts' }, () => {
                Boako.Auth.checkTournamentBadge();
            })
            .subscribe();
    },

    // 🌟 [추가] 요청 게시판 중 아직 답변(댓글) 안 달린 글 개수 뱃지
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
        } catch (err) { console.error("게시판 요청 뱃지 갱신 실패:", err); }
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

    // 🌟 [추가] 같이하자 모집중인 글 개수 뱃지
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
        } catch (err) { console.error("같이하자 뱃지 갱신 실패:", err); }
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
                        <p class="text-slate-600 text-sm mb-5 font-bold text-center leading-relaxed">
                            현재 보드게임 아레나에서 사용 중인<br><span class="text-red-500 underline decoration-red-200 underline-offset-4">정확한 닉네임</span>을 입력해 주세요.
                        </p>
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
    }
};
