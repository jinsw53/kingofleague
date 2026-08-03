/**
 * [SCHEDULE] 아카이브 일정 관리 및 캘린더 전광판 (히트맵 + 다중 콘텐츠 통합)
 * 표시 대상: 라이벌전 / 대항전(본선+밴투표마감+엔트리마감) / 드루와챌린지 / 같이하자 / 토너먼트 / 리그시즌일정
 * 🌟 [버그수정] "🔔 톡캘린더"/"🔕 알림 취소" 버튼의 onclick이 실제 함수 위치(Boako.Schedule.View.* 안에 중첩됨)와
 *    다르게 Boako.Schedule.*로 호출하고 있어서 "not a function" 에러가 나던 문제 수정 (.View. 경로 추가).
 * 🌟 [신규] 토너먼트/시즌 알림을 취소한 뒤 다시 켤 방법이 없던 문제 수정 — 실제 등록 여부(hasActiveBroadcast)를
 *    조회해서 등록 상태면 "🔕 알림 취소", 취소된 상태면 "🔔 다시 받기" 버튼으로 자동 전환됨.
 * 🌟 [신규] 라이벌전 일정 카드에 "승자 예측 투표(응원)" UI 추가 — 매치 당사자 제외, 로그인 유저만,
 *    매치당 1표, 마감은 scheduled_time. 결과 확정 시(complete_rival_match) 적중/미적중 모두 포인트 지급.
 */
