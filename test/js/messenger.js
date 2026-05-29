/**
 * [MESSENGER - V2.1] 아카이브 통신망 (방 나가기 및 스마트 숨김 기능 추가)
 */
Boako.Messenger = {
    unreadCount: 0,
    chatRooms: {},       
    currentRoomId: null, 
    realtimeChannel: null, 

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
        const myId = Boako.state.user.id;
        try {
            const { data, error } = await Boako.db
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            Boako.Messenger.chatRooms = {};
            
            data.forEach(msg => {
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

                    Boako.Messenger.chatRooms[roomId] = {
                        id: roomId,
                        isMatch: isMatch,
                        matchType: msg.metadata?.match_type,
                        otherId: otherId,
                        otherName: otherName, 
                        title: roomTitle,
                        badge: matchBadge,
                        lastMessage: msg.content,
                        lastTime: msg.created_at,
                        unread: (!isMeSender && !msg.is_read) ? 1 : 0,
                        messages: [] 
                    };
                } else {
                    if (!isMeSender && !msg.is_read) Boako.Messenger.chatRooms[roomId].unread++;
                }
                
                Boako.Messenger.chatRooms[roomId].messages.unshift(msg); 
            });

            return Boako.Messenger.chatRooms;
        } catch (err) {
            console.error("채팅 목록 로드 실패:", err);
            return {};
        }
    },

    send: async (receiverId, content, receiverName, actionType = 'DEFAULT', metadata = {}, matchId = null) => {
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
        } catch (err) {
            console.error(err);
            return false;
        }
    },

    // 🚪 5. [추가] 방 나가기 (숨김) 처리 함수
    hideRoom: async (roomId) => {
        if(!confirm("이 대화방을 나가시겠습니까?\n(새로운 쪽지가 도착하면 다시 나타납니다.)")) return;

        // 1. 방에 있는 안 읽은 메시지 강제 읽음 처리
        await Boako.db.from('messages').update({ is_read: true })
            .eq('receiver_id', Boako.state.user.id)
            .or(`match_id.eq.${roomId},sender_id.eq.${roomId}`);
        
        // 2. 현재 시간을 '숨김 처리 기준 시간'으로 로컬스토리지에 저장
        const room = Boako.Messenger.chatRooms[roomId];
        let hidden = JSON.parse(localStorage.getItem('boako_hidden_rooms') || '{}');
        hidden[roomId] = room ? room.lastTime : new Date().toISOString();
        localStorage.setItem('boako_hidden_rooms', JSON.stringify(hidden));

        // 3. UI 초기화 (만약 보고 있던 방이었다면 화면 닫기)
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
        if (!Boako.state.user || Boako.Messenger.realtimeChannel) return;

        Boako.Messenger.realtimeChannel = Boako.db
            .channel('messages-changes')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'messages' }, 
                async (payload) => {
                    const newMsg = payload.new;
                    const myId = Boako.state.user.id;

                    if (newMsg.receiver_id === myId || newMsg.sender_id === myId) {
                        await Boako.Messenger.fetchUnreadCount();
                        await Boako.Messenger.View.refreshRoomList();

                        const roomId = newMsg.match_id || (newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id);
                        
                        if (Boako.Messenger.currentRoomId === roomId) {
                            Boako.Messenger.View.openRoom(roomId);
                        } else if (newMsg.receiver_id === myId) {
                            Boako.Util.toast(`💬 ${newMsg.sender_name_override}님의 새 메시지가 도착했습니다!`);
                        }
                    }
                }
            )
            .subscribe();
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
                        <div id="chat-room-list" class="flex-1 overflow-y-auto p-2 space-y-1">
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

            // 💡 [핵심] 로컬 스토리지의 '숨김 기록'을 가져와서 필터링
            let hidden = JSON.parse(localStorage.getItem('boako_hidden_rooms') || '{}');

            const roomArray = Object.values(rooms).filter(room => {
                const hideTime = hidden[room.id];
                if (hideTime) {
                    // 숨긴 시간보다 마지막 메시지가 '최신'일 때만 보여줌
                    return new Date(room.lastTime) > new Date(hideTime);
                }
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
                
                // 🖱️ 목록을 호버(마우스 오버)하면 우측 상단에 쪼끄만 [X] 버튼이 나타나게 세팅
                listHtml += `
                    <div onclick="Boako.Messenger.View.openRoom('${room.id}')" class="p-3 rounded-xl border cursor-pointer transition-all group ${activeClass} flex items-center gap-3 relative">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0 flex items-center justify-center text-slate-500 font-black">
                            ${room.isMatch ? '⚔️' : room.title.charAt(0)}
                        </div>
                        <div class="flex-1 min-w-0 pr-4">
                            <div class="font-bold text-sm text-slate-800 truncate flex items-center">${room.title} ${room.badge}</div>
                            <div class="text-xs text-slate-500 truncate mt-0.5">${room.lastMessage}</div>
                        </div>
                        <div>${unreadBadge}</div>
                        
                        <button onclick="event.stopPropagation(); Boako.Messenger.hideRoom('${room.id}')" class="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity bg-white/80 rounded-full p-0.5">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
            });
            listContainer.innerHTML = listHtml;
            lucide.createIcons(); // ❌ 아이콘 렌더링
        },

        openRoom: (roomId) => {
            Boako.Messenger.currentRoomId = roomId;
            const room = Boako.Messenger.chatRooms[roomId];
            const contentContainer = document.getElementById('chat-room-content');
            if (!room || !contentContainer) return;

            Boako.db.from('messages').update({ is_read: true }).eq('receiver_id', Boako.state.user.id).or(`match_id.eq.${roomId},sender_id.eq.${roomId}`).then(() => Boako.Messenger.fetchUnreadCount());

            // 🌟 상단 배너에 [방 나가기] 버튼 추가
            const bannerHtml = room.isMatch ? `
                <div class="bg-indigo-50 border-b border-indigo-100 p-3 px-5 flex items-center justify-between shadow-sm z-10">
                    <div class="font-black text-indigo-900 text-sm flex items-center gap-2">
                        <span class="animate-pulse">🔴</span> 이 대화방은 ${room.title} 전용 공간입니다.
                    </div>
                    <div class="flex gap-2">
                        <button onclick="Boako.Messenger.hideRoom('${roomId}')" class="text-xs bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-100 transition-colors">나가기</button>
                        <button onclick="Boako.Messenger.View.promptScheduleProposal('${roomId}')" class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm">📅 일정 제안</button>
                    </div>
                </div>
            ` : `
                <div class="bg-white border-b border-slate-200 p-4 font-black text-slate-800 shadow-sm z-10 flex items-center justify-between">
                    <span>${room.title}</span>
                    <button onclick="Boako.Messenger.hideRoom('${roomId}')" class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 transition-colors">방 나가기</button>
                </div>
            `;

            let messagesHtml = '<div class="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col" id="chat-scroll-area">';
            room.messages.forEach(msg => {
                // 🌟 메시지 말풍선 & 일정 제안 카드 렌더링 로직
            let messagesHtml = '<div class="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col" id="chat-scroll-area">';
            room.messages.forEach(msg => {
                const isMe = msg.sender_id === Boako.state.user.id;
                const timeStr = new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                
                // 💡 [추가] 일정 제안 메시지일 경우 특별한 카드 UI로 그리기
                if (msg.action_type === 'SCHEDULE_PROPOSE') {
                    const proposedTime = new Date(msg.metadata?.proposed_time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const status = msg.action_status || 'PENDING';
                    
                    let actionButtons = '';
                    let statusBadge = '';

                    if (status === 'PENDING') {
                        if (!isMe) {
                            // 상대방이 보낸 제안이면 수락/거절 버튼 표시
                            actionButtons = `
                                <div class="flex gap-2 mt-3">
                                    <button onclick="Boako.Messenger.View.replySchedule('${msg.message_id}', 'ACCEPTED')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">🟢 수락</button>
                                    <button onclick="Boako.Messenger.View.replySchedule('${msg.message_id}', 'REJECTED')" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 rounded-lg transition-colors">❌ 거절</button>
                                </div>
                            `;
                        } else {
                            statusBadge = `<div class="mt-3 text-xs text-slate-500 font-bold text-center bg-white/50 py-1.5 rounded-lg">상대방의 수락을 기다리는 중...</div>`;
                        }
                    } else if (status === 'ACCEPTED') {
                        statusBadge = `<div class="mt-3 text-xs text-emerald-600 font-bold text-center bg-emerald-50 py-1.5 rounded-lg border border-emerald-100">✅ 수락됨 (캘린더 등록 완료)</div>`;
                    } else if (status === 'REJECTED') {
                        statusBadge = `<div class="mt-3 text-xs text-red-500 font-bold text-center bg-red-50 py-1.5 rounded-lg border border-red-100">❌ 거절됨</div>`;
                    }

                    const cardHtml = `
                        <div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 w-64 shadow-sm text-slate-800">
                            <div class="flex items-center gap-2 font-black text-indigo-900 mb-2">
                                📅 매치 일정 제안
                            </div>
                            <div class="text-sm font-bold text-slate-700 bg-white p-2 rounded-lg border border-indigo-100 text-center shadow-inner">
                                ${proposedTime}
                            </div>
                            ${actionButtons}
                            ${statusBadge}
                        </div>
                    `;

                    messagesHtml += `
                        <div class="flex flex-col items-${isMe ? 'end' : 'start'} self-${isMe ? 'end' : 'start'} mb-2">
                            ${!isMe ? `<div class="font-bold text-xs text-slate-800 mb-1 ml-1">${msg.sender_name_override}</div>` : ''}
                            <div class="flex items-end gap-2">
                                ${isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}
                                ${cardHtml}
                                ${!isMe ? `<span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>` : ''}
                            </div>
                        </div>
                    `;
                } 
                // 💬 일반 텍스트 메시지 렌더링 (기존 로직 유지)
                else {
                    if (isMe) {
                        messagesHtml += `<div class="flex items-end justify-end gap-2 self-end max-w-[85%] mb-2"><span class="text-[10px] text-slate-400 mb-1">${timeStr}</span><div class="bg-indigo-500 text-white p-3 rounded-2xl rounded-tr-sm shadow-sm text-sm break-words leading-relaxed">${msg.content.replace(/\n/g, '<br>')}</div></div>`;
                    } else {
                        messagesHtml += `<div class="flex items-end justify-start gap-2 self-start max-w-[85%] mb-2"><div class="bg-white border border-slate-200 text-slate-700 p-3 rounded-2xl rounded-tl-sm shadow-sm text-sm break-words leading-relaxed"><div class="font-bold text-xs text-slate-800 mb-1">${msg.sender_name_override}</div>${msg.content.replace(/\n/g, '<br>')}</div><span class="text-[10px] text-slate-400 mb-1">${timeStr}</span></div>`;
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
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        Boako.Messenger.View.executeChatSend();
                    }
                });
            }
        },

       executeChatSend: async () => {
            const roomId = Boako.Messenger.currentRoomId;
            const inputEl = document.getElementById('chat-input');
            if (!roomId || !inputEl) return;

            const content = inputEl.value.trim();
            if (!content) return;

            const room = Boako.Messenger.chatRooms[roomId];
            const matchId = room.isMatch ? room.id : null;
            
            inputEl.value = ''; 
            const metadata = room.isMatch ? { match_type: room.matchType, game_name: room.title.replace(/\[|\]/g, '').split(' ')[0] } : {};

            const success = await Boako.Messenger.send(room.otherId, content, room.otherName, 'DEFAULT', metadata, matchId);
            if (success) {
                await Boako.Messenger.View.refreshRoomList();
                Boako.Messenger.View.openRoom(roomId); 
            } else {
                Boako.Util.toast("❌ 전송에 실패했습니다.");
            }
        }, // 🌟 <--- 소장님이 말씀하신 바로 그 쉼표입니다! 🌟

        // 📅 1. 일정 제안 날짜 선택 및 발송 
        promptScheduleProposal: async (roomId) => {
            const room = Boako.Messenger.chatRooms[roomId];
            if (!room.isMatch) {
                Boako.Util.toast("일정 제안은 매치(라이벌/챌린지) 전용 대화방에서만 가능합니다.");
                return;
            }
            
            // ... (생략) ...
            
            if (success) Boako.Util.toast("일정 제안 카드가 전송되었습니다!");
        }, // <--- 여기도 쉼표 필수!

        // 🤝 2. 상대방이 제안 카드의 [수락/거절]을 눌렀을 때의 마법
        replySchedule: async (messageId, status) => {
            if (!confirm(`이 일정을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;
            
            // ... (생략) ...
            
            await Boako.Messenger.fetchUnreadCount();
            await Boako.Messenger.View.refreshRoomList();
            Boako.Messenger.View.openRoom(Boako.Messenger.currentRoomId);
        }
    } // View 객체 닫는 괄호
}; // Boako.Messenger 객체 닫는 괄호
