/**
 * [MOBILE TEAM HUB] 모바일 전용 — 팀 창단 / 팀 본부(정보+로스터+지갑+포인트내역+우승별) /
 * 작전 회의실(팀챗) / 대항전 기록·일정 / 챌린지
 * 🌟 PC js/team.js의 팀 본부/작전회의실/대항전 기록·일정/챌린지 4개 탭 + 우승 별 붙이기까지
 *    전부 단계적으로 포팅 완료. 각 단계:
 *    1단계: 팀 본부(정보+로스터+초대/강퇴/탈퇴) + 작전 회의실(팀챗)
 *    2단계: 대항전 기록·일정(시즌 페이즈별 밴투표/엔트리작전판/경기일정) + 팀 본부에 포인트 이용 내역
 *    3단계: 포인트 환전 지갑(드롭다운 방식), 우승 별 붙이기, 챌린지 탭.
 * 🌟 [버그수정] 지갑 지급 대상 드롭다운에서 팀장 본인을 무심코 제외했었음 — PC는 팀원 카드
 *    드래그 조건이 isDraggable = isLeader뿐이라(isMe 배제 없음) 팀장 본인도 대상이 될 수 있었음.
 *    PC와 동일하게 본인도 목록에 포함하도록 수정(선택 시 "(나)" 표기 추가).
 * 🌟 [재사용 원칙] Boako.Team.searchUser/executeInvite/addMember(멤버 스카웃 모달)/openBanVote/
 *    openEntryForm/loadTeamPointHistory/updateWalletPreview/_compositeStars/_uploadStarLogo/
 *    _makeDraggableStar/_renderStarModalMode는 PC 전용 DOM에 의존하지 않고 Tailwind 유틸리티
 *    클래스만 쓰거나 특정 컨테이너 id만 참조하는 자기완결형 함수라 모바일에서도 안전하게 그대로
 *    재사용함(모바일도 Tailwind CDN을 로드하므로 동일 클래스가 그대로 먹힘). 우승 별 드래그는
 *    Pointer Events 기반이라 터치에서도 원래부터 동작함 — 별도 터치 UI 재설계가 필요 없었음.
 * 🌟 [버그 회피] Boako.Team.create()/kick()/confirmStarPlacement()/confirmStarReset()과
 *    Boako.Team.submitWalletExchange()는 마지막에 PC 전용 화면 전환/DOM(Boako.View.render('team')
 *    또는 '#team-wallet-container')을 건드려서 모바일에서 그대로 쓰면 에러나거나 조용히 무시됨
 *    (messenger.js의 startRealtime 콜백이 Boako.Auth.renderWidget()을 부르던 것과 동일한 문제
 *    패턴). create/kick/confirmStar*는 동일한 DB 로직을 이 파일에 재구현하고 마무리만 모바일
 *    재렌더로 대체. submitWalletExchange는 PC 함수를 그대로 호출한 뒤(RPC/사운드/토스트 재사용)
 *    모바일 지갑만 명시적으로 다시 그려줌. 우승 별의 "확정하고 저장" 버튼은 PC의 모달 마크업/
 *    드래그 로직을 그대로 쓰되, _renderStarModalMode를 모바일 세션에서만 런타임 래핑해서 클릭
 *    핸들러만 모바일 안전 버전으로 매번 다시 연결함(team.js 파일 자체는 절대 수정하지 않음).
 * 🌟 [버그 회피] Boako.Team.loadMatchSchedule()/Boako.League.openChallengeChat()도 진행 예정
 *    경기/챌린지 채팅방 열기 시 Boako.View.render('messenger')를 호출해서 모바일에서 에러남 —
 *    모바일 쪽지함(messenger)이 아직 포팅 전이라, 경기 일정은 조회/렌더 로직을 이 파일에
 *    재구현하고 진행 예정 경기 클릭 시 토스트로 대체(완료 경기는 외부 링크 그대로 동작), 챌린지
 *    쪽은 openChallengeChat 함수 자체를 모바일 세션에서 토스트로 안전하게 덮어씀.
 * 🌟 [알려진 제한] 팀챗 실시간 채널(subscribeChat)은 PC의 Boako.Team.Chat과 마찬가지로 아직
 *    js/realtime_coordinator.js 탭 리더 선출을 적용하지 않음 — 화면을 벗어날 때(teardownChat)
 *    확실히 구독 해제해서 최소한 "떠나 있는 동안 계속 열려있는" 것만 방지함. 사이트 전역 실시간
 *    최적화 작업 때 PC/모바일 팀챗을 함께 코디네이터 방식으로 옮기는 걸 백로그로 남겨둠.
 * 🌟 [버그수정] 팀 배너 색을 임의로 남색(#1e293b→#0f172a)으로 지정했었는데, PC team.js는 이
 *    배너에 배경색을 따로 안 주고 .main-banner 기본값(보라색 #8b5cf6→#6d28d9)을 그대로 씀 —
 *    PC와 동일하게 수정. 서포터즈 배지 아이콘도 🎽 이모지로 대충 넣었던 걸 PC와 동일하게
 *    "시즌 유니폼 이미지(없으면 저지 실루엣 SVG)"로, 도전권 배지도 🎟️ 이모지 대신 실제
 *    CHALLENGE_TOKEN_ICON 이미지로 교체. PC 배너엔 팀 로고 이미지가 없어 마찬가지로 제거.
 */
