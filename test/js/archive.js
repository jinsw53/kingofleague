/**
 * [ARCHIVE] 기록실 및 실시간 랭킹 시스템
 * DB: v_boako_total_records 가상 뷰 연동
 */
Boako.Archive = {
    allRecords: [],
    filteredRecords: [],
    currentTab: 'records', // 'records' | 'rankings'

    // 1. view.js가 깨우는 진입점
    init: async function() {
        if (!Boako.db) {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        // 도화지에 기본 UI 프레임(필터, 검색바, 결과 구역)을 얹습니다.
        this.renderFrame();
        
        // 실전 DB 데이터를 땡겨옵니다.
        await this.loadData();
    },

    // 2. 도화지 위에 고정 프레임 그리기
    renderFrame: function() {
        const container = document.getElementById('archive-container');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px; background:#fff; padding:15px; border-radius:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
                <div style="font-size:18px; font-weight:900; color:#1e1b4b;">LEAGUE ARCHIVE</div>
                <div style="display:flex; background:#f1f5f9; padding:5px; border-radius:10px;">
                    <button onclick="Boako.Archive.switchTab('records')" id="tab-btn-records" style="background:#fff; color:#4f46e5; box-shadow:0 2px 5px rgba(0,0,0,0.05); font-weight:800; padding:8px 20px; border-radius:8px; font-size:14px; transition:all 0.2s;">📋 기록실</button>
                    <button onclick="Boako.Archive.switchTab('rankings')" id="tab-btn-rankings" style="background:transparent; color:#64748b; font-weight:800; padding:8px 20px; border-radius:8px; font-size:14px; transition:all 0.2s;">🔥 랭킹보드</button>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:20px; margin-bottom:30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:15px; flex-wrap:wrap;">
                    <div style="font-size:22px; font-weight:900; color:#0f172a;" id="archive-dynamic-title">시즌 경기 기록실</div>
                    <div style="display:flex; gap:10px;">
                        <select id="archive-filter-season" onchange="Boako.Archive.filterData()" style="background:#fff; border:1px solid #e2e8f0; padding:10px 15px; border-radius:12px; font-weight:800; font-size:13px; outline:none; cursor:pointer;">
                            <option value="all">전체 시즌</option>
                            <option value="1">시즌 1</option>
                            <option value="2">시즌 2</option>
                        </select>
                        <select id="archive-filter-round" onchange="Boako.Archive.filterData()" style="background:#fff; border:1px solid #e2e8f0; padding:10px 15px; border-radius:12px; font-weight:800; font-size:13px; outline:none; cursor:pointer;">
                            <option value="all">전체 라운드</option>
                            <option value="1">1 라운드</option>
                            <option value="2">2 라운드</option>
                            <option value="3">3 라운드</option>
                        </select>
                    </div>
                </div>
                <div style="position:relative; width:100%;">
                    <input type="text" id="archive-filter-search" oninput="Boako.Archive.filterData()" placeholder="플레이어 닉네임이나 보드게임 종목을 검색하세요..." style="width:100%; padding:15px 20px; border-radius:16px; border:1px solid #e2e8f0; background:#fff; font-size:16px; font-weight:500; outline:none; box-shadow:0 4px 6px -1px rgba(0,0,0,0.02);">
                </div>
            </div>

            <div id="archive-core-box">
                <div style="text-align:center; padding:50px; color:#94a3b8; font-weight:700;">가상 뷰 동기화 중...</div>
            </div>
        `;
    },

    // 3. Supabase v_boako_total_records 연동
    loadData: async function() {
        try {
            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.allRecords = data || [];
            
            // 실시간 필터링 및 렌더링 시작
            this.filterData();
        } catch (err) {
            console.error("아카이브 로드 에러:", err);
            Boako.Util.toast("🚨 기록을 불러오지 못했습니다.");
        }
    },

    // 4. 메모리 내 실시간 필터링 실무 로직
    filterData: function() {
        const seasonVal = document.getElementById('archive-filter-season')?.value || 'all';
        const roundVal = document.getElementById('archive-filter-round')?.value || 'all';
        const searchVal = (document.getElementById('archive-filter-search')?.value || '').toLowerCase();

        this.filteredRecords = this.allRecords.filter(rec => {
            const matchSeason = seasonVal === 'all' || String(rec.season_no) === seasonVal;
            const matchRound = roundVal === 'all' || String(rec.round_no) === roundVal;
            const matchSearch = (rec.nickname?.toLowerCase().includes(searchVal) || rec.game_name?.toLowerCase().includes(searchVal));
            return matchSeason && matchRound && matchSearch;
        });

        if (this.currentTab === 'records') this.renderRecords();
        else this.renderRankings();
    },

    // 5. 내부 탭 전환 스위치
    switchTab: function(tabName) {
        this.currentTab = tabName;
        const isRec = tabName === 'records';
        
        const btnRec = document.getElementById('tab-btn-records');
        const btnRank = document.getElementById('tab-btn-rankings');
        const titleText = document.getElementById('archive-dynamic-title');

        if(btnRec && btnRank) {
            btnRec.style.background = isRec ? '#fff' : 'transparent';
            btnRec.style.color = isRec ? '#4f46e5' : '#64748b';
            btnRec.style.boxShadow = isRec ? '0 2px 5px rgba(0,0,0,0.05)' : 'none';
            btnRec.style.border = isRec ? '1px solid #e2e8f0' : '1px solid transparent';

            btnRank.style.background = !isRec ? '#fff' : 'transparent';
            btnRank.style.color = !isRec ? '#4f46e5' : '#64748b';
            btnRank.style.boxShadow = !isRec ? '0 2px 5px rgba(0,0,0,0.05)' : 'none';
            btnRank.style.border = !isRec ? '1px solid #e2e8f0' : '1px solid transparent';
        }

        if(titleText) {
            titleText.innerText = isRec ? '시즌 경기 기록실' : '종합 리그 순위표';
        }

        this.filterData();
    },

    // 6. [디자인 모듈] 기록실 데이터 테이블 시각화
    renderRecords: function() {
        const box = document.getElementById('archive-core-box');
        if (!box) return;

        if (this.filteredRecords.length === 0) {
            box.innerHTML = `<div style="text-align:center; padding:60px; color:#94a3b8; font-weight:800; background:#fff; border-radius:24px;">매칭되는 경기 기록이 없습니다.</div>`;
            return;
        }

        let tableHtml = `
            <div style="background:#fff; border-radius:24px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.05); border:1px solid #fff; overflow:hidden;">
                <div style="overflow-x:auto;">
                    <table style="width:100%; text-align:left; border-collapse:collapse; font-size:14px;">
                        <thead>
                            <tr style="background:#f8fafc; text-color:#94a3b8; font-weight:900; border-b:1px solid #e2e8f0; text-transform:uppercase;">
                                <th style="padding:15px 20px;">Source</th>
                                <th style="padding:15px 20px;">Player</th>
                                <th style="padding:15px 20px;">Game Info</th>
                                <th style="padding:15px 20px; text-align:center;">Logic (W × T × M)</th>
                                <th style="padding:15px 20px; text-align:right;">RP</th>
                                <th style="padding:15px 20px; text-align:center;">Status</th>
                                <th style="padding:15px 20px;"></th>
                            </tr>
                        </thead>
                        <tbody style="color:#334155;">
        `;

        tableHtml += this.filteredRecords.map(rec => {
            const isTour = rec.record_source === 'TOURNAMENT';
            const sourceBadge = isTour 
                ? `background:#fef3c7; color:#d97706; border:1px solid #fde68a;` 
                : `background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;`;

            return `
                <tr style="border-bottom:1px solid #f1f5f9; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:20px;">
                        <span style="padding:3px 8px; border-radius:9999px; font-size:10px; font-weight:900; ${sourceBadge}">${rec.record_source || 'BTLDB'}</span>
                    </td>
                    <td style="padding:20px;">
                        <div style="font-weight:900; color:#0f172a; font-size:16px;">${rec.nickname || '무명'}</div>
                        <div style="font-size:10px; color:#94a3b8; font-weight:800; margin-top:2px;">${rec.b_all_team || '무소속'}</div>
                    </td>
                    <td style="padding:20px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-weight:800; color:#312e81;">${rec.game_name || '-'}</span>
                            ${rec.is_first == 1 ? '<span style="background:#ef4444; color:#fff; font-size:9px; font-weight:900; padding:1px 4px; border-radius:4px;">1ST</span>' : ''}
                        </div>
                        <div style="font-size:11px; color:#64748b; margin-top:2px; font-weight:500;">S${rec.season_no} R${rec.round_no} · ${rec.match_type || '일반'}</div>
                    </td>
                    <td style="padding:20px;">
                        <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-weight:900;">
                            <div style="width:32px; height:32px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#475569; font-size:12px;">${rec.weight || 0}</div>
                            <span style="color:#cbd5e1;">×</span>
                            <div style="width:32px; height:32px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#475569; font-size:12px;">${rec.playtime || 0}</div>
                            <span style="color:#cbd5e1;">×</span>
                            <div style="width:32px; height:32px; background:#e0e7ff; border:1px solid #c7d2fe; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#4f46e5; font-size:12px;">${rec.multiplier || 0}</div>
                        </div>
                    </td>
                    <td style="padding:20px; text-align:right; font-weight:900; color:#4f46e5; font-size:18px;">
                        ${(rec.rp || 0).toFixed(1)} <span style="font-size:11px; font-weight:700; color:#a5b4fc;">RP</span>
                    </td>
                    <td style="padding:20px; text-align:center;">
                        ${rec.is_verified == 1 
                            ? '<span style="color:#10b981; font-weight:900; font-size:18px;">✓</span>' 
                            : '<span style="color:#cbd5e1; font-weight:900; font-size:18px;">?</span>'}
                    </td>
                    <td style="padding:20px; text-align:right;">
                        ${rec.post_url ? `<a href="${rec.post_url}" target="_blank" style="display:inline-block; padding:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; color:#94a3b8; text-decoration:none; transition:all 0.2s;" onmouseover="this.style.color='#4f46e5'; this.style.background='#e0e7ff';" onmouseout="this.style.color='#94a3b8'; this.style.background='#f8fafc';">🔗</a>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        tableHtml += `</tbody></table></div></div>`;
        box.innerHTML = tableHtml;
    },

    // 7. [디자인 모듈] 실시간 종합 랭킹 카드 시각화
    renderRankings: function() {
        const box = document.getElementById('archive-core-box');
        if (!box) return;

        const stats = {};
        this.filteredRecords.forEach(r => {
            if (!stats[r.nickname]) stats[r.nickname] = { name: r.nickname, team: r.b_all_team, rp: 0, games: 0, wins: 0 };
            stats[r.nickname].rp += (r.rp || 0);
            stats[r.nickname].games += 1;
            if (r.is_first == 1) stats[r.nickname].wins += 1;
        });

        const sorted = Object.values(stats).sort((a, b) => b.rp - a.rp);

        if (sorted.length === 0) {
            box.innerHTML = `<div style="text-align:center; padding:60px; color:#94a3b8; font-weight:800; background:#fff; border-radius:24px;">집계할 랭킹 데이터가 없습니다.</div>`;
            return;
        }

        const maxRp = sorted[0].rp || 1;

        let gridHtml = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:25px;">`;

        gridHtml += sorted.map((p, idx) => {
            const medal = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
            const rankBg = idx < 3 ? 'background:#4f46e5; color:#fff;' : 'background:#f1f5f9; color:#64748b;';
            const pct = Math.min(100, (p.rp / maxRp) * 100);

            return `
                <div class="boako-rank-card" style="background:#fff; border-radius:28px; padding:25px; border:1px solid #fff; box-shadow:0 10px 15px -3px rgba(0,0,0,0.04); position:relative; transition:all 0.3s;" onmouseover="this.style.transform='translateY(-6px)'; this.style.boxShadow='0 20px 25px -5px rgba(0,0,0,0.08)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.04)';">
                    <div style="position:absolute; top:0; right:0; padding:6px 15px; border-bottom-left-radius:16px; font-size:11px; font-weight:900; tracking-widest:0.1em; ${rankBg}">RANK #${idx + 1}</div>
                    
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px; margin-top:10px;">
                        <div style="width:50px; height:50px; background:#f8fafc; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">${medal}</div>
                        <div>
                            <div style="font-size:20px; font-weight:900; color:#0f172a; line-height:1;">${p.name}</div>
                            <div style="font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase; tracking-widest:0.05em; margin-top:5px;">${p.team || 'FREE AGENT'}</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
                        <div style="background:#f8fafc; padding:15px; border-radius:16px; border:1px solid #f1f5f9; text-align:center;">
                            <div style="font-size:9px; font-weight:900; color:#94a3b8; text-transform:uppercase; tracking-widest:0.05em; margin-bottom:4px;">Total RP</div>
                            <div style="font-size:22px; font-weight:900; color:#4f46e5;">${Math.floor(p.rp)}</div>
                        </div>
                        <div style="background:#f8fafc; padding:15px; border-radius:16px; border:1px solid #f1f5f9; text-align:center;">
                            <div style="font-size:9px; font-weight:900; color:#94a3b8; text-transform:uppercase; tracking-widest:0.05em; margin-bottom:4px;">Matches</div>
                            <div style="font-size:22px; font-weight:900; color:#334155;">${p.games}</div>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:900; color:#475569; margin-bottom:10px;">
                        <span style="color:#94a3b8; font-style:italic;">First Win Bonus</span>
                        <span style="background:#fef2f2; color:#ef4444; padding:2px 8px; border-radius:6px;">+${p.wins} Times</span>
                    </div>

                    <div style="width:100%; background:#f1f5f9; h:6px; height:6px; border-radius:9999px; overflow:hidden;">
                        <div style="background:linear-gradient(to right, #6366f1, #4f46e5); height:100%; width:${pct}%; border-radius:9999px; transition:width 0.5s ease-out;"></div>
                    </div>
                </div>
            `;
        }).join('');

        gridHtml += `</div>`;
        box.innerHTML = gridHtml;
    }
};
