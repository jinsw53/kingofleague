/**
 * [VIEW] 화면 렌더링 및 페이지 템플릿 관리 (인덱스 다이어트 최종 최적화본)
 * 구조: 신설 6대장 메뉴 수송선 라인 + 통신망(메신저) + 일정표(스케줄) 확장 + 🌟 팀 탭 분리 적용
 */
Boako.View = {
    toggleEdit: (type) => {
        const area = document.getElementById(`${type}-edit-area`);
        const display = type === 'motto' ? document.getElementById('motto-display-row') : document.getElementById('desc-display-txt');
        const isNone = area.style.display === 'none' || area.style.display === '';
        area.style.display = isNone ? 'flex' : 'none';
        display.style.display = isNone ? 'none' : (type === 'motto' ? 'flex' : 'block');
    },

    // 🌟 [수정된] 버튼형 팀 탭 전환 로직
    switchTeamTab: (tabId) => {
        // 모든 탭 내용 숨기기
        document.querySelectorAll('.team-tab-content').forEach(el => {
            el.style.display = 'none';
        });
        
        // 버튼 스타일 (활성/비활성)
        const activeClasses = ['bg-slate-800', 'text-white', 'shadow-sm'];
        const inactiveClasses = ['bg-slate-100', 'text-slate-500', 'hover:bg-slate-200', 'hover:text-slate-700'];

        // 모든 버튼을 비활성(회색) 상태로 초기화
        document.querySelectorAll('.team-tab-btn').forEach(el => {
            el.classList.remove(...activeClasses);
            el.classList.add(...inactiveClasses);
        });

        // 선택한 탭 보이기
        const targetContent = document.getElementById(`tab-${tabId}`);
        if(targetContent) targetContent.style.display = 'block';

        // 선택한 버튼을 활성(진한색) 상태로 변경
        const activeBtn = document.getElementById(`btn-tab-${tabId}`);
        if (activeBtn) {
            activeBtn.classList.remove(...inactiveClasses);
            activeBtn.classList.add(...activeClasses);
        }

        if (tabId === 'chat' && Boako.Team && Boako.Team.Chat) {
            setTimeout(() => { Boako.Team.Chat.scrollToBottom(); }, 50);
        }
    },

    render: async (pageId) => {
        const area = document.getElementById('main-content-area');
        let html = '';
        
        // 기존 켜져 있던 메뉴 불 끄기
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        
        // 🌟 [핵심 수정] 타겟 메뉴 ID 스마트 지정!
        let targetMenuId = `menu-${pageId}`;
        
        // 인벤토리를 눌렀다면 메뉴바는 '포인트샵(shop)' 위치로 맞춤
        if (pageId === 'inventory') {
            targetMenuId = 'menu-shop'; 
        }

        // 버튼 불 켜고 그 위치로 스르륵 이동!
        const navBtn = document.getElementById(targetMenuId);
        if (navBtn) {
            navBtn.classList.add('active');
            Boako.Util.scrollToMenu(targetMenuId); // 자동 스크롤 함수 호출
        }

        switch(pageId) {
            case 'ranking':
                if (!Boako.Ranking || !Boako.Ranking.init) {
                    await Boako.Util.loadScript('js/ranking.js');
                }
                html = `<div class="main-banner"><h1>🏆 실시간 랭킹</h1></div><section class="section-card"><div class="card-body">집계 중...</div></section>`;
                
                setTimeout(() => {
                    if (Boako.Ranking && typeof Boako.Ranking.init === 'function') {
                        Boako.Ranking.init();
                    }
                }, 0);
                break;

            case 'match':
                if (!Boako.Match || !Boako.Match.init) {
                    await Boako.Util.loadScript('js/match.js');
                }
                html = `<div id="match-master-container" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.Match && typeof Boako.Match.init === 'function') {
                        Boako.Match.init('match-master-container');
                    }
                }, 0);
                break;

            case 'rival':
                if (!Boako.Rival || !Boako.Rival.init) {
                    await Boako.Util.loadScript('js/rival.js');
                }
                html = `<div id="rival-master-container" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.Rival && typeof Boako.Rival.init === 'function') {
                        Boako.Rival.init('rival-master-container');
                    }
                }, 0);
                break;

            case 'league':
                if (!Boako.League || !Boako.League.buildUI) {
                    await Boako.Util.loadScript('js/league.js'); 
                }
                html = `<div id="league-master-container" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.League && typeof Boako.League.buildUI === 'function') {
                        Boako.League.buildUI('league-master-container'); 
                    }
                }, 0);
                break;

            case 'records':
                if (!Boako.Archive || !Boako.Archive.buildUI) {
                    await Boako.Util.loadScript('js/archive.js');
                }
                html = `<div id="archive-master-container" class="w-full animate-in fade-in duration-500"></div>`;
                
                setTimeout(() => {
                    if (Boako.Archive && typeof Boako.Archive.buildUI === 'function') {
                        Boako.Archive.buildUI('archive-master-container');
                    }
                }, 0);
                break;

            case 'tournament':
                if (!Boako.Tournament || !Boako.Tournament.init) {
                    await Boako.Util.loadScript('js/tournament.js');
                }
                html = `<div id="tournament-master-container" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.Tournament && typeof Boako.Tournament.init === 'function') {
                        Boako.Tournament.init('tournament-master-container');
                    }
                }, 0);
                break;

            case 'together':
                if (!Boako.Together || !Boako.Together.init) {
                    await Boako.Util.loadScript('js/together.js');
                }
                html = `<div id="together-master-container" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.Together && typeof Boako.Together.init === 'function') {
                        Boako.Together.init('together-master-container');
                    }
                }, 0);
                break;

            case 'team':
                if (!Boako.state.user) {
                    html = `<div class="main-banner"><h1>🛡️ 팀 서비스</h1></div><div style="text-align:center; padding:100px 0;"><h3 style="color:#94a3b8;">카카오 로그인을 먼저 진행해 주세요.</h3></div>`;
                    break;
                }
                
                if (!Boako.Team || !Boako.Team.syncStatus) {
                    await Boako.Util.loadScript('js/team.js');
                }
                await Boako.Team.syncStatus();

                if (Boako.state.team) {
                    const { info: team, type } = Boako.state.team;
                    const isLeader = type === 'LEADER';
                    const { data: members } = await Boako.db.from('team_members').select('*').eq('team_id', team.id).eq('is_active', true);
                    // 🌟 여기서 바로 정렬해버리면 됩니다!
        if (members) {
            members.sort((a, b) => (a.role === 'LEADER' ? -1 : 1));
        }
                    // [추가] 🌟 대항전 시즌 상태 DB에서 가져오기
let seasonStatus = { current_phase: 0, title: '비시즌', day_count: 0 };
try {
    const { data } = await Boako.db.rpc('get_current_season_status');
    if (data) seasonStatus = data;
} catch (e) { 
    console.error("시즌 상태 로드 실패:", e); 
}

// [추가] 🌟 페이즈(Phase)에 따른 '기록 및 일정 탭' UI 동적 생성
let recordTabHtml = '';
switch(seasonStatus.current_phase) {
    case 1: // 준비기 (1~44일)
        recordTabHtml = `
            <div class="flex flex-col items-center justify-center text-slate-600 py-16 gap-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                <span class="text-4xl">⚔️</span>
                <h3 class="text-xl font-black">${seasonStatus.title} 준비 기간</h3>
                <p class="font-bold text-slate-400">후보 종목 선발을 위한 데이터가 집계 중입니다. (현재 ${seasonStatus.day_count}일 차)</p>
                <button onclick="Boako.View.render('match')" class="mt-2 bg-indigo-50 text-indigo-600 px-6 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors">실시간 랭킹 보러가기</button>
            </div>`;
        break;
    case 2: // 밴 투표 기간 (45~51일)
        recordTabHtml = `
            <div class="flex flex-col items-center justify-center text-slate-600 py-16 gap-4 border border-red-200 rounded-xl bg-red-50 shadow-sm">
                <span class="text-4xl">🚫</span>
                <h3 class="text-xl font-black text-red-600">${seasonStatus.title} 밴(Ban) 투표 진행 중</h3>
                <p class="font-bold text-red-400">우리 팀의 밴 투표 권한을 행사하세요! (마감까지 D-${52 - seasonStatus.day_count}일)</p>
                <button onclick="Boako.Team.openBanVote()" class="mt-2 bg-red-600 text-white px-8 py-3 rounded-xl font-black shadow-md hover:bg-red-700 transition-colors hover:-translate-y-1">투표소 입장하기</button>
            </div>`;
        break;
    case 3: // 엔트리 등록 기간 (52~59일)
        recordTabHtml = `
            <div class="flex flex-col items-center justify-center text-slate-600 py-16 gap-4 border border-emerald-200 rounded-xl bg-emerald-50 shadow-sm">
                <span class="text-4xl">📝</span>
                <h3 class="text-xl font-black text-emerald-700">${seasonStatus.title} 출전 엔트리 마감 임박</h3>
                <p class="font-bold text-emerald-500">최종 확정된 종목에 출전할 선수를 등록하세요. (마감까지 D-${60 - seasonStatus.day_count}일)</p>
                <button onclick="Boako.Team.openEntryForm()" class="mt-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-black shadow-md hover:bg-emerald-700 transition-colors hover:-translate-y-1">엔트리 작전판 열기</button>
            </div>`;
        break;
    default: // 비시즌 (60일~)
        recordTabHtml = `
            <div class="flex flex-col items-center justify-center text-slate-400 font-bold py-20 gap-3 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                <span class="text-2xl">🏆</span>
                <p>현재 진행 중인 대항전 일정이 없습니다. (비시즌)</p>
            </div>`;
        break;
}
                    // 🌟 탭이 포함된 팀 레이아웃으로 변경
                    html = `
                    <div class="main-banner" style="margin-bottom: 20px;">
                        <h1>${team.team_name}</h1>
                    </div>

                    <section class="section-card">
                        <div class="card-header flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                            <span style="font-size: 18px;">나의 팀 대시보드</span>
                            
                            <div class="flex gap-2">
                                <button id="btn-tab-info" class="team-tab-btn bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all" onclick="Boako.View.switchTeamTab('info')">🛡️ 팀 본부</button>
                                <button id="btn-tab-chat" class="team-tab-btn bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.View.switchTeamTab('chat')">💬 작전 회의실</button>
                                <button id="btn-tab-record" class="team-tab-btn bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all" onclick="Boako.View.switchTeamTab('record')">⚔️ 기록 및 일정</button>
                            </div>
                        </div>

                        <div class="card-body" style="padding-top: 0;">
                            
                            <div id="tab-info" class="team-tab-content block animate-in fade-in duration-300">
                                <div class="team-profile-header">
                                    <img src="${team.logo_url || 'https://via.placeholder.com/160'}" class="team-logo-preview">
                                    <div class="team-info-txt">
                                        <h2>${team.team_name}</h2>
                                        <div id="motto-display-row" style="display:flex; align-items:center; gap:12px;">
                                            <p style="color:var(--primary); font-weight:800; font-style:italic; font-size:20px;">"${team.team_motto || '전설의 서막'}"</p>
                                            ${isLeader ? `<button class="btn-edit-small" onclick="Boako.View.toggleEdit('motto')">수정</button>` : ''}
                                        </div>
                                        <div id="motto-edit-area" style="display:none; margin-top:10px; gap:8px;">
                                            <input type="text" id="input-motto" class="edit-input-box" style="width:250px; padding:8px;" value="${team.team_motto || ''}">
                                            <button class="btn-edit-small" style="background:var(--primary); color:white;" onclick="Boako.Team.updateInfo('team_motto')">저장</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div style="margin-top:20px; border-top:1px solid #f1f5f9; padding-top:30px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                                        <h4 style="font-weight:950; font-size:18px;">🛡️ 팀 상세 소개</h4>
                                        ${isLeader ? `<button class="btn-edit-small" onclick="Boako.View.toggleEdit('desc')">소개 수정</button>` : ''}
                                    </div>
                                    <p id="desc-display-txt" style="color:#64748b; font-size:15px; white-space:pre-wrap;">${team.team_desc || '소개가 없습니다.'}</p>
                                    <div id="desc-edit-area" style="display:none; flex-direction:column; gap:10px;">
                                        <textarea id="textarea-desc" rows="6" class="edit-input-box">${team.team_desc || ''}</textarea>
                                        <button class="btn-edit-small" style="background:var(--primary); color:white; align-self:flex-end;" onclick="Boako.Team.updateInfo('team_desc')">저장</button>
                                    </div>
                                </div>
                                
                                <div class="member-section" style="margin-top:40px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                                        <h4 style="font-weight:950; font-size:20px;">👥 팀 멤버 (${members?.length || 0}/4)</h4>
                                        ${isLeader ? `<button class="btn-edit-small" style="background:var(--primary); color:white; border:none; padding:10px 20px;" onclick="Boako.Team.addMember()">+ 멤버 추가</button>` : ''}
                                    </div>
                                    <div class="member-grid">
                                        ${members?.map(m => {
                                            const isMe = m.player_name === Boako.state.user.nickname;
                                            return `
                                            <div class="member-item">
                                                <div style="display:flex; align-items:center; gap:18px;">
                                                    <span class="role-tag ${m.role === 'LEADER' ? 'role-leader' : 'role-member'}">${m.role}</span>
                                                    <strong style="font-size:16px;">${m.player_name} ${isMe ? '<small style="color:var(--primary);">(나)</small>' : ''}</strong>
                                                </div>
                                                <div>
                                                    ${isLeader && m.role !== 'LEADER' ? `<button class="btn-edit-small" style="color:red; border-color:#fee2e2;" onclick="Boako.Team.kick('${m.player_name}')">방출</button>` : ''}
                                                    ${!isLeader && isMe ? `<button class="btn-edit-small" onclick="Boako.Team.leave()">팀 탈퇴</button>` : ''}
                                                </div>
                                            </div>`;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>

                            <div id="tab-chat" class="team-tab-content hidden animate-in fade-in duration-300 w-full pt-4">
                                <div id="team-chat-container" class="w-full"></div>
                            </div>

                            <div id="tab-record" class="team-tab-content hidden animate-in fade-in duration-300 pt-4">
                                ${recordTabHtml}
                            </div>

                        </div>

                    </section>
                    `;

                    // 채팅창 엔진은 백그라운드에서 바로 가동시킵니다.
                    setTimeout(() => {
                        if (Boako.Team && Boako.Team.Chat && typeof Boako.Team.Chat.init === 'function') {
                            Boako.Team.Chat.init('team-chat-container');
                        }
                    }, 0);

                } else {
                    html = `
                    <div class="main-banner"><h1>🛡️ 팀 창단</h1></div>
                    <section class="section-card">
                        <div class="card-header">신규 팀 정보 입력</div>
                        <div class="card-body">
                            <form onsubmit="Boako.Team.create(event)">
                                <div class="form-group"><label>팀 이름 (필수)</label><input type="text" id="team_name" class="edit-input-box" placeholder="팀명을 입력하세요" required></div>
                                <div class="form-group" style="margin-top:15px;"><label>팀 슬로건</label><input type="text" id="team_motto" class="edit-input-box" placeholder="각오 한마디"></div>
                                <div class="form-group" style="margin-top:15px;"><label>팀 상세 소개</label><textarea id="team_desc" rows="5" class="edit-input-box" placeholder="팀 모집 요강 등"></textarea></div>
                                <div class="form-group" style="margin-top:15px;">
                                    <label>팀 로고 (필수)</label>
                                    <div class="custom-upload" onclick="document.getElementById('team_logo').click()">
                                        <div id="upload-placeholder">🖼️<br><b>로고 이미지 업로드</b><br><small>클릭하여 파일을 선택하세요</small><br><small>해상도 500 X 500 이하의 배경이 없는 Png 파일이여야 합니다</small></div>
                                        <div id="preview-container" class="preview-img-container">
                                            <img id="logo-preview-img" src="">
                                            <div style="position:absolute; top:10px; right:10px; background:red; color:white; width:25px; height:25px; border-radius:50%; display:flex; align-items:center; justify-content:center;" onclick="Boako.Util.removeImgPreview(event)">✕</div>
                                        </div>
                                        <input type="file" id="team_logo" accept="image/*" required onchange="Boako.Util.handleImgPreview(this)" style="display:none;">
                                    </div>
                                </div>
                                <button type="submit" id="btn_f" class="btn-submit" style="margin-top: 30px;">전설의 팀 창단하기</button>
                            </form>
                        </div>
                    </section>`;
                }
                break;

            case 'team_list':
                if (!Boako.TeamList || !Boako.TeamList.init) {
                    await Boako.Util.loadScript('js/team_list.js');
                }
                html = `<div id="team-list-master-container" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.TeamList && typeof Boako.TeamList.init === 'function') {
                        Boako.TeamList.init('team-list-master-container');
                    }
                }, 0);
                break;

            case 'record_verify':
                if (!Boako.state.user) {
                    html = `<div class="main-banner"><h1>✅ 기록 인증 센터</h1></div><div style="text-align:center; padding:100px 0;"><h3 style="color:#94a3b8;">카카오 로그인을 먼저 진행해 주세요.</h3></div>`;
                    break;
                }

                try {
                    const { data: leaderCheck, error: authError } = await Boako.db
                        .from('team_members')
                        .select('*')
                        .eq('player_name', Boako.state.user.nickname)
                        .eq('is_active', true)
                        .eq('role', 'LEADER')
                        .maybeSingle();

                    if (authError) throw authError;

                    if (!leaderCheck) {
                        html = `
                            <div class="main-banner" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);">
                                <h1>🚫 접근 권한 없음</h1>
                                <p>팀 리더 전용 보안 구역입니다.</p>
                            </div>
                            <div style="text-align:center; padding:100px 0;">
                                <i data-lucide="shield-alert" class="text-red-400 w-16 h-16 mx-auto mb-4 animate-bounce"></i>
                                <h3 class="text-slate-500 font-bold text-lg">현재 소속된 팀의 'LEADER'가 아니거나, 비활성화 상태입니다.</h3>
                                <p class="text-slate-400 text-sm mt-1">기록 인증 권한은 정식 팀장에게만 부여됩니다.</p>
                            </div>
                        `;
                        break;
                    }

                    if (!Boako.RecordVerify || !Boako.RecordVerify.init) {
                        await Boako.Util.loadScript('js/record_verify.js');
                    }

                    html = `
                        <div class="main-banner" style="background: linear-gradient(135deg, #059669 0%, #047857 100%);">
                            <h1>✅ 팀 리그 기록 인증 센터</h1>
                            <p>다른 팀원들의 경기 기록을 최종 검증하고 서명합니다.</p>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="section-card col-span-1">
                                <div class="card-header" style="font-size:16px;">📋 리더 인증 수칙</div>
                                <div class="card-body" style="padding:20px 25px;">
                                    <ul class="text-slate-600 text-xs font-bold space-y-4 leading-relaxed">
                                        <li>1. 옆에 보이는 기록을 살펴봐주세요! <span class="text-red-500">클릭</span>하면, 해당 테이블이 새 창으로 열립니다.</li>
                                        <li>2. 기록 정보와 <span class="text-emerald-600">BGA 테이블</span> 정보가 일치하는지 대조해주세요.</li>
                                        <li>3. 승인 완료 시 해당 점수가 팀 스코어 및 랭킹보드에 실시간 즉시 반영됩니다.</li>
                                    </ul>
                                </div>
                            </div>

                            <div class="section-card col-span-2">
                                <div class="card-header" style="font-size:16px;">⏳ 우리 팀 기록 인증 대기열</div>
                                <div class="card-body" style="min-height: 300px; background: #f8fafc; padding: 30px;">
                                    <div id="team-verify-list-container" class="text-center text-slate-400 font-bold py-20">
                                        인증 대기 중인 팀 전적이 없습니다.
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    setTimeout(() => {
                        if (Boako.RecordVerify && typeof Boako.RecordVerify.init === 'function') {
                            Boako.RecordVerify.init();
                        }
                    }, 0);

                } catch (err) {
                    console.error("리더 권한 검증 중 치명적 오류:", err);
                    html = `<div class="text-center py-20 text-red-400 font-bold">권한 시스템 동기화에 실패했습니다.</div>`;
                }
                break;

            case 'shop':
                if (!Boako.state.user) {
                    html = `<div class="main-banner" style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);"><h1>🛒 포인트 샵</h1></div><div style="text-align:center; padding:100px 0;"><h3 style="color:#94a3b8;">카카오 로그인을 먼저 진행해 주세요.</h3></div>`;
                    break;
                }
                
                if (!Boako.Shop || !Boako.Shop.buyItem) {
                    await Boako.Util.loadScript('js/shop.js');
                }

                const { data: myProfile } = await Boako.db.from('profiles').select('points').eq('id', Boako.state.user.id).single();
                const myPoints = myProfile?.points || 0;
                
                const { data: pointHistory } = await Boako.db.from('point_history')
                    .select('*')
                    .eq('user_id', Boako.state.user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                const { data: shopItems } = await Boako.db.from('shop_items')
                    .select('*')
                    .eq('is_active', true)
                    .order('price', { ascending: true });

                html = `
                <div class="main-banner" style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                    <h1>🛒 프리미엄 포인트 샵</h1>
                    <p style="margin-top:10px; font-size:20px; font-weight:800; background:rgba(0,0,0,0.2); padding:5px 20px; border-radius:30px;">
                        내 지갑: <span style="color:#fde047;">${myPoints.toLocaleString()} P</span>
                    </p>
                </div>
                
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:25px; margin-bottom:40px;">
                    ${(shopItems || []).map(item => `
                        <div class="section-card" style="margin-bottom:0; display:flex; flex-direction:column; text-align:center; transition:0.3s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                            <div class="card-body" style="flex:1;">
                                <div style="width: 80px; height: 80px; font-size: 60px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                    ${item.icon && item.icon.startsWith('http') 
                                        ? `<img src="${item.icon}" style="width: 100%; height: 100%; object-fit: contain;">` 
                                        : (item.icon || '❓')
                                    }
                                </div>
                                <h3 style="font-size:20px; font-weight:900; margin-bottom:10px;">${item.name}</h3>
                                <p style="color:#64748b; font-size:14px; word-break:keep-all;">${item.description}</p>
                            </div>
                            <div style="padding:20px; border-top:1px solid #f1f5f9; background:#fafafa;">
                                <button class="btn-submit" style="padding:15px; font-size:16px; background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 10px 20px rgba(245, 158, 11, 0.2);" onclick="Boako.Shop.buyItem('${item.item_id}')">
                                    💎 ${item.price.toLocaleString()} P 구매
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <section class="section-card">
                    <div class="card-header" style="font-size:18px;">🧾 최근 포인트 이용 내역</div>
                    <div class="card-body" style="padding:0;">
                        ${(!pointHistory || pointHistory.length === 0) 
                            ? `<div style="padding:40px; text-align:center; color:#94a3b8; font-weight:700;">이용 내역이 없습니다.</div>`
                            : `<ul style="list-style:none; margin:0; padding:0;">
                                ${pointHistory.map(log => {
                                    const date = new Date(log.created_at).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                                    const isPlus = log.point_change > 0;
                                    const color = isPlus ? '#10b981' : '#ef4444';
                                    const sign = isPlus ? '+' : '';
                                    return `
                                    <li style="display:flex; justify-content:space-between; align-items:center; padding:18px 30px; border-bottom:1px solid #f1f5f9;">
                                        <div>
                                            <div style="font-size:13px; color:#94a3b8; font-weight:600; margin-bottom:4px;">${date}</div>
                                            <div style="font-size:16px; font-weight:800; color:#334155;">${log.description}</div>
                                        </div>
                                        <div style="font-size:18px; font-weight:900; color:${color};">
                                            ${sign}${log.point_change.toLocaleString()} P
                                        </div>
                                    </li>`;
                                }).join('')}
                               </ul>`
                        }
                    </div>
                </section>
                `;
                break;

            case 'inventory':
                if (!Boako.Inventory || !Boako.Inventory.loadItems) {
                    await Boako.Util.loadScript('js/inventory.js');
                }

                html = `
                    <div class="main-banner"><h1>🎒 내 인벤토리</h1></div>
                    <section class="section-card">
                        <div class="card-header">배지 및 아이템 관리</div>
                        <div class="card-body">
                            
                            <div class="badge-slots-area" style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                                <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 15px;">✨ 장착 중인 배지</h3>
                                <div id="equipped-badges">로딩 중...</div>
                            </div>

                            <div class="inventory-items-area">
                                <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 15px;">📦 내 가방</h3>
                                <div id="inventory-list">로딩 중...</div>
                            </div>

                        </div>
                    </section>
                `;
                setTimeout(() => {
                    if (Boako.Inventory && typeof Boako.Inventory.loadItems === 'function') {
                        Boako.Inventory.loadItems();
                    }
                }, 0);
                break;

            case 'admin_review':
                if (!Boako.AdminReview || !Boako.AdminReview.init) {
                    await Boako.Util.loadScript('js/admin_review.js');
                }

                html = `
                    <div class="main-banner" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%);">
                        <h1>🛠️ 아카이브 검수센터</h1>
                        <p>수정이 필요한 데이터를 검토하고 승인합니다.</p>
                    </div>
                    <section class="section-card">
                        <div class="card-header">데이터 검수 대기 리스트</div>
                        <div class="card-body" style="min-height: 400px; background: #f8fafc;">
                            <div id="review-container">
                                <div style="text-align:center; padding:50px; color:#94a3b8;">데이터를 불러오는 중...</div>
                            </div>
                        </div>
                    </section>
                `;
                setTimeout(() => {
                    if (Boako.AdminReview && typeof Boako.AdminReview.init === 'function') {
                        Boako.AdminReview.init();
                    }
                }, 0);
                break;

            case 'messenger':
                if (!Boako.state.user) {
                    html = `<div class="main-banner"><h1>📬 아카이브 통신망</h1></div><div style="text-align:center; padding:100px 0;"><h3 style="color:#94a3b8;">카카오 로그인을 먼저 진행해 주세요.</h3></div>`;
                    break;
                }
                
                if (!Boako.Messenger || !Boako.Messenger.View) {
                    await Boako.Util.loadScript('js/messenger.js');
                }
                
                html = `<div id="main-content" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.Messenger && typeof Boako.Messenger.View.renderMain === 'function') {
                        Boako.Messenger.View.renderMain();
                    }
                }, 0);
                break;

            case 'schedule':
                if (!Boako.Schedule || !Boako.Schedule.View) {
                    await Boako.Util.loadScript('js/schedule.js');
                }
                
                html = `<div id="main-content" class="w-full"></div>`;
                
                setTimeout(() => {
                    if (Boako.Schedule && typeof Boako.Schedule.View.renderMain === 'function') {
                        Boako.Schedule.View.renderMain();
                    }
                }, 0);
                break;

            case 'main': default:
                html = `<div class="main-banner"><h1>BOAKO ARCHIVE</h1><p>데이터로 기록되는 보드게임 성지</p></div><div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;"><section class="section-card"><div class="card-header">공지사항</div><div class="card-body" style="min-height:180px;">BTL 시즌 정산 안내</div></section><section class="section-card"><div class="card-header">커뮤니티</div><div class="card-body" style="min-height:180px;">이달의 우수 팀 인터뷰</div></section></div>`;
        }
        area.innerHTML = html;
    }
};
