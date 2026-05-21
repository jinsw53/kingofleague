/**
 * 🎯 [LEAGUE] 리그 콘텐츠 4대장 허브 대시보드
 * 관리 책임자: 소장님 MASTER
 * 연결 위치: view.js의 'league' 라우터에서 Boako.League.buildUI()로 호출됨
 */

Boako.League = Boako.League || {};

// 💡 소장님의 view.js가 호출하는 메인 사출 엔진
Boako.League.buildUI = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 소장님 전용 2열 그리드 대시보드 HTML 주입
    container.innerHTML = `
        <div class="league-contents-wrap w-full space-y-6 animate-in fade-in duration-500" style="font-family: inherit;">
            
            <div class="main-top-banner group" onclick="if(typeof Boako.Util.showToast === 'function') Boako.Util.showToast('🎲 팀 빙고 쟁탈전 시스템을 로드합니다.');" style="
                width: 100%; 
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); 
                border: 1px solid var(--border-color);
                border-radius: 20px; 
                padding: 30px; 
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: var(--shadow-md);
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='var(--accent)';" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='var(--border-color)';">
                
                <div class="banner-text">
                    <span style="background: var(--accent); color: #000; padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 11px; tracking: 1px;">NEW SYSTEM</span>
                    <h2 style="margin: 12px 0 6px 0; font-size: 26px; font-weight: 950; color: #f8fafc;">
                        🎲 팀 빙고 쟁탈전
                    </h2>
                    <p style="margin: 0; color: #94a3b8; font-size: 14px; font-weight: 600;">
                        보드판 위에서 펼쳐지는 팀원들의 전략적 타일 점유 미션!
                    </p>
                </div>
                <div class="banner-graphic" style="font-size: 44px; opacity: 0.8; padding-right: 15px; user-select: none;">🎯</div>
            </div>

            <div class="contents-grid" style="
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 24px;
            ">
                
                <div class="content-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 24px; display: flex; align-items: center; gap: 20px; box-shadow: var(--shadow-md);">
                    <div class="card-img-holder" style="width: 110px; height: 110px; background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <img src="야, 너네 나와! 챌린지.jpg" alt="CHALLENGE" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2270%22>💥</text></svg>';">
                    </div>
                    <div class="card-info" style="flex-grow: 1; min-width: 0;">
                        <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 900; color: var(--text-main);">야, 너네 나와! 챌린지</h3>
                        <p style="margin: 0 0 16px 0; color: var(--text-sub); font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            Current: Solo Duel / 9 Layers 진행 중
                        </p>
                        <button onclick="Boako.View.render('rival')" style="background: var(--text-main); color: #fff; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 13px;">Join Now</button>
                    </div>
                </div>

                <div class="content-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 24px; display: flex; align-items: center; gap: 20px; box-shadow: var(--shadow-md);">
                    <div class="card-img-holder" style="width: 110px; height: 110px; background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 6px;">
                        <img src="킹 오브 리그.png" alt="KING" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2270%22>👑</text></svg>';">
                    </div>
                    <div class="card-info" style="flex-grow: 1; min-width: 0;">
                        <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 900; color: var(--text-main);">킹 오브 리그</h3>
                        <p style="margin: 0 0 16px 0; color: var(--text-sub); font-size: 13px; font-weight: 600;">
                            Current Champion / 3 Players 대기 중
                        </p>
                        <button onclick="Boako.View.render('ranking')" style="background: var(--primary); color: #fff; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 13px;">Leaderboard</button>
                    </div>
                </div>

                <div class="content-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 24px; display: flex; align-items: center; gap: 20px; box-shadow: var(--shadow-md);">
                    <div class="card-img-holder" style="width: 110px; height: 110px; background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 14px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 4px;">
                        <img src="리그의 게임 챔피언 벨트.png" alt="BELT" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2270%22>🏆</text></svg>';">
                    </div>
                    <div class="card-info" style="flex-grow: 1; min-width: 0;">
                        <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 900; color: var(--text-main);">팀 리그 TOP 10</h3>
                        <p style="margin: 0 0 16px 0; color: var(--text-sub); font-size: 13px; font-weight: 600;">
                            최상위 10개 팀 실시간 전적 통계
                        </p>
                        <button onclick="Boako.View.render('team_list')" style="background: #fff; color: var(--text-sub); border: 1px solid var(--border-color); padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#f1f5f9';" onmouseout="this.style.backgroundColor='#fff';">Team List</button>
                    </div>
                </div>

                <div class="content-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 24px; display: flex; align-items: center; gap: 20px; box-shadow: var(--shadow-md);">
                    <div class="card-img-holder" style="width: 110px; height: 110px; background-color: #f8fafc; border: 1px solid var(--border-color); border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 36px; user-select: none;">
                        🏅
                    </div>
                    <div class="card-info" style="flex-grow: 1; min-width: 0;">
                        <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 900; color: var(--text-main);">정규 토너먼트</h3>
                        <p style="margin: 0 0 16px 0; color: var(--text-sub); font-size: 13px; font-weight: 600;">
                            BOAKO 공식 토너먼트 대진표 대조
                        </p>
                        <button onclick="Boako.View.render('tournament')" style="background: #fff; color: var(--text-sub); border: 1px solid var(--border-color); padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#f1f5f9';" onmouseout="this.style.backgroundColor='#fff';">View Brackets</button>
                    </div>
                </div>

            </div>
        </div>
    `;

    // 💡 화면 주입이 끝난 후 이벤트나 라이브러리 가동 지시
    this.bindEvents();
};

// 화면 세팅 직후에 발동해야 하는 이벤트 관리
Boako.League.bindEvents = function() {
    // Lucide 아이콘이 렌더링된 요소 안에 있다면 다시 그려주기
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
    
    console.log("🎯 리그 콘텐츠 4대장 UI 사출 완료!");
};
