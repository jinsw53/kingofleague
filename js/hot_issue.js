/**
 * [HOT ISSUE] 사이드바 실시간 이슈 — 라이벌 도전, 토너먼트 개최, 같이하자 모임 확정, 업적 달성,
 * 5연속 전적 기록("수배전단") 등 가벼운 즉발성 소식
 */
Boako.HotIssue = {
    init: async () => {
        const container = document.getElementById('hot-issue-list');
        if (!container) return;

        try {
            const items = await Boako.HotIssue.fetchItems();
            Boako.HotIssue.render(items);
        } catch (err) {
            console.error("실시간 이슈 로드 실패:", err);
        }

        Boako.HotIssue.startRealtime();
    },

    // 🌟 [리팩토링] 사이트를 여러 탭으로 띄워두면 탭마다 각자 채널을 구독해서 소켓이
    // 늘어나던 문제 방지 — realtime_coordinator.js 전역 탭 리더 선출 패턴 적용(achievements.js와 동일).
    _coordinatorInited: false,
    startRealtime: () => {
        if (!Boako.HotIssue._coordinatorInited) {
            Boako.HotIssue._coordinatorInited = true;
            Boako.RealtimeCoordinator.onRelay('hot-issue:refresh', () => Boako.HotIssue.init());
            Boako.RealtimeCoordinator.onBecomeLeader(() => Boako.HotIssue._subscribeAsLeader());
        }
        Boako.HotIssue._subscribeAsLeader();
    },

    fetchItems: async () => {
        let items = [];

        // 1. 라이벌 매치 도전 (최근 발행분)
        try {
            const { data: matches } = await Boako.db
                .from('rival_matches')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (matches && matches.length > 0) {
                const userIds = [...new Set(matches.flatMap(m => [m.challenger_id, m.defender_id]))];
                const { data: profiles } = await Boako.db.from('profiles').select('id, full_name').in('id', userIds);
                const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

                matches.forEach(m => {
                    items.push({
                        icon: '⚡',
                        text: `${profileMap[m.challenger_id] || '누군가'}님이 ${profileMap[m.defender_id] || '누군가'}님에게 [${m.game_name}] 라이벌 도전장!`,
                        time: m.created_at,
                        linkType: 'RIVAL_MATCH',
                        linkId: m.id
                    });
                });
            }
        } catch (e) { console.error("라이벌 이슈 로드 실패:", e); }

        // 2. 토너먼트 개최 공지
        try {
            const { data } = await Boako.db
                .from('tournament_posts')
                .select('*')
                .eq('type', 'ANNOUNCEMENT')
                .order('created_at', { ascending: false })
                .limit(5);

            (data || []).forEach(p => {
                items.push({
                    icon: '🏅',
                    text: `[${p.game_name || '종목미정'}] ${p.title} 토너먼트가 개최됐어요!`,
                    time: p.created_at,
                    linkType: 'TOURNAMENT',
                    linkId: p.id
                });
            });
        } catch (e) { console.error("토너먼트 이슈 로드 실패:", e); }

        // 3. 같이하자 모임 확정
        try {
            const { data } = await Boako.db
                .from('together_posts')
                .select('*')
                .eq('status', 'CONFIRMED')
                .order('created_at', { ascending: false })
                .limit(5);

            (data || []).forEach(p => {
                items.push({
                    icon: '🤝',
                    text: `[${p.game_name || '종목미정'}] 같이하자 모임 확정! (${p.current_count}/${p.max_participants}명)`,
                    time: p.created_at,
                    linkType: 'TOGETHER_POST',
                    linkId: p.id
                });
            });
        } catch (e) { console.error("같이하자 이슈 로드 실패:", e); }

        // 4. 게시판 — 새 질문 게시글
        try {
            const { data } = await Boako.db
                .from('board_posts')
                .select('*')
                .eq('category', '질문')
                .eq('is_deleted', false)
                .eq('is_draft', false)
                .order('created_at', { ascending: false })
                .limit(5);

            (data || []).forEach(p => {
                items.push({
                    icon: '❓',
                    text: `[질문] ${p.title}`,
                    time: p.created_at,
                    linkType: 'BOARD_POST',
                    linkId: p.id
                });
            });
        } catch (e) { console.error("질문 게시글 이슈 로드 실패:", e); }

        // 5. 업적 달성 (최근 획득분)
        //    🌟 OO매니아류는 achievements.name에 'OO' 플레이스홀더가 그대로 들어있어서,
        //    meta.game_name으로 치환해줘야 함 (소식지 트리거와 동일한 규칙)
        //    🌟 [수정] 클릭 이동 위치 확정 — 전적기록실로 이동 (소식지 트리거와 동일하게 ARCHIVE 사용).
        try {
            const { data: uas } = await Boako.db
                .from('user_achievements')
                .select('id, user_id, achieved_at, meta, achievements(name)')
                .order('achieved_at', { ascending: false })
                .limit(5);

            if (uas && uas.length > 0) {
                const userIds = [...new Set(uas.map(u => u.user_id))];
                const { data: profiles } = await Boako.db.from('profiles').select('id, full_name').in('id', userIds);
                const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

                uas.forEach(u => {
                    let achievementName = u.achievements?.name || '업적';
                    const gameName = u.meta?.game_name;
                    if (achievementName.includes('OO') && gameName) {
                        achievementName = achievementName.replace('OO', gameName + ' ');
                    }
                    items.push({
                        icon: '🏅',
                        text: `${profileMap[u.user_id] || '누군가'}님이 ${achievementName} 업적 달성!`,
                        time: u.achieved_at,
                        linkType: 'ARCHIVE',
                        linkId: null
                    });
                });
            }
        } catch (e) { console.error("업적 이슈 로드 실패:", e); }

        // 6. 🌟 [신규] 5연속 전적 기록 ("수배전단") — 전용 테이블이 없고 소식지(news_feed_items)를
        //    소스로 재사용. event_type='RECORD_STREAK'인 것만 필터링.
        try {
            const { data: streaks } = await Boako.db
                .from('news_feed_items')
                .select('*')
                .eq('event_type', 'RECORD_STREAK')
                .order('created_at', { ascending: false })
                .limit(5);

            (streaks || []).forEach(s => {
                items.push({
                    icon: '🤠',
                    text: s.title,
                    time: s.created_at,
                    linkType: s.link_type,
                    linkId: s.link_id
                });
            });
        } catch (e) { console.error("연속기록 이슈 로드 실패:", e); }

        items.sort((a, b) => new Date(b.time) - new Date(a.time));
        return items.slice(0, 5);
    },

    render: (items) => {
        const container = document.getElementById('hot-issue-list');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `<li style="color:#94a3b8; font-weight:600; font-size:13px; list-style:none;">아직 소식이 없습니다.</li>`;
            return;
        }

        const nowMs = Date.now();
        container.innerHTML = items.map(item => {
            const isNew = (nowMs - new Date(item.time).getTime()) < 24 * 60 * 60 * 1000;
            const clickable = item.linkType ? `onclick="Boako.Util.navigateToLink('${item.linkType}', '${item.linkId}')" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; list-style:none; cursor:pointer;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color=''"` : `style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; list-style:none;"`;
            return `
                <li ${clickable}>
                    <span style="white-space:normal; word-break:keep-all; line-height:1.4;">${item.icon} ${item.text}</span>
                    ${isNew ? `<span style="flex-shrink:0; color:var(--primary); font-size:12px; font-weight:900; margin-top:2px;">NEW</span>` : ''}
                </li>
            `;
        }).join('');
    },

    // 🌟 이 탭이 리더일 때만(그리고 아직 구독 안 했을 때만) 실제 채널 구독
    _subscribeAsLeader: () => {
        if (!Boako.RealtimeCoordinator.isLeader()) return;
        if (Boako.HotIssue._channel) return;
        Boako.HotIssue._channel = Boako.db.channel('hot-issue-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rival_matches' }, () => Boako.HotIssue._onRemoteChange())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_posts' }, () => Boako.HotIssue._onRemoteChange())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, () => Boako.HotIssue._onRemoteChange())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_achievements' }, () => Boako.HotIssue._onRemoteChange())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_feed_items' }, () => Boako.HotIssue._onRemoteChange())
            .subscribe();
    },

    // 🌟 리더가 실제 이벤트를 받으면 로컬 갱신 + 팔로워 탭에 중계
    _onRemoteChange: () => {
        Boako.HotIssue.init();
        Boako.RealtimeCoordinator.broadcast('hot-issue:refresh', null);
    }
};
