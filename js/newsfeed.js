/**
 * [NEWSFEED] 소식지 — 중요도 × 신선도로 신문 1면처럼 배치되는 뉴스피드
 */
Boako.NewsFeed = {
    items: [],

    init: async (containerId) => {
        Boako.NewsFeed.rootId = containerId;
        const root = document.getElementById(containerId);
        if (!root) return;

        root.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">소식을 불러오는 중...</div>`;

        const { data, error } = await Boako.db
            .from('news_feed_items')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(80);

        if (error) {
            console.error('소식지 로드 실패:', error);
            root.innerHTML = `<div class="text-center py-20 text-rose-400 font-bold">소식을 불러오지 못했습니다.</div>`;
            return;
        }

        Boako.NewsFeed.items = data || [];
        Boako.NewsFeed.render();
    },

    // 중요도 × 시간감쇠(반감기 = 중요도 × 24시간)로 점수 계산
    computeScore: (item) => {
        const hoursElapsed = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        const halfLifeHours = item.importance * 24;
        const freshness = Math.pow(0.5, hoursElapsed / halfLifeHours);
        return item.importance * freshness;
    },

    getTier: (score) => {
        if (score >= 7) return 'headline';
        if (score >= 4) return 'large';
        if (score >= 2) return 'medium';
        return 'small';
    },

    // 헤드라인의 좌/우 배치를 정하는 함수 — 랜덤이 아니라 항목 id로 결정되는 고정값.
    // 같은 소식이 헤드라인인 동안에는 항상 같은 자리, 다른 소식이 헤드라인이 되면 그때만 바뀐다.
    hashSide: (id) => {
        const str = String(id);
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
        return h % 2 === 0 ? 'left' : 'right';
    },

    render: () => {
        const root = document.getElementById(Boako.NewsFeed.rootId);
        if (!root) return;

        const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        const bannerHtml = `
            <div class="main-banner" style="height:100px; background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
                <h1>📰 아카이브 소식지</h1>
                <p>${todayStr}</p>
            </div>
        `;

        if (Boako.NewsFeed.items.length === 0) {
            root.innerHTML = `
                ${bannerHtml}
                <div class="text-center py-20 text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl bg-white">아직 소식이 없습니다.</div>
            `;
            return;
        }

        const scored = Boako.NewsFeed.items.map(item => ({
            ...item,
            _score: Boako.NewsFeed.computeScore(item),
        }));
        scored.sort((a, b) => b._score - a._score);
        scored.forEach(item => { item._tier = Boako.NewsFeed.getTier(item._score); });

        root.innerHTML = `
            ${bannerHtml}
            <div class="grid grid-cols-4 gap-4" style="grid-auto-flow: dense;">
                ${scored.map(item => Boako.NewsFeed.renderCard(item)).join('')}
            </div>
        `;
    },

    renderCard: (item) => {
        const clickable = item.link_type ? `onclick="Boako.Util.navigateToLink('${item.link_type}', '${item.link_id}')" style="cursor:pointer;"` : '';
        const img = item.thumbnail_url ? Boako.Util.cdn(item.thumbnail_url) : null;

        if (item._tier === 'headline') {
            const side = Boako.NewsFeed.hashSide(item.id);
            const startClass = side === 'left' ? 'md:col-start-1' : 'md:col-start-2';
            return `
                <div class="col-span-4 md:col-span-3 ${startClass} row-span-2 bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200 flex hover:shadow-xl transition-shadow" ${clickable}>
                    ${img ? `<div class="w-2/5 shrink-0"><img src="${img}" class="w-full h-full object-cover"></div>` : `<div class="w-2/5 shrink-0 bg-slate-100 flex items-center justify-center text-6xl">📰</div>`}
                    <div class="p-8 flex-1 flex flex-col justify-center min-w-0">
                        <span class="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">HEADLINE</span>
                        <h2 class="text-2xl font-black text-slate-900 leading-snug mb-2 truncate">${Boako.NewsFeed.escapeHtml(item.title)}</h2>
                        ${item.subtitle ? `<p class="text-sm text-slate-500 font-bold truncate">${Boako.NewsFeed.escapeHtml(item.subtitle)}</p>` : ''}
                    </div>
                </div>
            `;
        }

        if (item._tier === 'large') {
            return `
                <div class="col-span-4 md:col-span-2 min-h-[112px] bg-white rounded-xl overflow-hidden shadow-md border border-slate-200 flex hover:shadow-lg transition-shadow" ${clickable}>
                    ${img ? `<div class="w-32 shrink-0"><img src="${img}" class="w-full h-full object-cover"></div>` : `<div class="w-32 shrink-0 bg-slate-100 flex items-center justify-center text-3xl">📰</div>`}
                    <div class="p-4 flex-1 flex flex-col justify-center min-w-0">
                        <h3 class="text-base font-black text-slate-900 leading-snug mb-1 truncate">${Boako.NewsFeed.escapeHtml(item.title)}</h3>
                        ${item.subtitle ? `<p class="text-xs text-slate-500 font-bold truncate">${Boako.NewsFeed.escapeHtml(item.subtitle)}</p>` : ''}
                    </div>
                </div>
            `;
        }

        if (item._tier === 'medium') {
            return `
                <div class="col-span-2 md:col-span-1 min-h-[132px] bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow" ${clickable}>
                    ${img ? `<div class="h-24 overflow-hidden"><img src="${img}" class="w-full h-full object-cover"></div>` : ''}
                    <div class="p-3">
                        <h4 class="text-xs font-black text-slate-800 leading-snug truncate">${Boako.NewsFeed.escapeHtml(item.title)}</h4>
                    </div>
                </div>
            `;
        }

        // small
        return `
            <div class="col-span-2 md:col-span-1 min-h-[44px] bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 hover:bg-slate-100 transition-colors flex items-center" ${clickable}>
                <span class="text-[11px] font-bold text-slate-500 truncate block">${Boako.NewsFeed.escapeHtml(item.title)}</span>
            </div>
        `;
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
