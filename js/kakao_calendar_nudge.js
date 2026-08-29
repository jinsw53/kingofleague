/**
 * [KAKAO CALENDAR NUDGE] ⑧번 활성화 시나리오 — 캘린더 등록 API가 -402(동의 부족)로 실패한 적 있는
 * 유저에게 로그인 시점에 "톡캘린더 다시 연동하기"를 제안하는 풀스크린 오버레이.
 * 🌟 대상/타이밍은 DB 쪽에서 판단(fn_find_kakao_calendar_nudge_targets, 30일 쿨다운) — 이 모듈은
 *    순수 렌더러(showOverlay)만 담당. js/social_activation.js와 동일한 구조/톤.
 * 🌟 "지금 연동하기" = Boako.Auth.login() 재호출 → talk_calendar가 선택동의로 전환됐으므로
 *    카카오 로그인 화면에 체크박스가 다시 뜸(2026-08-29 콘솔 설정 변경, 톡캘린더 동의 부족(-402) 조사 참고).
 * 🌟 수락/거절 상관없이 fn_respond_kakao_calendar_nudge() 호출 — 30일 쿨다운만 기록, 대기열에서 제거.
 */
Boako.KakaoCalendarNudge = {
    showOverlay: () => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'kakao-calendar-nudge-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center;
                background:rgba(15,23,42,0.75); backdrop-filter:blur(3px);
                opacity:0; transition:opacity .25s ease;
            `;
            overlay.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center; padding:28px; max-width:420px;">
                    <div style="font-size:12px; font-weight:900; color:#94a3b8; letter-spacing:0.14em; text-transform:uppercase;">🔔 캘린더 알림 제안</div>

                    <div style="width:64px; height:64px; border-radius:16px; background:#fff; display:flex; align-items:center; justify-content:center;">
                        <span style="font-size:30px;">🗓️</span>
                    </div>

                    <div style="font-size:19px; font-weight:900; color:#fff; line-height:1.4;">톡캘린더 연동이 꺼져있어요</div>

                    <p style="font-size:13px; font-weight:700; color:#cbd5e1; line-height:1.6; margin:0;">
                        토너먼트·매치 일정을 카카오톡 캘린더로 자동 등록해드리는데,<br>
                        아직 연동이 안 돼있어서 알림을 못 보내드리고 있어요.<br>
                        지금 다시 로그인해서 연동해보시겠어요?
                    </p>

                    <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
                        <button id="kakao-calendar-nudge-accept-btn" style="flex:1.4; background:#fff; color:#0f172a; font-weight:900; font-size:13px; padding:12px; border-radius:12px; border:none; cursor:pointer;">
                            지금 연동하기
                        </button>
                        <button id="kakao-calendar-nudge-reject-btn" style="flex:1; background:rgba(255,255,255,0.08); color:#cbd5e1; font-weight:800; font-size:13px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); cursor:pointer;">
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

            // 🌟 수락 = 30일 쿨다운 기록 후 카카오 재로그인 트리거(talk_calendar 재동의 화면 노출).
            //    로그인은 페이지 리다이렉트를 동반하므로, 응답 기록이 끝난 뒤 바로 로그인 흐름으로 넘어감.
            document.getElementById('kakao-calendar-nudge-accept-btn')?.addEventListener('click', async () => {
                try {
                    await Boako.db.rpc('fn_respond_kakao_calendar_nudge')
                        .then(({ error }) => { if (error) throw error; });
                } catch (e) {
                    console.error('캘린더 동의 재유도 응답 처리 실패:', e);
                }
                dismiss();
                setTimeout(() => {
                    Boako.Auth.login();
                }, 300);
            });

            // 🌟 거절 = 아무 행동 없이 30일 쿨다운만 기록.
            document.getElementById('kakao-calendar-nudge-reject-btn')?.addEventListener('click', async () => {
                try {
                    await Boako.db.rpc('fn_respond_kakao_calendar_nudge')
                        .then(({ error }) => { if (error) throw error; });
                } catch (e) {
                    console.error('캘린더 동의 재유도 응답 처리 실패:', e);
                }
                dismiss();
            });
        });
    }
};
