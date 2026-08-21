/**
 * [MOBILE TOURNAMENT] 모바일 전용 — 토너먼트(개최 공지/개최 요청) 화면
 * 🌟 [신규] PC js/tournament.js의 loadPosts()/renderCard()와 완전히 동일한 데이터 조회 로직
 *    (tournament_posts + games 로고/BGA URL 조인)을 그대로 재사용하되, 화면 마크업만 모바일
 *    전용으로 새로 작성. 카드 자체는 PC와 정보 구성이 거의 같아 그대로 세로 목록으로 옮김.
 * 🌟 [알려진 제한] PC의 "🗳️ 추천하기"(VOTE) 탭과 "+ 공지하기/요청하기" 작성 모달은 이번 1차
 *    포팅에서 제외 — 검색+투표 UI, 작성 폼 둘 다 별도로 공들여 만들어야 하는 화면이라 범위 밖.
 *    지금은 "📢 개최 공지" / "🙋 개최 요청" 두 목록 탭(읽기 전용)만 먼저 포팅.
 * 🌟 DEFAULT_LOGO_FALLBACK — PC tournament.js 맨 아래 전역 상수와 동일한 값을 그대로 복사해서 사용
 *    (그 파일 전체를 불러오면 무거운 PC 렌더 로직까지 같이 실행돼서, 값만 이 파일에 직접 둠).
 */
