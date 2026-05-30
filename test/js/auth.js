/**
 * [AUTH] 인증 및 프로필 관리 (최종 통합본 - 데드락 방지 + 메신저 연결 + 상점 지연로딩 + BGA 닉네임 모달)
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

            // 🌟 [신규 추가] 화면 그리기 전, DB를 조회하여 BGA 닉네임 모달 띄우기 (최초 1회)
            await Boako.Auth.requireBgaNickname();
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

                // 🌟 [신규 추가] 신규 로그인 직후에도 BGA 닉네임 설정 안 했으면 모달 띄우기
                await Boako.Auth.requireBgaNickname();
                
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
    
    // 🗑️ (불필요해진 editNick 임시 함수는 소장님의 완벽한 샵 아키텍처를 위해 완전히 제거했습니다!)

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

            area.innerHTML = `
            <div class="user-avatar" style="display: flex; align-items: center; justify-content: center; overflow: hidden; p-0">
                ${avatarUrl ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Profile">` : '👤'}
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                <strong>${user.nickname || '사용자'}</strong>
                
                <!-- 🌟 [핵심 변경] 상점 모듈이 로드되지 않았다면 몰래 다운받은 후 구매 로직 실행 (지연 로딩) -->
                <button class="btn-edit-small" onclick="(async () => { if (!window.Boako.Shop) await Boako.Util.loadScript('js/shop.js'); Boako.Shop.buyItem('item_ticket_nick'); })()">수정</button>
                
            </div>
            <div style="margin-top: 8px;">
                <button class="btn-inventory" onclick="Boako.View.render('inventory')" style="cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 12px;">🎒 인벤토리</button>
                <button class="btn-messenger" onclick="Boako.View.render('messenger')" style="cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-size: 12px; margin-left: 5px;">📬 쪽지${unreadBadge}</button>
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
    },

    // 🌟 [기능 유지] BGA 닉네임 설정 팝업 띄우기 (DB 테이블 조회 방식)
    requireBgaNickname: async () => {
        // 이미 팝업이 띄워져 있다면 중복 실행 방지
        if (document.getElementById('bga-nick-modal')) return;

        try {
            // DB의 profiles 테이블에서 is_nick_changed 값을 가져와 검사
            const { data: profile } = await Boako.db.from('profiles')
                .select('is_nick_changed')
                .eq('id', Boako.state.user.id)
                .single();

            // 값이 1(수정 완료)이라면 바로 종료 (팝업 안 띄움)
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

    // 🌟 [기능 유지] BGA 닉네임 저장 및 팝업 닫기
    saveInitialNick: async () => {
        const inputEl = document.getElementById('bga-nick-input');
        const newValue = inputEl.value.trim();
        
        if (!newValue) {
            Boako.Util.toast("닉네임을 입력해 주세요!");
            inputEl.focus();
            return;
        }

        try {
            // DB 업데이트: 닉네임을 변경하고 is_nick_changed 값을 1로 확정
            const { error: updateErr } = await Boako.db.from('profiles').update({ 
                full_name: newValue,
                is_nick_changed: 1 
            }).eq('id', Boako.state.user.id);

            if (updateErr) throw new Error(updateErr.message);
            
            // 로컬 상태 업데이트
            Boako.state.user.nickname = newValue; 
            
            // 모달 제거
            const modalEl = document.getElementById('bga-nick-modal');
            if (modalEl) modalEl.remove();
            
            // 화면 새로고침하여 변경 반영
            Boako.Auth.renderWidget();
            Boako.Util.toast("🎉 BGA 닉네임이 완벽하게 연동되었습니다!");
            
        } catch (err) {
            Boako.Util.toast("수정 실패: " + err.message);
        }
    }
};
