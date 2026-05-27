/**
 * [SCHEDULE] 아카이브 일정 관리 및 캘린더 전광판
 */
Boako.Schedule = {
    schedulesData: [],
    currentDate: new Date(), // 달력 렌더링 기준 (연/월)
    selectedDateStr: null,   // 유저가 클릭한 날짜 (YYYY-MM-DD)

    // ==========================================
    // ⚙️ 1. 데이터/통신 코어 (API)
    // ==========================================
    getSchedules: async (statusFilter = 'UPCOMING') => {
        try {
            const { data, error } = await Boako.db
                .from('match_schedules')
                .select('*')
                .eq('status', statusFilter)
                .order('scheduled_time', { ascending: true });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error("일정 로드 오류:", err);
            Boako.Util.toast("❌ 일정을 불러오지 못했습니다.");
            return [];
        }
    },

    // Date 객체를 YYYY-MM-DD 형식의 문자열로 변환하는 헬퍼 함수
    formatDateStr: (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    // ==========================================
    // 🎨 2. 프론트엔드 UI 화면 렌더링 (View)
    // ==========================================
    View: {
        renderMain: async () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            if (!container) return;

            container.innerHTML = `<div style="text-align:center; padding:50px;">캘린더 불러오는 중... ⏳</div>`;
            
            // 데이터 로드
            Boako.Schedule.schedulesData = await Boako.Schedule.getSchedules('UPCOMING');
            
            // 초기 세팅: 오늘 날짜로 달력 및 리스트 맞춤
            const today = new Date();
            Boako.Schedule.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            Boako.Schedule.selectedDateStr = Boako.Schedule.formatDateStr(today);

            Boako.Schedule.View.renderUI();
        },

        renderUI: () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            
            const year = Boako.Schedule.currentDate.getFullYear();
            const month = Boako.Schedule.currentDate.getMonth();
            
            const firstDay = new Date(year, month, 1).getDay(); // 이번 달 1일의 요일
            const lastDate = new Date(year, month + 1, 0).getDate(); // 이번 달 마지막 날짜
            
            const todayStr = Boako.Schedule.formatDateStr(new Date());

            // 📌 날짜별로 일정을 분류하여 맵핑 (달력에 점 찍기 위함)
            const scheduleMap = {};
            Boako.Schedule.schedulesData.forEach(sch => {
                const dStr = Boako.Schedule.formatDateStr(new Date(sch.scheduled_time));
                if (!scheduleMap[dStr]) scheduleMap[dStr] = [];
                scheduleMap[dStr].push(sch);
            });

            // 📅 1. 달력 UI 생성 시작
            const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
            let calendarHtml = `
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center; font-weight:bold; color:#64748b; margin-bottom:8px; font-size:14px;">
                    ${daysOfWeek.map((day, idx) => `<div style="${idx === 0 ? 'color:#ef4444;' : idx === 6 ? 'color:#3b82f6;' : ''}">${day}</div>`).join('')}
                </div>
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;">
            `;

            // 1일 이전의 빈 칸 채우기
            for (let i = 0; i < firstDay; i++) {
                calendarHtml += `<div style="min-height:50px; padding:5px;"></div>`;
            }

            // 실제 날짜 채우기
            for (let i = 1; i <= lastDate; i++) {
                const cellDateStr = Boako.Schedule.formatDateStr(new Date(year, month, i));
                const isToday = cellDateStr === todayStr;
                const isSelected = cellDateStr === Boako.Schedule.selectedDateStr;
                const dailySchedules = scheduleMap[cellDateStr] || [];
                const hasSchedule = dailySchedules.length > 0;
                
                // 일요일(0)은 빨간색, 토요일(6)은 파란색
                const dayOfWeek = new Date(year, month, i).getDay();
                const dayColor = dayOfWeek === 0 ? '#ef4444' : (dayOfWeek === 6 ? '#3b82f6' : '#1e293b');
                
                // 선택 상태 및 오늘 날짜 강조 스타일
                const bgStyle = isSelected ? 'background:#3b82f6; color:white;' : (isToday ? 'background:#f1f5f9; font-weight:bold;' : 'background:white;');
                const fontColor = isSelected ? 'white' : dayColor;
                const borderStyle = isSelected ? 'border:1px solid #3b82f6;' : 'border:1px solid #e2e8f0;';

                calendarHtml += `
                    <div onclick="Boako.Schedule.View.selectDate('${cellDateStr}')" style="min-height:60px; padding:8px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; ${bgStyle} ${borderStyle} transition:all 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <span style="font-size:14px; color:${fontColor};">${i}</span>
                        ${hasSchedule ? `<div style="margin-top:auto; display:flex; gap:3px;">
                            ${dailySchedules.slice(0,3).map(() => `<div style="width:6px; height:6px; border-radius:50%; background:${isSelected ? 'white' : '#f59e0b'};"></div>`).join('')}
                            ${dailySchedules.length > 3 ? `<span style="font-size:10px; font-weight:900; color:${isSelected ? 'white' : '#94a3b8'}; line-height:6px;">+</span>` : ''}
                        </div>` : ''}
                    </div>
                `;
            }
            calendarHtml += `</div>`;

            // 📌 2. 하단 선택된 날짜의 일정 리스트 렌더링
            const targetSchedules = scheduleMap[Boako.Schedule.selectedDateStr] || [];
            let listHtml = `
                <div style="margin-top:20px; border-top:2px dashed #e2e8f0; padding-top:20px;">
                    <h3 style="font-size:18px; font-weight:900; margin-bottom:15px; color:#0f172a; display:flex; align-items:center; gap:8px;">
                        🎯 ${Boako.Schedule.selectedDateStr.split('-')[1]}월 ${Boako.Schedule.selectedDateStr.split('-')[2]}일 매치 일정
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (targetSchedules.length === 0) {
                listHtml += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">이 날짜에 예정된 매치가 없습니다.</div>`;
            } else {
                targetSchedules.forEach(sch => {
                    const dateObj = new Date(sch.scheduled_time);
                    const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });

                    let typeBadge = '';
                    if (sch.match_type === 'RIVAL') typeBadge = `<span style="background:#ef4444; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">⚔️ 라이벌전</span>`;
                    else if (sch.match_type === 'LEAGUE') typeBadge = `<span style="background:#3b82f6; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">🏆 공식리그</span>`;
                    else typeBadge = `<span style="background:#10b981; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">🤝 친선전</span>`;

                    const player1 = sch.proposer_name_override || '알 수 없음';
                    const player2 = sch.responder_name_override || '알 수 없음';

                    listHtml += `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding: 16px 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition:all 0.2s;">
                            <div style="flex: 1;">
                                <div style="font-size:13px; color:#64748b; font-weight:800; margin-bottom:6px;">⏰ ${timeStr}</div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${typeBadge}
                                    <span style="font-size:16px; font-weight:900; color:#0f172a;">${sch.game_name}</span>
                                </div>
                            </div>
                            <div style="flex: 1; text-align:right; font-size:16px; font-weight:bold; color:#1e293b; display:flex; align-items:center; justify-content:flex-end; gap:12px;">
                                <span style="background:#f1f5f9; padding:6px 14px; border-radius:8px;">${player1}</span>
                                <span style="color:#ef4444; font-size:14px;">VS</span>
                                <span style="background:#f1f5f9; padding:6px 14px; border-radius:8px;">${player2}</span>
                            </div>
                        </div>
                    `;
                });
            }
            listHtml += `</div></div>`;

            // 최종 HTML 조립
            let finalHtml = `
                <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📅 BOAKO 공식 캘린더</h2>
                        <button onclick="Boako.Schedule.View.showAllSchedules()" style="padding:8px 14px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; color:#334155;">📜 전체 리스트 보기</button>
                    </div>
                    
                    <div class="section-card" style="margin-bottom:10px; padding:25px; background:white;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                            <button onclick="Boako.Schedule.View.changeMonth(-1)" style="border:none; background:#f8fafc; width:36px; height:36px; border-radius:50%; font-size:16px; cursor:pointer; color:#64748b; font-weight:bold; transition:all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">◀</button>
                            <h3 style="margin:0; font-size:20px; font-weight:900; color:#0f172a;">${year}년 ${month + 1}월</h3>
                            <button onclick="Boako.Schedule.View.changeMonth(1)" style="border:none; background:#f8fafc; width:36px; height:36px; border-radius:50%; font-size:16px; cursor:pointer; color:#64748b; font-weight:bold; transition:all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">▶</button>
                        </div>
                        ${calendarHtml}
                    </div>

                    ${listHtml}
                </div>
            `;

            container.innerHTML = finalHtml;
        },

        // 달력 이동
        changeMonth: (offset) => {
            const cur = Boako.Schedule.currentDate;
            Boako.Schedule.currentDate = new Date(cur.getFullYear(), cur.getMonth() + offset, 1);
            // 달을 넘기면 그 달의 1일로 포커스 이동
            Boako.Schedule.selectedDateStr = Boako.Schedule.formatDateStr(Boako.Schedule.currentDate);
            Boako.Schedule.View.renderUI();
        },

        // 특정 날짜 클릭
        selectDate: (dateStr) => {
            Boako.Schedule.selectedDateStr = dateStr;
            Boako.Schedule.View.renderUI();
        },

        // 📜 전체 일정 리스트 모드로 덮어쓰기
        showAllSchedules: () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            let html = `
                <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📜 전체 예정 매치 리스트</h2>
                        <button onclick="Boako.Schedule.View.renderUI()" style="padding:8px 14px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; color:#334155;">◀ 달력으로 돌아가기</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (Boako.Schedule.schedulesData.length === 0) {
                html += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">예정된 매치가 없습니다.</div>`;
            } else {
                Boako.Schedule.schedulesData.forEach(sch => {
                    const dateObj = new Date(sch.scheduled_time);
                    const dateStr = dateObj.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
                    const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });

                    let typeBadge = '';
                    if (sch.match_type === 'RIVAL') typeBadge = `<span style="background:#ef4444; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">⚔️ 라이벌전</span>`;
                    else if (sch.match_type === 'LEAGUE') typeBadge = `<span style="background:#3b82f6; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">🏆 공식리그</span>`;
                    else typeBadge = `<span style="background:#10b981; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold;">🤝 친선전</span>`;

                    const player1 = sch.proposer_name_override || '알 수 없음';
                    const player2 = sch.responder_name_override || '알 수 없음';

                    html += `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding: 16px 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="flex: 1;">
                                <div style="font-size:13px; color:#64748b; font-weight:800; margin-bottom:6px;">${dateStr} ${timeStr}</div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${typeBadge}
                                    <span style="font-size:16px; font-weight:900; color:#0f172a;">${sch.game_name}</span>
                                </div>
                            </div>
                            <div style="flex: 1; text-align:right; font-size:16px; font-weight:bold; color:#1e293b; display:flex; align-items:center; justify-content:flex-end; gap:12px;">
                                <span style="background:#f1f5f9; padding:6px 14px; border-radius:8px;">${player1}</span>
                                <span style="color:#ef4444; font-size:14px;">VS</span>
                                <span style="background:#f1f5f9; padding:6px 14px; border-radius:8px;">${player2}</span>
                            </div>
                        </div>
                    `;
                });
            }
            html += `</div></div>`;
            
            // 🚀 여기서 중복 선언되어 있던 `const container = ...` 부분을 삭제하고 바로 innerHTML 주입!
            container.innerHTML = html;
        }
    }
};
