/**
 * [MOBILE MESSENGER] 모바일 전용 — 쪽지함
 * 🌟 [1단계 범위] PC js/messenger.js는 일반 쪽지(DM) 외에도 대항전 소통채널(투표카드 포함),
 *    같이하자 채팅방, 챌린지 그룹채팅방까지 4가지 방 유형을 지원하는 큰 화면이라, 이번 포팅은
 *    방 목록엔 4가지 유형을 전부 보여주되(아이콘/뱃지로 구분), 실제로 열어서 대화할 수 있는 건
 *    일반 쪽지(DM)만 우선 구현함. 대항전 소통채널(투표카드/일정조율)·같이하자 채팅·챌린지
 *    그룹채팅은 목록에는 보이지만 탭하면 "곧 지원 예정" 안내만 뜸 — 다음 단계로 미룸.
 * 🌟 [재사용 원칙] Boako.Messenger.loadChatRooms()/sendDirect()는 순수 데이터 함수(DOM 조작
 *    없이 DB 조회/삽입만 함)라 모바일에서도 안전하게 그대로 재사용. 4가지 방 유형을 전부 계산해서
 *    Boako.Messenger.chatRooms에 채워주므로, 목록 렌더링만 모바일 전용으로 새로 그림.
 * 🌟 [버그 회피] PC의 replySchedule/replyChallenge/replyTeamJoin/replyTeamInvite는 처리 후
 *    Boako.Auth.renderWidget()과 Boako.Messenger.View.refreshRoomList()/openRoom()을 무조건
 *    호출해서 PC 전용 DOM이 없는 모바일에서 에러남 — 동일한 DB 업데이트/RPC 호출 로직을
 *    이 파일에 재구현하고 마무리만 모바일 재렌더로 대체.
 * 🌟 [실시간] 새 쪽지 실시간 반영은 js/mobile_shell.js가 로그인 시점에 이미 구독 중인
 *    'mobile-messages-changes' 채널(안읽은 배지 갱신용)에 편승함 — 이 화면이 렌더된 상태에서
 *    새 쪽지가 오면 mobile_shell.js가 Boako.MobileMessenger.handleRealtimeInsert()를 호출해줌.
 *    별도 채널을 새로 만들지 않아 탭당 소켓이 늘어나는 문제를 피함.
 * 🌟 액션 카드(일정제안/도전장/팀가입/스카웃) UI는 크롬 확장(보아코_확장2/boako-widget.js)의
 *    카드 마크업을 그대로 가져와 재사용 — 이미 터치 화면 크기에 맞춰 디자인된 스타일이라 그대로 맞음.
 */
