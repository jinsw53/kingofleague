/**
 * [VIEW] 화면 렌더링 및 페이지 템플릿 관리
 */
Boako.View = {
    toggleEdit: (type) => {
        const area = document.getElementById(`${type}-edit-area`);
        const display = type === 'motto' ? document.getElementById('motto-display-row') : document.getElementById('desc-display-txt');
        const isNone = area.style.display === 'none' || area.style.display === '';
        area.style.display = isNone ? 'flex' : 'none';
        display.style.display = isNone ? 'none' : (type === 'motto' ? 'flex' : 'block');
    },
    render: async (pageId) => {
        const area = document.getElementById('main-content-area');
        let html = '';
        
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        const navBtn = document.getElementById(pageId === 'team' ? 'menu-team' : `menu-${pageId}`);
        if (navBtn) navBtn.classList.add('active');

        switch(pageId) {
            case 'ranking':
                html = `<div class="main-banner"><h1>🏆 실시간 랭킹</h1></div><section class="section-card"><div class="card-body">집계 중...</div></section>`;
                break;
            case 'records':
                html = `<div class="main-banner"><h1>📋 전적 아카이브</h1></div><section class="section-card"><div class="card-body">로그 로딩 중...</div></section>`;
                break;
            case 'team':
                if (!Boako.state.user) {
                    html = `<div class="main-banner"><h1>🛡️ 팀 서비스</h1></div><div style="text-align:center; padding:100px 0;"><h3 style="color:#94a3b8;">카카오 로그인을 먼저 진행해 주세요.</h3></div>`;
                    break;
                }
                await Boako.Team.syncStatus();
                if (Boako.state.team) {
                    const { info: team, type } = Boako.state.team;
                    const isLeader = type === 'LEADER';
                    const { data: members } = await Boako.db.from('team_members').select('*').eq('team_id', team.id).eq('is_active', true);
                    
                    html = `
                    <div class="main-banner"><h1>${team.team_name}</h1></div>
                    <section class="section-card">
                        <div class="card-header">나의 팀 대시보드</div>
                        <div class="card-body">
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
                    </section>`;
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
                // 포인트샵 관련
            case 'shop':
                if (!Boako.state.user) {
                    html = `<div class="main-banner" style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);"><h1>🛒 포인트 샵</h1></div><div style="text-align:center; padding:100px 0;"><h3 style="color:#94a3b8;">카카오 로그인을 먼저 진행해 주세요.</h3></div>`;
                    break;
                }
                
                // 1. 내 포인트와 영수증 내역 조회
                const { data: myProfile } = await Boako.db.from('profiles').select('points').eq('id', Boako.state.user.id).single();
                const myPoints = myProfile?.points || 0;
                
                const { data: pointHistory } = await Boako.db.from('point_history')
                    .select('*')
                    .eq('user_id', Boako.state.user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                // 2. DB에서 판매 중인 아이템 목록 가져오기
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
                                <div style="font-size:60px; margin-bottom:15px;">${item.icon}</div>
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

                <!-- 영수증 UI -->
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
                // 🎒 [2] 내 인벤토리 버튼을 눌렀을 때
                case 'inventory':
                    contentArea.innerHTML = `
                        <div class="inventory-container">
                            <h2 style="margin-bottom: 20px;">🎒 내 인벤토리 및 배지 관리</h2>
                            
                            <!-- 장착된 배지 슬롯 영역 -->
                            <div class="badge-slots-area" style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                                <h3>✨ 장착 중인 배지</h3>
                                <div id="equipped-badges">로딩 중...</div>
                            </div>

                            <!-- 보유 중인 아이템 가방 영역 -->
                            <div class="inventory-items-area">
                                <h3>📦 내 가방</h3>
                                <div id="inventory-list">로딩 중...</div>
                            </div>
                        </div>
                    `;
                    // 화면을 다 그렸으니, DB에서 아이템을 가져와서 채우는 함수 실행 (앞으로 만들 부분!)
                    // Boako.Inventory.loadItems();
                    
                    break; // 👈 inventory 다 그렸으면 여기서 탈출!
            case 'main': default:
                html = `<div class="main-banner"><h1>BOAKO ARCHIVE</h1><p>데이터로 기록되는 보드게임 성지</p></div><div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;"><section class="section-card"><div class="card-header">공지사항</div><div class="card-body" style="min-height:180px;">BTL 시즌 정산 안내</div></section><section class="section-card"><div class="card-header">커뮤니티</div><div class="card-body" style="min-height:180px;">이달의 우수 팀 인터뷰</div></section></div>`;
        }
        area.innerHTML = html;
    }
};
