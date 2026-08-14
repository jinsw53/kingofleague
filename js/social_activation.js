/**
 * [SOCIAL ACTIVATION] ⑥번 활성화 시나리오 — 개인 소셜형(기록 있음, 라이벌전 1건↑, 팀 무소속) 유저에게
 * 로그인 시점에 다음 단계(토너먼트 참가 또는 팀 창단)를 제안하는 풀스크린 오버레이.
 * 🌟 [리팩토링] 로그인 시점 실시간 계산(fn_check_social_activation_eligibility) 방식에서
 *    크론(fn_enqueue_social_activation_overlays) + 대기열(activation_overlay_queue) 방식으로 전환.
 *    이 모듈은 이제 순수 렌더러(showOverlay)만 담당 — 언제/누구에게 보여줄지는
 *    js/activation_dispatch.js가 fn_get_my_activation_overlay()로 대기열을 조회해서 호출해줌.
 * 🌟 대상 조건(DB 쪽에서 판단, 배치 찾기 함수 fn_find_social_activation_targets): 게임 기록 있음 +
 *    라이벌전 참여 이력 1건↑ + 팀 무소속 + 30일 쿨다운 통과.
 * 🌟 토너먼트 참가 이력 유무로 분기: 없으면 'tournament' 타입(토너먼트 유도), 있으면 'team' 타입(팀 창단 유도).
 * 🌟 실제 참가/창단은 시스템이 대신 못 하므로, "수락"은 해당 페이지로 이동만 함 — ⑤번(자동 도전장 전송)과 다름.
 */
Boako.SocialActivation = {
    // 🌟 사이트의 다른 풀스크린 오버레이(⑤번 라이벌전 추천 등)와 동일한 톤 — 어두운 배경 + 중앙 카드.
    showOverlay: (targetType) => {
        return new Promise((resolve) => {
            const isTeam = targetType === 'team';
            const badgeText = isTeam ? '🏆 팀 창단 제안' : '⚔️ 토너먼트 제안';
            const emoji = isTeam ? '🚩' : '🏟️';
            const title = isTeam ? '이제 팀을 만들어보실래요?' : '토너먼트도 한번 참가해보실래요?';
            const bodyText = isTeam
                ? '라이벌전까지 즐기셨다면, 팀을 만들어서<br>동료들과 함께 리그에 도전해보는 건 어떠세요?'
                : '라이벌전까지 즐기셨다면, 더 큰 무대인<br>토너먼트에서 다른 유저들과 실력을 겨뤄보세요!';
            const acceptLabel = isTeam ? '팀 만들러 가기' : '토너먼트 둘러보기';

            const overlay = document.createElement('div');
            overlay.id = 'social-activation-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                background:rgba(15,23,42,0.75); backdrop-filter:blur(3px);
                opacity:0; transition:opacity .25s ease;
            `;
            overlay.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:420px;">
                    <div style="font-size:12px; font-weight:900; color:#94a3b8; letter-spacing:0.14em; text-transform:uppercase;">${badgeText}</div>

                    <div style="width:64px; height:64px; border-radius:16px; background:#fff; display:flex; align-items:center; justify-content:center;">
                        <span style="font-size:30px;">${emoji}</span>
                    </div>

                    <div style="font-size:19px; font-weight:900; color:#fff; line-height:1.4;">${title}</div>

                    <p style="font-size:13px; font-weight:700; color:#cbd5e1; line-height:1.6; margin:0;">
                        ${bodyText}
                    </p>

                    <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
                        <button id="social-activation-accept-btn" style="flex:1.4; background:#fff; color:#0f172a; font-weight:900; font-size:13px; padding:12px; border-radius:12px; border:none; cursor:pointer;">
                            ${acceptLabel}
                        </button>
                        <button id="social-activation-reject-btn" style="flex:1; background:rgba(255,255,255,0.08); color:#cbd5e1; font-weight:800; font-size:13px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); cursor:pointer;">
                            다음에 할게요
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

            // 🌟 수락 = 30일 쿨다운 기록 후 해당 페이지로 이동. 실제 참가/창단은 유저가 그 페이지에서 직접 진행.
            document.getElementById('social-activation-accept-btn')?.addEventListener('click', async () => {
                try {
                    await Boako.db.rpc('fn_respond_social_activation', { p_target_type: targetType })
                        .then(({ error }) => { if (error) throw error; });
                } catch (e) {
                    console.error('개인 소셜형 활성화 응답 처리 실패:', e);
                }
                dismiss();
                setTimeout(() => {
                    Boako.View.render(isTeam ? 'team_list' : 'tournament');
                }, 300);
            });

            // 🌟 거절 = 아무 행동 없이 30일 쿨다운만 기록.
            document.getElementById('social-activation-reject-btn')?.addEventListener('click', async () => {
                try {
                    await Boako.db.rpc('fn_respond_social_activation', { p_target_type: targetType })
                        .then(({ error }) => { if (error) throw error; });
                } catch (e) {
                    console.error('개인 소셜형 활성화 응답 처리 실패:', e);
                }
                dismiss();
            });
        });
    }
};
