/**
 * [ACHIEVEMENTS] 업적 실시간 획득 알림
 * 🌟 user_achievements INSERT를 Realtime으로 감지해서, 사이트 어느 화면에 있든 주사위 굴림과 같은 톤의
 *    풀스크린 축하 오버레이를 띄움. 로그인 즉시(auth.js) 구독 시작 — 메신저 실시간 쪽지 감지(startRealtime)와 동일한 패턴.
 *    포인트 지급/인벤토리 배지 지급은 DB 트리거(fn_grant_achievement_rewards)가 원자적으로 처리하므로,
 *    이 모듈은 순수하게 "알림 표시"만 담당함.
 *    여러 개가 한꺼번에 뜰 수 있어서(오프라인 중 놓친 업적 등) 큐(enqueueOverlay)로 순서대로 하나씩 보여줌.
 * 🌟 배지 합성 렌더링(renderBadgeHTML): 인벤토리/위젯/오버레이가 전부 공유하는 공용 함수.
 *    획득마다 별도 인벤토리 인스턴스(achv_<code>_<user_achievements.id>)라 매번 achievements 테이블에서 code로 조회.
 *    시즌형 배지는 배경 원본 비율 유지(정사각형 강제 X) + season_logo_overlay 좌표로 시즌 로고 합성.
 *    OO매니아는 배경 없이 게임 로고 + 티어(동/은/금) 테두리로 합성.
 */