window.Boako = window.Boako || {};
Boako.MobileMessenger = {

    rooms: [],
    activeConversation: null, // { roomId, otherName }

    render: async (container) => {
        if (!Boako.state.user) {
            container.innerHTML = `<div style="padding:60px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">🔒 로그인 후 이용할 수 있어요.</div>`;
            return;
        }
        container.innerHTML = `<div style="padding:40px 0; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">불러오는 중...</div>`;

        if (!Boako.Messenger || Object.keys(Boako.Messenger).length === 0) await Boako.Util.loadScript('/js/messenger.js');
        await Boako.MobileMessenger.refreshRooms();
        Boako.MobileMessenger.activeConversation = null;
        Boako.MobileMessenger.draw(container);
    },

    refreshRooms: async () => {
        // 🌟 PC와 완전히 동일한 순수 데이터 함수 — DM/대항전/같이하자/챌린지 4종을 전부 계산해서 채워줌
        const rooms = await Boako.Messenger.loadChatRooms();
        const hidden = JSON.parse(localStorage.getItem('boako_hidden_rooms') || '{}');
        Boako.MobileMessenger.rooms = Object.values(rooms).filter(room => {
            const hideTime = hidden[room.id];
            if (hideTime) return new Date(room.lastTime) > new Date(hideTime);
            return true;
        }).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    },

    draw: (container) => {
        if (Boako.MobileMessenger.activeConversation) {
            Boako.MobileMessenger.drawThread(container);
        } else {
            Boako.MobileMessenger.drawList(container);
        }
    },

    // ========== 🌟 방 목록 (4가지 유형 전부 표시, 아이콘/뱃지로 구분) ==========
    drawList: (container) => {
        const rooms = Boako.MobileMessenger.rooms;

        if (rooms.length === 0) {
            container.innerHTML = `<div style="padding:60px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">참여 중인 대화가 없습니다.</div>`;
            return;
        }

        container.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">${rooms.map(room => {
            const icon = room.isMatchChannel ? '📣' : (room.isChallengeChat ? '🔥' : (room.isMatch ? '⚔️' : (room.isTogether ? '🎲' : '💬')));
            const typeLabel = room.isMatchChannel ? '대항전' : (room.isChallengeChat ? '챌린지' : (room.isMatch ? (room.matchType === 'CHALLENGE' ? '승자연전' : '라이벌전') : (room.isTogether ? '같이하자' : '')));
            const badgeHtml = typeLabel ? `<span style="font-size:9.5px; font-weight:900; color:#7c3aed; background:#f5f3ff; padding:1px 6px; border-radius:6px; margin-left:5px; flex-shrink:0;">${typeLabel}</span>` : '';
            const unreadHtml = room.unread > 0 ? `<span style="flex-shrink:0; background:#ef4444; color:#fff; font-size:10.5px; font-weight:900; min-width:18px; height:18px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 4px;">${room.unread > 99 ? '99+' : room.unread}</span>` : '';

            return `
                <div onclick="Boako.MobileMessenger.openRoom('${room.id}')" style="display:flex; align-items:center; gap:10px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
                    <div style="width:38px; height:38px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0;">${icon}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center;">
                            <span style="font-size:13px; font-weight:900; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileMessenger.escapeHtml(room.title)}</span>
                            ${badgeHtml}
                        </div>
                        <div style="font-size:11.5px; color:#94a3b8; font-weight:600; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileMessenger.escapeHtml(room.lastMessage)}</div>
                    </div>
                    ${unreadHtml}
                </div>
            `;
        }).join('')}</div>`;
    },

    openRoom: async (roomId) => {
        const room = Boako.MobileMessenger.rooms.find(r => r.id === roomId);
        if (!room) return;

        // 🌟 [1단계 범위] 대항전 소통채널/같이하자/챌린지는 아직 채팅 UI 미구현 — 다음 단계로 미룸
        if (room.isMatchChannel || room.isTogether || room.isChallengeChat) {
            Boako.Util.toast('💬 이 채팅 유형은 곧 지원될 예정이에요!');
            return;
        }

        Boako.MobileMessenger.activeConversation = {
            roomId,
            otherId: room.otherId,
            otherName: room.otherName,
            isMatch: room.isMatch,
            matchType: room.matchType,
            gameName: room.gameName
        };

        // 🌟 읽음 처리 (PC와 동일 로직, DB 직접 업데이트만 — DOM 사이드이펙트 없음)
        try {
            await Boako.db.from('messages').update({ is_read: true })
                .eq('receiver_id', Boako.state.user.id)
                .or(`match_id.eq.${roomId},sender_id.eq.${roomId}`);
            if (Boako.Messenger.fetchUnreadCount) await Boako.Messenger.fetchUnreadCount();
            if (Boako.MobileShell && Boako.MobileShell.renderDrawer) await Boako.MobileShell.renderDrawer();
        } catch (e) { console.error('읽음 처리 실패:', e); }

        Boako.MobileMessenger.draw(document.getElementById('mobile-content-area'));
    },

    closeThread: () => {
        Boako.MobileMessenger.activeConversation = null;
        Boako.MobileMessenger.draw(document.getElementById('mobile-content-area'));
    },

    // ========== 🌟 대화창 (DM 전용) ==========
    drawThread: (container) => {
        const { roomId } = Boako.MobileMessenger.activeConversation;
        const room = Boako.MobileMessenger.rooms.find(r => r.id === roomId);
        if (!room) { Boako.MobileMessenger.closeThread(); return; }

        const bubbles = (room.messages || []).map(m => Boako.MobileMessenger.renderMessageBubble(m)).join('');

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; height:calc(100vh - 220px); min-height:400px;">
                <div style="display:flex; align-items:center; gap:8px; padding-bottom:10px; border-bottom:1px solid #e2e8f0; margin-bottom:10px;">
                    <span onclick="Boako.MobileMessenger.closeThread()" style="font-size:18px; cursor:pointer;">←</span>
                    <span style="font-size:14px; font-weight:900; color:#1e293b;">${Boako.MobileMessenger.escapeHtml(room.otherName || '대화')}</span>
                </div>
                <div id="mobile-msg-thread" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-bottom:8px;">
                    ${bubbles || `<div style="text-align:center; color:#94a3b8; font-size:12px; font-weight:700; padding:20px 0;">대화가 없습니다.</div>`}
                </div>
                <div style="display:flex; gap:8px; padding-top:10px; border-top:1px solid #e2e8f0;">
                    <input type="text" id="mobile-msg-input" placeholder="메시지를 입력하세요" onkeypress="if(event.key==='Enter') Boako.MobileMessenger.sendMessage()" style="flex:1; border:1px solid #e2e8f0; border-radius:20px; padding:9px 14px; font-size:13px;">
                    <button onclick="Boako.MobileMessenger.sendMessage()" style="background:#4f46e5; color:#fff; font-weight:900; font-size:12.5px; padding:0 16px; border-radius:20px;">전송</button>
                </div>
            </div>
        `;
        const thread = document.getElementById('mobile-msg-thread');
        if (thread) thread.scrollTop = thread.scrollHeight;
    },

    renderMessageBubble: (m) => {
        const isMe = m.sender_id === Boako.state.user.id;
        const time = new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

        if (m.action_type === 'SCHEDULE_PROPOSE') return Boako.MobileMessenger.renderScheduleCard(m, isMe, time);
        if (m.action_type === 'CHALLENGE_CARD') return Boako.MobileMessenger.renderChallengeCard(m, isMe, time);
        if (m.action_type === 'TEAM_JOIN' || m.action_type === 'TEAM_INVITE') return Boako.MobileMessenger.renderTeamActionCard(m, isMe, time);

        return `
            <div style="display:flex; ${isMe ? 'justify-content:flex-end;' : 'justify-content:flex-start;'}">
                <div>
                    <div style="max-width:220px; padding:8px 12px; border-radius:14px; font-size:12.5px; line-height:1.4;
                        ${isMe ? 'background:#4f46e5; color:#fff; border-bottom-right-radius:4px;' : 'background:#fff; border:1px solid #e2e8f0; color:#0f172a; border-bottom-left-radius:4px;'}">
                        ${Boako.MobileMessenger.escapeHtml(m.content)}
                    </div>
                    <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0; text-align:${isMe ? 'right' : 'left'};">${time}</div>
                </div>
            </div>
        `;
    },

    // 🌟 크롬 확장(boako-widget.js)의 카드 마크업을 그대로 가져와 재사용 — 이미 터치 크기에 맞게 디자인됨
    renderScheduleCard: (m, isMe, time) => {
        const times = Array.isArray(m.metadata?.proposed_times) ? m.metadata.proposed_times : [];
        const status = m.action_status || 'PENDING';
        const fmt = (iso) => new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        let bodyHtml = '', statusBadge = '';
        if (status === 'PENDING') {
            if (!isMe) {
                const optionButtons = times.map(t => `
                    <button onclick="Boako.MobileMessenger.replySchedule('${m.message_id}', 'ACCEPTED', '${t}')" style="width:100%; text-align:left; background:#fff; border:1px solid #c7d2fe; color:#334155; font-size:11.5px; font-weight:800; padding:8px 10px; border-radius:8px; margin-bottom:5px;">
                        🟢 ${fmt(t)}
                    </button>
                `).join('');
                bodyHtml = `
                    <div style="font-size:10.5px; color:#94a3b8; font-weight:700; margin-bottom:6px;">아래 후보 중 하나를 선택하면 바로 확정돼요.</div>
                    ${optionButtons}
                    <button onclick="Boako.MobileMessenger.replySchedule('${m.message_id}', 'REJECTED')" style="width:100%; background:#f1f5f9; color:#64748b; font-size:11px; font-weight:800; padding:7px; border:none; border-radius:8px; margin-top:2px;">
                        ❌ 전부 거절
                    </button>
                `;
            } else {
                bodyHtml = times.map(t => `<div style="font-size:12px; font-weight:800; color:#334155; background:#fff; padding:6px; border-radius:8px; border:1px solid #e0e7ff; text-align:center; margin-bottom:5px;">${fmt(t)}</div>`).join('');
                statusBadge = `<div style="font-size:10.5px; color:#94a3b8; font-weight:800; text-align:center; background:rgba(255,255,255,0.5); padding:6px; border-radius:8px;">상대방의 선택 대기 중...</div>`;
            }
        } else if (status === 'ACCEPTED') {
            const chosen = m.metadata?.chosen_time;
            bodyHtml = `<div style="font-size:12.5px; font-weight:900; color:#065f46; background:#fff; padding:8px; border-radius:8px; border:1px solid #a7f3d0; text-align:center; margin-bottom:6px;">${chosen ? fmt(chosen) : '확정됨'}</div>`;
            statusBadge = `<div style="font-size:10.5px; color:#059669; font-weight:800; text-align:center; background:#ecfdf5; padding:6px; border-radius:8px; border:1px solid #d1fae5;">✅ 수락됨 (캘린더 등록 완료)</div>`;
        } else if (status === 'REJECTED') {
            statusBadge = `<div style="font-size:10.5px; color:#e11d48; font-weight:800; text-align:center; background:#fff1f2; padding:6px; border-radius:8px; border:1px solid #fecdd3;">❌ 거절됨</div>`;
        }

        return `
            <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                <div style="max-width:250px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:14px; padding:12px;">
                    <div style="font-size:12px; font-weight:900; color:#3730a3; margin-bottom:8px;">📅 일정 제안 (${times.length}개 후보)</div>
                    ${bodyHtml}${statusBadge}
                </div>
                <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0;">${time}</div>
            </div>
        `;
    },

    renderChallengeCard: (m, isMe, time) => {
        const gameName = m.metadata?.game_name || '종목미정';
        const points = m.metadata?.reward_points || 0;
        const status = m.action_status || 'PENDING';

        let cardContent = '';
        if (status === 'PENDING') {
            if (!isMe) {
                cardContent = `
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <button onclick="Boako.MobileMessenger.replyChallenge('${m.message_id}', '${m.match_id || ''}', 'ACCEPTED')" style="flex:1; background:#ef4444; color:#fff; font-size:11px; font-weight:900; padding:8px; border:none; border-radius:8px;">🔥 수락</button>
                        <button onclick="Boako.MobileMessenger.replyChallenge('${m.message_id}', '${m.match_id || ''}', 'REJECTED')" style="flex:1; background:#475569; color:#fff; font-size:11px; font-weight:800; padding:8px; border:none; border-radius:8px;">거절</button>
                    </div>
                `;
            } else {
                cardContent = `<div style="margin-top:8px; font-size:10.5px; color:#94a3b8; font-weight:800; text-align:center; background:rgba(255,255,255,0.06); padding:6px; border-radius:8px;">응답 대기 중... ⏳</div>`;
            }
        } else if (status === 'ACCEPTED') {
            cardContent = `<div style="margin-top:8px; font-size:11px; color:#fca5a5; font-weight:900; text-align:center; background:rgba(239,68,68,0.1); padding:6px; border-radius:8px; border:1px solid rgba(239,68,68,0.2);">🔥 매치 수락됨</div>`;
        } else if (status === 'REJECTED') {
            cardContent = `<div style="margin-top:8px; font-size:10.5px; color:#94a3b8; font-weight:800; text-align:center; background:rgba(255,255,255,0.06); padding:6px; border-radius:8px;">❌ 거절됨</div>`;
        }

        return `
            <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                <div style="max-width:240px; background:linear-gradient(135deg,#1e293b,#0f172a); border:1px solid #334155; border-radius:14px; padding:12px; color:#fff;">
                    <div style="font-size:11px; font-weight:900; color:#f87171; margin-bottom:8px;">⚔️ 라이벌 매치 도착</div>
                    <div style="font-size:12.5px; font-weight:900; color:#0f172a; background:#fff; padding:7px; border-radius:8px; text-align:center; margin-bottom:6px;">${Boako.MobileMessenger.escapeHtml(gameName)}</div>
                    <div style="text-align:center; font-size:10.5px; font-weight:800; color:#fbbf24;">보상: <span style="font-size:13px;">${points} P</span></div>
                    ${cardContent}
                </div>
                <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0;">${time}</div>
            </div>
        `;
    },

    renderTeamActionCard: (m, isMe, time) => {
        const isJoin = m.action_type === 'TEAM_JOIN';
        let pData = {};
        try { pData = JSON.parse(m.content); } catch (e) { pData = { team_name: '오류' }; }
        const status = m.action_status || 'PENDING';
        const actionPrefix = isJoin ? 'teamjoin' : 'teaminvite';

        let btnHtml = '';
        if (status === 'PENDING' && !isMe) {
            btnHtml = `
                <div style="display:flex; gap:6px; margin-top:8px;">
                    <button onclick="Boako.MobileMessenger.${actionPrefix === 'teamjoin' ? 'replyTeamJoin' : 'replyTeamInvite'}('${m.message_id}', 'ACCEPTED')" style="flex:1; background:#2563eb; color:#fff; font-size:11px; font-weight:900; padding:8px; border:none; border-radius:8px;">✅ 수락</button>
                    <button onclick="Boako.MobileMessenger.${actionPrefix === 'teamjoin' ? 'replyTeamJoin' : 'replyTeamInvite'}('${m.message_id}', 'REJECTED')" style="flex:1; background:#e2e8f0; color:#475569; font-size:11px; font-weight:800; padding:8px; border:none; border-radius:8px;">거절</button>
                </div>
            `;
        } else if (status === 'PENDING') {
            btnHtml = `<div style="margin-top:8px; font-size:10.5px; color:#64748b; font-weight:800; text-align:center; background:#f1f5f9; padding:6px; border-radius:8px;">결재 대기 중...</div>`;
        } else if (status === 'ACCEPTED') {
            btnHtml = `<div style="margin-top:8px; font-size:10.5px; color:#2563eb; font-weight:900; text-align:center; background:#eff6ff; padding:6px; border-radius:8px;">✅ 승인됨</div>`;
        } else {
            btnHtml = `<div style="margin-top:8px; font-size:10.5px; color:#e11d48; font-weight:800; text-align:center; background:#fff1f2; padding:6px; border-radius:8px;">❌ 거절됨</div>`;
        }

        return `
            <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                <div style="max-width:240px; background:#fff; border:1px solid #bfdbfe; border-radius:14px; padding:12px;">
                    <div style="font-size:11px; font-weight:900; color:#2563eb; margin-bottom:8px;">${isJoin ? '🛡️ 입단 지원' : '💌 스카웃 제안'}</div>
                    <div style="font-size:12px; font-weight:800; color:#334155; background:#f8fafc; padding:7px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">[${Boako.MobileMessenger.escapeHtml(pData.team_name || '')}] 합류</div>
                    ${btnHtml}
                </div>
                <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0;">${time}</div>
            </div>
        `;
    },

    sendMessage: async () => {
        const input = document.getElementById('mobile-msg-input');
        const content = input.value.trim();
        if (!content || !Boako.MobileMessenger.activeConversation) return;
        input.value = '';

        // 🌟 [버그수정] roomId만으로 매치방/DM을 구분하려 하면 둘 다 UUID 형태라 신뢰할 수 없음 —
        // openRoom()에서 이미 저장해둔 room.isMatch 플래그를 그대로 사용 (PC executeChatSend와 동일 로직)
        const { otherId, otherName, roomId, isMatch, matchType, gameName } = Boako.MobileMessenger.activeConversation;
        const matchId = isMatch ? roomId : null;
        const metadata = isMatch ? { match_type: matchType, game_name: gameName } : {};
        const success = await Boako.Messenger.sendDirect(otherId, content, otherName, 'DEFAULT', metadata, matchId);

        if (success) {
            await Boako.MobileMessenger.refreshRooms();
            Boako.MobileMessenger.draw(document.getElementById('mobile-content-area'));
        } else {
            Boako.Util.toast('전송에 실패했습니다.');
        }
    },

    // ========== 🌟 액션 카드 응답 — PC replySchedule/replyChallenge/replyTeamJoin/replyTeamInvite와
    // 동일한 DB 업데이트/RPC 호출이되, 마지막만 모바일 재렌더로 대체 (PC 함수는 Boako.Auth.renderWidget()
    // 등 PC 전용 DOM을 무조건 건드려서 재사용 시 에러남) ==========
    _refreshAfterAction: async () => {
        if (Boako.Messenger.fetchUnreadCount) await Boako.Messenger.fetchUnreadCount();
        if (Boako.MobileShell && Boako.MobileShell.renderDrawer) await Boako.MobileShell.renderDrawer();
        await Boako.MobileMessenger.refreshRooms();
        Boako.MobileMessenger.draw(document.getElementById('mobile-content-area'));
    },

    replySchedule: async (messageId, status, chosenTime) => {
        if (!confirm(`이 일정을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
        try {
            await Boako.db.from('messages').update({ action_status: status }).eq('message_id', messageId);
            if (status === 'ACCEPTED') {
                const { error } = await Boako.db.rpc('confirm_direct_match_schedule', { p_message_id: messageId, p_chosen_time: chosenTime });
                if (error) throw error;
                if (window.sfx && window.sfx.rosterLock) window.sfx.rosterLock();
                Boako.Util.toast('🎉 일정이 수락되어 캘린더에 공식 등록되었습니다!');
            }
        } catch (e) {
            console.error('일정 응답 처리 실패:', e);
            Boako.Util.toast('❌ 캘린더 등록에 실패했습니다.');
        }
        await Boako.MobileMessenger._refreshAfterAction();
    },

    replyChallenge: async (messageId, matchId, status) => {
        if (!confirm(`라이벌 도전을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
        try {
            const { error } = await Boako.db.rpc('respond_to_rival_match', { p_match_id: matchId, p_action: status });
            if (error) throw error;
            if (status === 'ACCEPTED' && window.sfx && window.sfx.rosterLock) window.sfx.rosterLock();
            Boako.Util.toast('✅ 라이벌 도전을 처리했어요!');
        } catch (e) {
            console.error('라이벌 도전 응답 처리 실패:', e);
            Boako.Util.toast('❌ 처리 중 오류가 발생했습니다.');
        }
        await Boako.MobileMessenger._refreshAfterAction();
    },

    replyTeamJoin: async (messageId, status) => {
        if (!confirm(`가입 신청을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
        try {
            const { error } = await Boako.db.rpc('respond_to_team_join', { p_message_id: messageId, p_action: status });
            if (error) throw error;
            Boako.Util.toast('✅ 가입 신청을 처리했어요!');
        } catch (e) {
            console.error('가입신청 응답 처리 실패:', e);
            Boako.Util.toast('❌ 처리 중 오류가 발생했습니다.');
        }
        await Boako.MobileMessenger._refreshAfterAction();
    },

    replyTeamInvite: async (messageId, status) => {
        if (!confirm(`스카웃 제안을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
        try {
            const { error } = await Boako.db.rpc('respond_to_team_invite', { p_message_id: messageId, p_action: status });
            if (error) throw error;
            Boako.Util.toast('✅ 영입 제안을 처리했어요!');
        } catch (e) {
            console.error('스카웃 응답 처리 실패:', e);
            Boako.Util.toast('❌ 처리 중 오류가 발생했습니다.');
        }
        await Boako.MobileMessenger._refreshAfterAction();
    },

    // ========== 🌟 실시간 반영 — 새 채널을 만들지 않고 mobile_shell.js의 기존 채널에 편승 ==========
    handleRealtimeInsert: async (newMsg) => {
        const container = document.getElementById('mobile-content-area');
        if (!container) return; // 쪽지함 화면이 지금 렌더돼 있지 않으면 무시 (배지 갱신은 mobile_shell.js가 이미 처리)
        // 지금 이 화면이 정말 쪽지함인지 확인 (다른 화면에서 우연히 컨테이너 id만 같은 경우 방지)
        if (!document.getElementById('mobile-msg-thread') && !container.querySelector('[onclick^="Boako.MobileMessenger.openRoom"]')) return;

        await Boako.MobileMessenger.refreshRooms();
        Boako.MobileMessenger.draw(container);
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
