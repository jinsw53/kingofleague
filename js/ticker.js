/**
 * [TICKER] 전광판 롤링 바 — 헤더 검색창 바로 아래(사이트 본문과 동일한 .inner 컴럼 안)에서
 * 최근 소식을 위로 끓임없이 흘려보내는 실시간 세로 티커
 * 데이터 소스: news_feed_items(소식지) + 실시간이슈와 동일한 라이브 소스 테이블(라이벌매치/토너먼트/같이하자/게시판) 을 합쳐서 노출
 */
Boako.Ticker = {
    // 🌟 노출 시간 범위(시간 단위) — 필요하면 이 숫자만 바꾸면 됩니다
    WINDOW_HOURS: 48,
    // 안전장치용 상한 (최근 N시간 내 물량이 비정상적으로 많을 때 쿼리 폭주 방지)
    MAX_ITEMS: 50,
    // 🌟 세로 티커 한 줄 높이(px) — CSS의 .ticker-item / .ticker-viewport height와 반드시 일치시킬 것
    ITEM_HEIGHT: 42,
    // 흐르는 속도 (초당 픽셀) — 소식 개수와 무관하게 항상 이 속도로 일정하게 흘름 (세로는 가로보다 느리게)
    PIXELS_PER_SECOND: 24,

    _channel: null,

    init: async () => {
        const bar = document.getElementById('boako-ticker-bar');
        if (!bar) return;

        try {
            const items = await Boako.Ticker.fetchItems();
            Boako.Ticker.render(items);
        } catch (err) {
            console.error('전광판 로드 실패:', err);
        }

        Boako.Ticker.subscribeRealtime();
    },

    fetchItems: async () => {
        const cutoff = new Date(Date.now() - Boako.Ticker.WINDOW_HOURS * 60 * 60 * 1000).toISOString();

        const [newsFeedItems, liveItems] = await Promise.all([
            Boako.Ticker.fetchNewsFeedItems(cutoff),
            Boako.Ticker.fetchLiveIssueItems(cutoff),
        ]);

        const merged = [...newsFeedItems, ...liveItems];
        merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return merged.slice(0, Boako.Ticker.MAX_ITEMS);
    },

    // 🌟 기존 소식지(news_feed_items) 원본 데이터
    fetchNewsFeedItems: async (cutoff) => {
        try {
            const { data, error } = await Boako.db
                .from('news_feed_items')
                .select('*')
                .gte('created_at', cutoff)
                .order('created_at', { ascending: false })
                .limit(Boako.Ticker.MAX_ITEMS);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('소식지 데이터 로드 실패:', err);
            return [];
        }
    },

    // 🌟 [신규] 실시간이슈(hot_issue.js)와 동일한 라이브 소스에서 직접 가져와 전광판 형식으로 변환
    fetchLiveIssueItems: async (cutoff) => {
        const items = [];

        // 1. 라이벌 매치 도전
        try {
            const { data: matches } = await Boako.db
                .from('rival_matches')
                .select('*')
                .gte('created_at', cutoff)
                .order('created_at', { ascending: false })
                .limit(10);

            if (matches && matches.length > 0) {
                const userIds = [...new Set(matches.flatMap(m => [m.challenger_id, m.defender_id]))];
                const { data: profiles } = await Boako.db.from('profiles').select('id, full_name').in('id', userIds);
                const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

                matches.forEach(m => {
                    items.push({
                        title: `${profileMap[m.challenger_id] || '누군가'}님이 ${profileMap[m.defender_id] || '누군가'}님에게 [${m.game_name}] 라이벌 도전장!`,
                        created_at: m.created_at,
                        link_type: 'RIVAL_MATCH',
                        link_id: m.id
                    });
                });
            }
        } catch (e) { console.error('전광판(라이벌) 로드 실패:', e); }

        // 2. 토너먼트 개최 공지
        try {
            const { data } = await Boako.db
                .from('tournament_posts')
                .select('*')
                .eq('type', 'ANNOUNCEMENT')
                .gte('created_at', cutoff)
                .order('created_at', { ascending: false })
                .limit(10);

            (data || []).forEach(p => {
                items.push({
                    title: `[${p.game_name || '종목미정'}] ${p.title} 토너먼트가 개최됐어요!`,
                    created_at: p.created_at,
                    link_type: 'TOURNAMENT',
                    link_id: p.id
                });
            });
        } catch (e) { console.error('전광판(토너먼트) 로드 실패:', e); }

        // 3. 같이하자 모임 확정
        try {
            const { data } = await Boako.db
                .from('together_posts')
                .select('*')
                .eq('status', 'CONFIRMED')
                .gte('created_at', cutoff)
                .order('created_at', { ascending: false })
                .limit(10);

            (data || []).forEach(p => {
                items.push({
                    title: `[${p.game_name || '종목미정'}] 같이하자 모임 확정! (${p.current_count}/${p.max_participants}명)`,
                    created_at: p.created_at,
                    link_type: 'TOGETHER_POST',
                    link_id: p.id
                });
            });
        } catch (e) { console.error('전광판(같이하자) 로드 실패:', e); }

        // 4. 게시판 — 새 질문 게시글
        try {
            const { data } = await Boako.db
                .from('board_posts')
                .select('*')
                .eq('category', '질문')
                .eq('is_deleted', false)
                .eq('is_draft', false)
                .gte('created_at', cutoff)
                .order('created_at', { ascending: false })
                .limit(10);

            (data || []).forEach(p => {
                items.push({
                    title: `[질문] ${p.title}`,
                    created_at: p.created_at,
                    link_type: 'BOARD_POST',
                    link_id: p.id
                });
            });
        } catch (e) { console.error('전광판(게시글) 로드 실패:', e); }

        return items;
    },

    render: (items) => {
        const track = document.getElementById('boako-ticker-track');
        const viewport = track ? track.parentElement : null;
        if (!track || !viewport) return;

        if (!items || items.length === 0) {
            track.style.animation = 'none';
            track.innerHTML = `<span class="ticker-item ticker-empty">📡 최근 ${Boako.Ticker.WINDOW_HOURS}시간 이내 새로운 소식이 없습니다.</span>`;
            return;
        }

        const renderChip = (item) => {
            const clickable = item.link_type
                ? `onclick="Boako.Util.navigateToLink('${item.link_type}', '${item.link_id}')"`
                : '';
            return `<span class="ticker-item" ${clickable}>${Boako.Ticker.icon(item)} ${Boako.Ticker.escapeHtml(item.title)}</span>`;
        };

        const oneSetHtml = items.map(renderChip).join('');

        // 🌟 세로 티커는 항목마다 높이가 고정(ITEM_HEIGHT)이라, 가로처럼 폭을 채우는 반복 로직이 필요 없습니다.
        // 이음매 없는 무한 루프를 위해 한 세트를 두 번 이어붙입니다.
        track.style.animation = 'none';
        track.innerHTML = oneSetHtml + oneSetHtml;

        const blockHeight = items.length * Boako.Ticker.ITEM_HEIGHT;

        // 🌟 소식 개수와 무관하게 항상 동일한 속도(px/s)로 흐르도록 재생시간을 높이에서 역산
        const duration = Math.max(6, blockHeight / Boako.Ticker.PIXELS_PER_SECOND);
        track.style.animation = `boako-ticker-scroll ${duration}s linear infinite`;
    },

    icon: (item) => {
        const map = {
            TEAM: '🛡️',
            TOURNAMENT: '🏅',
            TOGETHER_POST: '🤝',
            RIVAL_MATCH: '⚡',
            SEASON_RANKING: '🏆',
            CHALLENGE: '🔥',
            GRANDPRIX: '🔥',
            BOARD_POST: '📝'
        };
        return map[item.link_type] || '📰';
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    },

    subscribeRealtime: () => {
        if (Boako.Ticker._channel) return;
        Boako.Ticker._channel = Boako.db.channel('ticker-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_feed_items' }, () => Boako.Ticker.init())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rival_matches' }, () => Boako.Ticker.init())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_posts' }, () => Boako.Ticker.init())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, () => Boako.Ticker.init())
            .subscribe();
    }
};