Boako.Achievements = {
    channel: null,

    injectStyle: () => {
        if (document.getElementById('achievement-toast-style')) return;
        const style = document.createElement('style');
        style.id = 'achievement-toast-style';
        style.innerHTML = `
            @keyframes achv-badge-pop {
                0%   { transform: scale(0.4) rotate(-10deg); opacity: 0; }
                60%  { transform: scale(1.15) rotate(4deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            .achv-badge-pop { animation: achv-badge-pop 0.5s cubic-bezier(.34,1.56,.64,1) 0.1s both; }
        `;
        document.head.appendChild(style);
    },

    // 🌟 업적명 뒤에 붙은 (동)/(은)/(금)으로 티어 컬러 판별. 없으면 기본(보라) 톤.
    getTierStyle: (name) => {
        if (name && name.includes('(금)')) return { bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', ring: '#fbbf24', label: 'GOLD' };
        if (name && name.includes('(은)')) return { bg: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', ring: '#cbd5e1', label: 'SILVER' };
        if (name && name.includes('(동)')) return { bg: 'linear-gradient(135deg,#fb923c,#c2703d)', ring: '#fb923c', label: 'BRONZE' };
        return { bg: 'linear-gradient(135deg,#8b5cf6,#4f46e5)', ring: '#8b5cf6', label: null };
    },

    startRealtime: () => {
        if (!Boako.state.user || !Boako.db) return;
        if (Boako.Achievements.channel) return; // 이미 구독 중이면 중복 방지

        Boako.Achievements.channel = Boako.db
            .channel(`achievements-realtime-${Boako.state.user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'user_achievements',
                filter: `user_id=eq.${Boako.state.user.id}`
            }, async (payload) => {
                try {
                    const { data: achievement } = await Boako.db
                        .from('achievements')
                        .select('*')
                        .eq('id', payload.new.achievement_id)
                        .single();
                    if (achievement) {
                        Boako.Achievements.enqueueOverlay(achievement, payload.new.meta, payload.new.season_no, payload.new.id);
                        // 🌟 실시간으로 이미 보여줬으니, 다음 로그인 때 다시 안 뜨도록 즉시 확인 처리
                        await Boako.Achievements.markConfirmed([payload.new.id]);
                    }
                } catch (e) {
                    console.error('업적 알림 표시 실패:', e);
                }
            })
            .subscribe();
    },

    // 🌟 [신규] 오프라인 중에 획득한 업적(=접속 안 했을 때 트리거로 지급된 것)을 로그인 시점에 체크해서 놓치지 않고 보여줌.
    // profiles.tutorial_status.confirmed_achievement_ids (user_achievements.id 배열)로 "이미 본 것" 추적 — 공지사항 확인 로직과 동일 패턴.
    checkUnseenAchievements: async () => {
        if (!Boako.state.user || !Boako.db) return;
        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();
            const confirmedIds = new Set((profile?.tutorial_status?.confirmed_achievement_ids) || []);

            const { data: rows } = await Boako.db
                .from('user_achievements')
                .select('id, meta, season_no, achievements(*)')
                .eq('user_id', Boako.state.user.id)
                .order('achieved_at', { ascending: true });

            const unseen = (rows || []).filter(r => !confirmedIds.has(r.id));
            if (unseen.length === 0) return;

            // 🌟 풀스크린 오버레이는 겹치면 안 되니, 한 번에 다 넣어도 큐가 순서대로 하나씩 보여줌
            unseen.forEach(row => {
                if (row.achievements) Boako.Achievements.enqueueOverlay(row.achievements, row.meta, row.season_no, row.id);
            });

            await Boako.Achievements.markConfirmed(unseen.map(r => r.id));
        } catch (e) {
            console.error('미확인 업적 체크 실패:', e);
        }
    },

    // 🌟 업적(user_achievements.id 목록)을 "확인함"으로 profiles.tutorial_status에 기록
    markConfirmed: async (ids) => {
        if (!ids || ids.length === 0 || !Boako.state.user) return;
        try {
            const { data: profile } = await Boako.db.from('profiles')
                .select('tutorial_status')
                .eq('id', Boako.state.user.id)
                .single();
            let status = profile?.tutorial_status || {};
            const confirmedIds = new Set(status.confirmed_achievement_ids || []);
            ids.forEach(id => confirmedIds.add(id));
            status.confirmed_achievement_ids = [...confirmedIds];
            await Boako.db.from('profiles').update({ tutorial_status: status }).eq('id', Boako.state.user.id);
        } catch (e) {
            console.error('업적 확인 상태 저장 실패:', e);
        }
    },

    stopRealtime: () => {
        if (Boako.Achievements.channel && Boako.db) {
            Boako.db.removeChannel(Boako.Achievements.channel);
            Boako.Achievements.channel = null;
        }
    },

    // ========== 🌟 풀스크린 오버레이 큐 (여러 개 놓친 업적이 한꺼번에 뜨면 겹치지 않게 순서대로) ==========
    _overlayQueue: [],
    _overlayShowing: false,

    enqueueOverlay: (achievement, meta, seasonNo, uaId) => {
        Boako.Achievements._overlayQueue.push({ achievement, meta, seasonNo, uaId });
        Boako.Achievements._processOverlayQueue();
    },

    _processOverlayQueue: async () => {
        if (Boako.Achievements._overlayShowing) return;
        const next = Boako.Achievements._overlayQueue.shift();
        if (!next) return;
        Boako.Achievements._overlayShowing = true;
        await Boako.Achievements.showToast(next.achievement, next.meta, next.seasonNo, next.uaId);
        Boako.Achievements._overlayShowing = false;
        Boako.Achievements._processOverlayQueue();
    },

    // 🌟 [전면 교체] 주사위 굴림(showDiceRollOverlay)과 같은 톤의 풀스크린 축하 오버레이.
    // 클릭해야만 닫힘(자동 닫힘 없음). Promise를 반환해서 큐가 "닫힌 뒤에" 다음 걸 보여줄 수 있게 함.
    showToast: (achievement, meta, seasonNo, uaId) => {
        return new Promise(async (resolve) => {
            Boako.Achievements.injectStyle();

            const gameName = meta && meta.game_name ? meta.game_name : null;

            // 🌟 시즌 로고/OO매니아 게임 로고까지 합성된 배지 HTML (정사각형 강제 없이 원본 비율 유지)
            const itemId = uaId ? `achv_${achievement.code}_${uaId}` : null;
            let badgeHtml = itemId ? await Boako.Achievements.renderBadgeHTML(itemId, seasonNo, meta, 140) : null;
            if (!badgeHtml) {
                badgeHtml = achievement.badge_icon_url
                    ? `<img src="${Boako.Util.cdn(achievement.badge_icon_url)}" style="height:140px; width:auto; display:block;">`
                    : `<div style="font-size:100px; line-height:1;">🏅</div>`;
            }

            const overlay = document.createElement('div');
            overlay.id = 'achv-fullscreen-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                background:rgba(15,23,42,0.6); backdrop-filter:blur(3px); cursor:pointer;
                opacity:0; transition:opacity .25s ease;
            `;
            overlay.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; padding:20px; max-width:420px;">
                    <div class="achv-badge-pop" style="display:flex; align-items:center; justify-content:center;">${badgeHtml}</div>
                    <div style="font-size:13px; font-weight:900; color:#c4b5fd; letter-spacing:0.12em; text-transform:uppercase;">🏅 업적 달성!</div>
                    <div style="font-size:26px; font-weight:900; color:#fff; text-shadow:0 4px 14px rgba(0,0,0,0.45); line-height:1.35;">
                        ${achievement.name}${gameName ? `<br><span style="font-size:16px; color:#cbd5e1; font-weight:700;">(${gameName})</span>` : ''}
                    </div>
                    <div style="font-size:16px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,0.3); padding:7px 20px; border-radius:999px;">
                        +${Number(achievement.point_reward || 0).toLocaleString()} P 획득
                    </div>
                    <div style="font-size:11px; font-weight:700; color:rgba(255,255,255,0.6); margin-top:6px;">화면을 탭하면 닫혀요</div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => { overlay.style.opacity = '1'; });

            if (window.lucide) window.lucide.createIcons();
            try { if (window.sfx && window.sfx.success) window.sfx.success(); } catch (e) { /* 자동재생 정책으로 인한 무음은 무시 */ }

            let dismissed = false;
            const dismiss = () => {
                if (dismissed) return;
                dismissed = true;
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.remove(); resolve(); }, 250);
            };
            overlay.addEventListener('click', dismiss);
        });
    },

    // ========== 🌟 배지 합성 렌더링 공용 함수 (인벤토리/위젯/오버레이 전부 공유) ==========
    // item_id 형식: achv_<code>_<user_achievements.id> — 획득할 때마다 별도 인스턴스라 매번 파싱해서 조회
    _achievementCache: {},
    _seasonLogoCache: {},
    _gameLogoCache: {},

    parseAchievementItemId: (itemId) => {
        if (!itemId) return null;
        const m = String(itemId).match(/^achv_(.+)_(\d+)$/);
        if (!m) return null;
        return { code: m[1], uaId: m[2] };
    },

    getAchievementByCode: async (code) => {
        if (Boako.Achievements._achievementCache[code] !== undefined) return Boako.Achievements._achievementCache[code];
        const { data } = await Boako.db.from('achievements').select('*').eq('code', code).maybeSingle();
        Boako.Achievements._achievementCache[code] = data || null;
        return data || null;
    },

    getSeasonLogo: async (seasonNo) => {
        if (!seasonNo) return null;
        if (Boako.Achievements._seasonLogoCache[seasonNo] !== undefined) return Boako.Achievements._seasonLogoCache[seasonNo];
        const { data } = await Boako.db.from('seasons').select('season_logo_url').eq('season_no', seasonNo).maybeSingle();
        const url = data?.season_logo_url || null;
        Boako.Achievements._seasonLogoCache[seasonNo] = url;
        return url;
    },

    getGameLogo: async (gameName) => {
        if (!gameName) return null;
        if (Boako.Achievements._gameLogoCache[gameName] !== undefined) return Boako.Achievements._gameLogoCache[gameName];
        const { data } = await Boako.db.from('games').select('image_url').eq('game_name', gameName).maybeSingle();
        const url = data?.image_url || null;
        Boako.Achievements._gameLogoCache[gameName] = url;
        return url;
    },

    // 🌟 배지 HTML 생성 (비동기). itemId가 achv_ 형식이 아니면 null 반환(호출부에서 기존 방식으로 폴백).
    // sizePx는 "높이" 기준 — 배경 이미지 원본 비율을 그대로 유지하고, 정사각형으로 강제 크롭하지 않음.
    renderBadgeHTML: async (itemId, seasonNo, meta, sizePx) => {
        sizePx = sizePx || 48;
        const parsed = Boako.Achievements.parseAchievementItemId(itemId);
        if (!parsed) return null;

        const achievement = await Boako.Achievements.getAchievementByCode(parsed.code);
        const fallbackEmoji = `<div style="width:${sizePx}px; height:${sizePx}px; display:flex; align-items:center; justify-content:center; font-size:${Math.round(sizePx * 0.6)}px;">🏅</div>`;
        if (!achievement) return fallbackEmoji;

        const gameName = meta && meta.game_name ? meta.game_name : null;

        // OO매니아: 배경 없이 게임 로고 + 티어(동/은/금) 테두리로 합성
        if (achievement.code.startsWith('game_mania_')) {
            const tier = Boako.Achievements.getTierStyle(achievement.name);
            const gameLogo = await Boako.Achievements.getGameLogo(gameName);
            const pad = Math.max(2, Math.round(sizePx * 0.06));
            return `
                <div style="width:${sizePx}px; height:${sizePx}px; border-radius:${Math.round(sizePx * 0.22)}px; background:${tier.bg}; padding:${pad}px; box-shadow:0 0 0 2px ${tier.ring}55; box-sizing:border-box;">
                    <div style="width:100%; height:100%; border-radius:${Math.round(sizePx * 0.18)}px; background:#fff; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        ${gameLogo ? `<img src="${Boako.Util.cdn(gameLogo)}" style="width:82%; height:82%; object-fit:contain;">` : `<span style="font-size:${Math.round(sizePx * 0.5)}px;">🎲</span>`}
                    </div>
                </div>
            `;
        }

        if (!achievement.badge_icon_url) return fallbackEmoji;

        // 🌟 시즌형 배지: 배경 위에 그 인스턴스가 획득된 시즌의 로고를 겹쳐 그림
        let overlayHtml = '';
        if (achievement.season_logo_overlay && seasonNo) {
            const seasonLogo = await Boako.Achievements.getSeasonLogo(seasonNo);
            if (seasonLogo) {
                const ov = achievement.season_logo_overlay;
                overlayHtml = `<img src="${Boako.Util.cdn(seasonLogo)}" style="position:absolute; top:${ov.top}; left:${ov.left}; width:${ov.width}; height:${ov.height}; object-fit:contain; transform:translate(-50%,-50%) rotate(${ov.rotate || 0}deg); pointer-events:none;">`;
            }
        }

        // 🌟 정사각형 강제 금지: 높이만 고정하고 폭은 원본 비율 그대로(auto)
        return `
            <div style="height:${sizePx}px; position:relative; display:inline-block; vertical-align:middle;">
                <img src="${Boako.Util.cdn(achievement.badge_icon_url)}" style="height:100%; width:auto; display:block;">
                ${overlayHtml}
            </div>
        `;
    }
};
