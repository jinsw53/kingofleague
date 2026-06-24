/**
 * [MESSENGER - V3.4] 아카이브 통신망
 * - 대항전 소통채널 우측 패널 통합 렌더링 (모달 완전 제거)
 * - grandprix_match_chats 테이블 & messages 테이블 이원화 처리 완료
 * - 🌟 [V3.5 업데이트] 일정 조율 투표(POLL) 데이터 통합 렌더링 시스템 탑재
 */
Boako.Messenger = {
    unreadCount: 0,
    chatRooms: {},       
    currentRoomId: null, 
    realtimeChannels: [], 

    // 🌟 [추가] 대항전 다수결 투표 브릿지 (달력 모달 호출기)
   openMatchPoll: async (roomId) => {
        const room = Boako.Messenger.chatRooms[roomId];
        if (!room || !room.isMatchChannel) return;
        
        // 🚨 [핵심 추가] 이미 일정이 확정된 방이면 모달 오픈 자체를 강제 차단
        if (room.isConfirmed) {
            Boako.Util.toast("이미 일정이 최종 확정되어 투표를 진행할 수 없습니다.");
            return;
        }

        Boako.Match.Chat.currentSeason = room.seasonNo;
        Boako.Match.Chat.currentGame = room.gameName;
        Boako.Match.Chat.currentEntryCount = room.entryCount || 2;
        
        Boako.Match.Chat.openPollModal();
    },

    fetchUnreadCount: async () => {
        if (!Boako.state.user) return 0;
        try {
            const { count, error } = await Boako.db
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', Boako.state.user.id)
                .eq('is_read', false);
            if (error) throw error;
            Boako.Messenger.unreadCount = count || 0;
            return count;
        } catch (err) { return 0; }
    },

    loadChatRooms: async () => {
        Boako.Messenger.chatRooms = {};
        const myId = Boako.state.user.id;
        const matchReadStorage = JSON.parse(localStorage.getItem('boako_match_read') || '{}');

        // 1. [대항전] 내가 출전 중인 본선 채널 방 생성 및 메시지/투표 로드
        try {
            const { data: finalGames } = await Boako.db.from('grandprix_games').select('game_name, season_no, entry_count').eq('status', 'FINAL');
            if (finalGames && finalGames.length > 0) {
                const finalGameNames = finalGames.map(g => g.game_name);
                const { data: myEntries } = await Boako.db.from('grandprix_entries')
                    .select('game_name, season_no').eq('player_name', Boako.state.user.nickname).eq('is_finalized', true).in('game_name', finalGameNames);
                
                if (myEntries && myEntries.length > 0) {
                    const validRoomIds = [];
                    myEntries.forEach(entry => {
                        const dbRoomId = `${entry.season_no}_${entry.game_name}`;
                        const uiRoomId = `match_channel_${dbRoomId}`;
                        const gameInfo = finalGames.find(g => g.game_name === entry.game_name);
                        validRoomIds.push(dbRoomId);
                        
                        Boako.Messenger.chatRooms[uiRoomId] = {
                            id: uiRoomId,
                            isMatchChannel: true, 
                            seasonNo: entry.season_no,
                            gameName: entry.game_name,
                            entryCount: gameInfo ? gameInfo.entry_count : 2, // 과반수 계산용 총원
                            dbRoomId: dbRoomId,
                            title: `[${entry.game_name}] 소통 채널`,
                            badge: `<span class="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded font-black ml-2">대항전</span>`,
                            lastMessage: '채널이 개설되었습니다. 자유롭게 소통하세요.',
                            lastTime: new Date(0).toISOString(), 
                            unread: 0,
                            messages: []
                        };
                    });

                    // 🌟 대항전 채팅 내역 긁어오기
                    const { data: matchMsgs } = await Boako.db.from('grandprix_match_chats')
                        .select('*, profiles(full_name)')
                        .in('room_id', validRoomIds);

                    // 🌟 [추가됨] 대항전 투표 내역 긁어오기
                    const { data: matchPolls } = await Boako.db.from('schedule_polls')
                        .select('*')
                        .in('target_id', validRoomIds);

                    let combined = [];
                    if (matchMsgs) combined = combined.concat(matchMsgs.map(m => ({ ...m, type: 'CHAT' })));
                    if (matchPolls) {
                        const activePolls = matchPolls.filter(p => p.status === 'OPEN' || p.status === 'PROPOSED');
                        const activePollIds = activePolls.map(p => p.poll_id);
                        matchPolls.forEach(p => {
                            // 종료된 투표 말고 활성 투표나 최종 확정된 투표만 필터링
                            if (p.status === 'CONFIRMED' || activePollIds.includes(p.poll_id)) {
                                combined.push({ ...p, type: 'POLL', room_id: p.target_id, created_at: p.created_at });
                            }
                        });
                    }

                    // 역순(최신순) 정렬 (나중에 unshift로 화면에 뿌릴 때 과거->최신 순서가 되도록 조율)
                    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    combined.forEach(item => {
                        const uiRoomId = `match_channel_${item.room_id}`;
                        const room = Boako.Messenger.chatRooms[uiRoomId];
                        if (room) {
                            room.messages.unshift(item);
                            if (item.type === 'CHAT') {
                                if (new Date(item.created_at) > new Date(room.lastTime)) {
                                    room.lastTime = item.created_at;
                                    room.lastMessage = item.content;
                                }
                                const lastRead = matchReadStorage[uiRoomId] || 0;
                                if (item.sender_id !== myId && new Date(item.created_at).getTime() > lastRead) {
                                    room.unread++;
                                }
                            } else {
                                if (new Date(item.created_at) > new Date(room.lastTime)) {
                                    room.lastTime = item.created_at;
                                    room.lastMessage = '📊 일정 투표가 업데이트되었습니다.';
                                }
                            }
                        }
                    });
                }
            }
        } catch (e) { console.error("소통채널 로드 실패:", e); }

        // 2. [일반 쪽지] 기존 messages 테이블 데이터 로드
        try {
            const { data: directMsgs, error } = await Boako.db.from('messages')
                .select('*')
                .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            if (directMsgs) {
                directMsgs.forEach(msg => {
                    const isMeSender = msg.sender_id === myId;
                    const otherId = isMeSender ? msg.receiver_id : msg.sender_id;
                    const otherName = isMeSender ? msg.receiver_name_override : msg.sender_name_override;
                    const roomId = msg.match_id || otherId; 
                    
                    if (!Boako.Messenger.chatRooms[roomId]) {
                        const isMatch = !!msg.match_id;
                        let roomTitle = `${otherName} 님과의 대화`;
                        let matchBadge = '';

                        if (isMatch) {
                            const gameName = msg.metadata?.game_name || '종목미정';
                            const typeName = msg.metadata?.match_type === 'CHALLENGE' ? '🔥 승자연전' : '⚔️ 라이벌전';
                            roomTitle = `[${gameName}] ${typeName}`;
                            matchBadge = `<span class="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded font-black ml-2">${msg.metadata?.match_type || 'MATCH'}</span>`;
                        }

                        const displayMessage = msg.action_type === 'TEAM_JOIN' ? '🛡️ 입단 지원서 도착' : 
                           (msg.action_type === 'TEAM_INVITE' ? '💌 팀 영입 제안서 도착' : msg.content);

                        Boako.Messenger.chatRooms[roomId] = {
                            id: roomId,
                            isMatch: isMatch,
                            matchType: msg.metadata?.match_type,
                            otherId: otherId,
                            otherName: otherName, 
                            title: roomTitle,
                            badge: matchBadge,
                            lastMessage: displayMessage,
                            lastTime: msg.created_at,
                            unread: (!isMeSender && !msg.is_read) ? 1 : 0,
                            messages: [{ ...msg, type: 'DM' }] 
                        };
                    } else {
                        Boako.Messenger.chatRooms[roomId].messages.unshift({ ...msg, type: 'DM' });
                        if (!isMeSender && !msg.is_read) Boako.Messenger.chatRooms[roomId].unread++;
                    }
                });
            }
            return Boako.Messenger.chatRooms;
        } catch (err) {
            console.error("일반 메시지 로드 실패:", err);
            return Boako.Messenger.chatRooms;
        }
    },

    sendDirect: async (receiverId, content, receiverName, actionType = 'DEFAULT', metadata = {}, matchId = null) => {
        try {
            const payload = {
                sender_id: Boako.state.user.id,
                sender_name_override: Boako.state.user.nickname,
                receiver_id: receiverId,
                receiver_name_override: receiverName,
                content: content,
                action_type: actionType,
                metadata: metadata,
                match_id: matchId
            };
            const { error } = await Boako.db.from('messages').insert([payload]);
            if (error) throw error;
            return true;
        } catch (err) { console.error(err); return false; }
    },

    sendMatchChannel: async (seasonNo, gameName, content) => {
        try {
            const payload = {
                season_no: seasonNo,
                game_name: gameName,
                sender_id: Boako.state.user.id,
                content: content
            };
            const { error } = await Boako.db.from('grandprix_match_chats').insert([payload]);
            if (error) throw error;
            return true;
        } catch (err) { console.error(err); return false; }
    },

    hideRoom: async (roomId) => {
        const room = Boako.Messenger.chatRooms[roomId];
        if(!room || !confirm("이 대화방을 나가시겠습니까?\n(새로운 쪽지가 도착하면 다시 나타납니다.)")) return;

        if (!room.isMatchChannel) {
            await Boako.db.from('messages').update({ is_read: true }).eq('receiver_id', Boako.state.user.id).or(`match_id.eq.${roomId},sender_id.eq.${roomId}`);
        }
        
        let hidden = JSON.parse(localStorage.getItem('boako_hidden_rooms') || '{}');
        hidden[roomId] = room.lastTime;
        localStorage.setItem('boako_hidden_rooms', JSON.stringify(hidden));

        if (Boako.Messenger.currentRoomId === roomId) {
            Boako.Messenger.currentRoomId = null;
            document.getElementById('chat-room-content').innerHTML = `
                <div class="flex-1 flex items-center justify-center text-slate-400 font-bold flex-col gap-3">
                    <i data-lucide="door-open" class="w-12 h-12 opacity-50"></i>방에서 나갔습니다.
                </div>
            `;
            lucide.createIcons();
        }
        await Boako.Messenger.fetchUnreadCount();
        Boako.Messenger.View.refreshRoomList();
    },

    startRealtime: () => {
        if (!Boako.state.user || Boako.Messenger.realtimeChannels.length > 0) return;

        const msgChannel = Boako.db.channel('messages-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
                const newMsg = payload.new;
                const myId = Boako.state.user.id;
                if (newMsg.receiver_id === myId || newMsg.sender_id === myId) {
                    await Boako.Messenger.fetchUnreadCount();
                    await Boako.Messenger.View.refreshRoomList();
                    const roomId = newMsg.match_id || (newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id);
                    if (Boako.Messenger.currentRoomId === roomId) Boako.Messenger.View.openRoom(roomId);
                    else if (newMsg.receiver_id === myId) Boako.Util.toast(`💬 ${newMsg.sender_name_override}님의 쪽지가 도착했습니다!`);
                }
            }).subscribe();

        const matchChannel = Boako.db.channel('grandprix-chats-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'grandprix_match_chats' }, async (payload) => {
                const newMsg = payload.new;
                const uiRoomId = `match_channel_${newMsg.room_id}`;
                if (Boako.Messenger.chatRooms[uiRoomId]) {
                    await Boako.Messenger.View.refreshRoomList();
                    if (Boako.Messenger.currentRoomId === uiRoomId) Boako.Messenger.View.openRoom(uiRoomId);
                    else if (newMsg.sender_id !== Boako.state.user.id) Boako.Util.toast(`📣 [대항전] 채널에 새 메시지가 도착했습니다!`);
                }
            }).subscribe();

        // 🌟 [추가] 투표 데이터 리얼타임 감지
        const pollChannel = Boako.db.channel('grandprix-polls-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_polls' }, async (payload) => {
                const uiRoomId = `match_channel_${payload.new.target_id}`;
                if (Boako.Messenger.chatRooms[uiRoomId]) {
                    await Boako.Messenger.loadChatRooms(); // 데이터 리로드
                    if (Boako.Messenger.currentRoomId === uiRoomId) Boako.Messenger.View.openRoom(uiRoomId);
                }
            }).subscribe();

        Boako.Messenger.realtimeChannels.push(msgChannel, matchChannel, pollChannel);
    },

    View: {
        renderMain: async () => {
            const container = document.getElementById('main-content');
            if (!container) return;
            container.innerHTML = `
                <div class="main-banner" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:25px; border-radius:16px; margin-bottom:20px;">
                    <h1 style="font-size: 24px; font-weight: 900; color: white;">💬 아카이브 통신망</h1>
                    <p style="color: #94a3b8; font-size: 14px; margin-top:5px;">매치업 일정 조율과 전략 논의를 위한 암호화 채널입니다.</p>
                </div>
                <div class="flex flex-col md:flex-row h-[600px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div class="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
                        <div class="p-4 border-b border-slate-200 font-black text-slate-800 flex justify-between items-center bg-white">
                            <span>대화 목록</span>
                        </div>
                        <div id="chat-room-list" class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            <div class="text-center py-10 text-slate-400 font-bold text-sm">목록을 불러오는 중...</div>
                        </div>
                    </div>
                    <div class="w-full md:w-2/3 flex flex-col bg-slate-50 relative" id="chat-room-content">
                        <div class="flex-1 flex items-center justify-center text-slate-400 font-bold flex-col gap-3">
                            <i data-lucide="message-square" class="w-12 h-12 opacity-50"></i>
                            좌측에서 대화방을 선택해주세요.
                        </div>
                    </div>
                </div>
            `;
            lucide.createIcons();
            await Boako.Messenger.View.refreshRoomList();
            Boako.Messenger.startRealtime();
        },

        refreshRoomList: async () => {
            const rooms = await Boako.Messenger.loadChatRooms();
            const listContainer = document.getElementById('chat-room-list');
            if (!listContainer) return;
            let hidden = JSON.parse(localStorage.getItem('boako_hidden_rooms') || '{}');
            const roomArray = Object.values(rooms).filter(room => {
                const hideTime = hidden[room.id];
                if (hideTime) return new Date(room.lastTime) > new Date(hideTime);
                return true;
            }).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

            if (roomArray.length === 0) {
                listContainer.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold text-sm">참여 중인 대화가 없습니다.</div>`;
                return;
            }

            let listHtml = '';
            roomArray.forEach(room => {
                const unreadBadge = room.unread > 0 ? `<div class="bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full">${room.unread}</div>` : '';
                const activeClass = Boako.Messenger.currentRoomId === room.id ? 'bg-white shadow-sm border-indigo-200' : 'border-transparent hover:bg-white/60';
                const icon = room.isMatchChannel ? '📣' : (room.isMatch ? '⚔️' : room.title.charAt(0));
                listHtml += `
                    <div onclick="Boako.Messenger.View.openRoom('${room.id}')" class="p-3 rounded-xl border cursor-pointer transition-all group ${activeClass} flex items-center gap-3 relative">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0 flex items-center justify-center text-slate-500 font-black">${icon}</div>
                        <div class="flex-1 min-w-0 pr-4">
                            <div class="font-bold text-sm text-slate-800 truncate flex items-center">${room.title} ${room.badge}</div>
                            <div class="text-xs text-slate-500 truncate mt-0.5">${room.lastMessage}</div>
                        </div>
                        <div>${unreadBadge}</div>
                        <button onclick="event.stopPropagation(); Boako.Messenger.hideRoom('${room.id}')" class="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity bg-white/80 rounded-full p-0.5"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </div>
                `;
            });
            listContainer.innerHTML = listHtml;
            lucide.createIcons(); 
        },

        openRoom: (roomId) => {
            Boako.Messenger.currentRoomId = roomId;
            const room = Boako.Messenger.chatRooms[roomId];
            const contentContainer = document.getElementById('chat-room-content');
            if (!room || !contentContainer) return;

            if (room.isMatchChannel) {
                let matchRead = JSON.parse(localStorage.getItem('boako_match_read') || '{}');
                matchRead[roomId] = Date.now();
                localStorage.setItem('boako_match_read', JSON.stringify(matchRead));
                room.unread = 0;
            } else {
                Boako.db.from('messages').update({ is_read: true }).eq('receiver_id', Boako.state.user.id).or(`match_id.eq.${roomId},sender_id.eq.${roomId}`).then(() => Boako.Messenger.fetchUnreadCount());
            }

            let bannerHtml = '';
            if (room.isMatchChannel) {
                bannerHtml = `
                    <div class="bg-indigo-900 border-b border-indigo-800 p-3 px-5 flex items-center justify-between shadow-sm z-10">
                        <div class="font-black text-white text-sm flex items-center gap-2"><span class="animate-pulse">📣</span> [대항전] ${room.gameName} 채널</div>
                        <div class="flex gap-2">
                            <button onclick="Boako.Messenger.openMatchPoll('${roomId}')" class="text-xs bg-white text-indigo-900 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 shadow-sm transition-colors">
                                📅 일정 투표/조율
                            </button>
                        </div>
                    </div>`;
            } else if (room.isMatch) {
                bannerHtml = `
                    <div class="bg-indigo-50 border-b border-indigo-100 p-3 px-5 flex items-center justify-between shadow-sm z-10">
                        <div class="font-black text-indigo-900 text-sm flex items-center gap-2"><span class="animate-pulse">🔴</span> 이 대화방은 ${room.title} 전용 공간입니다.</div>
                        <div class="flex gap-2">
                            <button onclick="Boako.Messenger.hideRoom('${roomId}')" class="text-xs bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-100">나가기</button>
                            <button onclick="Boako.Messenger.View.promptScheduleProposal('${roomId}')" class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 shadow-sm">📅 일정 제안</button>
                        </div>
                    </div>`;
            } else {
                bannerHtml = `
                    <div class="bg-white border-b border-slate-200 p-4 font-black text-slate-800 shadow-sm z-10 flex items-center justify-between">
                        <span>${room.title}</span>
                        <button onclick="Boako.Messenger.hideRoom('${roomId}')" class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200">방 나가기</button>
                    </div>`;
            }

            let messagesHtml = '<div class="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col custom-scrollbar" id="chat-scroll-area">';
            room.messages.forEach(msg => {
                const isMe = msg.sender_id === Boako.state.user.id;
                const timeStr = new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                const senderName = room.isMatchChannel ? (msg.profiles?.full_name || '참여자') : msg.sender_name_override;

                // 🌟 [핵심] 대항전 투표(POLL) UI 렌더링
                if (msg.type === 'POLL') {
                    const poll = msg;
                    const votersCount = Object.keys(poll.votes || {}).length;
                    const status = poll.status;
                    const myId = String(Boako.state.user.id);
                    const majorityCount = Math.floor(room.entryCount / 2) + 1;
                    
                    let cardInnerHtml = '';
                    if (status === 'OPEN') {
                        cardInnerHtml = `
                            <div class="font-black text-indigo-900 text-xs mb-1 flex items-center gap-1">📊 일정 조율 투표 진행 중</div>
                            <p class="text-[11px] text-slate-500 font-bold mb-3">전체 ${room.entryCount}명 중 ${votersCount}명이 일정을 제출했습니다.</p>
                            <div class="text-xs text-center bg-indigo-600 text-white p-2 rounded-xl font-black shadow-sm cursor-pointer hover:bg-indigo-700 active:scale-95 transition-all" onclick="Boako.Messenger.openMatchPoll('${Boako.Messenger.currentRoomId}')">나도 달력으로 시간 찍기</div>
                        `;
                    } else if (status === 'PROPOSED') {
                        const confirmedUsers = poll.confirmations || [];
                        const isAcceptedByMe = confirmedUsers.some(id => String(id) === myId);
                        const confirmedCount = confirmedUsers.length;
                        const isMajorityReached = confirmedCount >= majorityCount;
                        const hoursPassed = (new Date().getTime() - new Date(poll.created_at).getTime()) / (1000 * 60 * 60);
                        
                        if (isMajorityReached && hoursPassed >= 12) {
                            cardInnerHtml = `<div class="font-black text-amber-700 text-xs text-center p-3">⏳ 확정 처리 진행 중...</div>`;
                            setTimeout(() => Boako.Match.Chat.forceConfirmPoll(poll.poll_id, poll.proposed_time, poll.proposer_id), 100);
                        } else {
                            let statusHtml = isMajorityReached ? 
                                `<div class="bg-amber-50 border border-amber-200 text-amber-700 p-2.5 rounded-xl text-[11px] font-black mb-3">🔥 과반수 수락 완료! (${confirmedCount}/${room.entryCount}명)<br><span class="font-bold text-amber-600 mt-0.5 block">남은 인원 무관 12시간 뒤 자동 확정</span></div>` : 
                                `<div class="bg-slate-50 border border-slate-200 text-slate-600 p-2.5 rounded-xl text-[11px] font-black mb-3 flex justify-between items-center"><span>수락 진행도: ${confirmedCount} / ${room.entryCount}명</span><span class="text-indigo-600">과반수(${majorityCount}명) 필요</span></div>`;
                            let btnHtml = !isAcceptedByMe ? 
                                `<div class="flex flex-col gap-2 w-full"><button onclick="Boako.Match.Chat.acceptProposedTime('${poll.poll_id}')" class="w-full bg-emerald-600 text-white text-xs font-black py-2.5 rounded-xl shadow-sm">🟢 수락하기</button><button onclick="Boako.Match.Chat.rejectProposedTime('${poll.poll_id}')" class="w-full bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black py-2 rounded-xl">🔴 거절 및 재투표</button></div>` :
                                `<div class="flex flex-col gap-2 w-full"><div class="text-xs text-center bg-slate-100 text-slate-400 py-2.5 rounded-xl font-bold">✅ 나는 수락 완료 (대기 중)</div><button onclick="Boako.Match.Chat.rejectProposedTime('${poll.poll_id}')" class="w-full bg-slate-100 text-slate-500 text-[11px] font-bold py-1.5 rounded-lg">↩️ 수락 취소</button></div>`;
                            cardInnerHtml = `<div class="font-black text-emerald-800 text-xs mb-1 flex items-center gap-1">🎯 교집합 일정 제안됨!</div><div class="text-sm font-black text-indigo-900 bg-white p-3 rounded-xl border border-indigo-200 text-center shadow-inner mb-3">${poll.proposed_time}</div>${statusHtml} ${btnHtml}`;
                        }
                    } else if (status === 'CONFIRMED') {
                        cardInnerHtml = `<div class="font-black text-slate-700 text-xs mb-1 flex items-center gap-1">🏁 일정 최종 확정!</div><div class="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-center shadow-sm">🎉 확정 일정: ${poll.confirmed_time}</div>`;
                    }
                    messagesHtml += `<div class="flex justify-center my-2 w-full self-center"><div class="bg-gradient-to-b from-indigo-50 to-white border-2 border-indigo-200/60 rounded-2xl p-4 w-72 shadow-md">${cardInnerHtml}</div></div>`;
                } 
                // 일반 DM 특수 액션 카드 렌더링
                else if (msg.action_type === 'SCHEDULE_PROPOSE') {
                    const proposedTime = msg.metadata?.proposed_time ? new Date(msg.metadata.proposed_time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '미정';
                    const status = msg.action_status || 'PENDING';
                    let actionButtons = '', statusBadge = '';
                    if (status === 'PENDING') {
                        if (!isMe) actionButtons = `<div class="flex gap-2 mt-3"><button onclick="Boako.Messenger.View.replySchedule('${msg.message_id}', 'ACCEPTED')" class="flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg">🟢 수락</button><button onclick="Boako.Messenger.View.replySchedule('${msg.message_id}', 'REJECTED')" class="flex-1 bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-lg">❌ 거절</button></div>`;
                        else statusBadge = `<div class="mt-3 text-xs text-slate-500 font-bold text-center bg-white/50 py-1.5 rounded-lg">상대방의 수락 대기 중...</div>`;
                    } else if (status === 'ACCEPTED') statusBadge = `<div class="mt-3 text-xs text-emerald-600 font-bold text-center bg-emerald-50 py-1.5 rounded-lg border border-emerald-100">✅ 수락됨 (캘린더 등록 완료)</div>`;
                    else if (status === 'REJECTED') statusBadge = `<div class="mt-3 text-xs text-red-500 font-bold text-center bg-red-50 py-1.5 rounded-lg border border-red-100">❌ 거절됨</div>`;
                    messagesHtml += `<div class="flex flex-col items-${isMe ? 'end' : 'start'} self-${isMe ? 'end' : 'start'} mb-2">${!isMe ? `<div class="font-bold text-xs text-slate-800 mb-1 ml-1">${senderName}</div>` : ''}<div class="flex items-end gap-2">${isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}<div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 w-64 shadow-sm text-slate-800"><div class="flex items-center gap-2 font-black text-indigo-900 mb-2">📅 일정 제안</div><div class="text-sm font-bold text-slate-700 bg-white p-2 rounded-lg border border-indigo-100 text-center">${proposedTime}</div>${actionButtons}${statusBadge}</div>${!isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}</div></div>`;
                } else if (msg.action_type === 'CHALLENGE_CARD') {
                    const gameName = msg.metadata?.game_name || '종목미정';
                    const points = msg.metadata?.reward_points || 0;
                    const status = msg.action_status || 'PENDING';
                    let cardContent = '';
                    if (status === 'PENDING') {
                        if (!isMe) cardContent = `<div class="flex gap-2 mt-3"><button onclick="Boako.Messenger.View.replyChallenge('${msg.message_id}', '${msg.match_id}', 'ACCEPTED')" class="flex-1 bg-red-500 text-white text-xs font-black py-2 rounded-lg">🔥 수락</button><button onclick="Boako.Messenger.View.replyChallenge('${msg.message_id}', '${msg.match_id}', 'REJECTED')" class="flex-1 bg-slate-600 text-white text-xs font-bold py-2 rounded-lg">거절</button></div>`;
                        else cardContent = `<div class="mt-3 text-xs text-slate-400 font-bold text-center bg-white/5 py-1.5 rounded-lg">응답 대기 중... ⏳</div>`;
                    } else if (status === 'ACCEPTED') cardContent = `<div class="mt-3 text-xs text-red-400 font-black text-center bg-red-500/10 py-1.5 rounded-lg border border-red-500/20">🔥 매치 수락됨</div>`;
                    else if (status === 'REJECTED') cardContent = `<div class="mt-3 text-xs text-slate-400 font-bold text-center bg-white/5 py-1.5 rounded-lg">❌ 거절됨</div>`;
                    messagesHtml += `<div class="flex flex-col items-${isMe ? 'end' : 'start'} self-${isMe ? 'end' : 'start'} mb-2">${!isMe ? `<div class="font-bold text-xs text-slate-800 mb-1 ml-1">${senderName}</div>` : ''}<div class="flex items-end gap-2">${isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}<div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-4 w-64 shadow-lg text-white"><div class="font-black text-red-400 text-xs mb-2">⚔️ 라이벌 매치 도착</div><div class="text-sm font-black text-slate-800 bg-white p-2.5 rounded-lg text-center mb-2">${gameName}</div><div class="text-center text-yellow-400 text-[11px] font-bold">보상: <span class="text-sm">${points} P</span></div>${cardContent}</div>${!isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}</div></div>`;
                } else if (msg.action_type === 'TEAM_JOIN' || msg.action_type === 'TEAM_INVITE') {
                    const isJoin = msg.action_type === 'TEAM_JOIN';
                    let pData = {};
                    try { pData = JSON.parse(msg.content); } catch(e) { pData = { team_name: '오류' }; }
                    const status = msg.action_status || 'PENDING';
                    let btnHtml = '';
                    if (status === 'PENDING' && !isMe) {
                        const fn = isJoin ? 'replyTeamJoin' : 'replyTeamInvite';
                        btnHtml = `<div class="flex gap-2 mt-3"><button onclick="Boako.Messenger.View.${fn}('${msg.message_id}', 'ACCEPTED')" class="flex-1 bg-blue-600 text-white text-xs font-black py-2 rounded-lg">✅ 수락</button><button onclick="Boako.Messenger.View.${fn}('${msg.message_id}', 'REJECTED')" class="flex-1 bg-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg">거절</button></div>`;
                    } else if (status === 'PENDING') btnHtml = `<div class="mt-3 text-xs text-slate-500 text-center bg-slate-100 py-1.5 rounded-lg">결재 대기 중...</div>`;
                    else if (status === 'ACCEPTED') btnHtml = `<div class="mt-3 text-xs text-blue-600 text-center bg-blue-50 py-1.5 rounded-lg">✅ 승인됨</div>`;
                    else btnHtml = `<div class="mt-3 text-xs text-red-500 text-center bg-red-50 py-1.5 rounded-lg">❌ 거절됨</div>`;
                    messagesHtml += `<div class="flex flex-col items-${isMe ? 'end' : 'start'} self-${isMe ? 'end' : 'start'} mb-2">${!isMe ? `<div class="font-bold text-xs text-slate-800 mb-1 ml-1">${senderName}</div>` : ''}<div class="flex items-end gap-2">${isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}<div class="bg-white border border-blue-200 rounded-2xl p-4 w-64 shadow-sm text-slate-800"><div class="font-black text-blue-600 text-xs mb-2">${isJoin ? '🛡️ 입단 지원' : '💌 스카웃 제안'}</div><div class="text-sm font-bold bg-slate-50 p-2.5 rounded-lg text-center border">[${pData.team_name}] 합류</div>${btnHtml}</div>${!isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}</div></div>`;
                } 
                // 일반 텍스트 대화 렌더링
                else {
                    if (isMe) {
                        messagesHtml += `<div class="flex items-end justify-end gap-2 self-end max-w-[85%]"><span class="text-[10px] text-slate-400 mb-1">${timeStr}</span><div class="bg-indigo-500 text-white p-3 rounded-2xl rounded-tr-sm shadow-sm text-sm break-words leading-relaxed">${msg.content.replace(/\n/g, '<br>')}</div></div>`;
                    } else {
                        messagesHtml += `<div class="flex items-end justify-start gap-2 self-start max-w-[85%]"><div class="bg-white border border-slate-200 text-slate-700 p-3 rounded-2xl rounded-tl-sm shadow-sm text-sm break-words leading-relaxed"><div class="font-bold text-xs text-slate-800 mb-1">${senderName}</div>${msg.content.replace(/\n/g, '<br>')}</div><span class="text-[10px] text-slate-400 mb-1">${timeStr}</span></div>`;
                    }
                }
            });
            messagesHtml += '</div>';

            const inputHtml = `
                <div class="p-4 bg-white border-t border-slate-200 flex gap-2 z-10">
                    <textarea id="chat-input" rows="1" placeholder="메시지를 입력하세요... (엔터로 전송)" class="flex-1 resize-none border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"></textarea>
                    <button onclick="Boako.Messenger.View.executeChatSend()" class="bg-slate-800 hover:bg-slate-900 text-white px-5 rounded-xl font-bold transition-colors flex items-center justify-center">전송</button>
                </div>
            `;

            contentContainer.innerHTML = bannerHtml + messagesHtml + inputHtml;

            const scrollArea = document.getElementById('chat-scroll-area');
            if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
            
            Boako.Messenger.View.refreshRoomList(); 
            
            const chatInput = document.getElementById('chat-input');
            if(chatInput) {
                chatInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); Boako.Messenger.View.executeChatSend(); }
                });
                chatInput.focus();
            }
        },

        executeChatSend: async () => {
            const roomId = Boako.Messenger.currentRoomId;
            const inputEl = document.getElementById('chat-input');
            if (!roomId || !inputEl) return;

            const content = inputEl.value.trim();
            if (!content) return;

            const room = Boako.Messenger.chatRooms[roomId];
            inputEl.value = ''; 

            let success = false;
            if (room.isMatchChannel) {
                success = await Boako.Messenger.sendMatchChannel(room.seasonNo, room.gameName, content);
            } else {
                const matchId = room.isMatch ? room.id : null;
                const metadata = room.isMatch ? { match_type: room.matchType, game_name: room.title.replace(/\[|\]/g, '').split(' ')[0] } : {};
                success = await Boako.Messenger.sendDirect(room.otherId, content, room.otherName, 'DEFAULT', metadata, matchId);
            }

            if (success) {
                await Boako.Messenger.View.refreshRoomList();
                Boako.Messenger.View.openRoom(roomId); 
            } else {
                Boako.Util.toast("❌ 전송에 실패했습니다.");
            }
        },

        promptScheduleProposal: async (roomId) => {
            const room = Boako.Messenger.chatRooms[roomId];
            if (!room.isMatch) { Boako.Util.toast("매치 전용 대화방에서만 가능합니다."); return; }
            const inputTime = prompt("제안할 날짜/시간 (예: 2026-06-05 20:00)");
            if (!inputTime) return;
            const md = { match_type: room.matchType, game_name: room.title.replace(/\[|\]/g, '').split(' ')[0], proposed_time: inputTime };
            const success = await Boako.Messenger.sendDirect(room.otherId, "매치 일정을 제안합니다.", room.otherName, 'SCHEDULE_PROPOSE', md, roomId);
            if (success) Boako.Util.toast("일정 제안 카드가 전송되었습니다!");
        },

        replySchedule: async (messageId, status) => {
            if (!confirm(`이 일정을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
            await Boako.db.from('messages').update({ action_status: status }).eq('message_id', messageId);
            if (status === 'ACCEPTED') {
                const { data: msgInfo } = await Boako.db.from('messages').select('*').eq('message_id', messageId).single();
                if (msgInfo) {
                    const payload = { proposer_id: msgInfo.sender_id, responder_id: msgInfo.receiver_id, game_name: msgInfo.metadata.game_name || '미정', match_type: msgInfo.metadata.match_type || 'FRIENDLY', scheduled_time: msgInfo.metadata.proposed_time, status: 'UPCOMING', original_message_id: messageId };
                    const { error } = await Boako.db.from('match_schedules').insert([payload]);
                    if (error) Boako.Util.toast("캘린더 등록에 실패했습니다."); else Boako.Util.toast("🎉 일정이 수락되어 캘린더에 공식 등록되었습니다!");
                }
            }
            await Boako.Messenger.fetchUnreadCount(); await Boako.Messenger.View.refreshRoomList(); Boako.Messenger.View.openRoom(Boako.Messenger.currentRoomId);
        },

        replyChallenge: async (messageId, matchId, status) => {
            if (!confirm(`라이벌 도전을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
            try {
                const { error } = await Boako.db.rpc('respond_to_rival_match', { p_match_id: matchId, p_action: status });
                if (error) throw new Error("처리 실패");
                Boako.Util.toast(`✅ 라이벌 도전을 처리했습니다!`);
                await Boako.Messenger.fetchUnreadCount(); await Boako.Messenger.View.refreshRoomList(); Boako.Messenger.View.openRoom(Boako.Messenger.currentRoomId);
            } catch (err) { alert(err.message); }
        },

        replyTeamJoin: async (messageId, status) => {
            if (!confirm(`가입 신청을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
            try {
                const { error } = await Boako.db.rpc('respond_to_team_join', { p_message_id: messageId, p_action: status });
                if (error) throw new Error("처리 실패");
                Boako.Util.toast(`✅ 가입 신청을 처리했습니다!`);
                await Boako.Messenger.fetchUnreadCount(); await Boako.Messenger.View.refreshRoomList(); Boako.Messenger.View.openRoom(Boako.Messenger.currentRoomId);
            } catch (err) { alert(err.message); }
        },

        replyTeamInvite: async (messageId, status) => {
            if (!confirm(`스카웃 제안을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
            try {
                const { error } = await Boako.db.rpc('respond_to_team_invite', { p_message_id: messageId, p_action: status });
                if (error) throw new Error("처리 실패");
                Boako.Util.toast(`✅ 영입 제안을 처리했습니다!`);
                await Boako.Messenger.fetchUnreadCount(); await Boako.Messenger.View.refreshRoomList(); Boako.Messenger.View.openRoom(Boako.Messenger.currentRoomId);
            } catch (err) { alert(err.message); }
        }
    }
};
