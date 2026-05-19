/**
 * [RANKING] 실시간 팀 리더보드 연동 엔진 (아코디언 모드)
 */
Boako.Ranking = {
    // 🏆 DB에서 팀 점수 현황을 긁어와 동적으로 HTML을 그려주는 함수
    init: async function() {
        const contentArea = document.getElementById('main-content-area');
        if (!contentArea) return;

        // 1) 프리미엄 스타일의 리더보드 껍데기 판 짜기
        contentArea.innerHTML = `
            <div class="section-card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🏆 실시간 팀 리더보드</span>
                    <span style="font-size: 13px; color: var(--text-sub); font-weight: 500;">💡 팀을 터치하면 상세 라운드 점수가 열립니다</span>
                </div>
                <div class="card-body" id="leaderboard-list-target" style="padding: 25px; display: flex; flex-direction: column; gap: 14px;">
                    <div style="text-align: center; color: var(--text-sub); font-weight: 700; padding: 40px 0;">
                        📊 리그 데이터 산출 및 정산 중...
                    </div>
                </div>
            </div>
        `;

        const listTarget = document.getElementById('leaderboard-list-target');

        try {
            // 🎯 [2단계] 소장님의 실제 팀 랭킹 스코어 테이블 타격
            // (테이블명이나 정렬 기준 컬럼은 DB 실제 규격에 맞춰 편하게 바꾸시면 됩니다!)
            const { data: teamScores, error } = await Boako.db
                .from('team_scores') 
                .select('*')
                .order('total_points', { ascending: false }); // 총점 높은 팀이 1등

            if (error) throw error;

            if (!teamScores || teamScores.length === 0) {
                listTarget.innerHTML = `<div style="text-align: center; color: var(--text-sub); padding: 40px 0;">현재 등록된 리그 팀 점수 장부가 없습니다.</div>`;
                return;
            }

            // 🎯 [3단계] 맵(map) 루프 돌려서 하드코딩 없이 DB 정보로 한 줄씩 조립
            const leaderboardHtml = teamScores.map((team, index) => {
                const rank = index + 1;
                
                // 🥇 상위권 트로피 색상 포인트 매칭
                let rankBadge = `<span style="font-size: 18px; font-weight: 900; width: 30px; text-align: center; color: #94a3b8;">${rank}</span>`;
                if (rank === 1) rankBadge = `<span style="font-size: 20px; width: 30px; text-align: center;">🥇</span>`;
                if (rank === 2) rankBadge = `<span style="font-size: 20px; width: 30px; text-align: center;">🥈</span>`;
                if (rank === 3) rankBadge = `<span style="font-size: 20px; width: 30px; text-align: center;">🥉</span>`;

                return `
                    <div style="border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; background: #fff; transition: all 0.2s;" 
                         onmouseover="this.style.borderColor='var(--primary-light)'" 
                         onmouseout="this.style.borderColor='var(--border-color)'">
                        
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; cursor: pointer; background: #fff;"
                             onclick="const panel = this.nextElementSibling; panel.style.display = panel.style.display === 'none' ? 'block' : 'none';">
                            
                            <div style="display: flex; align-items: center; gap: 16px;">
                                ${rankBadge}
                                <div style="width: 38px; height: 38px; border-radius: 50%; background: #f1f5f9; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--primary);">
                                    ${team.team_name ? team.team_name.charAt(0) : '🛡️'}
                                </div>
                                <span style="font-size: 17px; font-weight: 800; color: var(--text-main);">${team.team_name}</span>
                            </div>

                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 24px; font-weight: 950; color: var(--primary);">${team.total_points || 0}</span>
                                <span style="font-size: 12px; font-weight: 800; color: var(--text-sub); margin-right: 4px;">P</span>
                                <span style="color: var(--text-sub); font-size: 12px;">▼</span>
                            </div>
                        </div>

                        <div style="display: none; background: #f8fafc; border-top: 1px solid var(--border-color); padding: 20px; overflow-x: auto; -webkit-overflow-scrolling: touch;">
                            <table style="width: 100%; text-align: center; font-size: 13px; border-collapse: collapse; min-w-[600px];">
                                <thead>
                                    <tr style="color: var(--text-sub); border-bottom: 1px solid var(--border-color); font-weight: 800;">
                                        <th style="padding-bottom: 10px;">1R</th>
                                        <th style="padding-bottom: 10px;">2R</th>
                                        <th style="padding-bottom: 10px;">3R</th>
                                        <th style="padding-bottom: 10px;">4R</th>
                                        <th style="padding-bottom: 10px;">5R</th>
                                        <th style="padding-bottom: 10px;">6R</th>
                                        <th style="padding-bottom: 10px;">7R</th>
                                        <th style="padding-bottom: 10px; color: #ef4444;">제외</th>
                                        <th style="padding-bottom: 10px; color: var(--accent);">대항전</th>
                                        <th style="padding-bottom: 10px; color: var(--primary);">킹오브</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="font-weight: 800; color: var(--text-main);">
                                        <td style="padding-top: 12px;">${team.r1 || 0}</td>
                                        <td style="padding-top: 12px;">${team.r2 || 0}</td>
                                        <td style="padding-top: 12px;">${team.r3 || 0}</td>
                                        <td style="padding-top: 12px;">${team.r4 || 0}</td>
                                        <td style="padding-top: 12px;">${team.r5 || 0}</td>
                                        <td style="padding-top: 12px;">${team.r6 || 0}</td>
                                        <td style="padding-top: 12px;">${team.r7 || 0}</td>
                                        <td style="padding-top: 12px; color: #ef4444;">${team.exclude_score || 0}</td>
                                        <td style="padding-top: 12px; color: var(--accent);">${team.challenge_score || 0}</td>
                                        <td style="padding-top: 12px; color: var(--primary);">${team.king_score || 0}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>
                `;
            }).join('');

            // 최종 조립품 화면에 투척!
            listTarget.innerHTML = leaderboardHtml;

        } catch (err) {
            console.error("리더보드 집계 실패:", err);
            listTarget.innerHTML = `<div style="text-align: center; color: #ef4444; font-weight: 700; padding: 40px 0;">⚠️ 랭킹 데이터를 실시간 산출하는 과정에서 연동 오류가 발생했습니다.</div>`;
        }
    }
};
