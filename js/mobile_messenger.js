/**
 * [MOBILE MESSENGER] 모바일 전용 — 쪽지함
 * 🌟 [재사용 원칙] Boako.Messenger.loadChatRooms()/sendDirect()/sendMatchChannel()/sendTogetherChat()/
 *    sendChallengeChat()는 전부 순수 데이터 함수(DOM 조작 없이 DB 조회/삽입만 함)라 모바일에서도
 *    안전하게 그대로 재사용. 4가지 방 유형(DM/대항전 소통채널/같이하자/챌린지)을 전부 계산해서
 *    Boako.Messenger.chatRooms에 채워주므로, 화면 렌더링만 모바일 전용으로 새로 그림.
 * 🌟 [2단계: 그룹채팅 3종 실제 구현] 1단계에서는 방 목록엔 4종을 다 보여주되 실제 대화는 DM만
 *    가능했음("곧 지원 예정" 토스트). 이번에 대항전 소통채널/같이하자/챌린지도 실제로 열어서
 *    텍스트 채팅을 주고받을 수 있게 함:
 *    - 그룹채팅은 발신자가 여러 명이라 말풍선 위에 발신자 닉네임을 표시(DM은 1:1이라 불필요해서 안 함)
 *    - 읽음 처리는 PC와 동일하게 localStorage(boako_match_read/boako_together_read/
 *      boako_challenge_read)에 방 열람 시각을 기록하는 방식 (DM처럼 DB is_read 컬럼이 없는 구조)
 *    - 대항전 소통채널의 "일정 조율 투표" 카드도 함께 표시: 진행 상태(OPEN/PROPOSED/CONFIRMED) 조회는
 *      전부 지원하고, PROPOSED 상태의 수락/거절 버튼도 accept_schedule_poll/reject_schedule_poll
 *      RPC를 직접 호출해 지원함. 다만 OPEN 상태에서 "내가 되는 시간을 달력에 새로 찍어 제출"하는
 *      기능은 PC의 복잡한 달력 그리드 모달(Boako.Match.Chat.openPollModal)에 의존하고 있어 이번
 *      범위에서는 제외 — 이 경우에만 "캘린더로 시간 제출은 PC에서 진행해주세요" 안내를 띄움.
 *      (PC의 acceptProposedTime/rejectProposedTime 함수를 그대로 부르지 않고 같은 RPC를 직접
 *      호출하는 이유: 그 함수들 끝에 PC 전용 loadMessagesAndPolls()를 호출해서, RPC 자체는 성공해도
 *      마무리 단계에서 에러가 나 "실패했습니다" 토스트가 잘못 뜰 위험이 있기 때문.)
 * 🌟 [버그 회피] PC의 replySchedule/replyChallenge/replyTeamJoin/replyTeamInvite는 처리 후
 *    Boako.Auth.renderWidget()과 Boako.Messenger.View.refreshRoomList()/openRoom()을 무조건
 *    호출해서 PC 전용 DOM이 없는 모바일에서 에러남 — 동일한 DB 업데이트/RPC 호출 로직을
 *    이 파일에 재구현하고 마무리만 모바일 재렌더로 대체.
 * 🌟 [실시간] 새 쪽지 실시간 반영은 js/mobile_shell.js가 로그인 시점에 이미 구독 중인
 *    'mobile-messages-changes' 채널(안읽은 배지 갱신용)에 편승함 — 이 화면이 렌더된 상태에서
 *    새 쪽지가 오면 mobile_shell.js가 Boako.MobileMessenger.handleRealtimeInsert()를 호출해줌.
 *    별도 채널을 새로 만들지 않아 탭당 소켓이 늘어나는 문제를 피함. (그룹채팅 3종의 실시간 반영은
 *    이 채널이 'messages' 테이블만 구독하므로 아직 포함 안 됨 — 방을 나갔다 다시 들어오면 최신화됨.)
 * 🌟 액션 카드(일정제안/도전장/팀가입/스카웃) UI는 크롬 확장(보아코_확장2/boako-widget.js)의
 *    카드 마크업을 그대로 가져와 재사용 — 이미 터치 화면 크기에 맞춰 디자인된 스타일이라 그대로 맞음.
 */
