/**
 * [RIVAL RECOMMEND] ⑤번 활성화 시나리오 — 개인 기록형(기록 있음, 라이벌전 0건, 팀 무소속) 유저에게
 * 로그인 시점에 실제 상대를 추천하는 풀스크린 오버레이.
 * 🌟 [리팩토링] 로그인 시점 실시간 계산(fn_check_rival_recommend_eligibility) 방식에서
 *    크론(fn_enqueue_rival_recommend_overlays) + 대기열(activation_overlay_queue) 방식으로 전환.
 *    이 모듈은 이제 순수 렌더러(showOverlay)만 담당 — 언제/누구에게 보여줄지는
 *    js/activation_dispatch.js가 fn_get_my_activation_overlay()로 대기열을 조회해서 호출해줌.
 * 🌟 대상 조건(DB 쪽에서 판단, 배치 찾기 함수 fn_find_rival_recommend_targets): 게임 기록 있음 +
 *    라이벌전 참여 이력 0건 + 팀 무소속 + 30일 쿨다운 통과.
 * 🌟 "쪽지로 강요하는 느낌" 대신, 실제 추천 상대(가장 많이 한 게임 기준)를 자연스럽게 보여주고
 *    수락(도전장 실제 전송)/거절(라이벌전 메뉴로 이동, 다른 상대 둘러보게 유도) 두 선택지 제공.
 */
Boako.RivalRecommend = {
    // 🌟 사이트의 다른 풀스크린 오버레이(업적/라이벌전결과 등)와 동일한 톤 — 어두운 배경 + 중앙 카드.
    showOverlay: (rec) => {
        return new Promise((resolve) => {
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.innerText = str || '';
                return div.innerHTML;
            };

            const avatarHtml = (url, name, size) => url
                ? `<img src="${url}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; display:block;">`
                : `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:${Math.round(size * 0.4)}px; font-weight:900;">${(name || '?').charAt(0)}</div>`;

            const myAvatar = (Boako.state.customAvatarUrl || Boako.state.kakaoAvatarUrl || null);
            const myName = Boako.state.user?.nickname || '나';
            const gameLogo = rec.game_logo_url ? Boako.Util.cdn(rec.game_logo_url) : null;

            const overlay = document.createElement('div');
            overlay.id = 'rival-recommend-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                background:rgba(15,23,42,0.75); backdrop-filter:blur(3px);
                opacity:0; transition:opacity .25s ease;
            `;
            overlay.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:440px;">
                    <div style="font-size:12px; font-weight:900; color:#94a3b8; letter-spacing:0.14em; text-transform:uppercase;">⚔️ 라이벌전 추천</div>

                    <div style="width:64px; height:64px; border-radius:16px; background:#fff; display:flex; align-items:center; justify-content:center; padding:8px;">
                        ${gameLogo ? `<img src="${gameLogo}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span style="font-size:28px;">🎲</span>`}
                    </div>
                    <div style="font-size:20px; font-weight:900; color:#fff;">${escapeHtml(rec.game_name)}</div>

                    <div style="display:flex; align-items:center; justify-content:center; gap:16px; margin-top:4px;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                            ${avatarHtml(myAvatar, myName, 60)}
                            <div style="font-size:13px; font-weight:800; color:#fff;">${escapeHtml(myName)}</div>
                            <div style="font-size:11px; font-weight:700; color:#94a3b8;">${rec.my_record_count}판</div>
                        </div>
                        <div style="font-size:18px; font-weight:900; color:#64748b; font-style:italic;">VS</div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                            ${avatarHtml(rec.rival_profile_url, rec.rival_nickname, 60)}
                            <div style="font-size:13px; font-weight:800; color:#fff;">${escapeHtml(rec.rival_nickname)}</div>
                            <div style="font-size:11px; font-weight:700; color:#94a3b8;">${rec.rival_record_count}판</div>
                        </div>
                    </div>

                    <p style="font-size:13px; font-weight:700; color:#cbd5e1; line-height:1.6; margin:4px 0 0;">
                        ${escapeHtml(rec.rival_nickname)} 님과 라이벌전 한 번 해보실래요?<br>
                        같은 게임을 즐기는 분과 라이벌전을 하면,<br>
                        서로 응원하며 재밌게 승부를 겨룰 수 있어요!
                    </p>

                    <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
                        <button id="rival-recommend-reject-btn" style="flex:1; background:rgba(255,255,255,0.08); color:#cbd5e1; font-weight:800; font-size:13px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); cursor:pointer;">
                            다음에 할게요
                        </button>
                        <button id="rival-recommend-accept-btn" style="flex:1.4; background:#fff; color:#0f172a; font-weight:900; font-size:13px; padding:12px; border-radius:12px; border:none; cursor:pointer;">
                            도전장 보내기
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => { overlay.style.opacity = '1'; });

            let dismissed = false;
            const dismiss = () => {
                if (dismissed) return;
                dismissed = true;
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.remove(); resolve(); }, 250);
            };

            document.getElementById('rival-recommend-accept-btn')?.addEventListener('click', async () => {
                const btn = document.getElementById('rival-recommend-accept-btn');
                btn.disabled = true;
                btn.innerText = '전송 중...';
                try {
                    await Boako.db.rpc('fn_respond_rival_recommend', {
                        p_accept: true,
                        p_rival_id: rec.rival_id,
                        p_game_name: rec.game_name
                    }).then(({ error }) => { if (error) throw error; });
                    if (window.sfx?.success) window.sfx.success();
                    Boako.Util.toast(`⚔️ ${rec.rival_nickname}님에게 도전장을 보냈어요!`);
                } catch (e) {
                    console.error('라이벌전 도전장 전송 실패:', e);
                    Boako.Util.toast('❌ ' + (e.message || '도전장 전송에 실패했습니다.'));
                }
                dismiss();
            });

            document.getElementById('rival-recommend-reject-btn')?.addEventListener('click', async () => {
                try {
                    await Boako.db.rpc('fn_respond_rival_recommend', { p_accept: false })
                        .then(({ error }) => { if (error) throw error; });
                } catch (e) {
                    console.error('라이벌전 추천 거절 처리 실패:', e);
                }
                dismiss();
                // 🌟 거절해도 라이벌전 자체엔 흥미가 있을 수 있으니, 다른 상대도 둘러보게 메뉴로 유도
                setTimeout(() => {
                    Boako.Util.toast('다른 라이벌전도 한번 둘러보세요 👀');
                    Boako.View.render('rival');
                }, 300);
            });
        });
    }
};
