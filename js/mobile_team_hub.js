/**
 * [MOBILE TEAM HUB] 모바일 전용 — 팀 창단 / 팀 본부(정보+로스터) / 작전 회의실(팀챗)
 * 🌟 [1단계 범위] PC js/team.js는 팀 본부/작전회의실/대항전 기록·일정/챌린지 4개 탭 + 우승 별
 *    붙이기(캔버스 로고 합성)까지 포함된 거대한 화면이라, 이번 포팅은 소장님과 합의한 대로
 *    "팀 본부(정보+로스터+초대/강퇴/탈퇴)"와 "작전 회의실(팀챗)" 두 탭만 우선 구현함.
 *    ⚔️대항전 기록·일정 / 🔥챌린지 / ⭐우승 별 관리는 다음 단계로 미룸.
 * 🌟 [재사용 원칙] Boako.Team.searchUser/executeInvite/addMember(멤버 스카웃 모달)는 PC 전용
 *    DOM에 의존하지 않고 Tailwind 유틸리티 클래스만 쓰는 자기완결형 함수라 모바일에서도 안전하게
 *    그대로 재사용함(모바일도 Tailwind CDN을 로드하므로 동일 클래스가 그대로 먹힘).
 * 🌟 [버그 회피] Boako.Team.create()/kick()은 마지막에 PC 전용 화면 전환 시스템인
 *    Boako.View.render('team')을 호출해서 모바일에서 그대로 쓰면 에러남(messenger.js의
 *    startRealtime 콜백이 Boako.Auth.renderWidget()을 부르던 것과 동일한 문제 패턴).
 *    동일한 DB 로직을 이 파일에 그대로 옮기고, 마무리만 모바일 재렌더로 바꿔서 재구현함.
 * 🌟 [알려진 제한] 팀챗 실시간 채널(subscribeChat)은 PC의 Boako.Team.Chat과 마찬가지로 아직
 *    js/realtime_coordinator.js 탭 리더 선출을 적용하지 않음 — 화면을 벗어날 때(teardownChat)
 *    확실히 구독 해제해서 최소한 "떠나 있는 동안 계속 열려있는" 것만 방지함. 사이트 전역 실시간
 *    최적화 작업 때 PC/모바일 팀챗을 함께 코디네이터 방식으로 옮기는 걸 백로그로 남겨둠.
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

            let bannerStats = { currentSeasonRank: null, currentSeasonTeamCount: 0, totalChampionships: 0, bestRank: null, supporterCount: 0, liveSeasonNo: null };
            try {
                const nowIso = new Date().toISOString();
                const { data: liveSeason } = await Boako.db.from('seasons').select('season_no').lte('start_date', nowIso).gte('end_date', nowIso).maybeSingle();
                if (liveSeason) {
                    const { data: currentRanking } = await Boako.db.from('v_season_current_ranking').select('team_name, total_lp').eq('season_no', liveSeason.season_no).order('total_lp', { ascending: false });
                    if (currentRanking) {
                        bannerStats.currentSeasonTeamCount = currentRanking.length;
                        const myIdx = currentRanking.findIndex(r => r.team_name === team.team_name);
                        if (myIdx !== -1) { bannerStats.currentSeasonRank = myIdx + 1; bannerStats.liveSeasonNo = liveSeason.season_no; }
                    }
                }
                const { data: historyRows } = await Boako.db.from('season_final_rankings').select('final_rank').eq('team_name', team.team_name);
                if (historyRows && historyRows.length > 0) {
                    bannerStats.totalChampionships = historyRows.filter(r => r.final_rank === 1).length;
                    bannerStats.bestRank = Math.min(...historyRows.map(r => r.final_rank));
                }
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

        const bannerHtml = `
            <div style="background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:16px; padding:18px 20px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${team.logo_url ? Boako.Util.cdn(team.logo_url) : ''}" style="width:48px; height:48px; border-radius:10px; background:#fff; object-fit:contain; padding:4px; flex-shrink:0;">
                    <div style="min-width:0;">
                        <div style="font-size:16px; font-weight:900; color:#fff;">${Boako.MobileTeamHub.escapeHtml(team.team_name)}</div>
                        <div style="font-size:11px; font-weight:700; color:#94a3b8; margin-top:2px;">${currentSeasonLine}</div>
                    </div>
                </div>
                <div style="font-size:11px; font-weight:700; color:#94a3b8; margin-top:8px;">${historyLine}</div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <div style="background:rgba(255,255,255,0.12); padding:5px 10px; border-radius:999px; font-size:11px; font-weight:900; color:#fff;">🎽 서포터즈 ${bannerStats.supporterCount}명</div>
                    <div style="background:rgba(255,255,255,0.12); padding:5px 10px; border-radius:999px; font-size:11px; font-weight:900; color:#fff;">🎟️ 도전권 ${team.challengetokens || 0}개</div>
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
            </div>
            <div id="mobile-team-tab-content"></div>
        `;

        if (activeTab === 'chat') {
            Boako.MobileTeamHub.renderChatTab();
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
    renderInfoTab: () => {
        const wrap = document.getElementById('mobile-team-tab-content');
        if (!wrap) return;
        const { team, members, isLeader } = Boako.MobileTeamHub;

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

        wrap.innerHTML = `
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px; margin-bottom:12px;">
                <div style="font-size:14px; font-weight:900; color:#7c3aed; font-style:italic;">"${Boako.MobileTeamHub.escapeHtml(team.team_motto || '전설의 서막')}"</div>
                <div style="font-size:12px; color:#64748b; font-weight:600; margin-top:10px; white-space:pre-wrap; line-height:1.6;">${Boako.MobileTeamHub.escapeHtml(team.team_desc || '소개가 없습니다.')}</div>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <div style="font-size:13.5px; font-weight:900; color:#1e293b;">👥 팀 멤버 (${(members || []).length}/4)</div>
                ${isLeader ? `<button onclick="Boako.Team.addMember()" style="font-size:11.5px; font-weight:900; color:#fff; background:#7c3aed; padding:7px 12px; border-radius:8px;">+ 멤버 추가</button>` : ''}
            </div>
            ${rosterHtml}
        `;
    },

    // 🌟 Boako.Team.kick()과 완전히 동일한 DB 로직 — 마지막만 모바일 재렌더로 대체
    kick: async (name) => {
        if (!confirm(`${name} 님을 방출하시겠습니까? 기록은 보존됩니다.`)) return;
        await Boako.db.from('team_members').update({ is_active: false, left_at: new Date().toISOString() })
            .eq('team_id', Boako.state.team.info.id).eq('player_name', name).eq('is_active', true);
        await Boako.MobileTeamHub.render(document.getElementById('mobile-content-area'));
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
