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
            // 🌟 관리자 권한 확인
            await Boako.Auth.checkAdminMenu();
        }
        
        Boako.Auth.renderWidget();
        Boako.View.render('main');

        Boako.db.auth.onAuthStateChange(async (e, s) => {
            if (s?.user) {
                Boako.state.user = s.user;
                await Boako.Team.syncStatus();
                // 🌟 로그인/변경 시 관리자 권한 재확인
                await Boako.Auth.checkAdminMenu();
            } else {
                Boako.state.user = null;
                Boako.state.team = null;
                // 로그아웃 시 관리자 메뉴 숨기기
                const adminMenu = document.getElementById('menu-admin-review');
                if (adminMenu) adminMenu.style.display = 'none';
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
            // 🌟 수파베이스 라이브 세션에 담긴 카카오톡 프로필 이미지 주소 추출
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
            // 1. 관리자 권한 확인
            const { data: profile } = await Boako.db
                .from('profiles')
                .select('is_admin')
                .eq('id', Boako.state.user.id)
                .single();

            if (profile && profile.is_admin) {
                const adminMenu = document.getElementById('menu-admin-review');
                if (adminMenu) {
                    // 메뉴는 일단 노출
                    adminMenu.style.display = 'list-item'; 
                    
                    // 2. 검수할 데이터 건수 확인 (head: true 옵션으로 데이터 없이 개수만 빠르게 조회)
                    const { count } = await Boako.db
                        .from('view_pending_review_games')
                        .select('*', { count: 'exact', head: true });
                    
                    // 3. 건수에 따른 조건부 스타일링
                    if (count > 0) {
                        // 검수 대기 항목이 있을 때만 붉은색 포인트
                        adminMenu.style.background = '#fff1f2';
                        adminMenu.style.borderLeft = '4px solid #f43f5e';
                        adminMenu.style.fontWeight = '800';
                    } else {
                        // 검수할 게 없으면 일반 메뉴처럼 투명하게
                        adminMenu.style.background = 'transparent';
                        adminMenu.style.borderLeft = 'none';
                        adminMenu.style.fontWeight = 'normal';
                    }
                }
            }
        } catch (err) { 
            console.error("관리자 메뉴 로드 오류:", err); 
        }
    }
}; // 👈 여기서 딱 한 번만 닫아주면 끝!