window.Boako = window.Boako || {};
Boako.MobileTeamHub = {

    activeTab: 'info',
    team: null,
    members: [],
    isLeader: false,
    bannerStats: {},

    chatChannel: null,
    chatReadsChannel: null,
    chatActiveMemberCount: 0,
    chatReadRows: [],

    render: async (container) => {
        if (!Boako.state.user) {
            container.innerHTML = `<div style="padding:60px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">🔒 로그인 후 이용할 수 있어요.</div>`;
            return;
        }
        if (!Boako.Team || !Boako.Team.syncStatus) await Boako.Util.loadScript('/js/team.js');
        await Boako.Team.syncStatus();

        if (!Boako.state.team) {
            Boako.MobileTeamHub.renderCreateForm(container);
            return;
        }
        await Boako.MobileTeamHub.loadAndDraw(container);
    },

    // ========== 🌟 팀 창단 폼 (무소속 유저) ==========
    renderCreateForm: (container) => {
        container.innerHTML = `
            <div style="background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:16px; padding:18px 20px; margin-bottom:14px;">
                <div style="font-size:16px; font-weight:900; color:#fff;">🛡️ 팀 창단</div>
                <div style="font-size:11.5px; font-weight:700; color:#94a3b8; margin-top:4px;">전설의 팀을 만들어보세요</div>
            </div>
            <form onsubmit="Boako.MobileTeamHub.create(event)" style="display:flex; flex-direction:column; gap:14px;">
                <div>
                    <label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">팀 이름 (필수)</label>
                    <input type="text" id="team_name" required placeholder="팀명을 입력하세요" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;">
                </div>
                <div>
                    <label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">팀 슬로건</label>
                    <input type="text" id="team_motto" placeholder="각오 한마디" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;">
                </div>
                <div>
                    <label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">팀 상세 소개</label>
                    <textarea id="team_desc" rows="4" placeholder="팀 모집 요강 등" style="width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:11px; font-size:14px;"></textarea>
                </div>
                <div>
                    <label style="font-size:12px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">팀 로고 (필수, 투명 PNG 500x500 이하)</label>
                    <div onclick="document.getElementById('team_logo').click()" style="position:relative; border:2px dashed #cbd5e1; border-radius:14px; padding:20px; text-align:center; background:#f8fafc;">
                        <div id="upload-placeholder" style="font-size:12px; font-weight:700; color:#64748b;">🖼️<br>로고 이미지 업로드<br><span style="color:#dc2626; font-weight:800; font-size:10.5px;">⚠️ 배경 투명 PNG만 가능</span></div>
                        <div id="preview-container" style="display:none; align-items:center; justify-content:center; position:relative;">
                            <img id="logo-preview-img" src="" style="max-width:120px; max-height:120px;">
                            <div onclick="Boako.Util.removeImgPreview(event)" style="position:absolute; top:-10px; right:calc(50% - 70px); background:#ef4444; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">✕</div>
                        </div>
                        <input type="file" id="team_logo" accept="image/*" required onchange="Boako.Util.handleImgPreview(this)" style="display:none;">
                    </div>
                </div>
                <button type="submit" id="btn_f" style="background:linear-gradient(135deg,#7c3aed,#4f46e5); color:#fff; font-weight:900; font-size:14px; padding:14px; border-radius:12px;">전설의 팀 창단하기</button>
            </form>
        `;
    },

    // 🌟 Boako.Team.create()와 완전히 동일한 DB 로직 — 마지막만 모바일 재렌더로 대체
    create: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn_f');
        const file = document.getElementById('team_logo').files[0];
        btn.disabled = true; btn.innerText = "창단 처리 중...";

        try {
            const fExt = file.name.split('.').pop();
            const fName = `${Date.now()}.${fExt}`;
            await Boako.db.storage.from('teams').upload(fName, file);
            const { data: uData } = Boako.db.storage.from('teams').getPublicUrl(fName);

            let myName = Boako.state.user.nickname;
            if (!myName) {
                const { data: profile } = await Boako.db.from('profiles').select('full_name').eq('id', Boako.state.user.id).maybeSingle();
                myName = profile?.full_name || Boako.state.user.user_metadata?.full_name || "이름없음";
                Boako.state.user.nickname = myName;
            }

            const { error: teamError } = await Boako.db.from('teams').insert([{
                team_name: document.getElementById('team_name').value.trim(),
                owner_id: Boako.state.user.id,
                leader_name: myName,
                team_motto: document.getElementById('team_motto').value.trim(),
                team_desc: document.getElementById('team_desc').value.trim(),
                logo_url: uData.publicUrl,
                logo_url_origin: uData.publicUrl
            }]);
            if (teamError) throw teamError;

            Boako.Util.toast("✅ 새로운 전설의 팀이 탄생했습니다!");
            await Boako.Team.syncStatus();
            Boako.MobileTeamHub.activeTab = 'info';
            await Boako.MobileTeamHub.render(document.getElementById('mobile-content-area'));
        } catch (err) {
            Boako.Util.toast(err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = "전설의 팀 창단하기"; }
        }
    },

    // ========== 🌟 팀 본부 데이터 로드 (PC view.js case 'team'의 배너 통계 쿼리와 동일) ==========
    loadAndDraw: async (container) => {
        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;
        try {
            const team = Boako.state.team.info;
            const isLeader = Boako.state.team.type === 'LEADER';
            const { data: members } = await Boako.db.from('team_members').select('*').eq('team_id', team.id).eq('is_active', true);
            if (members) members.sort((a, b) => (a.role === 'LEADER' ? -1 : 1));

            let bannerStats = { currentSeasonRank: null, currentSeasonTeamCount: 0, totalChampionships: 0, bestRank: null, supporterCount: 0, liveSeasonNo: null, starEligible: false, latestWinSeasonNo: null, uniformImageUrl: null };
            try {
                const nowIso = new Date().toISOString();
                const { data: liveSeason } = await Boako.db.from('seasons').select('season_no, uniform_image_url').lte('start_date', nowIso).gte('end_date', nowIso).maybeSingle();
                if (liveSeason) {
                    bannerStats.uniformImageUrl = liveSeason.uniform_image_url;
                    const { data: currentRanking } = await Boako.db.from('v_season_current_ranking').select('team_name, total_lp').eq('season_no', liveSeason.season_no).order('total_lp', { ascending: false });
                    if (currentRanking) {
                        bannerStats.currentSeasonTeamCount = currentRanking.length;
                        const myIdx = currentRanking.findIndex(r => r.team_name === team.team_name);
                        if (myIdx !== -1) { bannerStats.currentSeasonRank = myIdx + 1; bannerStats.liveSeasonNo = liveSeason.season_no; }
                    }
                }
                const { data: historyRows } = await Boako.db.from('season_final_rankings').select('final_rank, season_no').eq('team_name', team.team_name);
                if (historyRows && historyRows.length > 0) {
                    bannerStats.totalChampionships = historyRows.filter(r => r.final_rank === 1).length;
                    bannerStats.bestRank = Math.min(...historyRows.map(r => r.final_rank));
                }
                // 🌟 우승 별 붙이기 자격 판별 — 우승한 시즌 중 아직 별을 안 붙인 가장 최근 시즌 (PC view.js와 동일 공식)
                const winSeasonNos = (historyRows || []).filter(r => r.final_rank === 1).map(r => r.season_no);
                bannerStats.latestWinSeasonNo = winSeasonNos.length > 0 ? Math.max(...winSeasonNos) : null;
                bannerStats.starEligible = bannerStats.latestWinSeasonNo !== null && team.last_star_season_no !== bannerStats.latestWinSeasonNo;
                const { count: supporterCount } = await Boako.db.from('inventory').select('id', { count: 'exact', head: true }).like('item_id', `item_supporter_badge_${team.id}`).gt('expires_at', nowIso);
                bannerStats.supporterCount = supporterCount || 0;
            } catch (bannerErr) { console.error('팀 배너 통계 로드 실패:', bannerErr); }

            Boako.MobileTeamHub.team = team;
            Boako.MobileTeamHub.members = members || [];
            Boako.MobileTeamHub.isLeader = isLeader;
            Boako.MobileTeamHub.bannerStats = bannerStats;

            Boako.MobileTeamHub.draw(container);
        } catch (e) {
            console.error('모바일 팀 화면 로드 실패:', e);
            container.innerHTML = `<div style="padding:40px 16px; text-align:center; color:#ef4444; font-weight:700; font-size:13px;">불러오지 못했습니다.</div>`;
        }
    },

    draw: (container) => {
        const { team, bannerStats, activeTab } = Boako.MobileTeamHub;

        const currentSeasonLine = bannerStats.currentSeasonRank
            ? `🔴 시즌 ${bannerStats.liveSeasonNo} 진행 중 · 잠정 ${bannerStats.currentSeasonRank}위 / ${bannerStats.currentSeasonTeamCount}팀`
            : `⚪ 현재 진행 중인 시즌 기록 없음`;
        const historyLine = bannerStats.bestRank
            ? `🏆 통산 ${bannerStats.totalChampionships}회 우승 · 최고 순위 ${bannerStats.bestRank}위`
            : `🏆 아직 종료된 시즌 기록이 없습니다`;

        // 🌟 PC view.js와 완전히 동일한 아이콘 소스 사용 — 서포터즈는 시즌 유니폼 이미지(없으면 저지
        // 실루엣 SVG), 도전권은 CHALLENGE_TOKEN_ICON 이미지. 임의 이모지로 대체하지 않음.
        const CHALLENGE_TOKEN_ICON = 'https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/teams/etc/challengetoken.png';
        const uniformIconHtml = bannerStats.uniformImageUrl
            ? `<img src="${Boako.Util.cdn(bannerStats.uniformImageUrl)}" style="width:18px; height:18px; object-fit:contain;">`
            : `<svg width="18" height="18" viewBox="0 0 100 100"><path d="M50 22 L60 22 L74 30 L68 42 L60 37 L60 78 L40 78 L40 37 L32 42 L26 30 L40 22 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="3"/></svg>`;

        // 🌟 [버그수정] PC team.js는 이 페이지에서 .main-banner 배경색을 따로 지정하지 않아
        // 기본값(보라색 #8b5cf6→#6d28d9)을 그대로 씀 — 임의로 남색을 넣었던 걸 PC와 동일하게 수정.
        // PC 배너에는 팀 로고 이미지가 없어 마찬가지로 제거.
        const bannerHtml = `
            <div style="background:linear-gradient(135deg,#8b5cf6,#6d28d9); border-radius:20px; padding:18px 20px; margin-bottom:12px; color:#fff;">
                <div style="font-size:18px; font-weight:900;">${Boako.MobileTeamHub.escapeHtml(team.team_name)}</div>
                <div style="font-size:12px; font-weight:800; opacity:0.9; margin-top:8px; display:flex; flex-direction:column; gap:4px;">
                    <div>${currentSeasonLine}</div>
                    <div>${historyLine}</div>
                </div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <div style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.15); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:900;">${uniformIconHtml} 서포터즈 ${bannerStats.supporterCount}명</div>
                    <div style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.15); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:900;"><img src="${Boako.Util.cdn(CHALLENGE_TOKEN_ICON)}" style="width:18px; height:18px; object-fit:contain;"> 도전권 ${team.challengetokens || 0}개</div>
                </div>
            </div>
        `;

        const tabBtn = (tab, label) => `
            <button onclick="Boako.MobileTeamHub.switchTab('${tab}')" style="flex:1; padding:9px 0; border-radius:9px; font-size:12px; font-weight:900; background:${activeTab === tab ? '#1e293b' : '#f1f5f9'}; color:${activeTab === tab ? '#fff' : '#64748b'};">${label}</button>
        `;

        container.innerHTML = `
            ${bannerHtml}
            <div style="display:flex; gap:6px; margin-bottom:12px;">
                ${tabBtn('info', '🛡️ 팀 본부')}
                ${tabBtn('chat', '💬 작전 회의실')}
                ${tabBtn('record', '⚔️ 대항전')}
                ${tabBtn('challenge', '🔥 챌린지')}
            </div>
            <div id="mobile-team-tab-content"></div>
        `;

        if (activeTab === 'chat') {
            Boako.MobileTeamHub.renderChatTab();
        } else if (activeTab === 'record') {
            Boako.MobileTeamHub.renderRecordTab();
        } else if (activeTab === 'challenge') {
            Boako.MobileTeamHub.renderChallengeTab();
        } else {
            Boako.MobileTeamHub.renderInfoTab();
        }
    },

    switchTab: (tab) => {
        if (Boako.MobileTeamHub.activeTab === tab) return;
        // 🌟 팀챗 탭을 벗어나면 실시간 구독을 확실히 정리 (백그라운드에 소켓을 남겨두지 않도록)
        if (Boako.MobileTeamHub.activeTab === 'chat') Boako.MobileTeamHub.teardownChat();
        Boako.MobileTeamHub.activeTab = tab;
        Boako.MobileTeamHub.draw(document.getElementById('mobile-content-area'));
    },

    // ========== 🌟 팀 본부 탭 (정보 + 로스터) ==========
    renderInfoTab: async () => {
        const wrap = document.getElementById('mobile-team-tab-content');
        if (!wrap) return;
        const { team, members, isLeader, bannerStats } = Boako.MobileTeamHub;

        const rosterHtml = (members || []).map(m => {
            const isMe = m.player_name === Boako.state.user.nickname;
            const escapedName = m.player_name.replace(/'/g, "\\'");
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        <span style="font-size:10px; font-weight:900; color:#fff; background:${m.role === 'LEADER' ? '#7c3aed' : '#94a3b8'}; padding:3px 8px; border-radius:6px; flex-shrink:0;">${m.role}</span>
                        <span style="font-size:13.5px; font-weight:800; color:#1e293b;">${Boako.MobileTeamHub.escapeHtml(m.player_name)}${isMe ? ' <span style="color:#7c3aed;">(나)</span>' : ''}</span>
                    </div>
                    ${isLeader && m.role !== 'LEADER' ? `<button onclick="Boako.MobileTeamHub.kick('${escapedName}')" style="font-size:11px; font-weight:800; color:#ef4444; border:1px solid #fee2e2; background:#fff; padding:6px 10px; border-radius:8px; flex-shrink:0;">방출</button>` : ''}
                    ${!isLeader && isMe ? `<button onclick="Boako.Team.leave()" style="font-size:11px; font-weight:800; color:#64748b; border:1px solid #e2e8f0; background:#fff; padding:6px 10px; border-radius:8px; flex-shrink:0;">탈퇴</button>` : ''}
                </div>
            `;
        }).join('');

        // 🌟 우승 별 버튼 — PC view.js와 동일 조건(자격 있거나 기존 별이 있으면 노출)
        const starBtnHtml = (isLeader && (bannerStats.starEligible || team.champion_star_count > 0))
            ? `<button onclick="Boako.MobileTeamHub.openStarModal(${bannerStats.starEligible ? bannerStats.latestWinSeasonNo : 'null'})" style="margin-top:10px; font-size:11.5px; font-weight:900; color:#fff; background:#f59e0b; padding:8px 14px; border-radius:8px;">${bannerStats.starEligible ? '🌟 우승 별 붙이기' : '⭐ 별 위치 관리'}</button>`
            : '';

        wrap.innerHTML = `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px; margin-bottom:12px;">
                <div style="font-size:14px; font-weight:900; color:#7c3aed; font-style:italic;">"${Boako.MobileTeamHub.escapeHtml(team.team_motto || '전설의 서막')}"</div>
                <div style="font-size:12px; color:#64748b; font-weight:600; margin-top:10px; white-space:pre-wrap; line-height:1.6;">${Boako.MobileTeamHub.escapeHtml(team.team_desc || '소개가 없습니다.')}</div>
                ${starBtnHtml}
            </div>

            <div id="mobile-team-wallet"></div>

            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; margin-top:16px;">
                <div style="font-size:13.5px; font-weight:900; color:#1e293b;">👥 팀 멤버 (${(members || []).length}/4)</div>
                ${isLeader ? `<button onclick="Boako.Team.addMember()" style="font-size:11.5px; font-weight:900; color:#fff; background:#7c3aed; padding:7px 12px; border-radius:8px;">+ 멤버 추가</button>` : ''}
            </div>
            ${rosterHtml}
            <div id="team-point-history-container" style="margin-top:16px;"></div>
        `;

        // 🌟 PC와 동일한 함수를 그대로 재사용 — '#team-point-history-container' id만 참조하는
        // 자기완결형 함수라 모바일에서도 안전. (Boako.Team은 이미 render()에서 로드됨)
        if (Boako.Team && Boako.Team.loadTeamPointHistory) Boako.Team.loadTeamPointHistory();

        await Boako.MobileTeamHub.renderWallet();
    },

    // ========== 🌟 포인트 환전 지갑 — PC는 팀원을 카드 위로 "드래그"해서 지급 대상을 바꾸는 방식인데
    // 터치 화면에선 그대로 안 먹혀서, 동일한 대상 선택을 드롭다운으로 대체. 실제 환전 로직(수수료
    // 계산/RPC 호출/사운드/토스트)은 PC의 Boako.Team.updateWalletPreview/submitWalletExchange를
    // 그대로 재사용 — 두 함수 다 'wallet-amount-input' 등 컨테이너 id만 참조하는 자기완결형이라
    // 모바일에서도 안전. 대상만 Boako.Team.walletDragTarget에 미리 세팅해서 넘겨줌.
    // ==========
    renderWallet: async () => {
        const wrap = document.getElementById('mobile-team-wallet');
        if (!wrap) return;
        wrap.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-weight:700; font-size:12px;">지갑 정보 로드 중...</div>`;

        try {
            const { team, members, isLeader } = Boako.MobileTeamHub;
            const userId = Boako.state.user.id;
            const teamId = team.id;
            const teamName = team.team_name;

            const { data: profile } = await Boako.db.from('profiles').select('points').eq('id', userId).single();
            const { data: teamInfo } = await Boako.db.from('teams').select('tpoint').eq('id', teamId).single();
            const myPoints = profile?.points || 0;
            const teamPoints = teamInfo?.tpoint || 0;

            const { data: realFeeRate } = await Boako.db.rpc('fn_get_team_fee_rate', { p_team_name: teamName });
            const feeRate = realFeeRate != null ? realFeeRate : 0.2;
            const feeRatePercent = Math.round(feeRate * 100);

            // 🌟 [버그수정] PC는 팀장 본인 카드도 드래그 가능한 대상이었음(isDraggable = isLeader,
            // isMe 배제 없음) — 드롭다운으로 옮기면서 본인을 무심코 제외했던 것을 PC 동작과 동일하게 되돌림.
            const targetOptions = isLeader
                ? `<option value="">💱 팀 금고로 환전</option>${(members || []).map(m => `<option value="${Boako.MobileTeamHub.escapeHtml(m.player_name)}">👑 ${Boako.MobileTeamHub.escapeHtml(m.player_name)}${m.player_name === Boako.state.user.nickname ? ' (나)' : ''} 님에게 지급</option>`).join('')}`
                : '';

            wrap.innerHTML = `
                <div style="display:flex; gap:8px; margin-bottom:10px;">
                    <div style="flex:1; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
                        <div style="font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase;">내 개인 포인트</div>
                        <div style="font-size:17px; font-weight:900; color:#1e293b; margin-top:2px;">${myPoints.toLocaleString()} <span style="font-size:11px; color:#94a3b8;">P</span></div>
                    </div>
                    <div style="flex:1; background:linear-gradient(135deg,#eef2ff,#f5f3ff); border:1px solid #ddd6fe; border-radius:12px; padding:12px;">
                        <div style="font-size:10px; font-weight:900; color:#7c3aed; text-transform:uppercase;">우리 팀 금고</div>
                        <div style="font-size:17px; font-weight:900; color:#5b21b6; margin-top:2px;">${teamPoints.toLocaleString()} <span style="font-size:11px; color:#a78bfa;">P</span></div>
                    </div>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
                    <div style="font-size:11.5px; font-weight:800; color:#64748b; margin-bottom:8px;">💱 포인트 환전 <span style="color:#f43f5e;">(수수료 ${feeRatePercent}%)</span></div>
                    ${isLeader ? `<select id="mobile-wallet-target" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:9px; font-size:12.5px; font-weight:700; margin-bottom:8px; background:#fff;">${targetOptions}</select>` : ''}
                    <div style="display:flex; gap:8px;">
                        <input type="number" id="wallet-amount-input" min="100" step="100" placeholder="100 단위로 입력" oninput="Boako.Team.updateWalletPreview(${feeRate})" style="flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:9px; font-size:12.5px;">
                        <button id="wallet-submit-btn" onclick="Boako.MobileTeamHub.submitWalletExchange(${feeRate})" style="background:#7c3aed; color:#fff; font-weight:900; font-size:12px; padding:0 16px; border-radius:8px;">환전하기</button>
                    </div>
                    <div id="wallet-preview" class="hidden" style="font-size:11px; font-weight:700; color:#94a3b8; margin-top:8px;">
                        수수료 <span id="wallet-preview-fee" style="color:#f43f5e;">0</span> P 차감 → <span id="wallet-preview-target">팀에</span> <span id="wallet-preview-net" style="color:#7c3aed;">0</span> P 지급
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('모바일 지갑 로드 실패:', e);
            wrap.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444; font-weight:700; font-size:12px;">오류: ${e.message}</div>`;
        }
    },

    // 🌟 [버그 회피] PC의 submitWalletExchange()는 성공 후 '#team-wallet-container'(PC 전용 id)를
    // 다시 그리려 하는데 모바일엔 그 id가 없어 조용히 무시됨(에러는 안 남) — 로직/RPC/사운드/토스트는
    // 100% 동일하게 재사용하고, 그 뒤에 모바일 지갑만 명시적으로 다시 그려줌.
    submitWalletExchange: async (feeRate) => {
        const targetSelect = document.getElementById('mobile-wallet-target');
        Boako.Team.walletDragTarget = targetSelect?.value || null;
        await Boako.Team.submitWalletExchange(feeRate);
        await Boako.MobileTeamHub.renderWallet();
    },

    // 🌟 Boako.Team.kick()과 완전히 동일한 DB 로직 — 마지막만 모바일 재렌더로 대체
    kick: async (name) => {
        if (!confirm(`${name} 님을 방출하시겠습니까? 기록은 보존됩니다.`)) return;
        await Boako.db.from('team_members').update({ is_active: false, left_at: new Date().toISOString() })
            .eq('team_id', Boako.state.team.info.id).eq('player_name', name).eq('is_active', true);
        await Boako.MobileTeamHub.render(document.getElementById('mobile-content-area'));
    },

    // ========== 🌟 대항전 기록·일정 (시즌 페이즈별 안내 + 밴투표/엔트리작전판 + 경기일정) ==========
    renderRecordTab: async () => {
        const wrap = document.getElementById('mobile-team-tab-content');
        if (!wrap) return;
        wrap.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;

        let seasonStatus = { current_phase: 0, title: '비시즌', day_count: 0 };
        try {
            const { data } = await Boako.db.rpc('get_current_season_status');
            if (data) seasonStatus = data;
        } catch (e) {
            console.error('시즌 상태 로드 실패:', e);
        }

        let bodyHtml = '';
        switch (seasonStatus.current_phase) {
            case 1: // 준비기
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; padding:40px 16px; background:#fff; border:1px solid #e2e8f0; border-radius:14px;">
                        <span style="font-size:32px;">⚔️</span>
                        <div style="font-size:15px; font-weight:900; color:#1e293b;">시즌 ${seasonStatus.season_no} 준비 기간</div>
                        <div style="font-size:12px; font-weight:700; color:#94a3b8;">후보 종목 선발을 위한 데이터가 집계 중입니다. (현재 ${seasonStatus.day_count}일 차)</div>
                    </div>`;
                break;
            case 2: // 밴 투표 기간
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; padding:40px 16px; background:#fef2f2; border:1px solid #fecaca; border-radius:14px;">
                        <span style="font-size:32px;">🚫</span>
                        <div style="font-size:15px; font-weight:900; color:#dc2626;">시즌 ${seasonStatus.season_no} 밴(Ban) 투표 진행 중</div>
                        <div style="font-size:12px; font-weight:700; color:#f87171;">우리 팀의 밴 투표 권한을 행사하세요! (마감까지 D-${52 - seasonStatus.day_count}일)</div>
                        <button onclick="Boako.Team.openBanVote()" style="margin-top:8px; background:#dc2626; color:#fff; font-weight:900; font-size:13px; padding:11px 20px; border-radius:10px;">투표소 입장하기</button>
                    </div>`;
                break;
            case 3: // 엔트리 등록 기간
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; padding:40px 16px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:14px;">
                        <span style="font-size:32px;">📝</span>
                        <div style="font-size:15px; font-weight:900; color:#047857;">시즌 ${seasonStatus.season_no} 출전 엔트리 마감 임박</div>
                        <div style="font-size:12px; font-weight:700; color:#34d399;">최종 확정된 종목에 출전할 선수를 등록하세요. (마감까지 D-${60 - seasonStatus.day_count}일)</div>
                        <button onclick="Boako.Team.openEntryForm()" style="margin-top:8px; background:#059669; color:#fff; font-weight:900; font-size:13px; padding:11px 20px; border-radius:10px;">엔트리 작전판 열기</button>
                    </div>`;
                break;
            case 4: // 본게임 진행 중
                bodyHtml = `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:14px; background:linear-gradient(135deg,#eff6ff,#eef2ff); border:1px solid #bfdbfe; border-radius:14px; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            ${seasonStatus.logo_url ? `<img src="${Boako.Util.cdn(seasonStatus.logo_url)}" style="height:32px; width:auto;">` : `<span style="font-size:22px;">🏆</span>`}
                            <div style="min-width:0;">
                                <div style="font-size:12.5px; font-weight:900; color:#1e293b;">시즌 ${seasonStatus.season_no}</div>
                                <div style="font-size:10.5px; font-weight:700; color:#2563eb;">${seasonStatus.day_count}일차 · 본게임 진행 중</div>
                            </div>
                        </div>
                    </div>
                    <div id="mobile-team-match-schedule"><div style="text-align:center; padding:24px; color:#94a3b8; font-weight:700; font-size:12.5px;">일정 데이터 로드 중...</div></div>
                `;
                break;
            default: // 비시즌
                bodyHtml = `
                    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; padding:50px 16px; color:#94a3b8; border:1px dashed #cbd5e1; border-radius:14px;">
                        <span style="font-size:24px;">🏆</span>
                        <div style="font-size:12.5px; font-weight:700;">현재 진행 중인 대항전 일정이 없습니다. (비시즌)</div>
                    </div>`;
                break;
        }

        wrap.innerHTML = bodyHtml;

        if (seasonStatus.current_phase === 4) {
            await Boako.MobileTeamHub.loadMatchSchedule();
        }
    },

    // 🌟 [버그 회피] PC의 Boako.Team.loadMatchSchedule()과 동일한 조회 로직이되, 진행 예정 경기
    // 클릭 시 Boako.Team.openMatchRoom()(내부에서 Boako.View.render('messenger') 호출)을 타지
    // 않도록 모바일 전용으로 재구현 — 모바일 쪽지함이 아직 없어서 토스트로 안내만 함.
    loadMatchSchedule: async () => {
        const container = document.getElementById('mobile-team-match-schedule');
        if (!container) return;

        try {
            const teamName = Boako.state.team.info.team_name;

            const { data: gameList } = await Boako.db.from('games').select('game_name, image_url');
            const gameLogoMap = {};
            (gameList || []).forEach(g => { gameLogoMap[g.game_name] = g.image_url; });

            const { data: gameScores } = await Boako.db.from('grandprix_game_scores').select('game_name, scores, source_url');
            const gameScoreMap = {};
            (gameScores || []).forEach(gs => { gameScoreMap[gs.game_name] = gs; });

            const { data: schedules } = await Boako.db
                .from('match_schedules')
                .select('*')
                .filter('participants', 'cs', `[{"team_name":"${teamName}"}]`)
                .eq('match_type', 'GRANDPRIX')
                .order('scheduled_time', { ascending: true });

            if (!schedules || schedules.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:24px 16px; color:#94a3b8; font-weight:700; font-size:12px; border:1px dashed #e2e8f0; border-radius:12px; background:#f8fafc;">아직 확정된 대항전 경기 일정이 없습니다.<br><span style="font-size:11px;">소통 채널에서 일정 조율을 진행해주세요.</span></div>`;
                return;
            }

            const statusMap = {
                UPCOMING: { label: '예정', bg: '#dbeafe', color: '#1d4ed8' },
                IN_PROGRESS: { label: '진행 중', bg: '#fef3c7', color: '#b45309' },
                COMPLETED: { label: '완료', bg: '#d1fae5', color: '#047857' }
            };

            container.innerHTML = schedules.map(s => {
                const dt = new Date(s.scheduled_time).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const st = statusMap[s.status] || { label: s.status, bg: '#f1f5f9', color: '#64748b' };
                const logoUrl = gameLogoMap[s.game_name];
                const logoHtml = logoUrl
                    ? `<img src="${Boako.Util.cdn(logoUrl)}" style="width:40px; height:40px; border-radius:10px; object-fit:contain; background:#f8fafc; padding:4px; flex-shrink:0;">`
                    : `<div style="width:40px; height:40px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">🎲</div>`;

                const opponent = (s.participants || []).find(p => p.team_name !== teamName);
                const opponentHtml = opponent ? `<div style="font-size:10.5px; color:#94a3b8; font-weight:700;">vs ${Boako.MobileTeamHub.escapeHtml(opponent.team_name)}</div>` : '';

                const isCompleted = s.status === 'COMPLETED';
                const scoreInfo = gameScoreMap[s.game_name];
                const lpEarned = isCompleted && scoreInfo ? (scoreInfo.scores?.[teamName] ?? null) : null;
                const tournamentUrl = isCompleted && scoreInfo ? scoreInfo.source_url : null;
                const lpBadge = isCompleted && lpEarned !== null
                    ? `<div style="font-size:10.5px; font-weight:900; color:#047857; background:#ecfdf5; border:1px solid #a7f3d0; padding:1px 7px; border-radius:8px; display:inline-block; margin-top:3px;">🏆 ${lpEarned} LP</div>`
                    : '';

                const clickAttr = isCompleted && tournamentUrl
                    ? `onclick="window.open('${tournamentUrl}', '_blank')"`
                    : `onclick="Boako.Util.toast('💬 일정 조율은 쪽지함 포팅 후 연결될 예정이에요!')"`;

                return `
                    <div ${clickAttr} style="display:flex; align-items:center; gap:10px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:10px; margin-bottom:8px;">
                        ${logoHtml}
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:12.5px; font-weight:900; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileTeamHub.escapeHtml(s.game_name)}</div>
                            ${opponentHtml}
                            <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-top:2px;">📅 ${dt}</div>
                            ${lpBadge}
                        </div>
                        <span style="font-size:10.5px; font-weight:900; padding:4px 9px; border-radius:8px; background:${st.bg}; color:${st.color}; flex-shrink:0;">${st.label}</span>
                    </div>`;
            }).join('');

        } catch (e) {
            console.error('대항전 일정 로드 실패:', e);
            container.innerHTML = `<div style="text-align:center; padding:24px; color:#ef4444; font-weight:700; font-size:12px;">일정 로드 실패: ${e.message}</div>`;
        }
    },

    // ========== 🌟 우승 별 붙이기 — PC의 모달 마크업/드래그 UI(Pointer Events 기반이라 터치도
    // 원래 지원됨)는 그대로 재사용하고, "확정하고 저장" 버튼의 최종 저장 로직만 모바일 안전 버전으로
    // 바꿔치기함. Boako.Team.confirmStarPlacement/confirmStarReset은 마지막에 PC 전용
    // Boako.View.render('team')을 호출해서 모바일에서 에러나므로, _renderStarModalMode가
    // 매번 새로 그리는 confirm 버튼 클릭 핸들러를 그때마다 다시 가로채서 모바일 버전으로 연결함
    // (팀.js 파일 자체는 절대 수정하지 않고, 모바일 세션 안에서만 런타임에 재정의).
    openStarModal: (winSeasonNo) => {
        if (!Boako.Team._mobileStarPatched) {
            const original = Boako.Team._renderStarModalMode;
            Boako.Team._renderStarModalMode = function (mode, seasonNo) {
                original(mode, seasonNo);
                const confirmBtn = document.getElementById('star-modal-confirm');
                if (confirmBtn) {
                    confirmBtn.onclick = mode === 'add'
                        ? () => Boako.MobileTeamHub.confirmStarPlacement(seasonNo)
                        : () => Boako.MobileTeamHub.confirmStarReset();
                }
            };
            Boako.Team._mobileStarPatched = true;
        }
        Boako.Team.openStarModal(winSeasonNo);
    },

    // 🌟 Boako.Team.confirmStarPlacement()와 완전히 동일한 DB 로직 — 마지막만 모바일 재렌더로 대체
    confirmStarPlacement: async (winSeasonNo) => {
        const team = Boako.state.team.info;
        const wrap = document.getElementById('star-canvas-wrap');
        const starEl = wrap.querySelector('.star-drag');
        const relX = parseFloat(starEl.dataset.relX);
        const relY = parseFloat(starEl.dataset.relY);

        const btn = document.getElementById('star-modal-confirm');
        btn.disabled = true; btn.innerText = '저장 중...';

        try {
            const blob = await Boako.Team._compositeStars(team.logo_url, [{ relX, relY, relSize: 0.16 }]);
            const newLogoUrl = await Boako.Team._uploadStarLogo(blob);

            const { error } = await Boako.db.from('teams').update({
                logo_url: newLogoUrl,
                champion_star_count: (team.champion_star_count || 0) + 1,
                last_star_season_no: winSeasonNo
            }).eq('id', team.id);
            if (error) throw error;

            document.getElementById('boako-star-modal')?.remove();
            Boako.Util.toast('🌟 우승 별이 로고에 새겨졌습니다!');
            if (window.sfx && window.sfx.success) window.sfx.success();
            await Boako.MobileTeamHub.render(document.getElementById('mobile-content-area'));
        } catch (err) {
            console.error('우승 별 저장 실패:', err);
            Boako.Util.toast('❌ ' + (err.message || '저장에 실패했습니다.'));
            btn.disabled = false; btn.innerText = '확정하고 저장';
        }
    },

    // 🌟 Boako.Team.confirmStarReset()와 완전히 동일한 DB 로직 — 마지막만 모바일 재렌더로 대체
    confirmStarReset: async () => {
        const team = Boako.state.team.info;
        const wrap = document.getElementById('star-canvas-wrap');
        const starEls = [...wrap.querySelectorAll('.star-drag')];
        const positions = starEls.map(el => ({
            relX: parseFloat(el.dataset.relX),
            relY: parseFloat(el.dataset.relY),
            relSize: 0.16
        }));

        const btn = document.getElementById('star-modal-confirm');
        btn.disabled = true; btn.innerText = '저장 중...';

        try {
            const blob = await Boako.Team._compositeStars(team.logo_url_origin, positions);
            const newLogoUrl = await Boako.Team._uploadStarLogo(blob);

            const { error } = await Boako.db.from('teams').update({ logo_url: newLogoUrl }).eq('id', team.id);
            if (error) throw error;

            document.getElementById('boako-star-modal')?.remove();
            Boako.Util.toast('✅ 별 위치가 초기화되었습니다.');
            await Boako.MobileTeamHub.render(document.getElementById('mobile-content-area'));
        } catch (err) {
            console.error('별 위치 초기화 실패:', err);
            Boako.Util.toast('❌ ' + (err.message || '저장에 실패했습니다.'));
            btn.disabled = false; btn.innerText = '확정하고 저장';
        }
    },

    // ========== 🌟 챌린지 탭 — PC js/league.js를 그대로 재사용. 파일 전체(177KB)에서 PC 전용
    // 화면 전환(Boako.View.render)을 부르는 곳은 openChallengeChat() 딱 한 곳뿐이라(챌린지
    // 그룹채팅방 열기), 그 함수만 모바일 세션에서 토스트로 안전하게 덮어씀. 나머지 렌더링/모달/
    // 팝업은 challenge-list/challenge-modal-root/challenge-popup-root 컨테이너 id만 참조하는
    // 자기완결형이라 수정 없이 그대로 동작함.
    renderChallengeTab: async () => {
        const wrap = document.getElementById('mobile-team-tab-content');
        if (!wrap) return;
        wrap.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">챌린지 데이터 로드 중...</div>`;

        try {
            if (!Boako.League || !Boako.League.renderChallenges) await Boako.Util.loadScript('/js/league.js');

            // 🌟 [버그 회피] 모바일 쪽지함이 아직 없어서 챌린지 그룹채팅 이동 함수만 안전하게 교체
            Boako.League.openChallengeChat = async () => {
                Boako.Util.toast('💬 챌린지 채팅은 쪽지함 포팅 후 연결될 예정이에요!');
            };

            const teamId = Boako.state.team.info.id;
            const { data: challenges, error } = await Boako.db
                .from('challenges')
                .select('*')
                .or(`attacker_team_id.eq.${teamId},defender_team_id.eq.${teamId}`)
                .order('created_at', { ascending: false });
            if (error) throw error;

            const { data: games } = await Boako.db.from('games').select('game_name, game_logo_url:image_url');
            Boako.League.State.availableGames = games || [];
            Boako.League.State.challenges = challenges || [];

            wrap.innerHTML = `<div id="challenge-list" style="display:flex; flex-direction:column; gap:12px;"></div><div id="challenge-modal-root"></div><div id="challenge-popup-root"></div>`;
            Boako.League.renderChallenges();
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error('챌린지 탭 로드 실패:', e);
            wrap.innerHTML = `<div style="text-align:center; padding:24px; color:#ef4444; font-weight:700; font-size:12px;">오류: ${e.message}</div>`;
        }
    },

    // ========== 🌟 작전 회의실(팀챗) — PC Boako.Team.Chat과 동일한 데이터/RPC를 그대로 재사용 ==========
    renderChatTab: async () => {
        const wrap = document.getElementById('mobile-team-tab-content');
        if (!wrap) return;
        const teamId = Boako.state.team.info.id;

        wrap.innerHTML = `
            <div style="display:flex; flex-direction:column; height:420px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
                <div id="mobile-team-chat-messages" style="flex:1; padding:12px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;"></div>
                <div style="padding:10px; background:#fff; border-top:1px solid #e2e8f0; display:flex; gap:8px;">
                    <input type="text" id="mobile-team-chat-input" placeholder="메시지를 입력하세요..." onkeypress="if(event.key==='Enter') Boako.MobileTeamHub.sendChat()" style="flex:1; border:1px solid #e2e8f0; border-radius:20px; padding:9px 14px; font-size:13px;">
                    <button onclick="Boako.MobileTeamHub.sendChat()" style="background:#2563eb; color:#fff; font-weight:900; font-size:12.5px; padding:0 16px; border-radius:20px;">전송</button>
                </div>
            </div>
        `;

        await Boako.MobileTeamHub.fetchChatActiveMemberCount(teamId);
        await Boako.MobileTeamHub.fetchChatReadRows(teamId);

        try {
            const { data: messages, error } = await Boako.db.from('team_chats')
                .select('*, profiles(full_name)')
                .eq('team_id', teamId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            (messages || []).reverse().forEach(msg => Boako.MobileTeamHub.renderChatMessage(msg));
            Boako.MobileTeamHub.scrollChatToBottom();
        } catch (e) { console.error('팀챗 로드 실패:', e); }

        await Boako.MobileTeamHub.markChatRead(teamId);
        Boako.MobileTeamHub.subscribeChat(teamId);
    },

    fetchChatActiveMemberCount: async (teamId) => {
        const { count } = await Boako.db.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('is_active', true);
        Boako.MobileTeamHub.chatActiveMemberCount = count || 0;
    },
    fetchChatReadRows: async (teamId) => {
        const { data } = await Boako.db.from('team_chat_reads').select('user_id, last_read_message_id').eq('team_id', teamId);
        Boako.MobileTeamHub.chatReadRows = data || [];
    },
    markChatRead: async (teamId) => {
        try {
            await Boako.db.rpc('fn_mark_team_chat_read', { p_team_id: teamId });
            await Boako.MobileTeamHub.fetchChatReadRows(teamId);
            Boako.MobileTeamHub.updateAllChatUnreadBadges();
        } catch (e) { console.error('팀챗 읽음 처리 실패:', e); }
    },
    computeChatUnreadCount: (msgId, senderId) => {
        const others = (Boako.MobileTeamHub.chatReadRows || []).filter(r => r.user_id !== senderId);
        const readCount = others.filter(r => r.last_read_message_id != null && r.last_read_message_id >= msgId).length;
        const totalOthers = Math.max(0, (Boako.MobileTeamHub.chatActiveMemberCount || 1) - 1);
        return Math.max(0, totalOthers - readCount);
    },
    updateAllChatUnreadBadges: () => {
        document.querySelectorAll('.mobile-own-msg-wrap').forEach(el => {
            const msgId = Number(el.dataset.msgId);
            const senderId = el.dataset.senderId;
            if (!msgId) return;
            const badge = el.querySelector('.mobile-own-msg-unread');
            if (!badge) return;
            const unread = Boako.MobileTeamHub.computeChatUnreadCount(msgId, senderId);
            badge.textContent = unread > 0 ? unread : '';
        });
    },

    renderChatMessage: (msg) => {
        const container = document.getElementById('mobile-team-chat-messages');
        if (!container) return;
        const isMe = msg.sender_id === Boako.state.user.id;
        const senderName = msg.profiles?.full_name || '팀원';
        const html = isMe ? `
            <div class="mobile-own-msg-wrap" data-msg-id="${msg.id || ''}" data-sender-id="${msg.sender_id}" style="display:flex; justify-content:flex-end; align-items:flex-end; gap:5px;">
                <span class="mobile-own-msg-unread" style="font-size:9.5px; font-weight:900; color:#f59e0b;"></span>
                <div style="background:#2563eb; color:#fff; border-radius:14px 14px 3px 14px; padding:8px 12px; max-width:75%; font-size:12.5px; word-break:break-word;">${Boako.MobileTeamHub.escapeHtml(msg.content)}</div>
            </div>
        ` : `
            <div style="display:flex; flex-direction:column; align-items:flex-start; gap:3px;">
                <span style="font-size:10.5px; font-weight:800; color:#64748b; margin-left:2px;">${Boako.MobileTeamHub.escapeHtml(senderName)}</span>
                <div style="background:#fff; border:1px solid #e2e8f0; color:#1e293b; border-radius:14px 14px 14px 3px; padding:8px 12px; max-width:75%; font-size:12.5px; word-break:break-word;">${Boako.MobileTeamHub.escapeHtml(msg.content)}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
        if (isMe && msg.id) {
            const unread = Boako.MobileTeamHub.computeChatUnreadCount(msg.id, msg.sender_id);
            const wrapEl = container.lastElementChild;
            const badge = wrapEl?.querySelector('.mobile-own-msg-unread');
            if (badge) badge.textContent = unread > 0 ? unread : '';
        }
    },

    sendChat: async () => {
        const input = document.getElementById('mobile-team-chat-input');
        const content = input.value.trim();
        if (!content || !Boako.state.team) return;
        input.value = '';

        const payload = { team_id: Boako.state.team.info.id, sender_id: Boako.state.user.id, content };
        const tempMsg = { ...payload, profiles: { full_name: Boako.state.user.nickname } };
        Boako.MobileTeamHub.renderChatMessage(tempMsg);
        Boako.MobileTeamHub.scrollChatToBottom();
        const container = document.getElementById('mobile-team-chat-messages');
        const tempWrap = container?.lastElementChild;

        const { data, error } = await Boako.db.from('team_chats').insert([payload]).select().single();
        if (error) { Boako.Util.toast('전송 실패: ' + error.message); return; }
        if (data && tempWrap && tempWrap.classList.contains('mobile-own-msg-wrap')) {
            tempWrap.dataset.msgId = data.id;
            const unread = Boako.MobileTeamHub.computeChatUnreadCount(data.id, data.sender_id);
            const badge = tempWrap.querySelector('.mobile-own-msg-unread');
            if (badge) badge.textContent = unread > 0 ? unread : '';
        }
    },

    scrollChatToBottom: () => {
        const el = document.getElementById('mobile-team-chat-messages');
        if (el) el.scrollTop = el.scrollHeight;
    },

    subscribeChat: (teamId) => {
        Boako.MobileTeamHub.teardownChat();
        Boako.MobileTeamHub.chatChannel = Boako.db.channel(`mobile-team-chat-${teamId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chats', filter: `team_id=eq.${teamId}` }, async (payload) => {
                const newMsg = payload.new;
                if (newMsg.sender_id !== Boako.state.user.id) {
                    newMsg.profiles = { full_name: '팀원' };
                    Boako.MobileTeamHub.renderChatMessage(newMsg);
                    Boako.MobileTeamHub.scrollChatToBottom();
                    Boako.Util.toast('💬 팀 작전 회의실에 새로운 메시지가 있습니다!');
                    await Boako.MobileTeamHub.markChatRead(teamId);
                }
            })
            .subscribe();

        Boako.MobileTeamHub.chatReadsChannel = Boako.db.channel(`mobile-team-chat-reads-${teamId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_chat_reads', filter: `team_id=eq.${teamId}` }, async () => {
                await Boako.MobileTeamHub.fetchChatReadRows(teamId);
                Boako.MobileTeamHub.updateAllChatUnreadBadges();
            })
            .subscribe();
    },

    teardownChat: () => {
        if (Boako.MobileTeamHub.chatChannel) { Boako.db.removeChannel(Boako.MobileTeamHub.chatChannel); Boako.MobileTeamHub.chatChannel = null; }
        if (Boako.MobileTeamHub.chatReadsChannel) { Boako.db.removeChannel(Boako.MobileTeamHub.chatReadsChannel); Boako.MobileTeamHub.chatReadsChannel = null; }
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
