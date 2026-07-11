/**
 * [TICKER] 전광판 롤링 바 — 헤더 검색창 바로 아래에서 최근 소식을 좌측으로 끓임없이 흘려보내는 실시간 티커
 * 데이터 소스: news_feed_items (소식지와 동일한 테이블) — 최근 N시간 이내 항목 전체를 시간순으로 노출
 */
Boako.Ticker = {
    // 🌟 노출 시간 범위(시간 단위) — 필요하면 이 숫자만 바꾸면 됩니다
    WINDOW_HOURS: 48,
    // 안전장치용 상한 (최근 N시간 내 물량이 비정상적으로 많을 때 쿼리 폭주 방지)
    MAX_ITEMS: 50,

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

        const { data, error } = await Boako.db
            .from('news_feed_items')
            .select('*')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(Boako.Ticker.MAX_ITEMS);

        if (error) throw error;
        return data || [];
    },

    render: (items) => {
        const track = document.getElementById('boako-ticker-track');
        if (!track) return;

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

        // 이음새 없는 무한 루프를 위해 동일한 목록을 두 번 이어붙입니다.
        const chips = items.map(renderChip).join('');
        track.innerHTML = chips + chips;

        // 소식 개수에 비례해 재생시간을 맞춰서, 개수가 적어도 너무 빠르지 않고 많아도 너무 느리지 않게 조절
        const duration = Math.max(20, items.length * 5);
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
            .subscribe();
    }
};
