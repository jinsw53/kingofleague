/**
 * [NEWSFEED] 소식지 — 중요도 × 신선도로 신문 1면처럼 배치되는 뉴스피드
 * 🌟 [전면 재작성] CSS Grid + 고정 슬롯(사이드 2칸/추천게임 페어 2칸/padCount) 방식을 걷어내고,
 *    1면/2면 구분 없는 단일 masonry 엔진(runMasonry)으로 통합. 헤드라인/헌정 카드(3칸, hashSide로
 *    좌우 로테이션)만 강제 위치, 오늘의 추천 게임은 큐 맨 앞에 편입. 그 외 전부 동일한 규칙 하나로 처리:
 *    "2칸짜리를 놓기 직전에 유독 낮게 홀로 남은 컬럼이 있으면 1칸짜리를 먼저 당겨와 메운다"
 *    (실제 소식이 없으면 필러 풀에서 대신 당겨옴, 필러도 소진되면 그냥 둠 — masonry 특성상 완전한
 *    무틈은 보장되지 않음). medium/small 카드의 min-height 강제도 제거해 실제 콘텐츠 높이를 그대로 씀.
 * 🌟 [신규] "오늘의 추천 게임" 카드 추가 — fn_get_today_recommended_game() RPC로 게임명 조회 후
 *    games.image_url로 로고까지 가져와서, 사이드 슬롯(미디엄 카드 크기)에 항상 고정 1장으로 배치.
 *    해당 게임으로 오늘(기록 제출 시점 기준) 기록을 남기면 BTLDB 트리거(fn_award_daily_recommend_bonus)가
 *    자동으로 개인 포인트(💎) 보너스를 지급 (하루 1회 한정). 배율 수치는 카드에 노출하지 않음.
 * 🌟 카드 등급 문턱값 재조정 (headline≥5 / large≥3 / medium≥2 / small≥1, 1 미만은 피드에서 완전히 숨김)
 *    기존엔 headline≥7이었는데 importance=7짜리(팀창단/공략글)는 등록 직후 시간이 조금만 지나도
 *    감쇠 때문에 바로 7 밑으로 떨어져서 헤드라인이 사실상 유지가 안 됐음. 여유를 두도록 낮춤.
 * 🌟 제목/부제목 호버 확대: 카드 자체가 overflow-hidden(썸네일 둥근 모서리 자르기용)이라
 *    CSS transform만으로는 카드 밖으로 못 튀어나오고 잘렸음. position:fixed 팝업 방식으로 변경해서
 *    어떤 카드에 있든 overflow 제약 없이 화면 위에 그대로 확대 표시되도록 수정.
 * 🌟 [수정] renderSupplementPadCard의 필러 이미지(팀/랭킹/게임 로고)가 object-fit:cover로 잘리던 버그 수정.
 *    실제 뉴스 썸네일(item.thumbnail_url)은 사진이라 cover가 맞지만, 로고는 전체가 보여야 하므로
 *    이 카드만 contain + 여백 배경으로 분리함.
 * 🌟 [수정] 헤드라인이 있어도 다른 실제 소식이 몇 개 안 되면 화면이 휑하게 비어 보이던 버그 수정.
 *    hasHeadline 분기에도 헌정 카드 분기와 동일하게 필러 풀로 최소 카드 수를 채우도록 함.
 * 🌟 [수정] 헤드라인 카드 레이아웃 — 이미지가 좌측 40%로 좁게 눌려 있던 걸, 이미지를 카드 전체 배경으로
 *    깔고 제목/부제목을 하단 그라데이션 위에 얹는 방식으로 변경 (AI 생성 이미지가 훨씬 크게 강조됨).
 * 🌟 [수정] 헤드라인 카드 옆 빈 칸을 CSS grid-auto-flow:dense의 자동 배치에 맡기던 걸(왼쪽/오른쪽에 따라
 *    결과가 들쭉날쭉했음) renderTributeGrid와 동일한 패턴으로 교체 — 헤드라인(row-span-2)과 사이드
 *    컬럼(row-span-2, 2칸)을 코드에서 직접 명시적으로 배치해서 항상 안정적으로 나오게 함.
 * 🌟 [수정] 헤드라인급 소식이 여러 개면 전부 헤드라인 카드로 그려지던 버그 수정 — 점수 내림차순,
 *    동점이면 최신순으로 정렬해서 1등만 헤드라인, 나머지는 large 카드로 강등.
 * 🌟 [수정] large 카드가 고정 128px 정사각형 옆배치라 폭 2배인 카드 치고 이미지가 오히려 작아 보이던 문제 —
 *    medium처럼 이미지를 카드 상단 풀폭으로 깔고(높이만 더 키움) 텍스트를 아래로 배치.
 * 🌟 [신규] 필러로 나오는 랜덤 게임 소개 카드 — bga_url 있으면 클릭 시 그 게임의 실제 BGA 페이지가
 *    새 탭으로 열리도록 함 (renderSupplementFiller / renderSupplementPadCard에 externalUrl 지원 추가).
 * 🌟 [수정] 랜덤 게임 소개 카드의 인원수 표기 — 최소/최대 인원이 같으면 "2-2인"이 아니라 "2인"으로 깔끔하게 표시.
 * 🌟 [버그수정] 헌정 카드(헤드라인급 소식이 없을 때 그 자리를 대신하는 카드)가 hashSide를 안 써서 항상
 *    왼쪽 고정이었음 — 헤드라인급 소식(임계값 5 이상)이 드물어서 실제로는 이 카드가 거의 항상 그 자리를
 *    차지하고 있었고, 그래서 "헤드라인 좌우가 안 바뀐다"는 문제가 체감됐음. 날짜 기준 해시로 하루 단위
 *    고정 + 날짜가 바뀌면 자리도 바뀌도록 수정.
 * 🌟 [수정] 스몰 카드(이미지 없는 가장 작은 카드) — 처음엔 텍스트가 카드 밖으로 넘치던 버그가 있었고,
 *    그다음 한 줄 말줄임(...)으로 고쳤었는데, 말줄임보다 줄바꿈이 낫다는 피드백을 받아 다시 변경.
 *    hoverTitle()의 강제 한 줄(white-space:nowrap) 대신 직접 break-words + line-clamp(2줄)를 써서
 *    자연스럽게 줄바꿈되도록 함 (이 카드에서는 hoverTitle의 호버 팝업 기능은 더 이상 안 씀).
 * 🌟 [수정] 나머지 카드(headline/large/medium/filler)의 "제목"도 동일 요청으로 말줄임+호버팝업
 *    대신 줄바꿈으로 통일 — clampTitle() 헬퍼 신설(break-words + line-clamp, 카드 크기별로 2~3줄).
 *    부제목(subtitle)은 이번 요청 범위 밖이라 기존 hoverTitle 그대로 유지.
 * 🌟 [신규] 공략글이 아닌 일반 게시글도 본문에 스크린샷이 포함된 경우 소식지에 노출되도록 DB 트리거
 *    (trg_fn_board_guide_notify) 확장 — AI 생성 없이 본문 첫 <img> 원본을 대표 이미지로 사용.
 * 🌟 [전면 재작성] 오늘의 추천 게임 — 이지/노멀/하드 3개로 확장(point_standards 테이블의 플레이타임
 *    구간 기준, 팀 빙고 쟁탈전과 동일 기준: 0~10분/10~30분/30분+). fn_get_today_recommended_game()
 *    (단일 게임) → fn_get_today_recommended_games_by_tier()(3개 반환)로 교체.
 *    카드는 더 이상 사이드 슬롯(미디엄 크기)을 잡아먹지 않고, 로고 3개가 나란히 들어가는 라지 카드(2칸)
 *    1장으로 독립 — 헤드라인/헌정 카드가 있는 쪽 반대편에 명시적으로 배치(grid-column 엇갈림)해서
 *    두 큰 블록이 나란히 정렬돼 보이지 않게 하고, 그 사이 빈 칸은 dense 모드로 다른 카드가 자동으로 메움.
 *    사이드 슬롯 2칸은 다시 원래대로 실제 소식/필러 전용으로 되돌림.
 * 🌟 [버그수정→재설계] "오늘의 추천 게임" 카드를 옆 large 카드와 같은 줄에서 높이를 맞추려던 시도
 *    (flex/auto-rows-fr/justify-center)를 전부 되돌림 — 라지 카드는 콘텐츠가 세로로 늘어날 수 있지만
 *    추천 게임 카드(아이콘+한 줄 텍스트)는 구조적으로 늘어날 수 없어서, 정렬을 아무리 만져도 "억지로
 *    늘어난 빈 여백" 느낌을 없앨 수 없었음. 대신 추천 게임 카드는 원래 크기(콘텐츠 크기)를 고수하고,
 *    그 옆 2칸을 항상 스몰/미디엄(1칸) 카드로 고정 배치해서 애초에 라지 카드와 같은 줄에 못 붙게 함
 *    (recommendPairCandidates — 부족하면 필러로 채움). render()/renderTributeGrid() 양쪽에 동일 적용.
 */
