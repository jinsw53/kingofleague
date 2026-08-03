/**
 * [RIVAL VOTE NOTIFY] 라이벌전 승자 예측 투표 결과 실시간 알림
 * 🌟 achievements.js와 완전히 동일한 패턴: rival_match_votes의 resolved_at이 채워지는 순간(결과 확정)을
 *    Realtime으로 감지해서, 사이트 어느 화면에 있든 풀스크린 오버레이로 적중/미적중 + 받은 포인트를 보여줌.
 *    포인트 지급 자체는 DB(complete_rival_match)가 원자적으로 처리하므로, 이 모듈은 순수 "알림 표시"만 담당.
 *    여러 개가 한꺼번에 뜰 수 있어서(오프라인 중 결과가 나온 경우 등) 큐로 순서대로 하나씩 보여줌.
 */
Boako.RivalNotify = {
    channel: null,

    startRealtime: () => {
        if (!Boako.state.user || !Boako.db) return;
        if (Boako.RivalNotify.channel) return; // 이미 구독 중이면 중복 방지

        Boako.RivalNotify.channel = Boako.db
            .channel(`rival-vote-result-${Boako.state.user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rival_match_votes',
                filter: `voter_id=eq.${Boako.state.user.id}`
            }, async (payload) => {
                try {
                    // resolved_at이 이번에 새로 채워진 경우만(=방금 결과가 확정된 경우만) 알림
                    if (!payload.new.resolved_at || payload.old.resolved_at) return;

                    Boako.RivalNotify.enqueueOverlay(payload.new);
                    // 🌟 실시간으로 이미 보여줬으니, 다음 로그인 때 다시 안 뜨도록 즉시 확인 처리
                    await Boako.RivalNotify.markConfirmed([payload.new.id]);
                } catch (e) {
                    console.error('라이벌전 투표 결과 알림 표시 실패:', e);
                }
            })
            .subscribe();
    },

    // 🌟 오프라인 중에 결과가 확정된 투표(=접속 안 했을 때 매치가 완료된 것)를 로그인 시점에 체크해서 놓치지 않고 보여줌.
    // profiles.tutorial_status.confirmed_vote_ids (rival_match_votes.id 배열)로 "이미 본 것" 추적 — 업적 확인 로직과 동일 패턴.
    checkUnseenResults: async () => {
        if (!Boako.state.user || !Boako.db) return;
        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();
            const confirmedIds = new Set((profile?.tutorial_status?.confirmed_vote_ids) || []);

            const { data: rows } = await Boako.db
                .from('rival_match_votes')
                .select('*')
                .eq('voter_id', Boako.state.user.id)
                .not('resolved_at', 'is', null)
                .order('resolved_at', { ascending: true });

            const unseen = (rows || []).filter(r => !confirmedIds.has(r.id));
            if (unseen.length === 0) return;

            // 🌟 풀스크린 오버레이는 겹치면 안 되니, 한 번에 다 넣어도 큐가 순서대로 하나씩 보여줌
            unseen.forEach(row => Boako.RivalNotify.enqueueOverlay(row));

            await Boako.RivalNotify.markConfirmed(unseen.map(r => r.id));
        } catch (e) {
            console.error('미확인 라이벌전 투표 결과 체크 실패:', e);
        }
    },

    // 🌟 투표(rival_match_votes.id 목록)를 "확인함"으로 profiles.tutorial_status에 기록
    markConfirmed: async (ids) => {
        if (!ids || ids.length === 0 || !Boako.state.user) return;
        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();
            let status = profile?.tutorial_status || {};
            const confirmedIds = new Set(status.confirmed_vote_ids || []);
            ids.forEach(id => confirmedIds.add(id));
            status.confirmed_vote_ids = [...confirmedIds];
            await Boako.db.from('profiles').update({ tutorial_status: status }).eq('id', Boako.state.user.id);
        } catch (e) {
            console.error('투표 결과 확인 상태 저장 실패:', e);
        }
    },

    stopRealtime: () => {
        if (Boako.RivalNotify.channel && Boako.db) {
            Boako.db.removeChannel(Boako.RivalNotify.channel);
            Boako.RivalNotify.channel = null;
        }
    },

    // ========== 🌟 풀스크린 오버레이 큐 (여러 개 한꺼번에 뜨면 겹치지 않게 순서대로) ==========
    _overlayQueue: [],
    _overlayShowing: false,

    enqueueOverlay: (voteRow) => {
        Boako.RivalNotify._overlayQueue.push(voteRow);
        Boako.RivalNotify._processOverlayQueue();
    },

    _processOverlayQueue: async () => {
        if (Boako.RivalNotify._overlayShowing) return;
        const next = Boako.RivalNotify._overlayQueue.shift();
        if (!next) return;
        Boako.RivalNotify._overlayShowing = true;
        await Boako.RivalNotify.showToast(next);
        Boako.RivalNotify._overlayShowing = false;
        Boako.RivalNotify._processOverlayQueue();
    },

    // 🌟 업적 알림(achievements.js showToast)과 같은 톤의 풀스크린 오버레이.
    // 클릭해야만 닫힘(자동 닫힘 없음). Promise를 반환해서 큐가 "닫힌 뒤에" 다음 걸 보여줄 수 있게 함.
    showToast: (voteRow) => {
        return new Promise(async (resolve) => {
            let gameName = null;
            let pickedName = '내가 고른 선수';
            try {
                const { data: match } = await Boako.db
                    .from('rival_matches')
                    .select('game_name, challenger_id, defender_id')
                    .eq('match_id', voteRow.match_id)
                    .maybeSingle();
                if (match) {
                    gameName = match.game_name;
                    const { data: profile } = await Boako.db
                        .from('profiles')
                        .select('full_name')
                        .eq('id', voteRow.predicted_winner_id)
                        .maybeSingle();
                    if (profile?.full_name) pickedName = profile.full_name;
                }
            } catch (e) {
                console.error('라이벌전 투표 결과 정보 조회 실패:', e);
            }

            const isCorrect = !!voteRow.is_correct;
            const rewardPoint = Number(voteRow.reward_point || 0);

            const overlay = document.createElement('div');
            overlay.id = 'rival-vote-result-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                background:rgba(15,23,42,0.6); backdrop-filter:blur(3px); cursor:pointer;
                opacity:0; transition:opacity .25s ease;
            `;
            overlay.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; padding:20px; max-width:420px;">
                    <div style="font-size:80px; line-height:1;">${isCorrect ? '🎉' : '🙌'}</div>
                    <div style="font-size:13px; font-weight:900; color:${isCorrect ? '#fca5a5' : '#c4b5fd'}; letter-spacing:0.12em; text-transform:uppercase;">
                        ${isCorrect ? '승자 예측 적중!' : '응원 참여 완료!'}
                    </div>
                    <div style="font-size:24px; font-weight:900; color:#fff; text-shadow:0 4px 14px rgba(0,0,0,0.45); line-height:1.35;">
                        ${gameName ? gameName : '라이벌전'}${gameName ? `<br><span style="font-size:15px; color:#cbd5e1; font-weight:700;">${pickedName} 응원 결과</span>` : ''}
                    </div>
                    <div style="font-size:16px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,0.3); padding:7px 20px; border-radius:999px;">
                        +${rewardPoint.toLocaleString()} P 획득
                    </div>
                    <div style="font-size:11px; font-weight:700; color:rgba(255,255,255,0.6); margin-top:6px;">화면을 탭하면 닫혀요</div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => { overlay.style.opacity = '1'; });

            try {
                if (window.sfx) {
                    if (isCorrect && window.sfx.success) window.sfx.success();
                    else if (window.sfx.click) window.sfx.click();
                }
            } catch (e) { /* 자동재생 정책으로 인한 무음은 무시 */ }

            let dismissed = false;
            const dismiss = () => {
                if (dismissed) return;
                dismissed = true;
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.remove(); resolve(); }, 250);
            };
            overlay.addEventListener('click', dismiss);
        });
    }
};
