/**
 * [AUTH] 인증 및 프로필 관리
 */
Boako.Auth = {
    init: async () => {
        Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);
        const { data: { session } } = await Boako.db.auth.getSession();
        
        if (session?.user) {
            Boako.state.user = session.user;
            await Boako.Team.syncStatus();
            
            // 🌟 권한 메뉴 체크 세트 실행
            await Boako.Auth.checkAdminMenu();
            await Boako.Auth.checkLeaderMenu(); // [추가]
        }
        
        Boako.Auth.renderWidget();
        Boako.View.render('main');

        Boako.db.auth.onAuthStateChange(async (e, s) => {
            if (s?.user) {
                Boako.state.user = s.user;
                await Boako.Team.syncStatus();
                
                // 🌟 로그인/변경 시 권한 메뉴 재확인
                await Boako.Auth.checkAdminMenu();
                await Boako.Auth.checkLeaderMenu(); // [추가]
            } else {
                Boako.state.user = null;
                Boako.state.team = null;
                
                // 로그아웃 시 권한 메뉴 일제히 숨기기
                const adminMenu = document.getElementById('menu-admin-review');
                if (adminMenu) adminMenu.style.display = 'none';
                
                const verifyMenu = document.getElementById('menu-record-verify'); // [추가]
                if (verifyMenu) verifyMenu.style.display = 'none'; // [추가]
            }
            Boako.Auth.renderWidget();
        });
    },

    login: () => Boako.db.auth.signInWithOAuth({ 
        provider: 'kakao', 
        options: { redirectTo: window.location.origin + window.location.pathname } 
    }),

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
            const avatarUrl = user.user_metadata?.avatar_url;

            area.innerHTML = `
            <div class="user-avatar" style="display: flex; align-items: center; justify-content: center; overflow: hidden; p-0">
                ${avatarUrl 
                    ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Profile">` 
                    : '👤'
                }
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                <strong>${user.nickname || '사용자'}</strong>
                <button class="btn-edit-small" onclick="Boako.Shop.buyItem('item_ticket_nick')">수정</button>
            </div>
            <button class="btn-inventory" onclick="Boako.View.render('inventory')" style="margin-left: 10px; cursor: pointer;">🎒 내 인벤토리</button><br>
            <span class="badge-premium">아카이브 멤버</span><br>
            <button class="btn-logout" style="width:100%; padding:12px; color:#94a3b8; font-size:13px; font-weight:600; border:1px solid #e2e8f0; border-radius:10px; margin-top:15px;" onclick="Boako.Auth.logout()">로그아웃</button>`;
        }
    },

    /**
     * 🌟 [업그레이드] 관리자 메뉴 권한 체크 및 실시간 스타일링
     */
    checkAdminMenu: async function() {
        if (!Boako.state.user) return;

        try {
            const { data: profile } = await Boako.db
                .from('profiles')
                .select('is_admin')
                .eq('id', Boako.state.user.id)
                .single();

            if (profile && profile.is_admin) {
                const adminMenu = document.getElementById('menu-admin-review');
                if (adminMenu) {
                    adminMenu.style.display = 'list-item'; 
                    
                    const { count } = await Boako.db
                        .from('view_pending_review_games')
                        .select('*', { count: 'exact', head: true });
                    
                    if (count > 0) {
                        adminMenu.style.background = '#fff1f2';
                        adminMenu.style.borderLeft = '4px solid #f43f5e';
                        adminMenu.style.fontWeight = '800';
                    } else {
                        adminMenu.style.background = 'transparent';
                        adminMenu.style.borderLeft = 'none';
                        adminMenu.style.fontWeight = 'normal';
                    }
                }
            }
        } catch (err) { 
            console.error("관리자 메뉴 로드 오류:", err); 
        }
    }, // 🌟 다음 함수로 이어지므로 쉼표 필수!

    /**
     * 🌟 [신설] 팀 리더(LEADER & is_active) 메뉴 권한 체크 엔진
     */
    checkLeaderMenu: async function() {
        if (!Boako.state.user) return;

        try {
            // 1. team_members 테이블에서 활성화 상태인 정식 팀장인지 압축 조회
            const { data: isLeader } = await Boako.db
                .from('team_members')
                .select('id')
                .eq('player_name', Boako.state.user.nickname)
                .eq('is_active', true)
                .eq('role', 'LEADER')
                .maybeSingle();

            const verifyMenu = document.getElementById('menu-record-verify');
            if (verifyMenu) {
                // 2. 조건 만족 시 메뉴바 노출 (Tailwind li 기본형태인 list-item 적용)
                if (isLeader) {
                    verifyMenu.style.display = 'list-item';
                } else {
                    verifyMenu.style.display = 'none';
                }
            }
        } catch (err) {
            console.error("팀 리더 메뉴 로드 오류:", err);
        }
    }
};
