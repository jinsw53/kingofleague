/**
 * [MESSENGER] 아카이브 통신망 (초고속 No-Join + CASCADE 최적화)
 */
Boako.Messenger = {
    unreadCount: 0,

    // ==========================================
    // ⚙️ 1. 데이터/통신 코어 (API)
    // ==========================================
    
    // 1. 안 읽은 쪽지 개수 가져오기 (뱃지 표시용)
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

    // 2. 쪽지 목록 가져오기 (JOIN 없이 초고속 단일 테이블 조회)
    getMessages: async (type = 'inbox') => {
        if (!Boako.state.user) return [];
        try {
            const isInbox = type === 'inbox';
            const targetColumn = isInbox ? 'receiver_id' : 'sender_id';

            const { data, error } = await Boako.db
                .from('messages')
                .select('*') // 🚀 profiles 테이블 JOIN 싹 지움! (속도 최적화)
                .eq(targetColumn, Boako.state.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error("쪽지 목록 로드 오류:", err);
            return [];
        }
    },

    // 3. 쪽지 보내기 (DB 제약조건에 맞춰 완벽한 스냅샷 기록)
    send: async (receiverId, content, receiverName) => {
        try {
            // 현재 로그인한 내 닉네임
            const myName = Boako.state.user.nickname || Boako.state.user.user_metadata?.full_name || '알수없음';

            const { error } = await Boako.db.from('messages').insert({
                sender_id: Boako.state.user.id,
                sender_type: 'USER',
                sender_name_override: myName, // 👈 DB가 CASCADE로 알아서 최신화 해줌
                receiver_id: receiverId,
                receiver_name_override: receiverName, // 👈 DB가 CASCADE로 알아서 최신화 해줌
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

    // 4. 쪽지 읽음 처리
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
    // 🚀 [신규] 일정 수락 시 match_schedules 장부에 공식 등록!
    acceptSchedule: async (msgId) => {
        const msg = Boako.Messenger.View.messagesData.find(m => m.message_id == msgId);
        if (!msg) return;

        if (confirm(`'${msg.metadata.game_name}' 일정을 수락하시겠습니까?\n(수락 시 전광판에 공식 등록됩니다)`)) {
            try {
                // 1. match_schedules 에 공식 등록 (외래키 및 닉네임 박제 데이터 토스)
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

                // 2. 쪽지 상태를 ACCEPTED로 마감
                const { error: msgError } = await Boako.db.from('messages')
                    .update({ action_status: 'ACCEPTED' })
                    .eq('message_id', msg.message_id);
                if (msgError) throw msgError;

                Boako.Util.toast("✅ 일정을 수락하고 공식 캘린더에 등록했습니다!");
                msg.action_status = 'ACCEPTED'; // 화면 즉시 반영
                Boako.Messenger.View.openMessage(msgId); // 화면 새로고침
            } catch (err) {
                Boako.Util.toast("❌ 수락 처리 중 오류: " + err.message);
            }
        }
    },

    // 🚀 [신규] 일정 거절 처리
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
    // 🎨 2. 프론트엔드 UI 화면 렌더링 (View)
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
                        <h2 style="margin:0; font-size:20px;">📬 아카이브 쪽지함</h2>
                        <button onclick="Boako.Messenger.View.renderCompose()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor:pointer; font-weight:bold;">+ 새 쪽지 작성</button>
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
                    
                    // 🚀 DB에서 가져온 텍스트 컬럼을 그대로 사용 (이름 변경 시 자동 동기화 되어있음)
                    const senderName = msg.sender_name_override || '알 수 없음';
                    const receiverName = msg.receiver_name_override || '알 수 없음';

                    let targetName = isInbox ? 
                        (msg.sender_type === 'SYSTEM' ? '⚙️ 시스템' : senderName) : 
                        receiverName;

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

        // 🚀 openMessage 함수 내부의 '쪽지 내용 출력부' 덮어쓰기
        openMessage: async (msgId) => {
            const msg = Boako.Messenger.View.messagesData.find(m => m.message_id == msgId);
            if (!msg) return;

            // ...(기존 변수 선언 및 읽음 처리 로직 동일)...
            const isInbox = Boako.Messenger.View.currentTab === 'inbox';
            const senderName = msg.sender_name_override || '알 수 없음';
            const receiverName = msg.receiver_name_override || '알 수 없음';
            const targetName = isInbox ? (msg.sender_type === 'SYSTEM' ? '⚙️ 시스템' : senderName) : receiverName;
            const dateStr = new Date(msg.created_at).toLocaleString('ko-KR');

            // 🚀 [추가] 일정 제안 전용 카드 레이아웃 생성
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

                // 상태에 따른 액션 버튼 출력
                if (msg.action_status === 'PENDING') {
                    if (isInbox) { 
                        scheduleCardHtml += `
                            <div style="margin-top:20px; display:flex; gap:10px;">
                                <button onclick="Boako.Messenger.acceptSchedule('${msg.message_id}')" style="flex:1; padding:10px; background:#10b981; color:white; border-radius:8px; font-weight:bold;">🟢 수락 (일정 등록)</button>
                                <button onclick="Boako.Messenger.rejectSchedule('${msg.message_id}')" style="flex:1; padding:10px; background:#ef4444; color:white; border-radius:8px; font-weight:bold;">🔴 거절</button>
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
                    <button onclick="Boako.Messenger.View.renderMain()" class="btn-edit-small">◀ 목록으로</button>
                    
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top:20px;">
                        <h3 style="margin: 0 0 8px 0;">${isInbox ? '보낸 사람' : '받는 사람'}: ${targetName}</h3>
                        <div style="font-size: 13px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px;">${dateStr}</div>
                        
                        <div style="font-size: 15px; line-height: 1.6; white-space: pre-wrap; min-height: 80px;">${msg.content}</div>
                        
                        <!-- 🚀 일정 제안 카드 출력부 -->
                        ${scheduleCardHtml}
                        
                        ${isInbox && msg.sender_type !== 'SYSTEM' ? `
                            <div style="margin-top: 24px; text-align: right;">
                                <button onclick="Boako.Messenger.View.renderCompose('${msg.sender_id}', '${senderName}')" class="btn-submit" style="width:auto; padding:10px 20px;">답장하기</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        },

        // 🚀 renderCompose 함수 덮어쓰기
        renderCompose: (replyToId = '', replyToName = '') => {
            const container = document.getElementById('main-content') || document.getElementById('app');
            const defaultName = replyToName ? replyToName : '';
            
            container.innerHTML = `
                <div style="padding: 20px; max-width: 600px; margin: 0 auto;">
                    <button onclick="Boako.Messenger.View.renderMain()" class="btn-edit-small">◀ 취소</button>
                    
                    <div class="section-card" style="margin-top:20px;">
                        <div class="card-header">새 쪽지 작성</div>
                        <div class="card-body">
                            <!-- 🚀 일정 제안 토글 -->
                            <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                                <label style="display:flex; align-items:center; gap:10px; font-weight:bold; cursor:pointer;">
                                    <input type="checkbox" id="is-schedule-toggle" onchange="document.getElementById('schedule-form-area').style.display = this.checked ? 'block' : 'none'">
                                    📅 매치 일정 제안하기
                                </label>
                                
                                <div id="schedule-form-area" style="display:none; margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                                        <select id="prop-game" class="edit-input-box" style="flex:1;">
                                            <option value="쿼리돌">쿼리돌</option>
                                            <option value="아크 노바">아크 노바</option>
                                            <option value="다빈치 코드">다빈치 코드</option>
                                        </select>
                                        <select id="prop-type" class="edit-input-box" style="flex:1;">
                                            <option value="RIVAL">⚔️ 라이벌전</option>
                                            <option value="LEAGUE">🏆 공식리그</option>
                                            <option value="FRIENDLY">🤝 친선전</option>
                                        </select>
                                    </div>
                                    <input type="datetime-local" id="prop-time" class="edit-input-box" style="width:100%;">
                                </div>
                            </div>

                            <div style="margin-bottom: 16px;">
                                <label style="font-weight:bold;">받는 사람 (닉네임)</label>
                                <input type="text" id="msg-receiver-name" class="edit-input-box" value="${defaultName}" ${defaultName ? 'readonly' : ''}>
                                <input type="hidden" id="msg-receiver-id-hidden" value="${replyToId}">
                            </div>
                            
                            <div style="margin-bottom: 20px;">
                                <label style="font-weight:bold;">내용</label>
                                <textarea id="msg-content" rows="5" class="edit-input-box"></textarea>
                            </div>
                            
                            <button onclick="Boako.Messenger.View.executeSend()" class="btn-submit">전송하기 🚀</button>
                        </div>
                    </div>
                </div>
            `;
        },

        // 🚀 executeSend 함수 덮어쓰기 (발송 시 일정 데이터 포함)
        executeSend: async () => {
            const receiverName = document.getElementById('msg-receiver-name').value.trim();
            const content = document.getElementById('msg-content').value.trim();
            let finalReceiverId = document.getElementById('msg-receiver-id-hidden').value;

            if (!receiverName || !content) return Boako.Util.toast("⚠️ 닉네임과 내용을 모두 입력해주세요!");

            // 🚀 일정 제안 데이터 수집
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

            // UUID 조회 로직 (기존과 동일)
            if (!finalReceiverId) {
                try {
                    const { data: targetUser } = await Boako.db.from('profiles').select('id').eq('full_name', receiverName).single();
                    if (!targetUser) return Boako.Util.toast("❌ 존재하지 않는 닉네임입니다.");
                    finalReceiverId = targetUser.id; 
                } catch (err) { return Boako.Util.toast("❌ 유저 검색 오류"); }
            }

            if (finalReceiverId === Boako.state.user.id) return Boako.Util.toast("⚠️ 자신에게 보낼 수 없습니다.");

            // 통신 코어의 send 함수 호출 시 추가 파라미터 전달!
            // (위에서 수정하셨던 send 함수가 actionType과 metadataParams를 받도록 되어 있어야 합니다.)
            const success = await Boako.Messenger.send(finalReceiverId, content, receiverName, actionType, metadataParams);
            if (success) Boako.Messenger.View.switchTab('outbox'); 
        }
        }
    }
};
