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
            area.innerHTML = `
            <div class="user-avatar">👤</div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                <strong>${user.nickname || '사용자'}</strong>
                <button class="btn-edit-small" onclick="Boako.Shop.buyItem('item_ticket_nick')">수정</button>
            </div>
            <button class="btn-inventory" onclick="Boako.View.render('inventory')" style="margin-left: 10px; cursor: pointer;">🎒 내 인벤토리</button><br>
            <span class="badge-premium">아카이브 멤버</span><br>
            <button class="btn-logout" style="width:100%; padding:12px; color:#94a3b8; font-size:13px; font-weight:600; border:1px solid #e2e8f0; border-radius:10px; margin-top:15px;" onclick="Boako.Auth.logout()">로그아웃</button>`;
        }
    }, // 👈 여기에 콤마(,)가 있어야 다음 함수를 쓸 수 있습니다!

    /**
     * 🌟 [추가] 관리자 메뉴 권한 체크 함수
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
                    adminMenu.style.display = 'list-item'; // 메뉴 보이기
                }
            }
        } catch (err) {
            console.error("관리자 메뉴 로드 오류:", err);
        }
    } // 👈 마지막 함수 뒤에는 콤마가 없어도 됩니다.
}; // 👈 여기서 딱 한 번만 닫아주면 끝!
