/**
 * [SCHEDULE] 아카이브 일정 관리 및 전광판
 */
Boako.Schedule = {
    // ==========================================
    // ⚙️ 1. 데이터/통신 코어 (API)
    // ==========================================
    
    // 확정된 경기 일정 가져오기
    getSchedules: async (statusFilter = 'UPCOMING') => {
        try {
            const { data, error } = await Boako.db
                .from('match_schedules')
                .select('*')
                .eq('status', statusFilter) // UPCOMING(예정), COMPLETED(완료), CANCELED(취소)
                .order('scheduled_time', { ascending: true });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error("일정 로드 오류:", err);
            Boako.Util.toast("❌ 일정을 불러오지 못했습니다.");
            return [];
        }
    },

    // ==========================================
    // 🎨 2. 프론트엔드 UI 화면 렌더링 (View)
    // ==========================================
    View: {
        renderMain: async () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            if (!container) return;

            container.innerHTML = `<div style="text-align:center; padding:50px;">일정표 불러오는 중... ⏳</div>`;
            
            // 다가오는 일정(UPCOMING) 데이터 호출
            const schedules = await Boako.Schedule.getSchedules('UPCOMING');
            
            let html = `
                <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📅 BOAKO 공식 일정표</h2>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (schedules.length === 0) {
                html += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px;">예정된 매치가 없습니다.</div>`;
            } else {
                schedules.forEach(sch => {
                    // 날짜 포맷팅 (예: 5월 30일 (목) 오후 8:00)
                    const dateObj = new Date(sch.scheduled_time);
                    const dateStr = dateObj.toLocaleString('ko-KR', { 
                        month: 'short', day: 'numeric', weekday: 'short', 
                        hour: 'numeric', minute: '2-digit', hour12: true 
                    });

                    // 매치 타입 라벨링
                    let typeBadge = '';
                    if (sch.match_type === 'RIVAL') typeBadge = `<span style="background:#ef4444; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">라이벌전</span>`;
                    else if (sch.match_type === 'LEAGUE') typeBadge = `<span style="background:#3b82f6; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">공식리그</span>`;
                    else typeBadge = `<span style="background:#10b981; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">친선전</span>`;

                    // 🚀 외래키 CASCADE로 자동 동기화된 닉네임 즉시 사용 (서버 부하 제로)
                    const player1 = sch.proposer_name_override || '알 수 없음';
                    const player2 = sch.responder_name_override || '알 수 없음';

                    html += `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding: 16px 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            
                            <div style="flex: 1;">
                                <div style="font-size:13px; color:#64748b; font-weight:600; margin-bottom:4px;">${dateStr}</div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${typeBadge}
                                    <span style="font-size:16px; font-weight:bold; color:#0f172a;">${sch.game_name}</span>
                                </div>
                            </div>
                            
                            <div style="flex: 1; text-align:right; font-size:16px; font-weight:bold; color:#1e293b; display:flex; align-items:center; justify-content:flex-end; gap:12px;">
                                <span style="background:#f1f5f9; padding:4px 12px; border-radius:6px;">${player1}</span>
                                <span style="color:#ef4444; font-size:14px;">VS</span>
                                <span style="background:#f1f5f9; padding:4px 12px; border-radius:6px;">${player2}</span>
                            </div>

                        </div>
                    `;
                });
            }

            html += `</div></div>`;
            container.innerHTML = html;
        }
    }
};