Boako.Schedule = {
    scheduleItems: [],
    currentDate: new Date(),
    selectedDateStr: null,

    TYPE_META: {
        RIVAL:     { color: '#ef4444', icon: '⚡', label: '라이벌전' },
        GRANDPRIX: { color: '#3b82f6', icon: '⚔️', label: '대항전' },
        CHALLENGE: { color: '#f97316', icon: '🔥', label: '드루와! 챌린지' },
        TOGETHER:  { color: '#0ea5e9', icon: '🤝', label: '같이하자' },
        TOURNAMENT:{ color: '#8b5cf6', icon: '🏅', label: '토너먼트' },
        SEASON:    { color: '#f59e0b', icon: '🏆', label: '리그 시즌 일정' }
    },

    fetchAllScheduleItems: async () => {
        const nowIso = new Date().toISOString();
        let items = [];

        // 1. 라이벌전 + 대항전(본선) — match_schedules
        try {
            const { data, error } = await Boako.db
                .from('match_schedules')
                .select('*')
                .order('scheduled_time', { ascending: true });
            if (error) throw error;

            (data || []).forEach(sch => {
                const parts = Array.isArray(sch.participants) ? sch.participants : [];
                const p1 = parts[0]?.player_name || parts[0]?.team_name || '알 수 없음';
                const p2 = parts[1]?.player_name || parts[1]?.team_name || '알 수 없음';
                // FRIENDLY 등 예상 외 값은 안전하게 RIVAL로 폴백 (실사용 안 하기로 함)
                const typeKey = sch.match_type === 'GRANDPRIX' ? 'GRANDPRIX' : 'RIVAL';

                items.push({
                    id: `match_${sch.schedule_id}`,
                    typeKey,
                    scheduled_time: sch.scheduled_time,
                    title: sch.game_name,
                    subtitle: `${p1} VS ${p2}`,
                    linkUrl: null,
                    // 🌟 [신규] 라이벌전 승자 예측 투표 UI를 붙이기 위해 실제 매치 id 보관
                    matchId: (typeKey === 'RIVAL' && sch.reference_id) ? sch.reference_id : null
                });
            });
        } catch (err) {
            console.error("매치 일정 로드 오류:", err);
        }

        // 2. 드루와! 챌린지 — challenges (확정된 일정만)
        try {
            const { data, error } = await Boako.db
                .from('challenges')
                .select('*')
                .not('confirmed_schedule', 'is', null);
            if (error) throw error;

            (data || []).forEach(c => {
                items.push({
                    id: `challenge_${c.id}`,
                    typeKey: 'CHALLENGE',
                    scheduled_time: c.confirmed_schedule,
                    title: c.game_name,
                    subtitle: `${c.attacker_team_name || '공격팀'} VS ${c.defender_team_name || '방어팀 미정'}`,
                    linkUrl: null
                });
            });
        } catch (err) {
            console.error("드루와 챌린지 일정 로드 오류:", err);
        }

        // 3. 같이하자 — 실제 확정(CONFIRMED)된 모임만
        try {
            const { data, error } = await Boako.db
                .from('together_posts')
                .select('*')
                .eq('status', 'CONFIRMED');
            if (error) throw error;

            (data || []).forEach(p => {
                items.push({
                    id: `together_${p.id}`,
                    typeKey: 'TOGETHER',
                    scheduled_time: p.scheduled_date,
                    title: p.title || `${p.game_name || '같이하자'} 모임`,
                    subtitle: `${p.game_name || '종목 미정'} · 참가 ${p.current_count}/${p.max_participants}명`,
                    linkUrl: null
                });
            });
        } catch (err) {
            console.error("같이하자 일정 로드 오류:", err);
        }

        // 4. 토너먼트 — 개최 공지(ANNOUNCEMENT)만
        try {
            const { data, error } = await Boako.db
                .from('tournament_posts')
                .select('*')
                .eq('type', 'ANNOUNCEMENT')
                .not('scheduled_date', 'is', null);
            if (error) throw error;

            (data || []).forEach(p => {
                items.push({
                    id: `tournament_${p.id}`,
                    typeKey: 'TOURNAMENT',
                    scheduled_time: p.scheduled_date,
                    title: p.title,
                    subtitle: p.game_name || '종목 미정',
                    linkUrl: p.source_url || null,
                    sourceType: 'TOURNAMENT',
                    sourceId: String(p.id)
                });
            });
        } catch (err) {
            console.error("토너먼트 일정 로드 오류:", err);
        }
        // 5. 리그 시즌 일정 — 시즌 시작일/종료일 + 밴투표 마감(시작+50일) + 엔트리 마감(시작+58일)
            try {
            const { data, error } = await Boako.db
                .from('seasons')
                .select('*');
            if (error) throw error;

            (data || []).forEach(season => {
                const startMs = new Date(season.start_date).getTime();
                const DAY = 24 * 60 * 60 * 1000;

                const banDeadline = new Date(startMs + 52 * DAY).toISOString();
                const entryDeadline = new Date(startMs + 59 * DAY).toISOString();

                items.push({
                    id: `season_start_${season.season_no}`,
                    typeKey: 'SEASON',
                    scheduled_time: season.start_date,
                    title: `시즌 ${season.season_no} 시작`,
                    subtitle: season.title || '',
                    linkUrl: null,
                    sourceType: 'SEASON_START',
                    sourceId: String(season.season_no)
                });

                const banStart = new Date(startMs + 45 * DAY).toISOString();
                if (banStart <= season.end_date) {
                    items.push({
                        id: `season_ban_start_${season.season_no}`,
                        typeKey: 'GRANDPRIX',
                        scheduled_time: banStart,
                        title: `시즌 ${season.season_no} 밴투표 시작`,
                        subtitle: season.title || '',
                        linkUrl: null,
                        sourceType: 'SEASON_BAN_START',
                        sourceId: String(season.season_no)
                    });
                }
                if (banDeadline <= season.end_date) {
                    items.push({
                        id: `season_ban_${season.season_no}`,
                        typeKey: 'GRANDPRIX',
                        scheduled_time: banDeadline,
                        title: `시즌 ${season.season_no} 밴투표 마감`,
                        subtitle: season.title || '',
                        linkUrl: null,
                        sourceType: 'SEASON_BAN_END',
                        sourceId: String(season.season_no)
                    });
                }
                if (entryDeadline <= season.end_date) {
                    items.push({
                        id: `season_entry_${season.season_no}`,
                        typeKey: 'GRANDPRIX',
                        scheduled_time: entryDeadline,
                        title: `시즌 ${season.season_no} 엔트리 마감`,
                        subtitle: season.title || '',
                        linkUrl: null,
                        sourceType: 'SEASON_ENTRY_END',
                        sourceId: String(season.season_no)
                    });
                }
                items.push({
                    id: `season_end_${season.season_no}`,
                    typeKey: 'SEASON',
                    scheduled_time: season.end_date,
                    title: `시즌 ${season.season_no} 종료`,
                    subtitle: season.title || '',
                    linkUrl: null,
                    sourceType: 'SEASON_END',
                    sourceId: String(season.season_no)
                });
            });
        } catch (err) {
            console.error("시즌 일정 로드 오류:", err);
        }

        items.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

        // 🌟 [신규] 토너먼트/시즌 항목에 대해, 현재 로그인 유저가 실제로 톡캘린더 등록이 돼있는지 조회
        // (취소 후에도 "🔕 알림 취소" 버튼만 계속 보이던 문제 수정용 — 실제 등록 상태를 반영해서 버튼 전환)
        if (Boako.state.user) {
            try {
                const { data: registered } = await Boako.db
                    .from('broadcast_kakao_events')
                    .select('source_type, source_id')
                    .eq('user_id', Boako.state.user.id);
                const registeredSet = new Set((registered || []).map(r => `${r.source_type}::${r.source_id}`));
                items.forEach(item => {
                    if (item.sourceType) {
                        item.hasActiveBroadcast = registeredSet.has(`${item.sourceType}::${item.sourceId}`);
                    }
                });
            } catch (err) {
                console.error("톡캘린더 등록 상태 조회 오류:", err);
            }
        }

        // 🌟 [신규] 라이벌전 "승자 예측 투표" UI에 필요한 정보 배치 조회
        // (매치 당사자 id/닉네임, 현재 로그인 유저의 기존 투표 여부, 매치 진행 상태)
        try {
            const nowMs = Date.now();
            const rivalItems = items.filter(it => it.typeKey === 'RIVAL' && it.matchId && new Date(it.scheduled_time).getTime() > nowMs);
            const matchIds = [...new Set(rivalItems.map(it => it.matchId))];

            if (matchIds.length > 0) {
                const { data: matches } = await Boako.db
                    .from('rival_matches')
                    .select('match_id, game_name, status, challenger_id, defender_id')
                    .in('match_id', matchIds);

                const matchMap = Object.fromEntries((matches || []).map(m => [m.match_id, m]));

                const playerIds = [...new Set((matches || []).flatMap(m => [m.challenger_id, m.defender_id]))];
                let nameMap = {};
                if (playerIds.length > 0) {
                    const { data: profiles } = await Boako.db.from('profiles').select('id, full_name').in('id', playerIds);
                    nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
                }

                let myVoteMap = {};
                if (Boako.state.user) {
                    const { data: myVotes } = await Boako.db
                        .from('rival_match_votes')
                        .select('match_id, predicted_winner_id')
                        .eq('voter_id', Boako.state.user.id)
                        .in('match_id', matchIds);
                    myVoteMap = Object.fromEntries((myVotes || []).map(v => [v.match_id, v.predicted_winner_id]));
                }

                rivalItems.forEach(it => {
                    const m = matchMap[it.matchId];
                    if (!m) return;
                    const isParticipant = Boako.state.user && (Boako.state.user.id === m.challenger_id || Boako.state.user.id === m.defender_id);
                    it.voteInfo = {
                        matchId: m.match_id,
                        status: m.status,
                        challengerId: m.challenger_id,
                        defenderId: m.defender_id,
                        challengerName: nameMap[m.challenger_id] || '선수1',
                        defenderName: nameMap[m.defender_id] || '선수2',
                        isParticipant,
                        myPick: myVoteMap[it.matchId] || null
                    };
                });
            }
        } catch (err) {
            console.error("라이벌전 투표 정보 로드 오류:", err);
        }

        return items;
    },

    formatDateStr: (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    View: {
        renderMain: async () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            if (!container) return;

            container.innerHTML = `<div style="text-align:center; padding:50px;">캘린더 불러오는 중... ⏳</div>`;

            Boako.Schedule.scheduleItems = await Boako.Schedule.fetchAllScheduleItems();

            const today = new Date();
            Boako.Schedule.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            Boako.Schedule.selectedDateStr = Boako.Schedule.formatDateStr(today);

            Boako.Schedule.View.renderUI();
        },

        renderItemCard: (item) => {
            const meta = Boako.Schedule.TYPE_META[item.typeKey] || { color: '#64748b', icon: '📌', label: '일정' };
            const dateObj = new Date(item.scheduled_time);
            const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });
            const typeBadge = `<span style="background:${meta.color}; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold; white-space:nowrap;">${meta.icon} ${meta.label}</span>`;
            const linkBtn = item.linkUrl ? `<a href="${item.linkUrl}" target="_blank" style="font-size:12px; font-weight:800; color:${meta.color}; text-decoration:underline; white-space:nowrap;">바로가기 🔗</a>` : '';
            const isFuture = new Date(item.scheduled_time).getTime() > Date.now();
            const kakaoBtn = isFuture ? `<button onclick='Boako.Schedule.View.addToKakaoCalendar(${JSON.stringify(item).replace(/'/g, "&#39;")})' style="font-size:11px; font-weight:800; color:#3c1e1e; background:#FEE500; padding:5px 10px; border-radius:8px; white-space:nowrap;">🔔 톡캘린더</button>` : '';
            const rejectBtn = (item.sourceType && isFuture) ? `<button onclick="Boako.Schedule.View.rejectBroadcastEvent('${item.sourceType}', '${item.sourceId}')" style="font-size:11px; font-weight:800; color:#64748b; background:#f1f5f9; padding:5px 10px; border-radius:8px; white-space:nowrap;">🔕 알림 취소</button>` : '';
            // 🌟 [신규] 취소한 뒤 다시 받고 싶을 때를 위한 버튼 (실제 등록 여부에 따라 rejectBtn과 전환됨)
            const rebroadcastBtn = (item.sourceType && isFuture) ? `<button onclick="Boako.Schedule.View.rebroadcastEvent('${item.sourceType}', '${item.sourceId}', this)" style="font-size:11px; font-weight:800; color:#3c1e1e; background:#FEE500; padding:5px 10px; border-radius:8px; white-space:nowrap;">🔔 다시 받기</button>` : '';
            const sourceBtn = item.hasActiveBroadcast ? rejectBtn : rebroadcastBtn;

            // 🌟 [신규] 라이벌전 승자 예측 투표(응원) 위젯 — 당사자/비로그인/투표종료 상태는 노출 안 함
            let voteWidget = '';
            if (item.voteInfo && item.voteInfo.status === 'UPCOMING' && Boako.state.user && !item.voteInfo.isParticipant) {
                const v = item.voteInfo;
                if (v.myPick) {
                    const pickedName = v.myPick === v.challengerId ? v.challengerName : v.defenderName;
                    voteWidget = `
                        <div style="margin-top:8px; font-size:12px; font-weight:800; color:#059669; background:#ecfdf5; border:1px solid #a7f3d0; padding:6px 10px; border-radius:8px; text-align:center;">
                            ✅ ${pickedName} 님 응원 완료! (결과 발표 시 참여 포인트 지급)
                        </div>
                    `;
                } else {
                    voteWidget = `
                        <div style="margin-top:8px; display:flex; gap:6px;">
                            <button onclick="Boako.Schedule.View.castRivalVote('${v.matchId}', '${v.challengerId}', this)" style="flex:1; font-size:12px; font-weight:800; color:#334155; background:#f1f5f9; border:1px solid #cbd5e1; padding:8px 6px; border-radius:8px; cursor:pointer;">📣 ${v.challengerName} 응원하기</button>
                            <button onclick="Boako.Schedule.View.castRivalVote('${v.matchId}', '${v.defenderId}', this)" style="flex:1; font-size:12px; font-weight:800; color:#334155; background:#f1f5f9; border:1px solid #cbd5e1; padding:8px 6px; border-radius:8px; cursor:pointer;">📣 ${v.defenderName} 응원하기</button>
                        </div>
                    `;
                }
            }

            return `
                <div style="display:flex; flex-direction:column; gap:4px; padding: 16px 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition:all 0.2s;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                        <div style="flex: 1; min-width:0;">
                            <div style="font-size:13px; color:#64748b; font-weight:800; margin-bottom:6px;">⏰ ${timeStr}</div>
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                ${typeBadge}
                                <span style="font-size:16px; font-weight:900; color:#0f172a;">${item.title}</span>
                            </div>
                        </div>
                        <div style="flex-shrink:0; text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                            ${item.subtitle ? `<span style="font-size:14px; font-weight:bold; color:#334155; background:#f1f5f9; padding:6px 14px; border-radius:8px;">${item.subtitle}</span>` : ''}
                            <div style="display:flex; gap:6px; align-items:center;">
                                ${item.sourceType ? sourceBtn : kakaoBtn}
                                ${linkBtn}
                            </div>
                        </div>
                    </div>
                    ${voteWidget}
                </div>
            `;
        },

        // 🌟 [신규] 라이벌전 승자 예측 투표 등록. 결과 확정 전까지는 포인트가 지급되지 않고,
        // 매치 완료 시(complete_rival_match) 적중/미적중 여부에 따라 자동으로 지급됨.
        castRivalVote: async (matchId, predictedWinnerId, btnEl) => {
            if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
            const wrap = btnEl?.closest('div');
            if (wrap) wrap.querySelectorAll('button').forEach(b => b.disabled = true);

            try {
                const { error } = await Boako.db.rpc('fn_cast_rival_vote', {
                    p_match_id: matchId,
                    p_predicted_winner_id: predictedWinnerId
                });
                if (error) throw error;

                if (window.sfx) window.sfx.click();
                Boako.Util.toast('📣 응원 참여 완료! 결과 발표 시 포인트가 지급됩니다.');
                Boako.Schedule.scheduleItems = await Boako.Schedule.fetchAllScheduleItems();
                Boako.Schedule.View.renderUI();
            } catch (err) {
                Boako.Util.toast('❌ ' + (err.message || '투표에 실패했습니다.'));
                if (wrap) wrap.querySelectorAll('button').forEach(b => b.disabled = false);
            }
        },

        addToKakaoCalendar: async (item) => {
            if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
            try {
                const startDate = new Date(item.scheduled_time);
                const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

                const { data: sessionData } = await Boako.db.auth.getSession();
                const token = sessionData?.session?.access_token;
                if (!token) { Boako.Util.toast('❌ 로그인 정보를 확인할 수 없습니다.'); return; }

                const res = await fetch('https://qrredwrxdnvqwdxzanba.supabase.co/functions/v1/kakao-calendar-add-event', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: `[BOAKO] ${item.title}`,
                        startAt: startDate.toISOString(),
                        endAt: endDate.toISOString(),
                        reminderMinutes: 60
                    })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || '등록 실패');

                if (window.sfx) window.sfx.success();
                Boako.Util.toast('🔔 톡캘린더에 등록되었습니다!');
            } catch (err) {
                console.error(err);
                Boako.Util.toast('❌ ' + (err.message || '톡캘린더 등록에 실패했습니다.'));
            }
        },

        rejectBroadcastEvent: async (sourceType, sourceId) => {
            if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
            if (!confirm('이 일정의 톡캘린더 알림을 취소하시겠어요?')) return;
            try {
                const { error } = await Boako.db.rpc('fn_cancel_broadcast_kakao_event', {
                    p_source_type: sourceType,
                    p_source_id: sourceId
                });
                if (error) throw error;
                Boako.Util.toast('🔕 알림이 취소되었습니다.');
                // 보던 월/날짜를 유지하기 위해 전체 재조회 대신 로컬 상태만 갱신
                Boako.Schedule.scheduleItems.forEach(it => {
                    if (it.sourceType === sourceType && it.sourceId === sourceId) it.hasActiveBroadcast = false;
                });
                Boako.Schedule.View.renderUI();
            } catch (err) {
                Boako.Util.toast('❌ ' + (err.message || '취소에 실패했습니다.'));
            }
        },

        // 🌟 [신규] 취소했던 토너먼트/시즌 톡캘린더 알림을 다시 받기
        rebroadcastEvent: async (sourceType, sourceId, btnEl) => {
            if (!Boako.state.user) { Boako.Util.toast('로그인 후 이용해주세요.'); return; }
            if (btnEl) { btnEl.disabled = true; btnEl.innerHTML += ' <div class="spinner"></div>'; }
            try {
                const { error } = await Boako.db.rpc('fn_rebroadcast_kakao_event', {
                    p_source_type: sourceType,
                    p_source_id: sourceId
                });
                if (error) throw error;
                Boako.Util.toast('🔔 톡캘린더에 다시 등록되었습니다!');
                Boako.Schedule.scheduleItems.forEach(it => {
                    if (it.sourceType === sourceType && it.sourceId === sourceId) it.hasActiveBroadcast = true;
                });
                Boako.Schedule.View.renderUI();
            } catch (err) {
                Boako.Util.toast('❌ ' + (err.message || '등록에 실패했습니다.'));
                if (btnEl) btnEl.disabled = false;
            }
        },

        renderUI: () => {
            const container = document.getElementById('main-content') || document.getElementById('app');

            const year = Boako.Schedule.currentDate.getFullYear();
            const month = Boako.Schedule.currentDate.getMonth();

            const firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();

            const todayStr = Boako.Schedule.formatDateStr(new Date());

            const scheduleMap = {};
            Boako.Schedule.scheduleItems.forEach(item => {
                const dStr = Boako.Schedule.formatDateStr(new Date(item.scheduled_time));
                if (!scheduleMap[dStr]) scheduleMap[dStr] = [];
                scheduleMap[dStr].push(item);
            });

            const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
            let calendarHtml = `
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center; font-weight:bold; color:#64748b; margin-bottom:8px; font-size:14px;">
                    ${daysOfWeek.map((day, idx) => `<div style="${idx === 0 ? 'color:#ef4444;' : idx === 6 ? 'color:#3b82f6;' : ''}">${day}</div>`).join('')}
                </div>
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;">
            `;

            for (let i = 0; i < firstDay; i++) {
                calendarHtml += `<div style="min-height:64px; padding:5px;"></div>`;
            }

            for (let i = 1; i <= lastDate; i++) {
                const cellDateStr = Boako.Schedule.formatDateStr(new Date(year, month, i));
                const dailyItems = scheduleMap[cellDateStr] || [];
                const count = dailyItems.length;

                const isToday = cellDateStr === todayStr;
                const isSelected = cellDateStr === Boako.Schedule.selectedDateStr;

                let bgStyle = 'background: white;';
                if (count > 0) {
                    const opacity = Math.min(count * 0.2, 0.55);
                    bgStyle = `background: rgba(100, 116, 139, ${opacity});`;
                } else if (isToday) {
                    bgStyle = `background: #f1f5f9;`;
                }

                const borderStyle = isSelected ? 'border:2px solid #3b82f6;' : 'border:1px solid #e2e8f0;';

                const uniqueTypeIcons = [...new Set(dailyItems.map(it => Boako.Schedule.TYPE_META[it.typeKey]?.icon || '📌'))].slice(0, 4);
                const iconsRow = uniqueTypeIcons.length > 0
                    ? `<div style="font-size:10px; line-height:1; margin-top:2px;">${uniqueTypeIcons.join(' ')}</div>`
                    : '';

                calendarHtml += `
                    <div onclick="Boako.Schedule.View.selectDate('${cellDateStr}')"
                         style="min-height:64px; padding:8px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center;
                                ${bgStyle} ${borderStyle} transition:all 0.2s;"
                         onmouseover="this.style.filter='brightness(0.95)'"
                         onmouseout="this.style.filter='brightness(1)'">
                        <span style="font-size:15px; font-weight:bold; color:#0f172a;">${i}</span>
                        ${iconsRow}
                        ${count > 0 ? `<span style="font-size:10px; font-weight:800; color:#475569; margin-top:1px;">${count}건</span>` : ''}
                    </div>
                `;
            }
            calendarHtml += `</div>`;

            const targetItems = scheduleMap[Boako.Schedule.selectedDateStr] || [];
            let listHtml = `
                <div style="margin-top:20px; border-top:2px dashed #e2e8f0; padding-top:20px;">
                    <h3 style="font-size:18px; font-weight:900; margin-bottom:15px; color:#0f172a; display:flex; align-items:center; gap:8px;">
                        🎯 ${Boako.Schedule.selectedDateStr.split('-')[1]}월 ${Boako.Schedule.selectedDateStr.split('-')[2]}일 예정 일정
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (targetItems.length === 0) {
                listHtml += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">이 날짜에 예정된 일정이 없습니다.</div>`;
            } else {
                targetItems.forEach(item => {
                    listHtml += Boako.Schedule.View.renderItemCard(item);
                });
            }
            listHtml += `</div></div>`;

            const legendHtml = `
                <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:14px; padding:12px 16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                    ${Object.entries(Boako.Schedule.TYPE_META).map(([key, meta]) => `
                        <div style="display:flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:#475569;">
                            <span style="width:10px; height:10px; border-radius:3px; background:${meta.color}; display:inline-block;"></span>
                            ${meta.icon} ${meta.label}
                        </div>
                    `).join('')}
                </div>
            `;

            let finalHtml = `
                <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📅 BOAKO 공식 캘린더</h2>
                        <button onclick="Boako.Schedule.View.showAllSchedules()" style="padding:8px 14px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; color:#334155;">📜 전체 리스트 보기</button>
                    </div>

                    <div class="section-card" style="margin-bottom:10px; padding:25px; background:white;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                            <button onclick="Boako.Schedule.View.changeMonth(-1)" style="border:none; background:#f8fafc; width:36px; height:36px; border-radius:50%; font-size:16px; cursor:pointer; color:#64748b; font-weight:bold; transition:all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">◀</button>
                            <h3 style="margin:0; font-size:20px; font-weight:900; color:#0f172a;">${year}년 ${month + 1}월</h3>
                            <button onclick="Boako.Schedule.View.changeMonth(1)" style="border:none; background:#f8fafc; width:36px; height:36px; border-radius:50%; font-size:16px; cursor:pointer; color:#64748b; font-weight:bold; transition:all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">▶</button>
                        </div>
                        ${calendarHtml}
                        ${legendHtml}
                    </div>

                    ${listHtml}
                </div>
            `;

            container.innerHTML = finalHtml;
        },

        changeMonth: (offset) => {
            const cur = Boako.Schedule.currentDate;
            Boako.Schedule.currentDate = new Date(cur.getFullYear(), cur.getMonth() + offset, 1);
            Boako.Schedule.selectedDateStr = Boako.Schedule.formatDateStr(Boako.Schedule.currentDate);
            Boako.Schedule.View.renderUI();
        },

        selectDate: (dateStr) => {
            Boako.Schedule.selectedDateStr = dateStr;
            Boako.Schedule.View.renderUI();
        },

        showAllSchedules: () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            let html = `
                <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📜 전체 예정 일정 리스트</h2>
                        <button onclick="Boako.Schedule.View.renderUI()" style="padding:8px 14px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; color:#334155;">◀ 달력으로 돌아가기</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (Boako.Schedule.scheduleItems.length === 0) {
                html += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">예정된 일정이 없습니다.</div>`;
            } else {
                Boako.Schedule.scheduleItems.forEach(item => {
                    html += Boako.Schedule.View.renderItemCard(item);
                });
            }
            html += `</div></div>`;
            container.innerHTML = html;
        }
    }
};
