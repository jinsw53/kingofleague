/**
 * [AUTH] 인증 및 프로필 관리 (최종 순정본 - 데드락 완벽 차단 + 메신저 연결)
 */
Boako.Auth = {
    init: async () => {
        Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);

        // 1. 최초 접속 시 정상 로드
        const { data: { session } } = await Boako.db.auth.getSession();
        if (session?.user) {
            Boako.state.user = session.user;
            if (!Boako.Team.syncStatus) await Boako.Util.loadScript('js/team.js');
            await Boako.Team.syncStatus();
            await Boako.Auth.checkAdminMenu();
            await Boako.Auth.checkLeaderMenu();

            // 📩 [추가 1] 최초 로그인 시 메신저 로드 및 안 읽은 쪽지 카운트
            if (Object.keys(Boako.Messenger).length === 0) await Boako.Util.loadScript('js/messenger.js');
            if (Boako.Messenger.fetchUnreadCount) await Boako.Messenger.fetchUnreadCount();
        }
        Boako.Auth.renderWidget();
        Boako.View.render('main'); // 최초 접속 시 딱 한 번만 화면 그림

        // 2. 상태 변화 감지 (탭 복귀 시)
        Boako.db.auth.onAuthStateChange(async (e, s) => {
            if (e === 'INITIAL_SESSION') return;

            if (s?.user) {
                // =========================================================
                // 🛡️ [마스터 방어막] 토큰 갱신이나, 이미 로그인된 상태에서의 
                // 중복 로그인 이벤트 완벽 차단 (무한 펜딩/버벅임 원천 방지)
                // =========================================================
                if (e === 'TOKEN_REFRESHED' || (e === 'SIGNED_IN' && Boako.state.user?.id === s.user.id)) {
                    return; // 아무것도 안 하고 쿨하게 함수 종료! 화면 유지됨.
                }

                // 진짜 쌩판 신규 로그인일 경우에만 아래 실행
                Boako.state.user = s.user;
                if (!Boako.Team.syncStatus) await Boako.Util.loadScript('js/team.js');
                await Boako.Team.syncStatus();
                await Boako.Auth.checkAdminMenu();
                await Boako.Auth.checkLeaderMenu();
                
                // 📩 [추가 2] 신규 재로그인 시 메신저 로드 및 카운트
                if (Object.keys(Boako.Messenger).length === 0) await Boako.Util.loadScript('js/messenger.js');
                if (Boako.Messenger.fetchUnreadCount) await Boako.Messenger.fetchUnreadCount();

                Boako.Auth.renderWidget();
                
            } else {
                // 로그아웃 처리
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

    login: () => Boako.db.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: window.location.origin + window.location.pathname } }),
    
    logout: async () => { await Boako.db.auth.signOut(); location.reload(); },
    
    editNick: async () => {
        const n = prompt("변경할 닉네임을 입력하세요:", Boako.state.user.nickname);
        if (n && n.trim()) {
            const { error } = await Boako.db.from('profiles').upsert({ id: Boako.state.user.id, full_name: n.trim() });
            if (error) Boako.Util.toast("수정 실패: " + error.message); 
            else { Boako.Util.toast("✅ 닉네임이 수정되었습니다."); location.reload(); }
        }
    },

    renderWidget: () => {
        const area = document.getElementById('login-widget-area');
        const user = Boako.state.user;
        if (!user) {
            area.innerHTML = `<button class="btn-kakao" onclick="Boako.Auth.login()">🟡 카카오 로그인</button>`;
        } else {
            const avatarUrl = user.user_metadata?.avatar_url?.replace('http://', 'https://');
            
            // 📩 [추가 3] 빨간색 안 읽음 뱃지 HTML 생성
            const unreadBadge = (Boako.Messenger && Boako.Messenger.unreadCount > 0) 
                ? `<span style="background:#ef4444; color:white; border-radius:50%; padding:2px 6px; font-size:11px; margin-left:4px; font-weight:bold;">${Boako.Messenger.unreadCount}</span>` 
                : '';

            // 📩 [수정 3] 인벤토리 버튼 옆에 '통신망(메신저)' 버튼 추가
            area.innerHTML = `
            <div class="user-avatar" style="display: flex; align-items: center; justify-content: center; overflow: hidden; p-0">
                ${avatarUrl ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Profile">` : '👤'}
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                <strong>${user.nickname || '사용자'}</strong>
                <button class="btn-edit-small" onclick="Boako.Shop.buyItem('item_ticket_nick')">수정</button>
            </div>
            <div style="margin-top: 8px;">
                <button class="btn-inventory" onclick="Boako.View.render('inventory')" style="cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 12px;">🎒 가방</button>
                <button class="btn-messenger" onclick="Boako.View.render('messenger')" style="cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 12px; margin-left: 5px;">📬 통신망${unreadBadge}</button>
            </div>
            <span class="badge-premium" style="display:inline-block; margin-top:8px;">아카이브 멤버</span><br>
            <button class="btn-logout" style="width:100%; padding:12px; color:#94a3b8; font-size:13px; font-weight:600; border:1px solid #e2e8f0; border-radius:10px; margin-top:15px;" onclick="Boako.Auth.logout()">로그아웃</button>`;
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
    }
};
