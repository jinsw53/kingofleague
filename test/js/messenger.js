/**
 * [MESSENGER] 아카이브 통신망 (초고속 No-Join + CASCADE 최적화 + 일정 연동)
 */
Boako.Messenger = {
    unreadCount: 0,

    // 1. 안 읽은 쪽지 뱃지용
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
            console.error("쪽지 카운트 오류:", err);
            return 0;
        }
    },

    // 2. 리스트 로드
    getMessages: async (type = 'inbox') => {
        if (!Boako.state.user) return [];
        try {
            const isInbox = type === 'inbox';
            const targetColumn = isInbox ? 'receiver_id' : 'sender_id';
            const { data, error } = await Boako.db
                .from('messages')
                .select('*')
                .eq(targetColumn, Boako.state.user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("쪽지 목록 로드 오류:", err);
            return [];
        }
    },

    // 3. 발송 (일정 데이터 포함)
    send: async (receiverId, content, receiverName, actionType = 'DEFAULT', metadataParams = {}) => {
        try {
            const myName = Boako.state.user.nickname || Boako.state.user.user_metadata?.full_name || '알수없음';
            const finalMetadata = { receiver_name: receiverName, ...metadataParams };

            const { error } = await Boako.db.from('messages').insert({
                sender_id: Boako.state.user.id,
                sender_type: 'USER',
                sender_name_override: myName,
                receiver_id: receiverId,
                receiver_name_override: receiverName,
                content: content,
                action_type: actionType,
                action_status: actionType === 'DEFAULT' ? 'NONE' : 'PENDING',
                metadata: finalMetadata
            });
            if (error) throw error;
            Boako.Util.toast("✅ 성공적으로 전송되었습니다.");
            return true;
        } catch (err) {
            Boako.Util.toast("❌ 전송 실패: " + err.message);
            return false;
        }
    },

    // 4. 읽음 처리
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

    // 5. 일정 수락 시 DB 등록
    acceptSchedule: async (msgId) => {
        const msg = Boako.Messenger.View.messagesData.find(m => m.message_id == msgId);
        if (!msg) return;

        if (confirm(`'${msg.metadata.game_name}' 일정을 수락하시겠습니까?\n(수락 시 전광판에 공식 등록됩니다)`)) {
            try {
                const { error: scheduleError } = await Boako.db.from('match_schedules').insert({
                    proposer_id: msg.sender_id,
                    responder_id: msg.receiver_id,
                    proposer_name_override: msg.sender_name_override,
                    responder_name_override: msg.receiver_name_override,
                    game_name: msg.metadata.game_name,
                    match_type: msg.metadata.match_type,
                    scheduled_time: msg.metadata.scheduled_time,
                    status: 'UPCOMING',
                    original_message_id: msg.message_id
                });
                if (scheduleError) throw scheduleError;

                const { error: msgError } = await Boako.db.from('messages')
                    .update({ action_status: 'ACCEPTED' })
                    .eq('message_id', msg.message_id);
                if (msgError) throw msgError;

                Boako.Util.toast("✅ 일정을 수락하고 공식 캘린더에 등록했습니다!");
                msg.action_status = 'ACCEPTED'; 
                Boako.Messenger.View.openMessage(msgId); 
            } catch (err) {
                Boako.Util.toast("❌ 수락 처리 중 오류: " + err.message);
            }
        }
    },

    // 6. 일정 거절 처리
    rejectSchedule: async (msgId) => {
        const msg = Boako.Messenger.View.messagesData.find(m => m.message_id == msgId);
        if (!msg) return;

        if (confirm("정말로 이 제안을 거절하시겠습니까?")) {
            try {
                const { error } = await Boako.db.from('messages')
                    .update({ action_status: 'REJECTED' })
                    .eq('message_id', msgId);
                if (error) throw error;
                
                Boako.Util.toast("🛑 일정을 거절했습니다.");
                msg.action_status = 'REJECTED'; 
                Boako.Messenger.View.openMessage(msgId);
            } catch (err) {
                Boako.Util.toast("❌ 거절 처리 중 오류: " + err.message);
            }
        }
    },

    // ==========================================
    // 🎨 UI 렌더링 영역
    // ==========================================
    View: {
        currentTab: 'inbox',
        messagesData: [],

        renderMain: async () => {
            const container = document.getElementById('main-content') || document.getElementById('app'); 
            if (!container) return;

            container.innerHTML = `<div style="text-align:center; padding:50px;">통신망 연결 중... ⏳</div>`;
            Boako.Messenger.View.messagesData = await Boako.Messenger.getMessages(Boako.Messenger.View.currentTab);
            
            let html = `
                <div class="message-container" style="padding: 20px; max-width: 600px; margin: 0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="margin:0; font-size:20px;">📬 아카이브 통신망</h2>
                        <button onclick="Boako.Messenger.View.renderCompose()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor:pointer; font-weight:bold;">+ 새 쪽지 쓰기</button>
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
                    const senderName = msg.sender_name_override || '알 수 없음';
                    const receiverName = msg.receiver_name_override || '알 수 없음';
                    const targetName = isInbox ? (msg.sender_type === 'SYSTEM' ? '⚙️ 시스템' : senderName) : receiverName;

                    const actionBadge = msg.action_type === 'SCHEDULE_PROPOSE' ? `<span style="background:#f59e0b; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px;">📅 일정</span>` : '';
                    const dateStr = new Date(msg.created_at).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
                    
                    html += `
                        <div onclick="Boako.Messenger.View.openMessage('${msg.message_id}')" style="padding: 16px; border: 1px solid ${isUnread ? '#93c5fd' : '#e2e8f0'}; border-radius: 8px; background: ${isUnread ? '#eff6ff' : '#ffffff'}; cursor:pointer; transition: all 0.2s;">
                            <div style="display:flex; justify-content:space-between; margin-bottom: 8px; align-items:center;">
                                <strong style="font-size:15px; color:#0f172a;">${isUnread ? '🔴 ' : ''}${isInbox ? 'From.' : 'To.'} ${targetName} ${actionBadge}</strong>
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
            const senderName = msg.sender_name_override || '알 수 없음';
            const receiverName = msg.receiver_name_override || '알 수 없음';
            const targetName = isInbox ? (msg.sender_type === 'SYSTEM' ? '⚙️ 시스템' : senderName) : receiverName;
            const dateStr = new Date(msg.created_at).toLocaleString('ko-KR', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

            if (isInbox && !msg.is_read) {
                msg.is_read = true; 
                await Boako.Messenger.markAsRead(msg.message_id); 
                if (Boako.Auth && Boako.Auth.renderWidget) Boako.Auth.renderWidget(); 
            }

            let scheduleCardHtml = '';
            if (msg.action_type === 'SCHEDULE_PROPOSE' && msg.metadata?.scheduled_time) {
                const matchDate = new Date(msg.metadata.scheduled_time).toLocaleString('ko-KR', { month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
                
                scheduleCardHtml = `
                    <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px;">
                        <h4 style="margin:0 0 12px 0; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">📅 매치 일정 제안</h4>
                        <div style="font-size:14px; color:#0f172a; line-height:1.8;">
                            <div><strong>종목:</strong> ${msg.metadata.game_name}</div>
                            <div><strong>일시:</strong> ${matchDate}</div>
                        </div>
                `;

                if (msg.action_status === 'PENDING') {
                    if (isInbox) { 
                        scheduleCardHtml += `
                            <div style="margin-top:20px; display:flex; gap:10px;">
                                <button onclick="Boako.Messenger.acceptSchedule('${msg.message_id}')" style="flex:1; padding:10px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">🟢 수락 (일정 등록)</button>
                                <button onclick="Boako.Messenger.rejectSchedule('${msg.message_id}')" style="flex:1; padding:10px; background:#ef4444; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">🔴 거절</button>
                            </div>
                        `;
                    } else {
                        scheduleCardHtml += `<div style="margin-top:15px; color:#f59e0b; font-weight:bold;">⏳ 상대방의 수락 대기 중...</div>`;
                    }
                } else if (msg.action_status === 'ACCEPTED') {
                    scheduleCardHtml += `<div style="margin-top:15px; color:#10b981; font-weight:bold;">✅ 수락 완료 (전광판 등록됨)</div>`;
                } else if (msg.action_status === 'REJECTED') {
                    scheduleCardHtml += `<div style="margin-top:15px; color:#ef4444; font-weight:bold;">❌ 거절됨</div>`;
                }
                scheduleCardHtml += `</div>`;
            }

            const container = document.getElementById('main-content') || document.getElementById('app');
            container.innerHTML = `
                <div style="padding: 20px; max-width: 600px; margin: 0 auto;">
                    <button onclick="Boako.Messenger.View.renderMain()" style="margin-bottom: 20px; padding: 8px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor:pointer;">◀ 목록으로</button>
                    
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                        <h3 style="margin: 0 0 8px 0;">${isInbox ? '보낸 사람' : '받는 사람'}: ${targetName}</h3>
                        <div style="font-size: 13px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px;">${dateStr}</div>
                        
                        <div style="font-size: 15px; line-height: 1.6; white-space: pre-wrap; min-height: 80px;">${msg.content}</div>
                        
                        ${scheduleCardHtml}
                        
                        ${isInbox && msg.sender_type !== 'SYSTEM' ? `
                            <div style="margin-top: 24px; text-align: right;">
                                <button onclick="Boako.Messenger.View.renderCompose('${msg.sender_id}', '${senderName}')" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; cursor:pointer; font-weight:bold;">답장하기</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        },

        renderCompose: (replyToId = '', replyToName = '') => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            const defaultName = replyToName ? replyToName : '';
            
            container.innerHTML = `
                <div style="padding: 20px; max-width: 600px; margin: 0 auto;">
                    <button onclick="Boako.Messenger.View.renderMain()" style="margin-bottom: 20px; padding: 8px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor:pointer;">◀ 취소</button>
                    
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                        <h2 style="margin-top: 0; margin-bottom: 20px;">새 쪽지 작성</h2>
                        
                        <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <label style="display:flex; align-items:center; gap:10px; font-weight:bold; cursor:pointer;">
                                <input type="checkbox" id="is-schedule-toggle" onchange="document.getElementById('schedule-form-area').style.display = this.checked ? 'block' : 'none'">
                                📅 매치 일정 제안하기
                            </label>
                            
                            <div id="schedule-form-area" style="display:none; margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                                <div style="display:flex; gap:10px; margin-bottom:10px;">
                                    <select id="prop-game" style="flex:1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                                        <option value="쿼리돌">쿼리돌</option>
                                        <option value="아크 노바">아크 노바</option>
                                        <option value="다빈치 코드">다빈치 코드</option>
                                    </select>
                                    <select id="prop-type" style="flex:1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                                        <option value="RIVAL">⚔️ 라이벌전</option>
                                        <option value="LEAGUE">🏆 공식리그</option>
                                        <option value="FRIENDLY">🤝 친선전</option>
                                    </select>
                                </div>
                                <input type="datetime-local" id="prop-time" style="width:100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
                            </div>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label style="display:block; margin-bottom: 8px; font-weight:bold;">받는 사람 (닉네임)</label>
                            <input type="text" id="msg-receiver-name" value="${defaultName}" ${defaultName ? 'readonly' : ''} placeholder="정확한 닉네임을 입력하세요" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; ${defaultName ? 'background:#f8fafc;' : ''}">
                            <input type="hidden" id="msg-receiver-id-hidden" value="${replyToId}">
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display:block; margin-bottom: 8px; font-weight:bold;">내용</label>
                            <textarea id="msg-content" rows="5" placeholder="전달할 내용을 입력하세요" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; resize: vertical;"></textarea>
                        </div>
                        
                        <button onclick="Boako.Messenger.View.executeSend()" style="width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor:pointer; font-weight:bold; font-size:16px;">전송하기 🚀</button>
                    </div>
                </div>
            `;
        },

        executeSend: async () => {
            const receiverName = document.getElementById('msg-receiver-name').value.trim();
            const content = document.getElementById('msg-content').value.trim();
            let finalReceiverId = document.getElementById('msg-receiver-id-hidden').value;

            if (!receiverName || !content) return Boako.Util.toast("⚠️ 닉네임과 내용을 모두 입력해주세요!");

            const isSchedule = document.getElementById('is-schedule-toggle').checked;
            let actionType = 'DEFAULT';
            let metadataParams = {};

            if (isSchedule) {
                const gameName = document.getElementById('prop-game').value;
                const matchType = document.getElementById('prop-type').value;
                const schedTime = document.getElementById('prop-time').value;
                if (!schedTime) return Boako.Util.toast("⚠️ 경기 일시를 선택해주세요!");
                
                actionType = 'SCHEDULE_PROPOSE';
                metadataParams = { game_name: gameName, match_type: matchType, scheduled_time: schedTime };
            }

            if (!finalReceiverId) {
                try {
                    const { data: targetUser } = await Boako.db.from('profiles').select('id').eq('full_name', receiverName).single();
                    if (!targetUser) return Boako.Util.toast("❌ 존재하지 않는 닉네임입니다.");
                    finalReceiverId = targetUser.id; 
                } catch (err) { return Boako.Util.toast("❌ 유저 검색 오류"); }
            }

            if (finalReceiverId === Boako.state.user.id) return Boako.Util.toast("⚠️ 자신에게 보낼 수 없습니다.");

            const success = await Boako.Messenger.send(finalReceiverId, content, receiverName, actionType, metadataParams);
            if (success) Boako.Messenger.View.switchTab('outbox'); 
        }
    }
};