window.Boako = window.Boako || {};
Boako.MobileTournament = {

    DEFAULT_LOGO_FALLBACK: 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challenge%20(1).png',

    State: {
        currentTab: 'ANNOUNCEMENT', // 'ANNOUNCEMENT' | 'REQUEST'
        posts: [],
        gameLogoMap: {},
        gameBgaUrlMap: {},
        realtimeChannel: null
    },

    render: async (container) => {
        Boako.MobileTournament.State.currentTab = 'ANNOUNCEMENT'; // 재진입 시 항상 공지 탭부터 (PC와 동일 원칙)
        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
        await Boako.MobileTournament.loadPosts(container);
        Boako.MobileTournament.subscribeRealtime(container);
    },

    // 🌟 PC subscribeRealtime()과 동일 — 양쪽 탭 다 실시간 반영
    subscribeRealtime: (container) => {
        if (Boako.MobileTournament.State.realtimeChannel) return; // 중복 구독 방지
        Boako.MobileTournament.State.realtimeChannel = Boako.db
            .channel('mobile-tournament-posts-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_posts' }, () => {
                Boako.MobileTournament.loadPosts(container);
            })
            .subscribe();
    },

    // 🌟 PC loadPosts()와 완전히 동일한 조회 로직
    loadPosts: async (container) => {
        try {
            const nowIso = new Date().toISOString();
            const { data, error } = await Boako.db
                .from('tournament_posts')
                .select('*')
                .or(`scheduled_date.is.null,scheduled_date.gte.${nowIso}`)
                .order('scheduled_date', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false });
            if (error) throw error;
            Boako.MobileTournament.State.posts = data || [];

            const gameNames = [...new Set(Boako.MobileTournament.State.posts.map(p => p.game_name).filter(Boolean))];
            if (gameNames.length > 0) {
                const { data: gamesData } = await Boako.db.from('games').select('game_name, image_url, bga_url').in('game_name', gameNames);
                Boako.MobileTournament.State.gameLogoMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.image_url]));
                Boako.MobileTournament.State.gameBgaUrlMap = Object.fromEntries((gamesData || []).map(g => [g.game_name, g.bga_url]));
            } else {
                Boako.MobileTournament.State.gameLogoMap = {};
                Boako.MobileTournament.State.gameBgaUrlMap = {};
            }

            Boako.MobileTournament.draw(container);
        } catch (e) {
            console.error('모바일 토너먼트 로드 실패:', e);
            container.innerHTML = `<div style="padding:40px 16px; text-align:center; color:#ef4444; font-weight:700; font-size:13px;">불러오지 못했습니다.</div>`;
        }
    },

    switchTab: (tab, container) => {
        Boako.MobileTournament.State.currentTab = tab;
        Boako.MobileTournament.draw(container);
    },

    draw: (container) => {
        const { currentTab, posts } = Boako.MobileTournament.State;
        const requestOpenCount = posts.filter(p => p.type === 'REQUEST' && p.status === 'OPEN').length;
        const filtered = posts.filter(p => p.type === currentTab);

        const tabBtn = (tab, label) => {
            const isActive = currentTab === tab;
            return `
                <button onclick="Boako.MobileTournament.switchTab('${tab}', document.getElementById('mobile-content-area'))" style="flex:1; position:relative; padding:9px 0; border-radius:9px; font-size:12.5px; font-weight:900; background:${isActive ? '#1e293b' : '#f1f5f9'}; color:${isActive ? '#fff' : '#64748b'};">
                    ${label}
                    ${tab === 'REQUEST' && requestOpenCount > 0 ? `<span style="position:absolute; top:-5px; right:2px; background:#ef4444; color:#fff; font-size:10px; font-weight:900; min-width:16px; height:16px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; padding:0 3px;">${requestOpenCount}</span>` : ''}
                </button>
            `;
        };

        const listHtml = filtered.length === 0
            ? `<div style="padding:32px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px; border:1px dashed #e2e8f0; border-radius:12px; background:#fff;">${currentTab === 'ANNOUNCEMENT' ? '아직 개최 공지가 없습니다.' : '아직 개최 요청이 없습니다.'}</div>`
            : filtered.map(p => Boako.MobileTournament.renderCard(p)).join('');

        container.innerHTML = `
            <div style="display:flex; gap:6px; margin-bottom:12px;">
                ${tabBtn('ANNOUNCEMENT', '📢 개최 공지')}
                ${tabBtn('REQUEST', '🙋 개최 요청')}
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">${listHtml}</div>
        `;
    },

    // 🌟 PC renderCard()와 동일한 정보 구성, 세로 카드 레이아웃으로 재배치
    renderCard: (p) => {
        const dateStr = p.scheduled_date
            ? new Date(p.scheduled_date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '일정 미정';
        const gameLogo = Boako.MobileTournament.State.gameLogoMap[p.game_name] || Boako.MobileTournament.DEFAULT_LOGO_FALLBACK;

        if (p.type === 'ANNOUNCEMENT') {
            return `
                <div onclick="window.open('${p.source_url}', '_blank')" style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:14px; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${Boako.Util.cdn(gameLogo)}" style="width:44px; height:44px; border-radius:10px; object-fit:contain; background:#f8fafc; border:1px solid #f1f5f9; padding:4px; flex-shrink:0;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:14px; font-weight:900; color:#6d28d9;">📅 ${dateStr}</div>
                            <div style="font-size:11px; color:#94a3b8; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileTournament.escapeHtml(p.title)}</div>
                        </div>
                        <span style="font-size:11px; font-weight:900; color:#7c3aed; background:#f5f3ff; padding:3px 8px; border-radius:999px; flex-shrink:0;">🔗</span>
                    </div>
                    ${p.max_participants ? `<div style="font-size:11px; color:#94a3b8; font-weight:700; margin-top:8px;">👥 최대 ${p.max_participants}명</div>` : ''}
                </div>
            `;
        }

        // REQUEST 카드
        const isFulfilled = p.status === 'FULFILLED';
        const gameBgaUrl = Boako.MobileTournament.State.gameBgaUrlMap[p.game_name];
        return `
            <div style="background:#fff; border:1px solid ${isFulfilled ? '#e2e8f0' : '#fde68a'}; opacity:${isFulfilled ? '0.7' : '1'}; border-radius:14px; padding:14px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <img src="${Boako.Util.cdn(gameLogo)}" style="width:44px; height:44px; border-radius:10px; object-fit:contain; background:#f8fafc; border:1px solid #f1f5f9; padding:4px; flex-shrink:0;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:14px; font-weight:900; color:#b45309;">📅 ${dateStr}</div>
                        <div style="font-size:11px; color:#94a3b8; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileTournament.escapeHtml(p.title)}</div>
                    </div>
                    <span style="font-size:10.5px; font-weight:900; padding:3px 8px; border-radius:999px; flex-shrink:0; ${isFulfilled ? 'color:#94a3b8; background:#f1f5f9;' : 'color:#d97706; background:#fffbeb;'}">
                        ${isFulfilled ? '✅ 완료' : '🙋 대기'}
                    </span>
                </div>
                ${p.content ? `<div style="background:rgba(251,191,36,0.08); border:1px solid #fde68a; border-radius:10px; padding:10px; margin-bottom:10px;"><p style="font-size:12.5px; color:#334155; white-space:pre-wrap; line-height:1.55;">${Boako.MobileTournament.escapeHtml(p.content)}</p></div>` : ''}
                ${p.max_participants ? `<div style="font-size:11px; color:#94a3b8; font-weight:700;">👥 희망 인원 ${p.max_participants}명</div>` : ''}
                ${!isFulfilled
                    ? (gameBgaUrl
                        ? `<a href="${gameBgaUrl}" target="_blank" style="display:block; text-align:center; margin-top:10px; font-size:11.5px; font-weight:900; color:#d97706; background:#fffbeb; border-radius:10px; padding:9px;">🎮 이 게임 아레나 페이지 열기</a>`
                        : `<div style="text-align:center; margin-top:10px; font-size:10.5px; color:#94a3b8; font-weight:700;">🎯 아레나에서 개최 후 확장으로 등록 시 자동 매칭됩니다</div>`)
                    : `<a href="${p.source_url}" target="_blank" style="display:block; text-align:center; margin-top:10px; font-size:11.5px; font-weight:700; color:#7c3aed;">🔗 개설된 토너먼트 바로가기</a>`}
            </div>
        `;
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
