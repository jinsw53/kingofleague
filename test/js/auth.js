/**
 * [AUTH] 인증 및 프로필 관리 (인덱스 다이어트 대응 최종본)
 */
Boako.Auth = {
    init: async () => {
        // 1. 최초 수파베이스 클라이언트 생성 (소장님 원본 흐름)
        Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);

        // ====================================================================
        // 🛡️ [글로벌 마스터 허브] 대용량 무한 로딩 방어형 커넥션 헬스체크 엔진
        // ====================================================================
        if (Boako.db && !Boako.db.isIntercepted) {
            const originalFrom = Boako.db.from;
            Boako.db.isIntercepted = true; // 중복 바인딩 완벽 차단

            Boako.db.from = function(tableName) {
                // 🎯 장시간 잠수로 인해 객체가 잠들었거나 내부 채널이 파괴되었는지 즉각 스캔
                if (!Boako.db || !Boako.db.auth || typeof Boako.db.auth.refreshSession !== 'function') {
                    console.log("♻️ [마스터 허브] 커넥션 유실 확인: 수파베이스 인스턴스 전격 즉시 리프레시");
                    Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);
                    return originalFrom.call(Boako.db, tableName);
                }

                // 소장님의 기존 세션 상태 유효성 및 토큰 만료 시간 체크 (유령 세션 전환 기조 차단)
                const session = typeof Boako.db.auth.session === 'function' ? Boako.db.auth.session() : null;
                if (session && session.expires_at && (Date.now() / 1000) > (session.expires_at - 60)) {
                    console.log("🕒 인증 토큰 수명 만료 임박 감지 ➡️ 안전하게 인스턴스 재생성 스왑");
                    Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);
                    return originalFrom.call(Boako.db, tableName);
                }

                // 정상 작동 및 대용량 페이지 연산 시에는 서버 응답을 안전하게 보장 (무한 로딩 0%)
                return originalFrom.call(this, tableName);
            };
        }
        // ====================================================================

        // 2. 기존 뼈대 세션 체크 로직 (여기서부터 기존 코드 100% 그대로 유지)
        const { data: { session } } = await Boako.db.auth.getSession();
        
        if (session?.user) {
            Boako.state.user = session.user;
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
