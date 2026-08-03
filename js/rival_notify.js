/**
 * [RIVAL VOTE NOTIFY] 라이벌전 승자 예측 투표 결과 실시간 알림
 * 🌟 achievements.js와 동일한 실시간 감지/큐 패턴이되, 화면 구성은 별도 설계:
 *    승자(크게, 프사+닉네임+WINNER 뱃지) — VS — 패자(작게, 프사+닉네임+LOSER 뱃지),
 *    그 아래 내 예측 결과(적중/미적중 + 받은 포인트), 하단 "확인" 버튼으로만 닫힘(배경 클릭 닫힘 없음).
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

    // 🌟 [전면 재설계] VS 구도 오버레이: 승자(크게)-VS-패자(작게), 각각 프사+닉네임+WINNER/LOSER 뱃지,
    // 가운데 아래에 내 예측 결과(적중/미적중 + 받은 포인트), 하단에 명시적 "확인" 버튼으로만 닫힘.
    showToast: (voteRow) => {
        return new Promise(async (resolve) => {
            let gameName = '라이벌전';
            let winner = null; // { name, avatar }
            let loser = null;  // { name, avatar }

            try {
                const { data: match } = await Boako.db
                    .from('rival_matches')
                    .select('game_name, challenger_id, defender_id, winner_id')
                    .eq('match_id', voteRow.match_id)
                    .maybeSingle();

                if (match) {
                    gameName = match.game_name || '라이벌전';
                    const loserId = match.winner_id === match.challenger_id ? match.defender_id : match.challenger_id;

                    const { data: profiles } = await Boako.db
                        .from('profiles')
                        .select('id, full_name, profile_url, custom_avatar_url')
                        .in('id', [match.challenger_id, match.defender_id]);

                    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
                    const buildPerson = (id) => {
                        const p = profileMap[id];
                        const avatar = p ? (p.custom_avatar_url || p.profile_url || null) : null;
                        return { name: p?.full_name || '선수', avatar: avatar ? avatar.replace('http://', 'https://') : null };
                    };

                    winner = buildPerson(match.winner_id);
                    loser = buildPerson(loserId);
                }
            } catch (e) {
                console.error('라이벌전 투표 결과 정보 조회 실패:', e);
            }

            const isCorrect = !!voteRow.is_correct;
            const rewardPoint = Number(voteRow.reward_point || 0);

            const avatarHtml = (person, size) => person?.avatar
                ? `<img src="${person.avatar}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; display:block;">`
                : `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:${Math.round(size*0.4)}px; font-weight:900;">${(person?.name || '?').charAt(0)}</div>`;

            const overlay = document.createElement('div');
            overlay.id = 'rival-vote-result-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                background:rgba(15,23,42,0.75); backdrop-filter:blur(3px);
                opacity:0; transition:opacity .25s ease;
            `;
            overlay.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:18px; text-align:center; padding:28px; max-width:440px;">
                    <div style="font-size:12px; font-weight:900; color:#94a3b8; letter-spacing:0.14em; text-transform:uppercase;">${gameName} · 라이벌전 결과</div>

                    <div style="display:flex; align-items:center; justify-content:center; gap:14px;">
                        <!-- 승자: 크게 -->
                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                            <div style="position:relative;">
                                <div style="border-radius:50%; padding:4px; background:linear-gradient(135deg,#fbbf24,#f59e0b); box-shadow:0 0 24px rgba(251,191,36,0.5);">
                                    ${avatarHtml(winner, 84)}
                                </div>
                            </div>
                            <div style="font-size:16px; font-weight:900; color:#fff;">${winner?.name || '승자'}</div>
                            <div style="font-size:10px; font-weight:900; letter-spacing:0.1em; color:#78350f; background:linear-gradient(135deg,#fde68a,#fbbf24); padding:3px 12px; border-radius:999px;">🏆 WINNER</div>
                        </div>

                        <div style="font-size:20px; font-weight:900; color:#64748b; font-style:italic; padding-bottom:24px;">VS</div>

                        <!-- 패자: 작게 -->
                        <div style="display:flex; flex-direction:column; align-items:center; gap:6px; opacity:0.75;">
                            <div style="border-radius:50%; padding:3px; background:#334155;">
                                ${avatarHtml(loser, 56)}
                            </div>
                            <div style="font-size:13px; font-weight:800; color:#cbd5e1;">${loser?.name || '패자'}</div>
                            <div style="font-size:9px; font-weight:900; letter-spacing:0.1em; color:#94a3b8; background:#1e293b; padding:2px 10px; border-radius:999px;">LOSER</div>
                        </div>
                    </div>

                    <div style="width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:16px;">
                        <div style="font-size:12px; font-weight:900; color:${isCorrect ? '#fbbf24' : '#c4b5fd'}; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;">
                            ${isCorrect ? '🎉 내 예측 적중!' : '🙌 응원 참여 완료'}
                        </div>
                        <div style="font-size:15px; font-weight:900; color:#fff; background:rgba(0,0,0,0.3); display:inline-block; padding:6px 18px; border-radius:999px;">
                            +${rewardPoint.toLocaleString()} P 획득
                        </div>
                    </div>

                    <button id="rival-vote-result-confirm-btn" style="width:100%; background:#fff; color:#0f172a; font-weight:900; font-size:14px; padding:12px; border-radius:12px; border:none; cursor:pointer; margin-top:4px;">
                        확인
                    </button>
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
            // 🌟 화면 아무데나 눌러서 닫히던 것 제거 — 명시적 "확인" 버튼으로만 닫힘
            document.getElementById('rival-vote-result-confirm-btn')?.addEventListener('click', dismiss);
        });
    }
};
