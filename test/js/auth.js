/**
 * [AUTH] 인증 및 프로필 관리 (하드코어 디버깅 모드)
 */
Boako.Auth = {
    init: async () => {
        console.log("[DEBUG 🚀 05] Auth.init 진입");
        Boako.db = supabase.createClient(Boako.config.url, Boako.config.key);
        console.log("[DEBUG 🚀 06] 수파베이스 클라이언트 생성");

        try {
            console.log("[DEBUG 🚀 07] 초기 getSession() 시도");
            const { data: { session } } = await Boako.db.auth.getSession();
            console.log(`[DEBUG 🚀 08] 초기 세션 가져오기 완료 (유저있음?: ${!!session?.user})`);

            if (session?.user) {
                Boako.state.user = session.user;
                if (!Boako.Team.syncStatus) {
                    console.log("[DEBUG 🚀 09] team.js 로드 시작");
                    await Boako.Util.loadScript('js/team.js');
                }
                
                console.log("[DEBUG 🚀 10] syncStatus 시도");
                await Promise.race([
                    Boako.Team.syncStatus(),
                    new Promise((_, r) => setTimeout(() => r(new Error("syncStatus 무한 펜딩 (3초 초과)")), 3000))
                ]).catch(e => console.error("[DEBUG 💥 10] syncStatus 폭발:", e));
                console.log("[DEBUG 🚀 11] syncStatus 통과");

                console.log("[DEBUG 🚀 12] checkAdminMenu 시도");
                await Boako.Auth.checkAdminMenu();
                console.log("[DEBUG 🚀 13] checkLeaderMenu 시도");
                await Boako.Auth.checkLeaderMenu();
            }

            console.log("[DEBUG 🚀 14] 최초 접속 renderWidget 호출");
            Boako.Auth.renderWidget();
            console.log("[DEBUG 🚀 15] 최초 접속 View.render('main') 호출 직전");
            if (typeof Boako.View !== 'undefined') Boako.View.render('main');
            console.log("[DEBUG 🚀 16] 최초 접속 View.render('main') 완료");

        } catch (err) {
            console.error("[DEBUG 💥] init 메인 흐름 에러:", err);
        }

        // 🌟 문제의 onAuthStateChange 철저 해부
        Boako.db.auth.onAuthStateChange(async (e, s) => {
            console.log(`\n[DEBUG 🎧 17] onAuthStateChange 이벤트 감지됨! [상태: ${e}]`);
            
            // INITIAL_SESSION 은 위에서 처리하므로 패스
            if (e === 'INITIAL_SESSION') return;

            try {
                if (s?.user) {
                    Boako.state.user = s.user;
                    
                    console.log(`[DEBUG 🎧 18] ${e} 여파로 syncStatus 재실행 시도`);
                    if (!Boako.Team.syncStatus) await Boako.Util.loadScript('js/team.js');
                    await Promise.race([
                        Boako.Team.syncStatus(),
                        new Promise((_, r) => setTimeout(() => r(new Error(`${e} 중 syncStatus 무한 펜딩`)), 3000))
                    ]).catch(e => console.error("[DEBUG 💥 18] syncStatus 폭발:", e));
                    console.log("[DEBUG 🎧 19] syncStatus 통과");

                    console.log(`[DEBUG 🎧 20] ${e} 여파로 checkAdminMenu 실행`);
                    await Boako.Auth.checkAdminMenu();
                    console.log(`[DEBUG 🎧 21] ${e} 여파로 checkLeaderMenu 실행`);
                    await Boako.Auth.checkLeaderMenu();

                    console.log(`[DEBUG 🎧 22] ${e} 렌더링 검토 구간 도달 (renderWidget)`);
                    Boako.Auth.renderWidget();
                    
                    // 핵심 의심 구간: 탭 복귀 시 화면을 강제 초기화 시켜버리는지 확인
                    console.log(`[DEBUG 🎧 23] ⚠️ 여기서 View.render('main')를 실행하지 않고 스킵합니다.`);
                    // Boako.View.render('main'); 
                    
                } else {
                    console.log("[DEBUG 🎧 24] 유저 없음 -> 로그아웃 처리");
                }
            } catch (err) {
                console.error("[DEBUG 💥 25] onAuthStateChange 내부 에러:", err);
            }
        });
    },

    login: () => Boako.db.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: window.location.origin + window.location.pathname } }),
    logout: async () => { await Boako.db.auth.signOut(); location.reload(); },
    editNick: async () => { /* 수정 기능 생략 (디버깅용) */ },
    renderWidget: () => { /* 기존 로직과 동일하므로 생략 (원본 유지해주세요) */ },

    checkAdminMenu: async function() {
        if (!Boako.state.user) return;
        try {
            console.log("[DEBUG 🛠️ A] checkAdminMenu -> profiles 쿼리 발사");
            const p = Boako.db.from('profiles').select('is_admin').eq('id', Boako.state.user.id).single();
            const { data: profile, error } = await Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("Admin profiles 쿼리 무한 펜딩")), 3000))]);
            if (error) throw error;

            if (profile && profile.is_admin) {
                console.log("[DEBUG 🛠️ B] checkAdminMenu -> pending 쿼리 발사");
                const c = Boako.db.from('view_pending_review_games').select('*', { count: 'exact', head: true });
                const { count, error: cErr } = await Promise.race([c, new Promise((_, r) => setTimeout(() => r(new Error("Admin pending 쿼리 무한 펜딩")), 3000))]);
                if (cErr) throw cErr;
                console.log("[DEBUG 🛠️ C] checkAdminMenu 완료");
            }
        } catch (err) { console.error("[DEBUG 💥 D] checkAdminMenu 에러:", err); }
    },

    checkLeaderMenu: async function() {
        if (!Boako.state.user || !Boako.state.team) return;
        try {
            const myTeamName = Boako.state.team.info.team_name;
            const isLeader = Boako.state.team.type === 'LEADER';
            if (!isLeader) return;

            console.log("[DEBUG 🛡️ A] checkLeaderMenu -> total_records 쿼리 발사");
            const r = Boako.db.from('v_boako_total_records').select('*', { count: 'exact', head: true }).neq('b_all_team', myTeamName).eq('is_verified', 1);
            const { count, error } = await Promise.race([r, new Promise((_, r) => setTimeout(() => r(new Error("Leader record 쿼리 무한 펜딩")), 3000))]);
            if (error) throw error;
            console.log("[DEBUG 🛡️ B] checkLeaderMenu 완료");
        } catch (err) { console.error("[DEBUG 💥 C] checkLeaderMenu 에러:", err); }
    }
};