window.Boako = window.Boako || {};
Boako.MobileMessenger = {

    rooms: [],
    activeConversation: null, // { roomId, roomType: 'dm'|'match_channel'|'together'|'challenge', ... }

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

        // 🌟 [2단계] 그룹채팅 3종도 실제로 오픈 — PC와 동일하게 localStorage에 열람 시각 기록(읽음 처리)
        if (room.isMatchChannel) {
            const read = JSON.parse(localStorage.getItem('boako_match_read') || '{}');
            read[roomId] = Date.now();
            localStorage.setItem('boako_match_read', JSON.stringify(read));
            room.unread = 0;
            Boako.MobileMessenger.activeConversation = { roomId, roomType: 'match_channel', title: room.title, seasonNo: room.seasonNo, gameName: room.gameName, entryCount: room.entryCount, isConfirmed: room.isConfirmed };
        } else if (room.isTogether) {
            const read = JSON.parse(localStorage.getItem('boako_together_read') || '{}');
            read[roomId] = Date.now();
            localStorage.setItem('boako_together_read', JSON.stringify(read));
            room.unread = 0;
            Boako.MobileMessenger.activeConversation = { roomId, roomType: 'together', title: room.title, postId: room.postId };
        } else if (room.isChallengeChat) {
            const read = JSON.parse(localStorage.getItem('boako_challenge_read') || '{}');
            read[roomId] = Date.now();
            localStorage.setItem('boako_challenge_read', JSON.stringify(read));
            room.unread = 0;
            Boako.MobileMessenger.activeConversation = { roomId, roomType: 'challenge', title: room.title, challengeId: room.challengeId };
        } else {
            Boako.MobileMessenger.activeConversation = {
                roomId,
                roomType: 'dm',
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
            } catch (e) { console.error('읽음 처리 실패:', e); }
        }

        if (Boako.MobileShell && Boako.MobileShell.renderDrawer) await Boako.MobileShell.renderDrawer();
        Boako.MobileMessenger.draw(document.getElementById('mobile-content-area'));
    },

    closeThread: () => {
        Boako.MobileMessenger.activeConversation = null;
        Boako.MobileMessenger.draw(document.getElementById('mobile-content-area'));
    },

    // ========== 🌟 대화창 (DM + 그룹채팅 3종 공용) ==========
    drawThread: (container) => {
        const conv = Boako.MobileMessenger.activeConversation;
        const room = Boako.MobileMessenger.rooms.find(r => r.id === conv.roomId);
        if (!room) { Boako.MobileMessenger.closeThread(); return; }

        const isGroup = conv.roomType !== 'dm';
        const bubbles = (room.messages || []).map(m => Boako.MobileMessenger.renderMessageBubble(m, room, isGroup)).join('');

        // 🌟 그룹채팅은 헤더에 뱃지를 붙여서 어떤 유형의 방인지 구분(DM은 상대 닉네임만 표시)
        const badgeMap = { match_channel: '📣 대항전', together: '🎲 같이하자', challenge: '🔥 챌린지' };
        const headerTitle = isGroup ? conv.title : (room.otherName || '대화');
        const headerBadge = isGroup ? `<span style="font-size:10px; font-weight:900; color:#7c3aed; background:#f5f3ff; padding:2px 7px; border-radius:6px; margin-left:6px;">${badgeMap[conv.roomType]}</span>` : '';

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; height:calc(100vh - 220px); min-height:400px;">
                <div style="display:flex; align-items:center; gap:8px; padding-bottom:10px; border-bottom:1px solid #e2e8f0; margin-bottom:10px;">
                    <span onclick="Boako.MobileMessenger.closeThread()" style="font-size:18px; cursor:pointer;">←</span>
                    <span style="font-size:14px; font-weight:900; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Boako.MobileMessenger.escapeHtml(headerTitle)}</span>
                    ${headerBadge}
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

    renderMessageBubble: (m, room, isGroup) => {
        const isMe = m.sender_id === Boako.state.user.id;
        const time = new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

        // 🌟 [2단계] 대항전 소통채널의 일정 조율 투표 카드
        if (m.type === 'POLL') return Boako.MobileMessenger.renderPollCard(m, room);

        if (m.action_type === 'SCHEDULE_PROPOSE') return Boako.MobileMessenger.renderScheduleCard(m, isMe, time);
        if (m.action_type === 'CHALLENGE_CARD') return Boako.MobileMessenger.renderChallengeCard(m, isMe, time);
        if (m.action_type === 'TEAM_JOIN' || m.action_type === 'TEAM_INVITE') return Boako.MobileMessenger.renderTeamActionCard(m, isMe, time);

        // 🌟 [2단계] 그룹채팅(대항전/같이하자/챌린지)은 발신자가 여러 명이라 말풍선 위에 닉네임 표시
        const senderNameHtml = (isGroup && !isMe)
            ? `<div style="font-size:10.5px; font-weight:900; color:#7c3aed; margin:0 6px 2px;">${Boako.MobileMessenger.escapeHtml(m.profiles?.full_name || '참여자')}</div>`
            : '';

        return `
            <div style="display:flex; flex-direction:column; ${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
                ${senderNameHtml}
                <div style="display:flex; ${isMe ? 'justify-content:flex-end;' : 'justify-content:flex-start;'}">
                    <div>
                        <div style="max-width:220px; padding:8px 12px; border-radius:14px; font-size:12.5px; line-height:1.4;
                            ${isMe ? 'background:#4f46e5; color:#fff; border-bottom-right-radius:4px;' : 'background:#fff; border:1px solid #e2e8f0; color:#0f172a; border-bottom-left-radius:4px;'}">
                            ${Boako.MobileMessenger.escapeHtml(m.content)}
                        </div>
                        <div style="font-size:9.5px; color:#94a3b8; margin:2px 6px 0; text-align:${isMe ? 'right' : 'left'};">${time}</div>
                    </div>
                </div>
            </div>
        `;
    },

    // 🌟 [2단계 신규] 대항전 소통채널의 일정 조율 투표 카드 — PC(js/messenger.js View.openRoom 내부)와
    // 동일한 상태 판정 로직(OPEN/PROPOSED/CONFIRMED, 과반수 계산)을 모바일 카드로 새로 그림.
    // OPEN 상태의 "내 시간 새로 제출"만 PC 전용 달력 모달에 의존해서 이번 범위에서 제외.
    renderPollCard: (poll, room) => {
        const votersCount = Object.keys(poll.votes || {}).length;
        const status = poll.status;
        const myId = String(Boako.state.user.id);
        const entryCount = room.entryCount || 2;
        const majorityCount = Math.floor(entryCount / 2) + 1;

        let inner = '';
        if (status === 'OPEN') {
            inner = `
                <div style="font-size:11.5px; font-weight:900; color:#3730a3; margin-bottom:4px;">📊 일정 조율 투표 진행 중</div>
                <div style="font-size:10.5px; color:#64748b; font-weight:700; margin-bottom:10px;">전체 ${entryCount}명 중 ${votersCount}명이 일정을 제출했습니다.</div>
                <div onclick="Boako.Util.toast('🗓️ 내 시간 제출은 PC에서 캘린더로 진행해주세요.')" style="font-size:11.5px; text-align:center; background:#4f46e5; color:#fff; padding:9px; border-radius:10px; font-weight:900;">나도 달력으로 시간 찍기</div>
            `;
        } else if (status === 'PROPOSED') {
            const confirmedUsers = poll.confirmations || [];
            const isAcceptedByMe = confirmedUsers.some(id => String(id) === myId);
            const confirmedCount = confirmedUsers.length;
            const isMajorityReached = confirmedCount >= majorityCount;

            const statusHtml = isMajorityReached
                ? `<div style="background:#fffbeb; border:1px solid #fde68a; color:#b45309; padding:8px; border-radius:10px; font-size:10.5px; font-weight:900; margin-bottom:10px;">🔥 과반수 수락 완료! (${confirmedCount}/${entryCount}명)<br><span style="font-weight:700; color:#d97706;">남은 인원 무관 12시간 뒤 자동 확정</span></div>`
                : `<div style="background:#f8fafc; border:1px solid #e2e8f0; color:#475569; padding:8px; border-radius:10px; font-size:10.5px; font-weight:900; margin-bottom:10px; display:flex; justify-content:space-between;"><span>수락 진행도: ${confirmedCount}/${entryCount}명</span><span style="color:#4f46e5;">과반수(${majorityCount}명) 필요</span></div>`;

            const btnHtml = !isAcceptedByMe
                ? `<div style="display:flex; flex-direction:column; gap:6px;">
                       <button onclick="Boako.MobileMessenger.replyPoll('${poll.poll_id}', 'accept')" style="background:#059669; color:#fff; font-size:11.5px; font-weight:900; padding:9px; border:none; border-radius:10px;">🟢 수락하기</button>
                       <button onclick="Boako.MobileMessenger.replyPoll('${poll.poll_id}', 'reject')" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; font-size:11px; font-weight:900; padding:8px; border-radius:10px;">🔴 거절 및 재투표</button>
                   </div>`
                : `<div style="display:flex; flex-direction:column; gap:6px;">
                       <div style="text-align:center; background:#f1f5f9; color:#94a3b8; padding:9px; border-radius:10px; font-size:11px; font-weight:800;">✅ 나는 수락 완료 (대기 중)</div>
                       <button onclick="Boako.MobileMessenger.replyPoll('${poll.poll_id}', 'reject')" style="background:#f1f5f9; color:#64748b; font-size:10.5px; font-weight:800; padding:7px; border:none; border-radius:8px;">↩️ 수락 취소</button>
                   </div>`;

            inner = `
                <div style="font-size:11.5px; font-weight:900; color:#065f46; margin-bottom:4px;">🎯 교집합 일정 제안됨!</div>
                <div style="font-size:13px; font-weight:900; color:#312e81; background:#fff; padding:10px; border-radius:10px; border:1px solid #c7d2fe; text-align:center; margin-bottom:8px;">${poll.proposed_time}</div>
                ${statusHtml}${btnHtml}
            `;
        } else if (status === 'CONFIRMED') {
            inner = `
                <div style="font-size:11.5px; font-weight:900; color:#334155; margin-bottom:6px;">🏁 일정 최종 확정!</div>
                <div style="font-size:11.5px; font-weight:900; color:#059669; background:#ecfdf5; border:1px solid #d1fae5; padding:9px; border-radius:10px; text-align:center;">🎉 확정 일정: ${poll.confirmed_time}</div>
            `;
        }

        return `<div style="display:flex; justify-content:center; margin:6px 0;"><div style="width:100%; max-width:280px; background:linear-gradient(180deg,#eef2ff,#fff); border:1.5px solid #c7d2fe; border-radius:16px; padding:14px;">${inner}</div></div>`;
    },

    // 🌟 [2단계 신규] 투표 수락/거절 — PC의 acceptProposedTime/rejectProposedTime과 같은 RPC를
    // 직접 호출(그 함수들을 그대로 부르지 않는 이유는 클래스 코멘트 참고).
    replyPoll: async (pollId, action) => {
        const confirmMsg = action === 'accept'
            ? '이 제안된 시간을 최종 일정으로 수락하시겠습니까?'
            : '이 제안을 거절하고 일정을 다시 조율하시겠습니까?\n거절 시 기존 교집합 제안이 취소되고 재투표가 진행됩니다.';
        if (!confirm(confirmMsg)) return;

        try {
            if (action === 'accept') {
                const { data: isConfirmed, error } = await Boako.db.rpc('accept_schedule_poll', { p_poll_id: pollId });
                if (error) throw error;
                Boako.Util.toast(isConfirmed === true ? '🎉 참가자 전원의 일정이 확정되었습니다!' : '🟢 수락 처리가 기록되었습니다.');
            } else {
                const { error } = await Boako.db.rpc('reject_schedule_poll', { p_poll_id: pollId });
                if (error) throw error;
                Boako.Util.toast('🔴 거절 처리되었습니다. 새로운 시간대를 선택해 주세요.');
            }
        } catch (e) {
            console.error('투표 응답 처리 실패:', e);
            Boako.Util.toast('🚨 ' + (e.message || '처리에 실패했습니다.'));
        }
        await Boako.MobileMessenger.refreshRooms();
        Boako.MobileMessenger.draw(document.getElementById('mobile-content-area'));
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

    // 🌟 [2단계] 방 유형에 따라 실제 전송 함수를 분기 (DM/대항전/같이하자/챌린지)
    sendMessage: async () => {
        const input = document.getElementById('mobile-msg-input');
        const content = input.value.trim();
        if (!content || !Boako.MobileMessenger.activeConversation) return;
        input.value = '';

        const conv = Boako.MobileMessenger.activeConversation;
        let success = false;

        if (conv.roomType === 'match_channel') {
            success = await Boako.Messenger.sendMatchChannel(conv.seasonNo, conv.gameName, content);
        } else if (conv.roomType === 'together') {
            success = await Boako.Messenger.sendTogetherChat(conv.postId, content);
        } else if (conv.roomType === 'challenge') {
            success = await Boako.Messenger.sendChallengeChat(conv.challengeId, content);
        } else {
            // 🌟 [버그수정] roomId만으로 매치방/DM을 구분하려 하면 둘 다 UUID 형태라 신뢰할 수 없음 —
            // openRoom()에서 이미 저장해둔 room.isMatch 플래그를 그대로 사용 (PC executeChatSend와 동일 로직)
            const matchId = conv.isMatch ? conv.roomId : null;
            const metadata = conv.isMatch ? { match_type: conv.matchType, game_name: conv.gameName } : {};
            success = await Boako.Messenger.sendDirect(conv.otherId, content, conv.otherName, 'DEFAULT', metadata, matchId);
        }

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
