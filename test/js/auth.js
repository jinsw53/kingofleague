/**
 * [AUTH] 인증 및 프로필 관리 (인덱스 다이어트 대응 최종본)
 */
Boako.Auth = {
    init: async () => {
        // ----------------------------------------------------------------
        // 🛡️ [글로벌 마스터 치트키] 모든 콘텐츠 수정 제로 ➡️ 끊김 없는 커넥터 개조
        // ----------------------------------------------------------------
        const createSmartClient = () => {
            const client = supabase.createClient(Boako.config.url, Boako.config.key);
            const originalFrom = client.from;

            // 모든 콘텐츠 파일의 db.from()이 실행될 때 자동으로 커넥션을 감지하고 자동 재접속(Auto-Reconnect)합니다.
            client.from = function(tableName) {
                // 장시간 잠수로 인해 통신 상태 스탬프가 맛이 갔거나 객체가 잠들었을 때
                if (!Boako.db || !Boako.db.auth || typeof Boako.db.auth.getSession !== 'function') {
                    console.log("♻️ [마스터 엔진] 단선 감지: 클라이언트를 전격 즉시 재기동합니다.");
                    Boako.db = createSmartClient();
                    return originalFrom.call(Boako.db, tableName);
                }
                return originalFrom.call(this, tableName);
            };
            return client;
        };

        // 스마트 클라이언트로 최초 구동 발사
        Boako.db = createSmartClient();
        // ====================================================================
        const { data: { session } } = await Boako.db.auth.getSession();
        
        if (session?.user) {
            Boako.state.user = session.user;

            // 🚚 [1번째 방어막] 팀 실무 파일이 메모리에 없다면 즉시 실시간 배달 받기!
            if (!Boako.Team.syncStatus) {
                await Boako.Util.loadScript('js/team.js');
            }
            await Boako.Team.syncStatus();
            
            // 🌟 권한 메뉴 체크 세트 실행
            await Boako.Auth.checkAdminMenu();
            await Boako.Auth.checkLeaderMenu();
        }
        
        Boako.Auth.renderWidget();
        Boako.View.render('main');

        Boako.db.auth.onAuthStateChange(async (e, s) => {
            if (s?.user) {
                Boako.state.user = s.user;

                // 🚚 [2번째 방어막] 실시간 로그인 상태 변화 대응 배달 검문
                if (!Boako.Team.syncStatus) {
                    await Boako.Util.loadScript('js/team.js');
                }
                await Boako.Team.syncStatus();
                
                // 🌟 로그인/변경 시 권한 메뉴 재확인
                await Boako.Auth.checkAdminMenu();
                await Boako.Auth.checkLeaderMenu();
            } else {
                Boako.state.user = null;
                Boako.state.team = null;
                
                // 로그아웃 시 권한 메뉴 일제히 숨기기
                const adminMenu = document.getElementById('menu-admin-review');
                if (adminMenu) adminMenu.style.display = 'none';
                
                const verifyMenu = document.getElementById('menu-record-verify');
                if (verifyMenu) verifyMenu.style.display = 'none';
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
            const avatarUrl = user.user_metadata?.avatar_url?.replace('http://', 'https://');

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
     * 🌟 관리자 메뉴 권한 체크 및 실시간 스타일링
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
    },

    /**
     * 🌟 팀 리더 메뉴 권한 체크 및 타 팀 미인증 알림 (b_all_team 다이렉트 매칭)
     */
    checkLeaderMenu: async function() {
        if (!Boako.state.user || !Boako.state.team) return;

        try {
            const myTeamName = Boako.state.team.info.team_name;
            const isLeader = Boako.state.team.type === 'LEADER';

            const verifyMenu = document.getElementById('menu-record-verify');
            if (!verifyMenu) return;

            if (!isLeader) {
                verifyMenu.style.display = 'none';
                return;
            }

            verifyMenu.style.display = 'list-item';

            const { count } = await Boako.db
                .from('v_boako_total_records')
                .select('*', { count: 'exact', head: true })
                .neq('b_all_team', myTeamName)
                .eq('is_verified', 1);

            if (count > 0) {
                verifyMenu.style.background = '#fff1f2';
                verifyMenu.style.borderLeft = '4px solid #10b981';
                verifyMenu.style.fontWeight = '800';
            } else {
                verifyMenu.style.background = 'transparent';
                verifyMenu.style.borderLeft = 'none';
                verifyMenu.style.fontWeight = 'normal';
            }

        } catch (err) {
            console.error("팀 리더 타 팀 검증 알림 연동 오류:", err);
        }
    }
};
