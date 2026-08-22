/**
 * [RECOMMEND NOTIFY] 오늘의 추천 게임 보너스 지급 실시간 알림
 * 🌟 achievements.js / rival_notify.js와 동일한 패턴: daily_recommend_bonus_claims의 bonus_point가
 *    0에서 실제 지급액으로 바뀌는 순간(=보너스 지급 확정)을 Realtime으로 감지해서,
 *    사이트 어느 화면에 있든 풀스크린 오버레이로 게임 로고 + 게임명 + 받은 포인트를 보여줌.
 *    포인트 지급 자체는 DB(fn_award_daily_recommend_bonus)가 원자적으로 처리하므로,
 *    이 모듈은 순수 "알림 표시"만 담당. 오프라인 중 지급된 것도 로그인 시점에 확인해서 놓치지 않음.
 * 🌟 [리팩토링] startRealtime()을 js/realtime_coordinator.js 탭 리더 선출 방식으로 전환.
 */
Boako.RecommendNotify = {
    channel: null,

    // 🌟 [리팩토링] 사이트를 여러 탭으로 띄워두면 탭마다 각자 이 채널을 구독해서 Realtime 동시연결
    // 한도를 탭 수만큼 잡아먹는 문제 방지 — js/realtime_coordinator.js의 탭 리더 선출 패턴 적용.
    // 채널 필터에 user_id가 들어가 있어(로그인 계정별) 로그아웃→재로그인(다른 계정) 시에도
    // 올바른 필터로 재구독돼야 하므로, _subscribeAsLeader()는 startRealtime() 호출마다 재진입 허용.
    // 🌟 UPDATE 이벤트의 payload.old/payload.new 비교(bonus_point가 이번에 새로 채워졌는지)는
    // 리더 탭의 원본 콜백에서만 가능하므로(팔로워는 old를 못 받음), 필터링을 리더 쪽에서 미리 끝내고
    // 통과한 payload.new만 중계/로컬반응 함수로 넘김.
    async _onAwarded(newRow) {
        try {
            Boako.RecommendNotify.enqueueOverlay(newRow);
            // 🌟 실시간으로 이미 보여줬으니, 다음 로그인 때 다시 안 뜨도록 즉시 확인 처리
            await Boako.RecommendNotify.markConfirmed([newRow.claim_date]);
        } catch (e) {
            console.error('오늘의 추천 게임 보너스 알림 표시 실패:', e);
        }
    },

    // 🌟 이 탭이 리더일 때만(그리고 아직 구독 안 했을 때만) 실제 채널 구독
    _subscribeAsLeader: () => {
        if (!Boako.RealtimeCoordinator.isLeader()) return;
        if (!Boako.state.user || !Boako.db) return;
        if (Boako.RecommendNotify.channel) return; // 이미 구독 중이면 중복 방지

        Boako.RecommendNotify.channel = Boako.db
            .channel(`recommend-bonus-${Boako.state.user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'daily_recommend_bonus_claims',
                filter: `user_id=eq.${Boako.state.user.id}`
            }, (payload) => {
                // bonus_point가 이번에 새로 채워진 경우만(=방금 지급 확정된 경우만) 알림. 0점 지급은 표시 안 함.
                if (!payload.new.bonus_point || payload.new.bonus_point <= 0) return;
                if (payload.old.bonus_point > 0) return;
                Boako.RecommendNotify._onAwarded(payload.new);
                Boako.RealtimeCoordinator.broadcast('recommend-notify:awarded', payload.new);
            })
            .subscribe();
    },

    startRealtime: () => {
        if (!Boako.state.user || !Boako.db) return;

        // 🌟 팔로워 탭(및 리더 자신 아닌 중계 경로)에서 받은 이벤트도 동일한 반응 함수로 처리 —
        // 여러 로그인 세션에 걸쳐 중복 등록되지 않도록 최초 1회만 등록
        if (!Boako.RecommendNotify._coordinatorInited) {
            Boako.RecommendNotify._coordinatorInited = true;
            Boako.RealtimeCoordinator.onRelay('recommend-notify:awarded', (p) => Boako.RecommendNotify._onAwarded(p));
            Boako.RealtimeCoordinator.onBecomeLeader(() => Boako.RecommendNotify._subscribeAsLeader());
        }
        // 🌟 이미 리더인 탭에서 로그인/재로그인(다른 계정) 시에도 새 필터로 즉시 재구독 시도
        Boako.RecommendNotify._subscribeAsLeader();
    },

    // 🌟 오프라인 중에 지급된(=접속 안 했을 때 기록을 남겨 보너스가 확정된) 건을 로그인 시점에 체크해서 놓치지 않고 보여줌.
    // profiles.tutorial_status.confirmed_recommend_dates (claim_date 문자열 배열)로 "이미 본 것" 추적 — 업적/투표 확인 로직과 동일 패턴.
    checkUnseenResults: async () => {
        if (!Boako.state.user || !Boako.db) return;
        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();
            const confirmedDates = new Set((profile?.tutorial_status?.confirmed_recommend_dates) || []);

            const { data: rows } = await Boako.db
                .from('daily_recommend_bonus_claims')
                .select('*')
                .eq('user_id', Boako.state.user.id)
                .gt('bonus_point', 0)
                .order('claimed_at', { ascending: true });

            const unseen = (rows || []).filter(r => !confirmedDates.has(r.claim_date));
            if (unseen.length === 0) return;

            unseen.forEach(row => Boako.RecommendNotify.enqueueOverlay(row));

            await Boako.RecommendNotify.markConfirmed(unseen.map(r => r.claim_date));
        } catch (e) {
            console.error('미확인 오늘의 추천 게임 보너스 체크 실패:', e);
        }
    },

    // 🌟 지급 건(claim_date 목록)을 "확인함"으로 profiles.tutorial_status에 기록
    markConfirmed: async (dates) => {
        if (!dates || dates.length === 0 || !Boako.state.user) return;
        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();
            let status = profile?.tutorial_status || {};
            const confirmedDates = new Set(status.confirmed_recommend_dates || []);
            dates.forEach(d => confirmedDates.add(d));
            status.confirmed_recommend_dates = [...confirmedDates];
            await Boako.db.from('profiles').update({ tutorial_status: status }).eq('id', Boako.state.user.id);
        } catch (e) {
            console.error('추천 게임 보너스 확인 상태 저장 실패:', e);
        }
    },

    stopRealtime: () => {
        if (Boako.RecommendNotify.channel && Boako.db) {
            Boako.db.removeChannel(Boako.RecommendNotify.channel);
            Boako.RecommendNotify.channel = null;
        }
    },

    // ========== 🌟 풀스크린 오버레이 큐 (여러 개 한꺼번에 뜨면 겹치지 않게 순서대로) ==========
    _overlayQueue: [],
    _overlayShowing: false,

    enqueueOverlay: (claimRow) => {
        Boako.RecommendNotify._overlayQueue.push(claimRow);
        Boako.RecommendNotify._processOverlayQueue();
    },

    _processOverlayQueue: async () => {
        if (Boako.RecommendNotify._overlayShowing) return;
        const next = Boako.RecommendNotify._overlayQueue.shift();
        if (!next) return;
        Boako.RecommendNotify._overlayShowing = true;
        await Boako.RecommendNotify.showToast(next);
        Boako.RecommendNotify._overlayShowing = false;
        Boako.RecommendNotify._processOverlayQueue();
    },

    // 🌟 게임 로고 + 게임명 + 받은 포인트를 보여주는 풀스크린 오버레이. 명시적 "확인" 버튼으로만 닫힘.
    showToast: (claimRow) => {
        return new Promise(async (resolve) => {
            let logoUrl = null;
            try {
                const { data: gameRow } = await Boako.db.from('games').select('image_url').eq('game_name', claimRow.game_name).maybeSingle();
                logoUrl = gameRow?.image_url ? Boako.Util.cdn(gameRow.image_url) : null;
            } catch (e) {
                console.error('추천 게임 로고 조회 실패:', e);
            }

            const overlay = document.createElement('div');
            overlay.id = 'recommend-bonus-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                background:rgba(15,23,42,0.75); backdrop-filter:blur(3px);
                opacity:0; transition:opacity .25s ease;
            `;
            overlay.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:380px;">
                    <div style="font-size:12px; font-weight:900; color:#fbbf24; letter-spacing:0.14em; text-transform:uppercase;">⭐ 오늘의 추천 게임 보너스</div>

                    <div style="width:96px; height:96px; border-radius:20px; background:#fff; display:flex; align-items:center; justify-content:center; padding:10px; box-shadow:0 0 24px rgba(251,191,36,0.35);">
                        ${logoUrl ? `<img src="${logoUrl}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span style="font-size:40px;">🎲</span>`}
                    </div>

                    <div style="font-size:19px; font-weight:900; color:#fff;">${Boako.RecommendNotify.escapeHtml(claimRow.game_name)}</div>
                    <p style="font-size:12px; font-weight:700; color:#cbd5e1; margin:-8px 0 0;">기록을 남겨주셔서 감사해요!</p>

                    <div style="font-size:16px; font-weight:900; color:#fff; background:rgba(0,0,0,0.3); padding:7px 20px; border-radius:999px;">
                        💎 +${Number(claimRow.bonus_point).toLocaleString()} P 획득
                    </div>

                    <button id="recommend-bonus-confirm-btn" style="width:100%; background:#fff; color:#0f172a; font-weight:900; font-size:14px; padding:12px; border-radius:12px; border:none; cursor:pointer; margin-top:4px;">
                        확인
                    </button>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => { overlay.style.opacity = '1'; });

            try { if (window.sfx && window.sfx.success) window.sfx.success(); } catch (e) { /* 자동재생 정책으로 인한 무음은 무시 */ }

            let dismissed = false;
            const dismiss = () => {
                if (dismissed) return;
                dismissed = true;
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.remove(); resolve(); }, 250);
            };
            document.getElementById('recommend-bonus-confirm-btn')?.addEventListener('click', dismiss);
        });
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
