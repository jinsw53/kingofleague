/**
 * [NEWSFEED] 소식지 — 중요도 × 신선도로 신문 1면처럼 배치되는 뉴스피드
 */
Boako.NewsFeed = {
    items: [],

    // 헤드라인급 소식이 없을 때 그 자리를 대신하는 명예 회장 헌정 카드에 쓰는 이미지
    TRIBUTE_IMAGE: 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/dustin.png',

    // 헌정 카드 옆 필러 슬롯 / 아래쪽 그리드 마지막 줄을 채울 실제 소식이 부족할 때 쓰는 예시 카드
    EXAMPLE_FILLERS: [
        { menu: '🛡️ 팀 목록', detail: '쿨한 전략가들 · 시즌12 우승' },
        { menu: '🏆 실시간 랭킹', detail: '강알리 — 리그 1위' },
        { menu: '📝 최근 게시글', detail: '신규 회원 가입 인사드립니다' },
        { menu: '🎲 추천 보드게임', detail: '이번 주 추천 — 윙스팬' },
    ],

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

        const scored = Boako.NewsFeed.items.map(item => ({
            ...item,
            _score: Boako.NewsFeed.computeScore(item),
        }));
        scored.sort((a, b) => b._score - a._score);
        scored.forEach(item => { item._tier = Boako.NewsFeed.getTier(item._score); });

        const hasHeadline = scored.some(item => item._tier === 'headline');

        // 헤드라인급 소식이 하나도 없으면(소식이 0개인 경우 포함) 헌정 카드가 그 자리를 대신한다.
        if (!hasHeadline) {
            root.innerHTML = `
                ${bannerHtml}
                ${Boako.NewsFeed.renderTributeGrid(scored)}
            `;
            return;
        }

        root.innerHTML = `
            ${bannerHtml}
            <div class="grid grid-cols-4 gap-4" style="grid-auto-flow: dense;">
                ${scored.map(item => Boako.NewsFeed.renderCard(item)).join('')}
            </div>
        `;
    },

    // 헤드라인이 없을 때: 헌정 카드(헤드라인 자리) + 필러 슬롯 2칸(미디엄 실제 소식 우선, 부족하면 예시)
    // + 남는 소식(라지/스몰/필러에 못 들어간 미디엄) + 마지막 줄이 4칸을 못 채우면 예시 카드로 채움
    renderTributeGrid: (scored) => {
        const mediumItems = scored.filter(item => item._tier === 'medium');
        const otherItems = scored.filter(item => item._tier === 'large' || item._tier === 'small');

        const fillerReal = mediumItems.slice(0, 2);
        const leftoverMedium = mediumItems.slice(2);

        let fillerHtml = '';
        for (let i = 0; i < 2; i++) {
            if (fillerReal[i]) {
                fillerHtml += Boako.NewsFeed.renderFillerReal(fillerReal[i]);
            } else {
                const ex = Boako.NewsFeed.EXAMPLE_FILLERS[i % Boako.NewsFeed.EXAMPLE_FILLERS.length];
                fillerHtml += Boako.NewsFeed.renderFillerExample(ex);
            }
        }

        const belowItems = [...otherItems, ...leftoverMedium].sort((a, b) => b._score - a._score);
        const belowCardsHtml = belowItems.map(item => Boako.NewsFeed.renderCard(item)).join('');

        // 아래쪽 그리드 마지막 줄이 4칸을 못 채우면, 남는 칸만큼 예시 카드로 채워 줄을 완성한다.
        const usedCols = belowItems.reduce((sum, item) => sum + (item._tier === 'large' ? 2 : 1), 0);
        const remainder = usedCols % 4;
        const padCount = remainder === 0 ? 0 : (4 - remainder);
        let padHtml = '';
        for (let i = 0; i < padCount; i++) {
            const ex = Boako.NewsFeed.EXAMPLE_FILLERS[i % Boako.NewsFeed.EXAMPLE_FILLERS.length];
            padHtml += Boako.NewsFeed.renderPadCard(ex);
        }

        return `
            <div class="grid grid-cols-4 gap-4" style="grid-auto-flow: dense;">
                <div class="col-span-4 md:col-span-3 md:row-span-2 nf-tribute">
                    <div class="nf-tribute-photo">
                        <img src="${Boako.Util.cdn(Boako.NewsFeed.TRIBUTE_IMAGE)}" alt="더스틴밤">
                    </div>
                    <div class="nf-tribute-body">
                        <div class="nf-tribute-eyebrow">👑 BOAKO ARCHIVE 명예 회장</div>
                        <h1 class="nf-tribute-name">더스틴밤 <span>님</span></h1>
                        <p class="nf-tribute-quote">헤드라인이 될 만한 큰 소식은 없지만, 명예 회장님의 존재감만으로 이 자리는 결코 비어있지 않습니다.</p>
                    </div>
                </div>
                <div class="col-span-2 md:col-span-1 md:row-span-2 grid grid-rows-2 gap-4">
                    ${fillerHtml}
                </div>
                ${belowCardsHtml}
                ${padHtml}
            </div>
        `;
    },

    renderFillerReal: (item) => {
        const clickable = item.link_type ? `onclick="Boako.Util.navigateToLink('${item.link_type}', '${item.link_id}')" style="cursor:pointer;"` : '';
        const img = item.thumbnail_url ? Boako.Util.cdn(item.thumbnail_url) : null;
        return `
            <div class="nf-filler-card" ${clickable}>
                <div class="thumb">${img ? `<img src="${img}">` : '📰'}</div>
                <div class="txt"><h4>${Boako.NewsFeed.escapeHtml(item.title)}</h4></div>
            </div>
        `;
    },

    renderFillerExample: (ex) => `
        <div class="nf-filler-card is-example">
            <div class="menu-slot">${ex.menu}</div>
            <div class="txt"><h4>${Boako.NewsFeed.escapeHtml(ex.detail)}</h4></div>
        </div>
    `,

    renderPadCard: (ex) => `
        <div class="col-span-2 md:col-span-1 min-h-[132px] bg-white rounded-xl overflow-hidden border nf-pad-example flex flex-col" style="position:relative;">
            <div class="nf-pad-thumb">${ex.menu}</div>
            <div class="p-3">
                <h4 class="text-xs font-black text-slate-800 leading-snug truncate">${Boako.NewsFeed.escapeHtml(ex.detail)}</h4>
            </div>
        </div>
    `,

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
