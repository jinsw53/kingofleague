/**
 * [MOBILE NEWSFEED] 모바일 전용 — 소식지(뉴스피드) 화면
 * 🌟 [신규] PC js/newsfeed.js와 동일한 데이터(news_feed_items 조회 + 오늘의 추천 게임)를 그대로
 *    재사용하되, PC의 신문 1면형 그리드(헤드라인/사이드/필러패딩)는 세로 1단 피드로 완전히 새로 작성.
 *    세로 1단이라 PC처럼 "4칸 그리드를 필러로 채워야 하는" 복잡함 자체가 없어져서 필러풀 로직은
 *    아예 안 가져옴 — 실제 소식만 점수 내림차순으로 쌓으면 끝.
 * 🌟 점수/등급 계산(computeScore/getTier)은 PC newsfeed.js의 공식과 완전히 동일하게 이 파일에도
 *    그대로 옮겨 적었음(값 자체가 아주 짧은 순수 계산이라, 무거운 PC newsfeed.js 전체를
 *    불러오는 대신 이 파일 안에 직접 둠 — 로드 비용 절약). 공식 자체가 바뀌면 두 곳 다 고쳐야 함.
 * 🌟 [디자인 통일] PC와 너무 동떨어져 보인다는 피드백 반영 — 아래 5가지를 PC 시각 정체성에 맞춰 재작성:
 *    1) 상단 배너(어두운 그라데이션 + 오늘 날짜) 추가 — PC render()의 bannerHtml과 동일한 톤.
 *    2) 헤드라인 카드를 PC처럼 이미지 풀블리드 + 검정 그라데이션 오버레이 + 흰 글씨로 재작성
 *       (기존엔 이미지가 박스로 위에 붙고 제목이 그 아래 평범한 검정 글씨였음 — "헤드라인" 느낌이 안 남).
 *    3) large/medium/small 등급별로 생김새를 확실히 차등화 — large(이미지 위·큰 텍스트) /
 *       medium(가로형, 이미지 왼쪽 작게+텍스트 오른쪽 — "덜 중요함"이 한눈에 보이게) /
 *       small(이미지 없는 회색 알약형 텍스트, PC의 small 카드와 동일 컨셉).
 *    4) 헤드라인급 소식이 하나도 없을 때 PC의 "명예 회장 헌정 카드"(nf-tribute)를 세로 1단에
 *       맞게 축약한 버전으로 재현 — 이 컴포넌트 자체가 없어서 소식 적은 날엔 휑해 보이던 문제 해결.
 *    5) 카드에 은은한 그림자(box-shadow) 추가 — PC의 shadow-sm/md에 해당하는 효과를 인라인으로.
 * 🌟 [알려진 제한] 카드 클릭 시 이동은 아직 안 붙임 — PC의 Boako.Util.navigateToLink()는
 *    Boako.View.render()라는 PC 전용 화면 전환 시스템을 불러서 모바일에서 그대로 쓰면 에러남.
 *    게시판/토너먼트/팀 등 목적지 화면들을 모바일로 포팅한 뒤에 이어서 연결할 예정.
 * 🌟 [버그수정] 상단 배너가 다른 화면들(팀 목록/인벤토리/같이하자/라이벌 등)과 달리 PC
 *    .main-banner 패턴을 쓰지 않고 독자적으로 만든 마크업이라, 애초에 가운데 정렬 스타일 자체가
 *    빠져있어 왼쪽 정렬로 보였음 — 다른 화면들과 통일되게 flex 가운데 정렬 추가.
 */
