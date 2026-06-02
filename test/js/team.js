/**
 * [TEAM] 팀 관리 (창단, 정보수정, 멤버관리 등)
 */
Boako.Team = {
    syncStatus: async () => {
        const user = Boako.state.user;
        const menuTxt = document.getElementById('team-menu-text');
        if (!user) { Boako.state.team = null; if (menuTxt) menuTxt.innerText = "팀 창단"; return; }
        
        try {
            const { data: profile } = await Boako.db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
            Boako.state.user.nickname = profile?.full_name || user.user_metadata?.full_name || "사용자";

            const { data: leaderTeam } = await Boako.db.from('teams').select('*').eq('owner_id', user.id).maybeSingle();
            if (leaderTeam) {
                Boako.state.team = { type: 'LEADER', info: leaderTeam };
                if (menuTxt) menuTxt.innerText = "팀 메뉴";
                return;
            }

            const { data: memberEntry } = await Boako.db.from('team_members').select('team_id').eq('player_name', Boako.state.user.nickname).eq('is_active', true).maybeSingle();
            if (memberEntry) {
                const { data: memberTeam } = await Boako.db.from('teams').select('*').eq('id', memberEntry.team_id).maybeSingle();
                if (memberTeam) {
                    Boako.state.team = { type: 'MEMBER', info: memberTeam };
                    if (menuTxt) menuTxt.innerText = "팀 메뉴";
                    return;
                }
            }
            Boako.state.team = null; if (menuTxt) menuTxt.innerText = "팀 창단";
        } catch (e) { console.error(e); }
    },
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
            
            const { error } = await Boako.db.from('teams').insert([{ 
                team_name: document.getElementById('team_name').value.trim(), 
                owner_id: Boako.state.user.id, 
                leader_name: Boako.state.user.nickname, 
                team_motto: document.getElementById('team_motto').value.trim(),
                team_desc: document.getElementById('team_desc').value.trim(),
                logo_url: uData.publicUrl 
            }]);
            if (error) throw error;
            Boako.Util.toast("✅ 새로운 전설의 팀이 탄생했습니다!");
            Boako.View.render('team');
        } catch (err) { Boako.Util.toast(err.message); } 
        finally { btn.disabled = false; btn.innerText = "전설의 팀 창단하기"; }
    },
    updateInfo: async (col) => {
        const val = col === 'team_motto' ? document.getElementById('input-motto').value : document.getElementById('textarea-desc').value;
        const { error } = await Boako.db.from('teams').update({ [col]: val }).eq('id', Boako.state.team.info.id);
        if (error) Boako.Util.toast("저장 실패: " + error.message);
        else { Boako.Util.toast("✅ 팀 정보가 업데이트되었습니다."); Boako.View.render('team'); }
    },
    addMember: async () => {
        const name = prompt("합류할 멤버의 닉네임을 정확히 입력하세요.");
        if (!name || !name.trim()) return;
        const { error } = await Boako.db.from('team_members').insert([{ 
            team_id: Boako.state.team.info.id, 
            team_name: Boako.state.team.info.team_name, 
            player_name: name.trim(), role: 'MEMBER', is_active: true 
        }]);
        if (error) {
            if (error.code === '23505') Boako.Util.toast("실패: 이미 어딘가에 소속된 유저입니다.");
            else Boako.Util.toast("오류: " + error.message);
        } else { Boako.Util.toast(`✅ ${name} 님이 합류했습니다!`); Boako.View.render('team'); }
    },
    kick: async (name) => {
        if (!confirm(`${name} 님을 방출하시겠습니까? 기록은 보존됩니다.`)) return;
        await Boako.db.from('team_members').update({ is_active: false, left_at: new Date().toISOString() })
            .eq('team_id', Boako.state.team.info.id).eq('player_name', name).eq('is_active', true);
        Boako.View.render('team');
    },
    leave: async () => {
        if (!confirm("정말 팀에서 탈퇴하시겠습니까? 이적 기록은 보존됩니다.")) return;
        await Boako.db.from('team_members').update({ is_active: false, left_at: new Date().toISOString() })
            .eq('team_id', Boako.state.team.info.id).eq('player_name', Boako.state.user.nickname).eq('is_active', true);
        location.reload();
    },

    // 🌟 [신규 추가] 팀 채팅 전용 모듈
    Chat: {
        channel: null, // 실시간 구독 객체를 담을 변수

        // 1. 채팅창 열 때 초기화 (기존 메시지 불러오기 + 실시간 구독)
        init: async (containerId) => {
            if (!Boako.state.team) return;
            const teamId = Boako.state.team.info.id;
            
            // UI 세팅 (간단한 채팅창 틀 - 나중에 View에 예쁘게 넣으셔도 됩니다)
            const chatHtml = `
                <div class="flex flex-col h-[400px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-6">
                    <div class="bg-slate-800 text-white px-4 py-3 font-bold text-sm flex justify-between">
                        <span>💬 팀 작전 회의실</span>
                    </div>
                    <div id="chat-messages" class="flex-1 p-4 overflow-y-auto flex flex-col gap-3"></div>
                    <div class="p-3 bg-white border-t border-slate-200 flex gap-2">
                        <input type="text" id="chat-input" placeholder="메시지를 입력하세요..." class="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onkeypress="if(event.key === 'Enter') Boako.Team.Chat.send()">
                        <button onclick="Boako.Team.Chat.send()" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700">전송</button>
                    </div>
                </div>
            `;
            document.getElementById(containerId).innerHTML = chatHtml;

            // 기존 메시지 50개 불러오기
            try {
                const { data: messages, error } = await Boako.db
                    .from('team_chats')
                    .select('*, profiles(full_name, profile_url)') // 보낸 사람 프로필 조인
                    .eq('team_id', teamId)
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                // 불러온 메시지를 시간순(오름차순)으로 역순 정렬해서 화면에 그리기
                if (messages) {
                    messages.reverse().forEach(msg => Boako.Team.Chat.renderMessage(msg));
                    Boako.Team.Chat.scrollToBottom();
                }
            } catch (err) { console.error("채팅 로드 실패:", err); }

            // 🌟 2. Supabase Realtime 구독 시작!
            if (Boako.Team.Chat.channel) Boako.db.removeChannel(Boako.Team.Chat.channel); // 혹시 열려있던 채널 닫기

            Boako.Team.Chat.channel = Boako.db.channel(`team-chat-${teamId}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'team_chats',
                    filter: `team_id=eq.${teamId}` // 우리 팀 채팅만!
                }, (payload) => {
                    // 새 메시지가 DB에 INSERT되면 이 함수가 실행됩니다.
                    // (단, 조인 데이터는 안 넘어오므로 프로필 정보는 따로 처리 필요)
                    const newMsg = payload.new;
                    // 내가 보낸 게 아니면 화면에 그리기 (내가 보낸 건 send()에서 바로 그림)
                    if (newMsg.sender_id !== Boako.state.user.id) {
                         // 임시로 이름 표기 (나중에 캐싱된 프로필 참조 로직 추가 권장)
                         newMsg.profiles = { full_name: "팀원" }; 
                         Boako.Team.Chat.renderMessage(newMsg);
                         Boako.Team.Chat.scrollToBottom();
                    }
                })
                .subscribe();
        },

        // 3. 채팅 화면에 말풍선 하나 그리기
        renderMessage: (msg) => {
            const container = document.getElementById('chat-messages');
            if (!container) return;

            const isMe = msg.sender_id === Boako.state.user.id;
            const senderName = msg.profiles?.full_name || "알 수 없음";

            const html = isMe ? `
                <div class="flex justify-end">
                    <div class="bg-blue-600 text-white rounded-l-xl rounded-tr-xl px-4 py-2 max-w-[70%] text-sm shadow-sm break-words">
                        ${msg.content}
                    </div>
                </div>
            ` : `
                <div class="flex flex-col items-start gap-1">
                    <span class="text-[11px] font-bold text-slate-500 ml-1">${senderName}</span>
                    <div class="bg-white border border-slate-200 text-slate-800 rounded-r-xl rounded-tl-xl px-4 py-2 max-w-[70%] text-sm shadow-sm break-words">
                        ${msg.content}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        },

        // 4. 메시지 전송 로직
        send: async () => {
            const input = document.getElementById('chat-input');
            const content = input.value.trim();
            if (!content || !Boako.state.team) return;

            input.value = ''; // 입력창 비우기

            const payload = {
                team_id: Boako.state.team.info.id,
                sender_id: Boako.state.user.id,
                content: content
            };

            // 화면에 먼저 내 메시지 띄워주기 (빠른 체감 속도)
            const tempMsg = { ...payload, profiles: { full_name: Boako.state.user.nickname } };
            Boako.Team.Chat.renderMessage(tempMsg);
            Boako.Team.Chat.scrollToBottom();

            // DB에 전송
            const { error } = await Boako.db.from('team_chats').insert([payload]);
            if (error) {
                Boako.Util.toast("전송 실패: " + error.message);
                console.error("채팅 전송 실패:", error);
            }
        },

        scrollToBottom: () => {
            const el = document.getElementById('chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
        }
    }
};
