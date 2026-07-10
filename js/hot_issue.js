/**
 * [HOT ISSUE] 사이드바 실시간 이슈 — 라이벌 도전, 토너먼트 개최, 같이하자 모임 확정 등 가벼운 즉발성 소식
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

        Boako.HotIssue.subscribeRealtime();
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
                        time: m.created_at
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
                    time: p.created_at
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
                    time: p.created_at
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
                    time: p.created_at
                });
            });
        } catch (e) { console.error("질문 게시글 이슈 로드 실패:", e); }

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
            return `
                <li style="display:flex; justify-content:space-between; align-items:center; gap:8px; list-style:none;">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.icon} ${item.text}</span>
                    ${isNew ? `<span style="flex-shrink:0; color:var(--primary); font-size:12px; font-weight:900;">NEW</span>` : ''}
                </li>
            `;
        }).join('');
    },

    subscribeRealtime: () => {
        if (Boako.HotIssue._channel) return;
        Boako.HotIssue._channel = Boako.db.channel('hot-issue-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rival_matches' }, () => Boako.HotIssue.init())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_posts' }, () => Boako.HotIssue.init())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, () => Boako.HotIssue.init())
            .subscribe();
    }
};