window.Boako = window.Boako || {};
Boako.MobileNewsfeed = {

    // 🌟 PC newsfeed.js의 TRIBUTE_IMAGE와 동일한 값 (명예 회장 사진)
    TRIBUTE_IMAGE: 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/dustin.png',

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

    // 🌟 PC와 동일한 톤의 상단 배너 (어두운 그라데이션 + 오늘 날짜)
    // 🌟 [버그수정] 다른 화면들과 달리 가운데 정렬 스타일이 빠져있어 왼쪽 정렬로 보였음 — 통일.
    renderBanner: () => {
        const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        return `
            <div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius:16px; padding:18px 20px; margin-bottom:12px; display:flex; flex-direction:column; align-items:center; text-align:center;">
                <div style="font-size:16px; font-weight:900; color:#fff; width:100%;">📰 아카이브 소식지</div>
                <div style="font-size:11.5px; font-weight:700; color:#94a3b8; margin-top:4px; width:100%;">${todayStr}</div>
            </div>
        `;
    },

    // 🌟 [신규] 헤드라인급 소식이 하나도 없을 때 PC의 nf-tribute(명예 회장 헌정 카드)를
    // 세로 1단에 맞게 축약한 버전. PC와 같은 어두운 그라데이션 + 골드 톤 배지로 정체성 통일.
    renderTribute: () => {
        return `
            <div style="position:relative; overflow:hidden; border-radius:16px; background:linear-gradient(135deg,#1e293b 0%,#0f172a 60%,#1e1b4b 100%); padding:22px; text-align:center; box-shadow:0 4px 14px rgba(0,0,0,0.15);">
                <div style="width:84px; height:84px; border-radius:50%; margin:0 auto 14px; padding:4px; background:linear-gradient(135deg,#fbbf24,#f59e0b,#fbbf24); box-shadow:0 0 0 3px rgba(251,191,36,0.15);">
                    <img src="${Boako.Util.cdn(Boako.MobileNewsfeed.TRIBUTE_IMAGE)}" alt="더스틴밤" style="width:100%; height:100%; object-fit:cover; border-radius:50%; border:2px solid #0f172a; display:block;">
                </div>
                <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.35); color:#fbbf24; font-size:10px; font-weight:900; letter-spacing:0.06em; padding:4px 10px; border-radius:999px; margin-bottom:10px;">👑 BOAKO ARCHIVE 명예 회장</div>
                <div style="font-size:19px; font-weight:900; color:#fff; margin-bottom:8px;">더스틴밤 <span style="color:#fbbf24;">님</span></div>
                <div style="font-size:11.5px; font-weight:700; color:#cbd5e1; line-height:1.6;">헤드라인이 될 만한 큰 소식은 없지만, 명예 회장님의 존재감만으로 이 자리는 결코 비어있지 않습니다.</div>
            </div>
        `;
    },

    draw: (container) => {
        let scored = Boako.MobileNewsfeed.items.map(item => ({ ...item, _score: Boako.MobileNewsfeed.computeScore(item) }));
        scored.forEach(item => { item._tier = Boako.MobileNewsfeed.getTier(item._score); });
        scored = scored.filter(item => item._tier !== null); // 1점 미만(신선도 다 떨어진 소식)은 완전히 숨김
        scored.sort((a, b) => b._score - a._score);

        const hasHeadline = scored.some(item => item._tier === 'headline');
        const recommendHtml = Boako.MobileNewsfeed.todayRecommendGame ? Boako.MobileNewsfeed.renderRecommendCard() : '';
        const bannerHtml = Boako.MobileNewsfeed.renderBanner();

        if (scored.length === 0 && !Boako.MobileNewsfeed.todayRecommendGame) {
            container.innerHTML = `<div style="display:flex; flex-direction:column; gap:12px;">${bannerHtml}<div style="padding:40px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">아직 표시할 소식이 없습니다.</div></div>`;
            return;
        }

        // 🌟 헤드라인이 없으면 PC와 동일하게 헌정 카드가 그 자리를 대신함
        const tributeHtml = hasHeadline ? '' : Boako.MobileNewsfeed.renderTribute();

        const cardsHtml = scored.map(item => Boako.MobileNewsfeed.renderCard(item)).join('');
        container.innerHTML = `<div style="display:flex; flex-direction:column; gap:12px;">${bannerHtml}${tributeHtml}${recommendHtml}${cardsHtml}</div>`;
    },

    renderRecommendCard: () => {
        const game = Boako.MobileNewsfeed.todayRecommendGame;
        const img = game.image ? Boako.Util.cdn(game.image) : null;
        return `
            <div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:14px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
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

    // 🌟 [전면 재작성] 등급별로 PC와 동일한 시각적 위계를 갖도록 완전히 다른 마크업을 사용.
    // headline: 이미지 풀블리드 + 그라데이션 오버레이 + 흰 글씨 (PC renderHeadlineBlock과 동일 톤)
    // large: 이미지가 카드 위쪽 전체 폭으로, 아래 굵은 제목 (PC의 large 카드 톤)
    // medium: 가로형(이미지 작게 왼쪽 + 텍스트 오른쪽) — "헤드라인보다 덜 중요함"이 한눈에 보이도록
    // small: 이미지 없는 회색 알약형 텍스트 (PC의 small 카드와 동일 컨셉)
    renderCard: (item) => {
        const img = item.thumbnail_url ? Boako.Util.cdn(item.thumbnail_url) : null;

        if (item._tier === 'headline') {
            return `
                <div style="position:relative; border-radius:16px; overflow:hidden; aspect-ratio:16/9; box-shadow:0 6px 18px rgba(0,0,0,0.16);">
                    ${img
                        ? `<img src="${img}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;">`
                        : `<div style="position:absolute; inset:0; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:56px;">📰</div>`}
                    <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.3) 55%, transparent);"></div>
                    <div style="position:absolute; left:0; right:0; bottom:0; padding:16px;">
                        <div style="font-size:10px; font-weight:900; color:#fb7185; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;">HEADLINE</div>
                        <div style="font-size:16.5px; font-weight:900; color:#fff; line-height:1.38; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.title)}</div>
                        ${item.subtitle ? `<div style="font-size:11.5px; font-weight:700; color:#e2e8f0; margin-top:5px; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.subtitle)}</div>` : ''}
                    </div>
                </div>
            `;
        }

        if (item._tier === 'large') {
            return `
                <div style="background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 3px 10px rgba(0,0,0,0.08);">
                    <div style="width:100%; aspect-ratio:2/1; overflow:hidden; background:#f1f5f9;">
                        ${img ? `<img src="${img}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:36px; color:#cbd5e1;">📰</div>`}
                    </div>
                    <div style="padding:14px;">
                        <div style="font-size:14.5px; font-weight:900; color:#0f172a; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.title)}</div>
                        ${item.subtitle ? `<div style="font-size:11px; font-weight:700; color:#94a3b8; margin-top:4px; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.subtitle)}</div>` : ''}
                    </div>
                </div>
            `;
        }

        if (item._tier === 'medium') {
            return `
                <div style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); display:flex; align-items:center; gap:10px; padding:10px;">
                    <div style="width:56px; height:56px; border-radius:8px; overflow:hidden; background:#f1f5f9; flex-shrink:0;">
                        ${img ? `<img src="${img}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:20px; color:#cbd5e1;">📰</div>`}
                    </div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:12.5px; font-weight:900; color:#1e293b; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.title)}</div>
                    </div>
                </div>
            `;
        }

        // small — PC와 동일 컨셉: 이미지 없는 회색 알약형 텍스트
        return `
            <div style="background:#f8fafc; border-radius:10px; padding:10px 13px; border:1px solid #f1f5f9;">
                <span style="font-size:11.5px; font-weight:700; color:#64748b; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${Boako.MobileNewsfeed.escapeHtml(item.title)}</span>
            </div>
        `;
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
