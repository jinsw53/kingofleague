/**
 * [SCHEDULE] 아카이브 일정 관리 및 캘린더 전광판 (히트맵 + 다중 콘텐츠 통합)
 * 표시 대상: 라이벌전 / 대항전(본선+밴투표마감+엔트리마감) / 드루와챌린지 / 같이하자 / 토너먼트 / 리그시즌일정
 */
Boako.Schedule = {
    scheduleItems: [],
    currentDate: new Date(),
    selectedDateStr: null,

    TYPE_META: {
        RIVAL:     { color: '#ef4444', icon: '⚡', label: '라이벌전' },
        GRANDPRIX: { color: '#3b82f6', icon: '⚔️', label: '대항전' },
        CHALLENGE: { color: '#f97316', icon: '🔥', label: '드루와! 챌린지' },
        TOGETHER:  { color: '#0ea5e9', icon: '🤝', label: '같이하자' },
        TOURNAMENT:{ color: '#8b5cf6', icon: '🏅', label: '토너먼트' },
        SEASON:    { color: '#f59e0b', icon: '🏆', label: '리그 시즌 일정' }
    },

    fetchAllScheduleItems: async () => {
        const nowIso = new Date().toISOString();
        let items = [];

        // 1. 라이벌전 + 대항전(본선) — match_schedules
        try {
            const { data, error } = await Boako.db
                .from('match_schedules')
                .select('*')
                .order('scheduled_time', { ascending: true });
            if (error) throw error;

            (data || []).forEach(sch => {
                const parts = Array.isArray(sch.participants) ? sch.participants : [];
                const p1 = parts[0]?.player_name || parts[0]?.team_name || '알 수 없음';
                const p2 = parts[1]?.player_name || parts[1]?.team_name || '알 수 없음';
                // FRIENDLY 등 예상 외 값은 안전하게 RIVAL로 폴백 (실사용 안 하기로 함)
                const typeKey = sch.match_type === 'GRANDPRIX' ? 'GRANDPRIX' : 'RIVAL';

                items.push({
                    id: `match_${sch.schedule_id}`,
                    typeKey,
                    scheduled_time: sch.scheduled_time,
                    title: sch.game_name,
                    subtitle: `${p1} VS ${p2}`,
                    linkUrl: null
                });
            });
        } catch (err) {
            console.error("매치 일정 로드 오류:", err);
        }

        // 2. 드루와! 챌린지 — challenges (확정된 일정만)
        try {
            const { data, error } = await Boako.db
                .from('challenges')
                .select('*')
                .not('confirmed_schedule', 'is', null);
            if (error) throw error;

            (data || []).forEach(c => {
                items.push({
                    id: `challenge_${c.id}`,
                    typeKey: 'CHALLENGE',
                    scheduled_time: c.confirmed_schedule,
                    title: c.game_name,
                    subtitle: `${c.attacker_team_name || '공격팀'} VS ${c.defender_team_name || '방어팀 미정'}`,
                    linkUrl: null
                });
            });
        } catch (err) {
            console.error("드루와 챌린지 일정 로드 오류:", err);
        }

        // 3. 같이하자 — 실제 확정(CONFIRMED)된 모임만
        try {
            const { data, error } = await Boako.db
                .from('together_posts')
                .select('*')
                .eq('status', 'CONFIRMED');
            if (error) throw error;

            (data || []).forEach(p => {
                items.push({
                    id: `together_${p.id}`,
                    typeKey: 'TOGETHER',
                    scheduled_time: p.scheduled_date,
                    title: p.title || `${p.game_name || '같이하자'} 모임`,
                    subtitle: `${p.game_name || '종목 미정'} · 참가 ${p.current_count}/${p.max_participants}명`,
                    linkUrl: null
                });
            });
        } catch (err) {
            console.error("같이하자 일정 로드 오류:", err);
        }

        // 4. 토너먼트 — 개최 공지(ANNOUNCEMENT)만
        try {
            const { data, error } = await Boako.db
                .from('tournament_posts')
                .select('*')
                .eq('type', 'ANNOUNCEMENT')
                .not('scheduled_date', 'is', null);
            if (error) throw error;

            (data || []).forEach(p => {
                items.push({
                    id: `tournament_${p.id}`,
                    typeKey: 'TOURNAMENT',
                    scheduled_time: p.scheduled_date,
                    title: p.title,
                    subtitle: p.game_name || '종목 미정',
                    linkUrl: p.source_url || null
                });
            });
        } catch (err) {
            console.error("토너먼트 일정 로드 오류:", err);
        }

        // 5. 리그 시즌 일정 — 시즌 시작일/종료일 + 밴투표 마감(시작+50일) + 엔트리 마감(시작+58일)
            try {
            const { data, error } = await Boako.db
                .from('seasons')
                .select('*');
            if (error) throw error;

            (data || []).forEach(season => {
                const startMs = new Date(season.start_date).getTime();
                const DAY = 24 * 60 * 60 * 1000;

                const banDeadline = new Date(startMs + 50 * DAY).toISOString();
                const entryDeadline = new Date(startMs + 58 * DAY).toISOString();

                items.push({
                    id: `season_start_${season.season_no}`,
                    typeKey: 'SEASON',
                    scheduled_time: season.start_date,
                    title: `시즌 ${season.season_no} 시작`,
                    subtitle: season.title || '',
                    linkUrl: null
                });

                if (banDeadline <= season.end_date) {
                    items.push({
                        id: `season_ban_${season.season_no}`,
                        typeKey: 'GRANDPRIX',
                        scheduled_time: banDeadline,
                        title: `시즌 ${season.season_no} 밴투표 마감`,
                        subtitle: season.title || '',
                        linkUrl: null
                    });
                }
                if (entryDeadline <= season.end_date) {
                    items.push({
                        id: `season_entry_${season.season_no}`,
                        typeKey: 'GRANDPRIX',
                        scheduled_time: entryDeadline,
                        title: `시즌 ${season.season_no} 엔트리 마감`,
                        subtitle: season.title || '',
                        linkUrl: null
                    });
                }
                items.push({
                    id: `season_end_${season.season_no}`,
                    typeKey: 'SEASON',
                    scheduled_time: season.end_date,
                    title: `시즌 ${season.season_no} 종료`,
                    subtitle: season.title || '',
                    linkUrl: null
                });
            });
        } catch (err) {
            console.error("시즌 일정 로드 오류:", err);
        }

        items.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
        return items;
    },

    formatDateStr: (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    View: {
        renderMain: async () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            if (!container) return;

            container.innerHTML = `<div style="text-align:center; padding:50px;">캘린더 불러오는 중... ⏳</div>`;

            Boako.Schedule.scheduleItems = await Boako.Schedule.fetchAllScheduleItems();

            const today = new Date();
            Boako.Schedule.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            Boako.Schedule.selectedDateStr = Boako.Schedule.formatDateStr(today);

            Boako.Schedule.View.renderUI();
        },

        renderItemCard: (item) => {
            const meta = Boako.Schedule.TYPE_META[item.typeKey] || { color: '#64748b', icon: '📌', label: '일정' };
            const dateObj = new Date(item.scheduled_time);
            const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });
            const typeBadge = `<span style="background:${meta.color}; color:white; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:bold; white-space:nowrap;">${meta.icon} ${meta.label}</span>`;
            const linkBtn = item.linkUrl ? `<a href="${item.linkUrl}" target="_blank" style="font-size:12px; font-weight:800; color:${meta.color}; text-decoration:underline; white-space:nowrap;">바로가기 🔗</a>` : '';

            return `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 16px 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition:all 0.2s;">
                    <div style="flex: 1; min-width:0;">
                        <div style="font-size:13px; color:#64748b; font-weight:800; margin-bottom:6px;">⏰ ${timeStr}</div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            ${typeBadge}
                            <span style="font-size:16px; font-weight:900; color:#0f172a;">${item.title}</span>
                        </div>
                    </div>
                    <div style="flex-shrink:0; text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                        ${item.subtitle ? `<span style="font-size:14px; font-weight:bold; color:#334155; background:#f1f5f9; padding:6px 14px; border-radius:8px;">${item.subtitle}</span>` : ''}
                        ${linkBtn}
                    </div>
                </div>
            `;
        },

        renderUI: () => {
            const container = document.getElementById('main-content') || document.getElementById('app');

            const year = Boako.Schedule.currentDate.getFullYear();
            const month = Boako.Schedule.currentDate.getMonth();

            const firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();

            const todayStr = Boako.Schedule.formatDateStr(new Date());

            const scheduleMap = {};
            Boako.Schedule.scheduleItems.forEach(item => {
                const dStr = Boako.Schedule.formatDateStr(new Date(item.scheduled_time));
                if (!scheduleMap[dStr]) scheduleMap[dStr] = [];
                scheduleMap[dStr].push(item);
            });

            const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
            let calendarHtml = `
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center; font-weight:bold; color:#64748b; margin-bottom:8px; font-size:14px;">
                    ${daysOfWeek.map((day, idx) => `<div style="${idx === 0 ? 'color:#ef4444;' : idx === 6 ? 'color:#3b82f6;' : ''}">${day}</div>`).join('')}
                </div>
                <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;">
            `;

            for (let i = 0; i < firstDay; i++) {
                calendarHtml += `<div style="min-height:64px; padding:5px;"></div>`;
            }

            for (let i = 1; i <= lastDate; i++) {
                const cellDateStr = Boako.Schedule.formatDateStr(new Date(year, month, i));
                const dailyItems = scheduleMap[cellDateStr] || [];
                const count = dailyItems.length;

                const isToday = cellDateStr === todayStr;
                const isSelected = cellDateStr === Boako.Schedule.selectedDateStr;

                let bgStyle = 'background: white;';
                if (count > 0) {
                    const opacity = Math.min(count * 0.2, 0.55);
                    bgStyle = `background: rgba(100, 116, 139, ${opacity});`;
                } else if (isToday) {
                    bgStyle = `background: #f1f5f9;`;
                }

                const borderStyle = isSelected ? 'border:2px solid #3b82f6;' : 'border:1px solid #e2e8f0;';

                const uniqueTypeIcons = [...new Set(dailyItems.map(it => Boako.Schedule.TYPE_META[it.typeKey]?.icon || '📌'))].slice(0, 4);
                const iconsRow = uniqueTypeIcons.length > 0
                    ? `<div style="font-size:10px; line-height:1; margin-top:2px;">${uniqueTypeIcons.join(' ')}</div>`
                    : '';

                calendarHtml += `
                    <div onclick="Boako.Schedule.View.selectDate('${cellDateStr}')"
                         style="min-height:64px; padding:8px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center;
                                ${bgStyle} ${borderStyle} transition:all 0.2s;"
                         onmouseover="this.style.filter='brightness(0.95)'"
                         onmouseout="this.style.filter='brightness(1)'">
                        <span style="font-size:15px; font-weight:bold; color:#0f172a;">${i}</span>
                        ${iconsRow}
                        ${count > 0 ? `<span style="font-size:10px; font-weight:800; color:#475569; margin-top:1px;">${count}건</span>` : ''}
                    </div>
                `;
            }
            calendarHtml += `</div>`;

            const targetItems = scheduleMap[Boako.Schedule.selectedDateStr] || [];
            let listHtml = `
                <div style="margin-top:20px; border-top:2px dashed #e2e8f0; padding-top:20px;">
                    <h3 style="font-size:18px; font-weight:900; margin-bottom:15px; color:#0f172a; display:flex; align-items:center; gap:8px;">
                        🎯 ${Boako.Schedule.selectedDateStr.split('-')[1]}월 ${Boako.Schedule.selectedDateStr.split('-')[2]}일 예정 일정
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (targetItems.length === 0) {
                listHtml += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">이 날짜에 예정된 일정이 없습니다.</div>`;
            } else {
                targetItems.forEach(item => {
                    listHtml += Boako.Schedule.View.renderItemCard(item);
                });
            }
            listHtml += `</div></div>`;

            const legendHtml = `
                <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:14px; padding:12px 16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                    ${Object.entries(Boako.Schedule.TYPE_META).map(([key, meta]) => `
                        <div style="display:flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:#475569;">
                            <span style="width:10px; height:10px; border-radius:3px; background:${meta.color}; display:inline-block;"></span>
                            ${meta.icon} ${meta.label}
                        </div>
                    `).join('')}
                </div>
            `;

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
                        ${legendHtml}
                    </div>

                    ${listHtml}
                </div>
            `;

            container.innerHTML = finalHtml;
        },

        changeMonth: (offset) => {
            const cur = Boako.Schedule.currentDate;
            Boako.Schedule.currentDate = new Date(cur.getFullYear(), cur.getMonth() + offset, 1);
            Boako.Schedule.selectedDateStr = Boako.Schedule.formatDateStr(Boako.Schedule.currentDate);
            Boako.Schedule.View.renderUI();
        },

        selectDate: (dateStr) => {
            Boako.Schedule.selectedDateStr = dateStr;
            Boako.Schedule.View.renderUI();
        },

        showAllSchedules: () => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            let html = `
                <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📜 전체 예정 일정 리스트</h2>
                        <button onclick="Boako.Schedule.View.renderUI()" style="padding:8px 14px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; color:#334155;">◀ 달력으로 돌아가기</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (Boako.Schedule.scheduleItems.length === 0) {
                html += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">예정된 일정이 없습니다.</div>`;
            } else {
                Boako.Schedule.scheduleItems.forEach(item => {
                    html += Boako.Schedule.View.renderItemCard(item);
                });
            }
            html += `</div></div>`;
            container.innerHTML = html;
        }
    }
};
