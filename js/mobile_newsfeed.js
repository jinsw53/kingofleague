/**
 * [MOBILE NEWSFEED] 모바일 전용 — 소식지(뉴스피드) 화면
 * 🌟 [신규] PC js/newsfeed.js와 동일한 데이터(news_feed_items 조회 + 오늘의 추천 게임)를 그대로
 *    재사용하되, PC의 신문 1면형 그리드(헤드라인/사이드/필러패딩)는 세로 1단 피드로 완전히 새로 작성.
 *    세로 1단이라 PC처럼 "4칸 그리드를 필러로 채워야 하는" 복잡함 자체가 없어져서 필러풀 로직은
 *    아예 안 가져옴 — 실제 소식만 점수 내림차순으로 쌓으면 끝.
 * 🌟 점수/등급 계산(computeScore/getTier)은 PC newsfeed.js의 공식과 완전히 동일하게 이 파일에도
 *    그대로 옮겨 적었음(값 자체가 아주 짧은 순수 계산이라, 무거운 PC newsfeed.js 전체를
 *    불러오는 대신 이 파일 안에 직접 둠 — 로드 비용 절약). 공식 자체가 바뀌면 두 곳 다 고쳐야 함.
 * 🌟 [알려진 제한] 카드 클릭 시 이동은 아직 안 붙임 — PC의 Boako.Util.navigateToLink()는
 *    Boako.View.render()라는 PC 전용 화면 전환 시스템을 불러서 모바일에서 그대로 쓰면 에러남.
 *    게시판/토너먼트/팀 등 목적지 화면들을 모바일로 포팅한 뒤에 이어서 연결할 예정.
 */
window.Boako = window.Boako || {};
Boako.MobileNewsfeed = {

    items: [],
    todayRecommendGame: null,

    render: async (container) => {
        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">소식을 불러오는 중...</div>`;
        try {
            const [feedResult, recommendResult] = await Promise.all([
                Boako.db.from('news_feed_items').select('*').order('created_at', { ascending: false }).limit(80),
                Boako.db.rpc('fn_get_today_recommended_game'),
            ]);
            if (feedResult.error) throw feedResult.error;
            Boako.MobileNewsfeed.items = feedResult.data || [];

            Boako.MobileNewsfeed.todayRecommendGame = null;
            const recommendGameName = recommendResult?.data || null;
            if (recommendGameName) {
                try {
                    const { data: gameRow } = await Boako.db.from('games').select('image_url').eq('game_name', recommendGameName).maybeSingle();
                    Boako.MobileNewsfeed.todayRecommendGame = { name: recommendGameName, image: gameRow?.image_url || null };
                } catch (e) {
                    console.error('오늘의 추천 게임 로고 조회 실패:', e);
                    Boako.MobileNewsfeed.todayRecommendGame = { name: recommendGameName, image: null };
                }
            }

            Boako.MobileNewsfeed.draw(container);
        } catch (e) {
            console.error('모바일 소식지 로드 실패:', e);
            container.innerHTML = `<div style="padding:40px 16px; text-align:center; color:#ef4444; font-weight:700; font-size:13px;">소식을 불러오지 못했습니다.</div>`;
        }
    },

    // 🌟 PC newsfeed.js computeScore/getTier와 완전히 동일한 공식 (중요도 × 시간감쇠, 반감기 = 중요도 × 24시간)
    computeScore: (item) => {
        const hoursElapsed = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        const halfLifeHours = item.importance * 24;
        const freshness = Math.pow(0.5, hoursElapsed / halfLifeHours);
        return item.importance * freshness;
    },
    getTier: (score) => {
        if (score >= 5) return 'headline';
        if (score >= 3) return 'large';
        if (score >= 2) return 'medium';
        if (score >= 1) return 'small';
        return null;
    },

    draw: (container) => {
        let scored = Boako.MobileNewsfeed.items.map(item => ({ ...item, _score: Boako.MobileNewsfeed.computeScore(item) }));
        scored.forEach(item => { item._tier = Boako.MobileNewsfeed.getTier(item._score); });
        scored = scored.filter(item => item._tier !== null); // 1점 미만(신선도 다 떨어진 소식)은 완전히 숨김
        scored.sort((a, b) => b._score - a._score);

        const recommendHtml = Boako.MobileNewsfeed.todayRecommendGame ? Boako.MobileNewsfeed.renderRecommendCard() : '';

        if (scored.length === 0 && !Boako.MobileNewsfeed.todayRecommendGame) {
            container.innerHTML = `<div style="padding:40px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">아직 표시할 소식이 없습니다.</div>`;
            return;
        }

        const cardsHtml = scored.map(item => Boako.MobileNewsfeed.renderCard(item)).join('');
        container.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px;">${recommendHtml}${cardsHtml}</div>`;
    },

    renderRecommendCard: () => {
        const game = Boako.MobileNewsfeed.todayRecommendGame;
        const img = game.image ? Boako.Util.cdn(game.image) : null;
        return `
            <div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:14px; padding:14px; display:flex; align-items:center; gap:12px;">
                <div style="width:56px; height:56px; border-radius:10px; background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
                    ${img ? `<img src="${img}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span style="font-size:26px;">🎲</span>`}
                </div>
                <div style="min-width:0;">
                    <div style="font-size:10.5px; font-weight:900; color:#b45309;">⭐ 오늘의 추천 게임</div>
                    <div style="font-size:14px; font-weight:900; color:#1e293b; margin-top:2px;">${Boako.MobileNewsfeed.escapeHtml(game.name)}</div>
                    <div style="font-size:10.5px; font-weight:700; color:#d97706; margin-top:2px;">기록 시 💎포인트 지급! (오늘까지)</div>
                </div>
            </div>
        `;
    },

    renderCard: (item) => {
        const img = item.thumbnail_url ? Boako.Util.cdn(item.thumbnail_url) : null;
        const isHeadline = item._tier === 'headline';
        return `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
                ${img
                    ? `<div style="width:100%; aspect-ratio:${isHeadline ? '16/9' : '2/1'}; overflow:hidden;"><img src="${img}" style="width:100%; height:100%; object-fit:cover;"></div>`
                    : ''}
                <div style="padding:12px 14px;">
                    ${isHeadline ? `<div style="font-size:9.5px; font-weight:900; color:#f43f5e; letter-spacing:0.08em; margin-bottom:4px;">HEADLINE</div>` : ''}
                    <div style="font-size:${isHeadline ? '15px' : '13.5px'}; font-weight:900; color:#1e293b; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.title)}</div>
                    ${item.subtitle ? `<div style="font-size:11.5px; font-weight:700; color:#94a3b8; margin-top:3px; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.subtitle)}</div>` : ''}
                </div>
            </div>
        `;
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
