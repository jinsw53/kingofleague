/**
 * [MESSENGER] 아카이브 통신망 (회원간 1:1 쪽지 시스템)
 */
Boako.Messenger = {
    unreadCount: 0,

    // ==========================================
    // ⚙️ 1. 데이터/통신 코어 (API)
    // ==========================================
    
    // 안 읽은 쪽지 개수 가져오기 (뱃지 표시용)
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
            return Boako.Messenger.unreadCount;
        } catch (err) {
            console.error("쪽지 카운트 로드 오류:", err);
            return 0;
        }
    },

    // 쪽지 목록 가져오기 (inbox: 받은 쪽지, outbox: 보낸 쪽지)
    getMessages: async (type = 'inbox') => {
        if (!Boako.state.user) return [];
        try {
            const isInbox = type === 'inbox';
            const targetColumn = isInbox ? 'receiver_id' : 'sender_id';

            const { data, error } = await Boako.db
                .from('messages')
                .select(`
                    *,
                    sender:sender_id(full_name, nickname),
                    receiver:receiver_id(full_name, nickname)
                `)
                .eq(targetColumn, Boako.state.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error("쪽지 목록 로드 오류:", err);
            return [];
        }
    },

    // 쪽지 보내기
    send: async (receiverId, content) => {
        try {
            const { error } = await Boako.db.from('messages').insert({
                sender_id: Boako.state.user.id,
                sender_type: 'USER',
                receiver_id: receiverId,
                content: content,
                action_type: 'DEFAULT',
                action_status: 'NONE'
            });

            if (error) throw error;
            Boako.Util.toast("✅ 쪽지를 성공적으로 보냈습니다.");
            return true;
        } catch (err) {
            Boako.Util.toast("❌ 쪽지 발송 실패: " + err.message);
            return false;
        }
    },

    // 쪽지 읽음 처리
    markAsRead: async (messageId) => {
        try {
            await Boako.db.from('messages')
                .update({ is_read: true })
                .eq('message_id', messageId)
                .eq('receiver_id', Boako.state.user.id); 
                
            await Boako.Messenger.fetchUnreadCount(); 
        } catch (err) {
            console.error("읽음 처리 오류:", err);
        }
    },

    // ==========================================
    // 🎨 2. 프론트엔드 UI 화면 렌더링 (View)
    // ==========================================
    View: {
        currentTab: 'inbox',
        messagesData: [],

        // 쪽지함 메인 화면 렌더링
        renderMain: async () => {
            const container = document.getElementById('main-content') || document.getElementById('app'); 
            if (!container) return;

            container.innerHTML = `<div style="text-align:center; padding:50px;">통신망 연결 중... ⏳</div>`;
            Boako.Messenger.View.messagesData = await Boako.Messenger.getMessages(Boako.Messenger.View.currentTab);
            
            let html = `
                <div class="message-container" style="padding: 20px; max-width: 600px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📬 아카이브 통신망</h2>
                        <button onclick="Boako.Messenger.View.renderCompose()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor:pointer; font-weight:bold;">+ 쪽지 쓰기</button>
                    </div>

                    <div class="message-tabs" style="display:flex; gap:10px; margin-bottom: 20px;">
                        <button onclick="Boako.Messenger.View.switchTab('inbox')" style="flex:1; padding:10px; background: ${Boako.Messenger.View.currentTab === 'inbox' ? '#1e293b' : '#f1f5f9'}; color: ${Boako.Messenger.View.currentTab === 'inbox' ? 'white' : 'black'}; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">받은 쪽지함</button>
                        <button onclick="Boako.Messenger.View.switchTab('outbox')" style="flex:1; padding:10px; background: ${Boako.Messenger.View.currentTab === 'outbox' ? '#1e293b' : '#f1f5f9'}; color: ${Boako.Messenger.View.currentTab === 'outbox' ? 'white' : 'black'}; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">보낸 쪽지함</button>
                    </div>

                    <div class="message-list" style="display:flex; flex-direction:column; gap:12px;">
            `;

            if (Boako.Messenger.View.messagesData.length === 0) {
                html += `<div style="text-align:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:8px;">쪽지가 없습니다.</div>`;
            } else {
                Boako.Messenger.View.messagesData.forEach(msg => {
                    const isInbox = Boako.Messenger.View.currentTab === 'inbox';
                    const isUnread = isInbox && !msg.is_read;
                    
                    let targetName = isInbox ? 
                        (msg.sender_type === 'SYSTEM' ? '⚙️ 시스템' : (msg.sender?.nickname || '알 수 없음')) : 
                        (msg.receiver?.nickname || '알 수 없음');

                    const dateStr = new Date(msg.created_at).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
                    
                    html += `
                        <div onclick="Boako.Messenger.View.openMessage('${msg.message_id}')" style="padding: 16px; border: 1px solid ${isUnread ? '#93c5fd' : '#e2e8f0'}; border-radius: 8px; background: ${isUnread ? '#eff6ff' : '#ffffff'}; cursor:pointer; transition: all 0.2s;">
                            <div style="display:flex; justify-content:space-between; margin-bottom: 8px; align-items:center;">
                                <strong style="font-size:15px; color:#0f172a;">${isUnread ? '🔴 ' : ''}${isInbox ? 'From.' : 'To.'} ${targetName}</strong>
                                <span style="font-size:12px; color:#64748b;">${dateStr}</span>
                            </div>
                            <div style="color: #475569; font-size:14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${msg.content}
                            </div>
                        </div>
                    `;
                });
            }
            html += `</div></div>`;
            container.innerHTML = html;
        },

        switchTab: (tab) => {
            Boako.Messenger.View.currentTab = tab;
            Boako.Messenger.View.renderMain();
        },

        openMessage: async (msgId) => {
            const msg = Boako.Messenger.View.messagesData.find(m => m.message_id == msgId);
            if (!msg) return;

            const isInbox = Boako.Messenger.View.currentTab === 'inbox';
            let targetName = isInbox ? 
                (msg.sender_type === 'SYSTEM' ? '⚙️ 시스템' : (msg.sender?.nickname || '알 수 없음')) : 
                (msg.receiver?.nickname || '알 수 없음');

            const dateStr = new Date(msg.created_at).toLocaleString('ko-KR', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

            if (isInbox && !msg.is_read) {
                msg.is_read = true; 
                await Boako.Messenger.markAsRead(msg.message_id); 
                Boako.Auth.renderWidget(); 
            }

            const container = document.getElementById('main-content') || document.getElementById('app');
            container.innerHTML = `
                <div style="padding: 20px; max-width: 600px; margin: 0 auto;">
                    <button onclick="Boako.Messenger.View.renderMain()" style="margin-bottom: 20px; padding: 8px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor:pointer;">◀ 뒤로 가기</button>
                    
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px;">
                            <h3 style="margin: 0 0 8px 0; font-size: 18px;">${isInbox ? '보낸 사람' : '받는 사람'}: ${targetName}</h3>
                            <div style="font-size: 13px; color: #64748b;">${dateStr}</div>
                        </div>
                        <div style="font-size: 15px; color: #1e293b; line-height: 1.6; white-space: pre-wrap; min-height: 150px;">${msg.content}</div>
                        
                        ${isInbox && msg.sender_type !== 'SYSTEM' ? `
                            <div style="margin-top: 24px; text-align: right;">
                                <button onclick="Boako.Messenger.View.renderCompose('${msg.sender_id}', '${msg.sender?.nickname}')" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; cursor:pointer; font-weight:bold;">답장하기</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        },

        renderCompose: (replyToId = '', replyToName = '') => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            container.innerHTML = `
                <div style="padding: 20px; max-width: 600px; margin: 0 auto;">
                    <button onclick="Boako.Messenger.View.renderMain()" style="margin-bottom: 20px; padding: 8px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor:pointer;">◀ 취소</button>
                    
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                        <h2 style="margin-top: 0;">새 쪽지 작성</h2>
                        <div style="margin-bottom: 16px;">
                            <label style="display:block; margin-bottom: 8px; font-weight:bold;">받는 사람 (UUID)</label>
                            <input type="text" id="msg-receiver-id" value="${replyToId}" placeholder="상대방의 UUID를 입력하세요" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
                            ${replyToName ? `<div style="font-size:12px; color:#10b981; margin-top:4px;">대상: ${replyToName}</div>` : ''}
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display:block; margin-bottom: 8px; font-weight:bold;">내용</label>
                            <textarea id="msg-content" rows="6" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; resize: vertical;"></textarea>
                        </div>
                        <button onclick="Boako.Messenger.View.executeSend()" style="width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor:pointer; font-weight:bold; font-size:16px;">전송하기 🚀</button>
                    </div>
                </div>
            `;
        },

        executeSend: async () => {
            const receiverId = document.getElementById('msg-receiver-id').value.trim();
            const content = document.getElementById('msg-content').value.trim();

            if (!receiverId || !content) {
                alert("받는 사람과 내용을 모두 입력해주세요!");
                return;
            }

            const success = await Boako.Messenger.send(receiverId, content);
            if (success) {
                Boako.Messenger.View.switchTab('outbox'); 
            }
        }
    }
};
