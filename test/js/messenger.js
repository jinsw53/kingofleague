/**
 * [MESSENGER - V2.0] 아카이브 통신망 
 * - 도전/매치 ID 기반 대화방 그룹화
 * - 카카오톡 스타일 투팬(Two-Pane) 레이아웃
 * - Supabase Realtime 기반 실시간 채팅 수신
 */
Boako.Messenger = {
    unreadCount: 0,
    chatRooms: {},       // 그룹화된 대화방 캐싱
    currentRoomId: null, // 현재 열려있는 방 ID
    realtimeChannel: null, // 실시간 수신 채널 보관용

    // 1. 안 읽은 쪽지 뱃지 카운트
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

    // 2. 모든 쪽지를 긁어와서 '방(Room)' 단위로 그룹화하는 엔진
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
                
                // 💡 방 식별자: match_id가 있으면 매치 전용방, 없으면 1:1 일반방
                const roomId = msg.match_id || otherId; 
                
                if (!Boako.Messenger.chatRooms[roomId]) {
                    const isMatch = !!msg.match_id;
                    let roomTitle = `${otherName} 님과의 대화`;
                    let matchBadge = '';

                    if (isMatch) {
                        const gameName = msg.metadata?.game_name || '종목미정';
                        const typeName = msg.metadata?.match_type === 'CHALLENGE' ? '🔥 승자연전 챌린지' : '⚔️ 라이벌 매치';
                        roomTitle = `[${gameName}] ${typeName}`;
                        matchBadge = `<span class="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded font-black ml-2">${msg.metadata?.match_type || 'MATCH'}</span>`;
                    }

                    Boako.Messenger.chatRooms[roomId] = {
                        id: roomId,
                        isMatch: isMatch,
                        matchType: msg.metadata?.match_type,
                        otherId: otherId,
                        otherName: otherName, // 전송 시 사용하기 위해 저장
                        title: roomTitle,
                        badge: matchBadge,
                        lastMessage: msg.content,
                        lastTime: msg.created_at,
                        unread: (!isMeSender && !msg.is_read) ? 1 : 0,
                        messages: [] // 메시지 배열
                    };
                } else {
                    if (!isMeSender && !msg.is_read) Boako.Messenger.chatRooms[roomId].unread++;
                }
                
                // 최신순으로 가져왔으므로 unshift로 넣어야 옛날 대화가 위로 감
                Boako.Messenger.chatRooms[roomId].messages.unshift(msg); 
            });

            return Boako.Messenger.chatRooms;
        } catch (err) {
            console.error("채팅 목록 로드 실패:", err);
            return {};
        }
    },

    // 3. 메시지 발송 함수 (match_id 지원)
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

    // 📡 4. 실시간(Realtime) 메시지 수신 안테나
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
                        // 1. 방 목록과 안읽은 뱃지 리로드
                        await Boako.Messenger.fetchUnreadCount();
                        await Boako.Messenger.View.refreshRoomList();

                        // 2. 방 식별자 계산
                        const roomId = newMsg.match_id || (newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id);
                        
                        // 3. 현재 열려있는 방이면 화면 즉시 갱신
                        if (Boako.Messenger.currentRoomId === roomId) {
                            Boako.Messenger.View.openRoom(roomId);
                        } 
                        // 4. 다른 곳을 보고 있는데 알림이 온 경우
                        else if (newMsg.receiver_id === myId) {
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
                    <!-- 좌측: 대화방 리스트 -->
                    <div class="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
                        <div class="p-4 border-b border-slate-200 font-black text-slate-800 flex justify-between items-center bg-white">
                            <span>대화 목록</span>
                            <button onclick="Boako.Util.toast('새 대화 상대를 검색하는 기능은 준비 중입니다!')" class="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"><i data-lucide="plus-circle" class="w-5 h-5"></i></button>
                        </div>
                        <div id="chat-room-list" class="flex-1 overflow-y-auto p-2 space-y-1">
                            <div class="text-center py-10 text-slate-400 font-bold text-sm">목록을 불러오는 중...</div>
                        </div>
                    </div>

                    <!-- 우측: 채팅창 영역 -->
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
            
            // 🌟 화면이 그려진 후 실시간 수신 안테나 가동!
            Boako.Messenger.startRealtime();
        },

        refreshRoomList: async () => {
            const rooms = await Boako.Messenger.loadChatRooms();
            const listContainer = document.getElementById('chat-room-list');
            if (!listContainer) return;

            let listHtml = '';
            const roomArray = Object.values(rooms).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

            if (roomArray.length === 0) {
                listContainer.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold text-sm">참여 중인 대화가 없습니다.</div>`;
                return;
            }

            roomArray.forEach(room => {
                const unreadBadge = room.unread > 0 ? `<div class="bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full">${room.unread}</div>` : '';
                const activeClass = Boako.Messenger.currentRoomId === room.id ? 'bg-white shadow-sm border-indigo-200' : 'border-transparent hover:bg-white/60';
                
                listHtml += `
                    <div onclick="Boako.Messenger.View.openRoom('${room.id}')" class="p-3 rounded-xl border cursor-pointer transition-all ${activeClass} flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0 flex items-center justify-center text-slate-500 font-black">
                            ${room.isMatch ? '⚔️' : room.title.charAt(0)}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm text-slate-800 truncate flex items-center">${room.title} ${room.badge}</div>
                            <div class="text-xs text-slate-500 truncate mt-0.5">${room.lastMessage}</div>
                        </div>
                        <div>${unreadBadge}</div>
                    </div>
                `;
            });
            listContainer.innerHTML = listHtml;
        },

        openRoom: (roomId) => {
            Boako.Messenger.currentRoomId = roomId;
            const room = Boako.Messenger.chatRooms[roomId];
            const contentContainer = document.getElementById('chat-room-content');
            if (!room || !contentContainer) return;

            // 안 읽은 메시지 읽음 처리
            Boako.db.from('messages').update({ is_read: true }).eq('receiver_id', Boako.state.user.id).or(`match_id.eq.${roomId},sender_id.eq.${roomId}`).then(() => Boako.Messenger.fetchUnreadCount());

            // 상단 배너 렌더링
            const bannerHtml = room.isMatch ? `
                <div class="bg-indigo-50 border-b border-indigo-100 p-3 px-5 flex items-center justify-between shadow-sm z-10">
                    <div class="font-black text-indigo-900 text-sm flex items-center gap-2">
                        <span class="animate-pulse">🔴</span> 이 대화방은 ${room.title} 조율을 위한 전용 공간입니다.
                    </div>
                    <button onclick="Boako.Util.toast('일정 캘린더 등록 기능이 곧 추가됩니다!')" class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors">📅 일정 제안하기</button>
                </div>
            ` : `
                <div class="bg-white border-b border-slate-200 p-4 font-black text-slate-800 shadow-sm z-10 flex items-center gap-2">
                    ${room.title}
                </div>
            `;

            // 메시지 말풍선 렌더링
            let messagesHtml = '<div class="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col" id="chat-scroll-area">';
            room.messages.forEach(msg => {
                const isMe = msg.sender_id === Boako.state.user.id;
                const timeStr = new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                
                if (isMe) {
                    messagesHtml += `
                        <div class="flex items-end justify-end gap-2 self-end max-w-[85%]">
                            <span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>
                            <div class="bg-indigo-500 text-white p-3 rounded-2xl rounded-tr-sm shadow-sm text-sm break-words leading-relaxed">
                                ${msg.content.replace(/\\n/g, '<br>')}
                            </div>
                        </div>
                    `;
                } else {
                    messagesHtml += `
                        <div class="flex items-end justify-start gap-2 self-start max-w-[85%]">
                            <div class="bg-white border border-slate-200 text-slate-700 p-3 rounded-2xl rounded-tl-sm shadow-sm text-sm break-words leading-relaxed">
                                <div class="font-bold text-xs text-slate-800 mb-1">${msg.sender_name_override}</div>
                                ${msg.content.replace(/\\n/g, '<br>')}
                            </div>
                            <span class="text-[10px] text-slate-400 mb-1">${timeStr}</span>
                        </div>
                    `;
                }
            });
            messagesHtml += '</div>';

            // 입력창 렌더링
            const inputHtml = `
                <div class="p-4 bg-white border-t border-slate-200 flex gap-2 z-10">
                    <textarea id="chat-input" rows="1" placeholder="메시지를 입력하세요... (엔터로 전송, Shift+엔터로 줄바꿈)" class="flex-1 resize-none border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"></textarea>
                    <button onclick="Boako.Messenger.View.executeChatSend()" class="bg-slate-800 hover:bg-slate-900 text-white px-5 rounded-xl font-bold transition-colors flex items-center justify-center">전송</button>
                </div>
            `;

            contentContainer.innerHTML = bannerHtml + messagesHtml + inputHtml;

            // 스크롤 맨 아래로 이동
            const scrollArea = document.getElementById('chat-scroll-area');
            if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

            Boako.Messenger.View.refreshRoomList();
            
            // 엔터키 전송 이벤트
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

        // 메시지 전송 실행
        executeChatSend: async () => {
            const roomId = Boako.Messenger.currentRoomId;
            const inputEl = document.getElementById('chat-input');
            if (!roomId || !inputEl) return;

            const content = inputEl.value.trim();
            if (!content) return;

            const room = Boako.Messenger.chatRooms[roomId];
            const matchId = room.isMatch ? room.id : null;
            
            inputEl.value = ''; // UI 즉각 반응

            const metadata = room.isMatch ? { match_type: room.matchType, game_name: room.title.replace(/\[|\]/g, '').split(' ')[0] } : {};

            const success = await Boako.Messenger.send(room.otherId, content, room.otherName, 'DEFAULT', metadata, matchId);
            if (success) {
                // 발송 성공 후 내 화면 즉시 갱신
                await Boako.Messenger.View.refreshRoomList();
                Boako.Messenger.View.openRoom(roomId); 
            } else {
                Boako.Util.toast("❌ 전송에 실패했습니다.");
            }
        }
    }
};