Boako.NewsFeed = {
    items: [],

    // 헤드라인급 소식이 없을 때 그 자리를 대신하는 명예 회장 헌정 카드에 쓰는 이미지
    TRIBUTE_IMAGE: 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/dustin.png',

    // 헌정 카드 옆 필러 슬롯 / 아래쪽 그리드 마지막 줄을 채울, 실제 소식이 부족할 때 대신 보여줄 사이트의 다른 진짜 데이터
    // 🌟 [수정] 이제 이 풀은 "다 쓰면 끝" — 모자라도 같은 카드를 반복해서 재사용하지 않는다
    fillerPool: [],
    fillerCursor: 0, // 🌟 [신규] 풀에서 다음에 꺼낼 위치

    init: async (containerId) => {
        Boako.NewsFeed.rootId = containerId;
        const root = document.getElementById(containerId);
        if (!root) return;

        Boako.NewsFeed.injectHoverStyle();

        root.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">소식을 불러오는 중...</div>`;

        const [feedResult, fillerPool, recommendResult] = await Promise.all([
            Boako.db.from('news_feed_items').select('*').order('created_at', { ascending: false }).limit(80),
            Boako.NewsFeed.buildFillerPool(),
            Boako.db.rpc('fn_get_today_recommended_games_by_tier'),
        ]);

        if (feedResult.error) {
            console.error('소식지 로드 실패:', feedResult.error);
            root.innerHTML = `<div class="text-center py-20 text-rose-400 font-bold">소식을 불러오지 못했습니다.</div>`;
            return;
        }

        Boako.NewsFeed.items = feedResult.data || [];
        Boako.NewsFeed.fillerPool = fillerPool;
        Boako.NewsFeed.fillerCursor = 0;
        // 🌟 [수정] 오늘의 추천 게임 — 이지/노멀/하드 3개로 확장, 라지 카드 1장 안에 3칸으로 표시.
        // fn_get_today_recommended_games_by_tier()가 [{tier, game_name}, ...] 형태로 반환.
        Boako.NewsFeed.todayRecommendGames = [];
        const recommendRows = recommendResult?.data || [];
        if (recommendRows.length > 0) {
            try {
                const names = recommendRows.map(r => r.game_name);
                const { data: gameRows } = await Boako.db.from('games').select('game_name, image_url').in('game_name', names);
                const imageByName = Object.fromEntries((gameRows || []).map(g => [g.game_name, g.image_url]));
                const tierOrder = { EASY: 0, NORMAL: 1, HARD: 2 };
                Boako.NewsFeed.todayRecommendGames = recommendRows
                    .map(r => ({ tier: r.tier, name: r.game_name, image: imageByName[r.game_name] || null }))
                    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
            } catch (e) {
                console.error('오늘의 추천 게임 로고 조회 실패:', e);
                Boako.NewsFeed.todayRecommendGames = recommendRows.map(r => ({ tier: r.tier, name: r.game_name, image: null }));
            }
        }
        Boako.NewsFeed.render();
    },

    // 🌟 [수정] 제목/부제목 호버 확대 — position:fixed 팝업 방식.
    // 카드의 overflow-hidden(썸네일 모서리 자르기)에 안 걸리도록 화면 좌표 기준으로 직접 띄운다.
    // 스타일 + 이벤트 위임(delegation)은 한 번만 등록.
    injectHoverStyle: () => {
        if (document.getElementById('newsfeed-hover-style')) return;
        const style = document.createElement('style');
        style.id = 'newsfeed-hover-style';
        style.innerHTML = `
            .nf-hover-title-wrap {
                position: relative;
                display: inline-block;
                max-width: 100%;
                vertical-align: bottom;
            }
            .nf-hover-title-base {
                display: block;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #nf-hover-popup {
                position: fixed;
                display: none;
                white-space: nowrap;
                background: #ffffff;
                color: #1e293b;
                padding: 6px 14px;
                border-radius: 8px;
                box-shadow: 0 10px 24px rgba(0,0,0,0.28);
                font-weight: 900;
                z-index: 99999;
                pointer-events: none;
                opacity: 0;
                transition: opacity .12s ease;
                max-width: 90vw;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #nf-hover-popup.show { display: block; opacity: 1; }
        `;
        document.head.appendChild(style);

        // 화면 어디에나 하나만 존재하는 공용 팝업 요소
        if (!document.getElementById('nf-hover-popup')) {
            const popup = document.createElement('div');
            popup.id = 'nf-hover-popup';
            document.body.appendChild(popup);
        }

        // 이벤트 위임: 카드가 매번 새로 그려져도(innerHTML 갱신) 계속 작동하도록 document에 한 번만 등록
        if (!Boako.NewsFeed._hoverBound) {
            Boako.NewsFeed._hoverBound = true;
            const popup = document.getElementById('nf-hover-popup');

            document.addEventListener('mouseover', (e) => {
                const wrap = e.target.closest('.nf-hover-title-wrap');
                if (!wrap) return;
                const baseEl = wrap.querySelector('.nf-hover-title-base');
                if (!baseEl) return;

                const rect = wrap.getBoundingClientRect();
                const fontSize = parseFloat(getComputedStyle(baseEl).fontSize) || 14;
                const fontWeight = getComputedStyle(baseEl).fontWeight;

                popup.textContent = baseEl.textContent;
                popup.style.fontSize = (fontSize * 1.15) + 'px';
                popup.style.fontWeight = fontWeight;
                popup.style.left = Math.max(8, rect.left - 4) + 'px';
                popup.style.top = Math.max(8, rect.top - 6) + 'px';
                popup.classList.add('show');
            });

            document.addEventListener('mouseout', (e) => {
                const wrap = e.target.closest('.nf-hover-title-wrap');
                if (!wrap) return;
                // 같은 wrap 안에서(자식 요소 사이) 이동한 거면 무시
                if (wrap.contains(e.relatedTarget)) return;
                popup.classList.remove('show');
            });
        }
    },

    // 🌟 [수정] 잘림 대상 텍스트를 감싸는 헬퍼 — 화면표시용 얇은 span + fixed 팝업(nf-hover-popup)에 쓸 원본 텍스트를 함께 준비
    hoverTitle: (text) => {
        const escaped = Boako.NewsFeed.escapeHtml(text);
        return `<span class="nf-hover-title-wrap"><span class="nf-hover-title-base">${escaped}</span></span>`;
    },

    // 🌟 [신규] 카드 제목 전용 — 말줄임(...)+호버팝업 대신 자연스러운 줄바꿈으로 표시.
    // small 카드에만 적용돼있던 break-words + line-clamp 방식을 headline/large/medium/filler
    // 카드의 제목(h2/h3/h4)에도 동일하게 적용 ("카드에서만큼은 줄임표 대신 줄바뀜" 요청 반영).
    // lines: 카드 크기에 맞춰 몇 줄까지 허용할지 (기본 2줄, 여유 있는 헤드라인은 3줄).
    clampTitle: (text, lines = 2) => {
        const escaped = Boako.NewsFeed.escapeHtml(text);
        return `<span class="break-words leading-snug" style="display:-webkit-box; -webkit-line-clamp:${lines}; -webkit-box-orient:vertical; overflow:hidden;">${escaped}</span>`;
    },

    // 🌟 [수정] 팀 목록 / 실시간 랭킹 / 최근 게시글 / 랜덤 보드게임에서 각각 여러 개씩 가져와
    // 필러 후보 풀을 넉넉하게 만든다 (반복 사용을 피하기 위해 데이터 개수를 늘림).
    // 개별 쿼리가 실패해도 나머지는 계속 진행되도록 각각 try/catch로 감싼다.
    buildFillerPool: async () => {
        const pool = [];

        try {
            const { data } = await Boako.db
                .from('view_team_list_sorted')
                .select('id, team_name, member_count, logo_url')
                .limit(4);
            (data || []).forEach(t => {
                pool.push({ title: `🛡️ ${t.team_name} · ${t.member_count}명`, image: t.logo_url, icon: '🛡️', linkType: 'TEAM', linkId: t.id });
            });
        } catch (e) { console.error('필러(팀 목록) 로드 실패:', e); }

        try {
            const { data } = await Boako.db
                .from('v_season_current_ranking')
                .select('season_no, team_name, total_lp, logo_url')
                .order('season_no', { ascending: false })
                .order('total_lp', { ascending: false })
                .limit(4);
            (data || []).forEach(r => {
                pool.push({ title: `🏆 ${r.team_name} — 시즌${r.season_no} 순위권 (LP ${r.total_lp})`, image: r.logo_url, icon: '🏆', linkType: 'SEASON_RANKING', linkId: r.team_name });
            });
        } catch (e) { console.error('필러(랭킹) 로드 실패:', e); }

        try {
            const { data } = await Boako.db
                .from('board_posts')
                .select('id, title, category')
                .eq('is_deleted', false)
                .eq('is_draft', false)
                .order('created_at', { ascending: false })
                .limit(4);
            (data || []).forEach(p => {
                pool.push({ title: `📝 [${p.category}] ${p.title}`, image: null, icon: '📝', linkType: 'BOARD_POST', linkId: p.id });
            });
        } catch (e) { console.error('필러(게시글) 로드 실패:', e); }

        try {
            const { count } = await Boako.db.from('games').select('id', { count: 'exact', head: true });
            if (count) {
                // 🌟 서로 다른 랜덤 위치에서 최대 4개까지 중복 없이 뽑기
                const pickCount = Math.min(4, count);
                const offsets = new Set();
                while (offsets.size < pickCount) {
                    offsets.add(Math.floor(Math.random() * count));
                }
                for (const offset of offsets) {
                    const { data } = await Boako.db
                        .from('games')
                        .select('game_name, min_players, max_players, playtime, image_url, bga_url')
                        .range(offset, offset);
                    if (data && data[0]) {
                        const g = data[0];
                        const playerLabel = g.min_players === g.max_players ? `${g.min_players}인` : `${g.min_players}-${g.max_players}인`;
                        pool.push({ title: `🎲 ${g.game_name} · ${playerLabel} · ${g.playtime}분`, image: g.image_url, icon: '🎲', externalUrl: g.bga_url || null });
                    }
                }
            }
        } catch (e) { console.error('필러(보드게임) 로드 실패:', e); }

        // 위 4개 쿼리가 전부 실패하는 극단적인 경우를 대비한 최소한의 안전장치
        if (pool.length === 0) {
            pool.push({ title: '🎮 BOAKO ARCHIVE', image: null, icon: '🎮' });
        }

        // 종류가 섞여서 나오도록 순서를 랜덤하게 섞는다
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        return pool;
    },

    // 🌟 [신규] 풀에서 다음 필러 하나를 꺼낸다. 다 썼으면 반복하지 않고 null을 반환한다.
    nextFiller: () => {
        if (Boako.NewsFeed.fillerCursor >= Boako.NewsFeed.fillerPool.length) return null;
        return Boako.NewsFeed.fillerPool[Boako.NewsFeed.fillerCursor++];
    },

    // 중요도 × 시간감쇠(반감기 = 중요도 × 24시간)로 점수 계산
    computeScore: (item) => {
        const hoursElapsed = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        const halfLifeHours = item.importance * 24;
        const freshness = Math.pow(0.5, hoursElapsed / halfLifeHours);
        return item.importance * freshness;
    },

    // 🌟 [수정] headline≥5 / large≥3 / medium≥2 / small≥1, 1 미만은 null(피드에서 완전히 숨김)
    getTier: (score) => {
        if (score >= 5) return 'headline';
        if (score >= 3) return 'large';
        if (score >= 2) return 'medium';
        if (score >= 1) return 'small';
        return null;
    },

    // 헤드라인의 좌/우 배치를 정하는 함수 — 랜덤이 아니라 항목 id로 결정되는 고정값.
    // 같은 소식이 헤드라인인 동안에는 항상 같은 자리, 다른 소식이 헤드라인이 되면 그때만 바뀐다.
    hashSide: (id) => {
        const str = String(id);
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
        return h % 2 === 0 ? 'left' : 'right';
    },

    // 🌟 [신규] 통합 masonry 배치 엔진 — 1면/2면 구분 없이 전체를 하나의 흐름으로 처리.
    // forcedBlock(헤드라인/헌정 카드, 3칸)만 강제 위치, 나머지는 전부 동일한 규칙 하나로 처리:
    // "2칸짜리를 놓기 직전에 유독 낮게 홀로 남은 컬럼이 있으면 1칸짜리를 먼저 당겨와 메운다"
    // (실제 소식 중엔 없으면 필러 풀에서 대신 당겨오고, 필러도 소진되면 그냥 둔다 — 완전한 무틈은 보장 안 됨,
    // masonry의 태생적 한계)
    // container: 실제로 DOM에 붙어있는 빈 div (clientWidth 측정 가능해야 함)
    // forcedBlock: { html, span:3, cols:[0,1,2] 또는 [1,2,3] }
    // queue: [{ html, span:1|2 }, ...] — 점수순 정렬된 나머지 카드
    runMasonry: (container, forcedBlock, includeRecommend, recommendHtml, queue) => {
        const cols = 4;
        const gap = 16; // gap-4
        const containerWidth = container.clientWidth;
        const colWidth = (containerWidth - gap * (cols - 1)) / cols;
        const colHeights = new Array(cols).fill(0);

        container.innerHTML = '';
        container.style.position = 'relative';

        const place = (html, span, forcedCols) => {
            const wrap = document.createElement('div');
            wrap.innerHTML = html.trim();
            const el = wrap.firstElementChild;
            if (!el) return;
            const width = span === 1 ? colWidth : colWidth * span + gap * (span - 1);
            el.style.width = width + 'px';
            el.style.position = 'static';
            container.appendChild(el);
            const height = el.offsetHeight;

            let colStart, top;
            if (forcedCols) {
                colStart = forcedCols[0];
                top = Math.max(...forcedCols.map(c => colHeights[c]));
                forcedCols.forEach(c => { colHeights[c] = top + height + gap; });
            } else if (span === 2) {
                let bestPair = 0, bestMax = Infinity, bestSum = Infinity;
                for (let i = 0; i <= cols - 2; i++) {
                    const h1 = colHeights[i], h2 = colHeights[i + 1];
                    const mx = Math.max(h1, h2), sm = h1 + h2;
                    if (mx < bestMax || (mx === bestMax && sm < bestSum)) { bestMax = mx; bestSum = sm; bestPair = i; }
                }
                colStart = bestPair; top = bestMax;
                colHeights[bestPair] = top + height + gap;
                colHeights[bestPair + 1] = top + height + gap;
            } else {
                let bestIdx = 0, bestH = colHeights[0];
                for (let i = 1; i < cols; i++) if (colHeights[i] < bestH) { bestH = colHeights[i]; bestIdx = i; }
                colStart = bestIdx; top = bestH;
                colHeights[bestIdx] = top + height + gap;
            }
            el.style.position = 'absolute';
            el.style.left = colStart * (colWidth + gap) + 'px';
            el.style.top = top + 'px';
        };

        // 1) 헤드라인/헌정 카드 강제 배치
        place(forcedBlock.html, forcedBlock.span, forcedBlock.cols);

        // 2) 추천게임을 큐 맨 앞에 끼워넣고, 이후는 규칙 하나만 반복
        if (includeRecommend) queue.unshift({ html: recommendHtml, span: 2 });

        const GAP_THRESHOLD = 50;
        while (queue.length) {
            const front = queue[0];
            if (front.span === 2) {
                const sorted = [...colHeights].sort((a, b) => a - b);
                if (sorted[1] - sorted[0] > GAP_THRESHOLD) {
                    const idx = queue.findIndex(q => q.span === 1);
                    if (idx !== -1) {
                        const [single] = queue.splice(idx, 1);
                        place(single.html, 1, null);
                        continue;
                    }
                    const filler = Boako.NewsFeed.nextFiller();
                    if (filler) {
                        place(Boako.NewsFeed.renderSupplementFiller(filler), 1, null);
                        continue;
                    }
                    // 필러도 소진 — 어쩔 수 없이 그냥 놓는다
                }
            }
            queue.shift();
            place(front.html, front.span, null);
        }

        container.style.height = (Math.max(...colHeights) - gap) + 'px';
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

        let scored = Boako.NewsFeed.items.map(item => ({
            ...item,
            _score: Boako.NewsFeed.computeScore(item),
        }));
        scored.forEach(item => { item._tier = Boako.NewsFeed.getTier(item._score); });
        // 🌟 1점 미만(너무 오래돼서 신선도가 다 떨어진 소식)은 피드에서 완전히 제외
        scored = scored.filter(item => item._tier !== null);
        scored.sort((a, b) => b._score - a._score);

        const hasHeadline = scored.some(item => item._tier === 'headline');

        // 헤드라인급 소식이 하나도 없으면(소식이 0개인 경우 포함) 헌정 카드가 그 자리를 대신한다.
        if (!hasHeadline) {
            root.innerHTML = `
                ${bannerHtml}
                <div id="nf-masonry-root"></div>
            `;
            Boako.NewsFeed.renderTributeGrid(scored, document.getElementById('nf-masonry-root'));
            return;
        }

        // 🌟 [수정] 헤드라인 옆 빈 칸을 CSS grid-auto-flow:dense의 자동 배치에 맡기면
        // (헤드라인이 왼쪽/오른쪽 어느 쪽이냐에 따라 결과가 들쭉날쭉해서) 예측이 안 됨.
        // renderTributeGrid와 똑같은 패턴 — 헤드라인(row-span-2) + 옆 2칸 사이드 컬럼(row-span-2)을
        // 코드에서 직접 명시적으로 배치해서 항상 안정적으로 나오게 함.
        // 🌟 [수정] 헤드라인급이 여러 개면 전부 헤드라인 카드로 그려지던 버그 수정.
        // 점수 내림차순 → 동점이면 최신순으로 정렬해서 1등만 진짜 헤드라인, 나머지는 large로 강등.
        const headlineItems = scored.filter(item => item._tier === 'headline').sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            return new Date(b.created_at) - new Date(a.created_at);
        });
        const mainHeadline = headlineItems[0];
        const extraHeadlines = headlineItems.slice(1).map(item => ({ ...item, _tier: 'large' }));
        const nonHeadline = scored.filter(item => item._tier !== 'headline');

        // 🌟 [재작성] 1면/2면 구분 없는 통합 masonry — 헤드라인만 강제 위치, 나머지는 전부
        // runMasonry의 단일 규칙으로 처리 (사이드/페어 고정 슬롯, padCount 계산 전부 제거)
        const headlineBlock = Boako.NewsFeed.renderHeadlineBlock(mainHeadline);
        const side = Boako.NewsFeed.hashSide(mainHeadline.id);
        const headlineCols = side === 'left' ? [0, 1, 2] : [1, 2, 3];

        const includeRecommend = Boako.NewsFeed.todayRecommendGames.length > 0;
        const recommendHtml = includeRecommend ? Boako.NewsFeed.renderTodayRecommendCard(1) : '';

        const queue = [...nonHeadline, ...extraHeadlines]
            .sort((a, b) => b._score - a._score)
            .map(item => ({ html: Boako.NewsFeed.renderCard(item), span: item._tier === 'large' ? 2 : 1 }));

        root.innerHTML = `
            ${bannerHtml}
            <div id="nf-masonry-root"></div>
        `;
        Boako.NewsFeed.runMasonry(
            document.getElementById('nf-masonry-root'),
            { html: headlineBlock, span: 3, cols: headlineCols },
            includeRecommend, recommendHtml, queue
        );
    },

    // 헤드라인이 없을 때: 헌정 카드(헤드라인 자리) + 필러 슬롯 2칸(미디엄 실제 소식 우선, 부족하면 사이트의 다른 실제 데이터)
    // + 남는 소식(라지/스몰/필러에 못 들어간 미디엄) + 마지막 줄이 4칸을 못 채우면 실제 데이터로 채움
    // 🌟 [수정] 필러 풀이 소진되면 더 이상 채우지 않고 그 자리를 비워둔다 (같은 카드 반복 금지)
    // 🌟 [재작성] container(실제 DOM)를 직접 받아 masonry로 그림 (더 이상 HTML 문자열을 반환하지 않음)
    renderTributeGrid: (scored, container) => {
        const mediumItems = scored.filter(item => item._tier === 'medium');
        const otherItems = scored.filter(item => item._tier === 'large' || item._tier === 'small');

        // 🌟 헤드라인급 소식이 드물어서 이 헌정 카드가 실제로는 거의 항상 그 자리를 대신함 —
        // 날짜 기준 해시로 하루 단위 고정, 날짜가 바뀌면 자리도 바뀜.
        const tributeSide = Boako.NewsFeed.hashSide(new Date().toDateString());
        const tributeCols = tributeSide === 'left' ? [0, 1, 2] : [1, 2, 3];
        const tributeBlock = `
            <div class="nf-tribute">
                <div class="nf-tribute-photo">
                    <img src="${Boako.Util.cdn(Boako.NewsFeed.TRIBUTE_IMAGE)}" alt="더스틴밤">
                </div>
                <div class="nf-tribute-body">
                    <div class="nf-tribute-eyebrow">👑 BOAKO ARCHIVE 명예 회장</div>
                    <h1 class="nf-tribute-name">더스틴밤 <span>님</span></h1>
                    <p class="nf-tribute-quote">헤드라인이 될 만한 큰 소식은 없지만, 명예 회장님의 존재감만으로 이 자리는 결코 비어있지 않습니다.</p>
                </div>
            </div>
        `;

        const includeRecommend = Boako.NewsFeed.todayRecommendGames.length > 0;
        const recommendHtml = includeRecommend ? Boako.NewsFeed.renderTodayRecommendCard(1) : '';

        const queue = [...mediumItems, ...otherItems]
            .sort((a, b) => b._score - a._score)
            .map(item => ({ html: Boako.NewsFeed.renderCard(item), span: item._tier === 'large' ? 2 : 1 }));

        Boako.NewsFeed.runMasonry(
            container,
            { html: tributeBlock, span: 3, cols: tributeCols },
            includeRecommend, recommendHtml, queue
        );
    },

    // 🌟 [신규] 메인 헤드라인 전용 — 사이드 컬럼(2칸, row-span-2)과 짝을 이루는 형태라
    // aspect-ratio 대신 row-span-2로 옆 컬럼과 정확히 같은 높이를 갖도록 함 (grid 기본 stretch 활용)
    renderHeadlineBlock: (item) => {
        const clickable = item.link_type ? `onclick="Boako.Util.navigateToLink('${item.link_type}', '${item.link_id}')" style="cursor:pointer;"` : '';
        const img = item.thumbnail_url ? Boako.Util.cdn(item.thumbnail_url) : null;
        return `
            <div class="col-span-4 md:col-span-3 md:row-span-2 relative rounded-2xl overflow-hidden shadow-lg border border-slate-200 hover:shadow-xl transition-shadow" style="min-height: 280px;" ${clickable}>
                ${img ? `<img src="${img}" class="absolute inset-0 w-full h-full object-cover">` : `<div class="absolute inset-0 bg-slate-100 flex items-center justify-center text-8xl">📰</div>`}
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
                <div class="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <span class="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 block">HEADLINE</span>
                    <h2 class="text-xl md:text-2xl font-black text-white leading-snug mb-2">${Boako.NewsFeed.clampTitle(item.title, 3)}</h2>
                    ${item.subtitle ? `<p class="text-sm text-slate-200 font-bold">${Boako.NewsFeed.hoverTitle(item.subtitle)}</p>` : ''}
                </div>
            </div>
        `;
    },

    // 🌟 [전면 재작성] 오늘의 추천 게임 — 이지/노멀/하드 3개를 라지카드(2칸) 1장 안에 3등분해서 표시.
    // colStart: 헤드라인/헌정 카드가 있는 쪽과 겹치지 않게 반대편에 명시적으로 배치하기 위한 grid-column 시작 위치(1 또는 3).
    // 🌟 [재설계] 옆 카드 높이에 맞춰 늘리는 시도(flex/auto-rows-fr)를 걷어내고 원래 크기(콘텐츠 크기)로 되돌림 —
    // 대신 render()/renderTributeGrid()에서 이 카드 옆 2칸을 항상 스몰/미디엄으로 고정 배치해 라지 카드와 안 만나게 함.
    renderTodayRecommendCard: (colStart) => {
        const games = Boako.NewsFeed.todayRecommendGames;
        if (!games || games.length === 0) return '';

        const TIER_LABEL = { EASY: '이지 · 10분 미만', NORMAL: '노멀 · 10~30분', HARD: '하드 · 30분 이상' };
        const TIER_STYLE = {
            EASY: { color: '#059669', bg: '#ecfdf5' },
            NORMAL: { color: '#b45309', bg: '#fffbeb' },
            HARD: { color: '#b91c1c', bg: '#fef2f2' }
        };

        const cellsHtml = games.map((game, i) => {
            const img = game.image ? Boako.Util.cdn(game.image) : null;
            const style = TIER_STYLE[game.tier] || TIER_STYLE.NORMAL;
            const borderClass = i < games.length - 1 ? 'border-r border-slate-100' : '';
            return `
                <div class="flex flex-col items-center justify-center text-center p-3 ${borderClass}" onclick="Boako.Util.navigateToLink('GAME', '${game.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
                    <span class="text-[9px] font-black px-2 py-0.5 rounded mb-2" style="color:${style.color}; background:${style.bg};">${TIER_LABEL[game.tier] || game.tier}</span>
                    <div class="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center mb-2 overflow-hidden">
                        ${img ? `<img src="${img}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span class="text-xl">🎲</span>`}
                    </div>
                    <div class="text-[11px] font-black text-slate-900 leading-snug">${Boako.NewsFeed.escapeHtml(game.name)}</div>
                </div>
            `;
        }).join('');

        const startClass = colStart >= 3 ? 'md:col-start-3' : 'md:col-start-1';
        return `
            <div class="col-span-4 md:col-span-2 ${startClass}">
                <div class="bg-white rounded-xl overflow-hidden shadow-sm border-2 border-amber-300">
                    <div class="flex items-center justify-between px-3 py-1.5 bg-slate-800">
                        <span class="text-[11px] font-black text-amber-300">⭐ 오늘의 추천 게임</span>
                        <span class="text-[9px] font-bold text-slate-400">기록 시 포인트 지급 · 오늘까지</span>
                    </div>
                    <div class="grid grid-cols-3">
                        ${cellsHtml}
                    </div>
                </div>
            </div>
        `;
    },

    renderFillerReal: (item) => {
        const clickable = item.link_type ? `onclick="Boako.Util.navigateToLink('${item.link_type}', '${item.link_id}')" style="cursor:pointer;"` : '';
        const img = item.thumbnail_url ? Boako.Util.cdn(item.thumbnail_url) : null;
        return `
            <div class="nf-filler-card" ${clickable}>
                <div class="thumb">${img ? `<img src="${img}">` : '📰'}</div>
                <div class="txt"><h4>${Boako.NewsFeed.clampTitle(item.title)}</h4></div>
            </div>
        `;
    },

    // 필러 슬롯을 채우는 사이트의 다른 실제 데이터 — 진짜 소식 카드와 똑같은 모양이라 자연스럽게 섞인다 (배지 없음)
    // 🌟 [수정] externalUrl(게임의 실제 BGA 페이지 등)이 있으면 그걸 새 탭으로 열고, 없으면 기존처럼 내부 navigateToLink 사용
    renderSupplementFiller: (filler) => {
        const img = filler.image ? Boako.Util.cdn(filler.image) : null;
        const clickable = filler.externalUrl
            ? `onclick="window.open('${filler.externalUrl.replace(/'/g, "\\'")}', '_blank')" style="cursor:pointer;"`
            : (filler.linkType ? `onclick="Boako.Util.navigateToLink('${filler.linkType}', '${filler.linkId}')" style="cursor:pointer;"` : '');
        return `
            <div class="nf-filler-card" ${clickable}>
                <div class="thumb">${img ? `<img src="${img}">` : filler.icon}</div>
                <div class="txt"><h4>${Boako.NewsFeed.clampTitle(filler.title)}</h4></div>
            </div>
        `;
    },

    // 아래쪽 그리드 마지막 줄을 채우는 사이트의 다른 실제 데이터 — production의 medium 카드와 동일한 마크업
    // 🌟 [수정] 여기 들어오는 image는 팀/랭킹/게임 "로고"라서 object-fit:cover로 자르면 안 됨 —
    // contain + 여백 배경으로 로고 전체가 보이도록 (실제 뉴스 썸네일용 object-fit:cover와는 용도가 다름)
    // 🌟 [수정] externalUrl(게임의 실제 BGA 페이지 등)이 있으면 그걸 새 탭으로 열고, 없으면 기존처럼 내부 navigateToLink 사용
    renderSupplementPadCard: (filler) => {
        const img = filler.image ? Boako.Util.cdn(filler.image) : null;
        const clickable = filler.externalUrl
            ? `onclick="window.open('${filler.externalUrl.replace(/'/g, "\\'")}', '_blank')" style="cursor:pointer;"`
            : (filler.linkType ? `onclick="Boako.Util.navigateToLink('${filler.linkType}', '${filler.linkId}')" style="cursor:pointer;"` : '');
        return `
            <div class="col-span-2 md:col-span-1 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow" ${clickable}>
                ${img ? `<div class="h-24 overflow-hidden bg-slate-50 flex items-center justify-center p-3"><img src="${img}" style="max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain;"></div>` : ''}
                <div class="p-3 min-w-0">
                    <h4 class="text-xs font-black text-slate-800 leading-snug">${Boako.NewsFeed.clampTitle(filler.title)}</h4>
                </div>
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
                <div class="col-span-4 md:col-span-3 ${startClass} relative rounded-2xl overflow-hidden shadow-lg border border-slate-200 hover:shadow-xl transition-shadow" style="aspect-ratio: 16/9;" ${clickable}>
                    ${img ? `<img src="${img}" class="absolute inset-0 w-full h-full object-cover">` : `<div class="absolute inset-0 bg-slate-100 flex items-center justify-center text-8xl">📰</div>`}
                    <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <span class="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 block">HEADLINE</span>
                        <h2 class="text-xl md:text-2xl font-black text-white leading-snug mb-2">${Boako.NewsFeed.clampTitle(item.title, 3)}</h2>
                        ${item.subtitle ? `<p class="text-sm text-slate-200 font-bold">${Boako.NewsFeed.hoverTitle(item.subtitle)}</p>` : ''}
                    </div>
                </div>
            `;
        }

        if (item._tier === 'large') {
            return `
                <div class="col-span-4 md:col-span-2 bg-white rounded-xl overflow-hidden shadow-md border border-slate-200 flex flex-col hover:shadow-lg transition-shadow" ${clickable}>
                    ${img ? `<div class="h-36 overflow-hidden"><img src="${img}" class="w-full h-full object-cover"></div>` : `<div class="h-36 bg-slate-100 flex items-center justify-center text-4xl">📰</div>`}
                    <div class="p-4 min-w-0">
                        <h3 class="text-base font-black text-slate-900 leading-snug mb-1">${Boako.NewsFeed.clampTitle(item.title)}</h3>
                        ${item.subtitle ? `<p class="text-xs text-slate-500 font-bold">${Boako.NewsFeed.hoverTitle(item.subtitle)}</p>` : ''}
                    </div>
                </div>
            `;
        }

        if (item._tier === 'medium') {
            return `
                <div class="col-span-2 md:col-span-1 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow" ${clickable}>
                    ${img ? `<div class="h-24 overflow-hidden"><img src="${img}" class="w-full h-full object-cover"></div>` : ''}
                    <div class="p-3 min-w-0">
                        <h4 class="text-xs font-black text-slate-800 leading-snug">${Boako.NewsFeed.clampTitle(item.title)}</h4>
                    </div>
                </div>
            `;
        }

        // small
        // 🌟 [수정] 말줄임(...)보다 줄바꿈이 낫겠다는 피드백 반영 — hoverTitle()의 강제 한 줄
        // 처리(white-space:nowrap) 대신, 직접 break-words + line-clamp(2줄)로 자연스럽게
        // 줄바꿈되도록 변경 (이 카드에서는 호버 팝업이 더 이상 필요 없어져서 hoverTitle을 안 씀).
        return `
            <div class="col-span-2 md:col-span-1 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 hover:bg-slate-100 transition-colors flex items-center min-w-0" ${clickable}>
                <span class="text-[11px] font-bold text-slate-500 break-words leading-snug" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${Boako.NewsFeed.escapeHtml(item.title)}</span>
            </div>
        `;
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
