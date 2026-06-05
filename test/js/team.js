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

    // 🌟 1. 검색 모달창 열기 (기존 prompt 완벽 대체)
    addMember: () => {
        const existing = document.getElementById('boako-invite-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="boako-invite-modal" class="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style="animation: fadeIn 0.2s ease-out;">
                <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                    <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <h3 class="font-black text-lg text-slate-800 flex items-center gap-2">🔍 멤버 스카웃</h3>
                        <button onclick="document.getElementById('boako-invite-modal').remove()" class="text-slate-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">
                            ✕
                        </button>
                    </div>
                    <div class="p-5">
                        <div class="flex gap-2 mb-4">
                            <input type="text" id="invite-search-input" class="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="닉네임으로 유저 검색" onkeypress="if(event.key==='Enter') Boako.Team.searchUser()">
                            <button onclick="Boako.Team.searchUser()" class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 shadow-sm transition-colors">검색</button>
                        </div>
                        <div id="invite-search-results" class="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            <div class="text-center text-slate-400 text-sm py-8 font-bold">찾고 싶은 팀원의 닉네임을 검색하세요.</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        setTimeout(() => {
            const input = document.getElementById('invite-search-input');
            if(input) input.focus();
        }, 100);
    },

    // 🌟 2. DB에서 유저 프로필 검색하기
    searchUser: async () => {
        const keyword = document.getElementById('invite-search-input').value.trim();
        const resultContainer = document.getElementById('invite-search-results');
        
        if (!keyword) {
            resultContainer.innerHTML = `<div class="text-center text-red-400 text-sm py-8 font-bold">검색어를 입력해주세요.</div>`;
            return;
        }

        resultContainer.innerHTML = `<div class="text-center text-slate-500 text-sm py-8 font-bold animate-pulse">데이터베이스 검색 중... ⏳</div>`;

        try {
            const { data: users, error } = await Boako.db
                .from('profiles')
                .select('id, full_name, profile_url')
                .ilike('full_name', `%${keyword}%`)
                .limit(10);

            if (error) throw error;

            if (!users || users.length === 0) {
                resultContainer.innerHTML = `<div class="text-center text-slate-400 text-sm py-8 font-bold">일치하는 유저가 없습니다.</div>`;
                return;
            }

            let listHtml = '';
            // [수정 후 코드]
users.forEach(u => {
    if (u.id === Boako.state.user.id) return; // 나 자신은 제외
    
    // 🌟 1. 카카오 프사 URL의 http를 https로 강제 변환하는 방어 코드 추가
    const secureProfileUrl = u.profile_url ? u.profile_url.replace(/^http:\/\//i, 'https://') : null;
    
    listHtml += `
        <div class="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-indigo-100 transition-all group">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center border border-slate-200 flex-shrink-0">
                    <!-- 🌟 2. 변환된 안전한 URL(secureProfileUrl)을 사용 -->
                    ${secureProfileUrl ? `<img src="${secureProfileUrl}" class="w-full h-full object-cover">` : '<span class="text-xl">👤</span>'}
                </div>
                <span class="font-black text-slate-700 text-sm">${u.full_name}</span>
            </div>
            <button onclick="Boako.Team.executeInvite('${u.id}', '${u.full_name}')" class="bg-white border border-emerald-500 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow-sm whitespace-nowrap">
                💌 스카웃
            </button>
        </div>
    `;
});

            if (listHtml === '') {
                listHtml = `<div class="text-center text-slate-400 text-sm py-8 font-bold">초대 가능한 유저가 없습니다.</div>`;
            }
            
            resultContainer.innerHTML = listHtml;

        } catch (err) {
            resultContainer.innerHTML = `<div class="text-center text-red-500 text-sm py-8 font-bold">검색 중 오류 발생:<br>${err.message}</div>`;
        }
    },

    // 🌟 3. 검색된 유저에게 초대장 날리기 (실제 발송 로직)
    executeInvite: async (targetId, targetName) => {
        if (!confirm(`[${targetName}] 님에게 스카웃 제안을 발송하시겠습니까?`)) return;

        try {
            const payload = {
                sender_id: Boako.state.user.id,
                sender_name_override: Boako.state.user.nickname,
                receiver_id: targetId,
                receiver_name_override: targetName,
                content: JSON.stringify({
                    text: `👋 [${Boako.state.team.info.team_name}] 팀에서 귀하를 영입하고 싶어 합니다!`,
                    team_id: Boako.state.team.info.id,
                    team_name: Boako.state.team.info.team_name
                }),
                action_type: 'TEAM_INVITE'
            };

            const { error: msgErr } = await Boako.db.from('messages').insert([payload]);
            if (msgErr) throw msgErr;

            Boako.Util.toast(`🎉 ${targetName} 님에게 스카웃 제안서를 성공적으로 보냈습니다!`);
            
            const existing = document.getElementById('boako-invite-modal');
            if (existing) existing.remove();
            
        } catch (err) {
            Boako.Util.toast("❌ 초대 실패: " + err.message);
        }
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
// 🌟 [추가 1] 밴(Ban) 투표소 팝업 열기
    openBanVote: async () => {
        const existingModal = document.getElementById('ban-vote-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="ban-vote-modal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onclick="if(event.target === this) this.remove()">
                <!-- 팝업창 크기를 max-w-3xl로 넉넉하게 키워서 12개 카드가 예쁘게 들어가게 함 -->
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" style="max-height: 90vh;">
                    
                    <div class="bg-red-600 px-6 py-4 flex justify-between items-center text-white">
                        <div>
                            <h2 class="text-xl font-black flex items-center gap-2"><span class="text-2xl">🚫</span> 대항전 밴(Ban) 투표소</h2>
                            <p class="text-red-100 text-sm font-bold mt-1">우리 팀을 대표하여 밴할 종목을 선택하세요.</p>
                        </div>
                        <button onclick="document.getElementById('ban-vote-modal').remove()" class="text-white hover:text-red-200 font-bold text-3xl transition-colors leading-none">&times;</button>
                    </div>

                    <div id="ban-vote-content" class="p-6 overflow-y-auto flex-1 bg-slate-50 custom-scrollbar">
                        <div class="text-center py-12">
                            <span class="text-4xl inline-block animate-bounce mb-3">⏳</span>
                            <h3 class="text-lg font-bold text-slate-600">투표 가능한 후보 종목을 불러오는 중...</h3>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 팝업 띄운 직후, 0.5초 뒤에 12개 리스트 렌더링 함수 자동 실행!
        setTimeout(() => { Boako.Team.loadBanCandidates(); }, 500); 
    },

    // 🌟 팝업창 내부에 실제 DB 데이터를 불러와 렌더링 (구조 수정 완료)
    loadBanCandidates: async () => {
        const contentArea = document.getElementById('ban-vote-content');
        if (!contentArea) return;

        try {
            // 1. 현재 날짜 기준 진행 중인 시즌 조회
            const { data: currentSeason, error: seasonError } = await Boako.db
                .from('seasons')
                .select('season_no')
                .lte('start_date', new Date().toISOString())
                .gte('end_date', new Date().toISOString())
                .maybeSingle();

            // 2. [수정] 비시즌일 경우 무조건 1번을 주는 대신, 가장 최근에 종료된 시즌을 찾음
            let seasonNo;
            if (currentSeason) {
                seasonNo = currentSeason.season_no;
            } else {
                // 오늘 날짜 이전인 것 중 가장 마지막 시즌을 가져옴
                const { data: lastSeason } = await Boako.db
                    .from('seasons')
                    .select('season_no')
                    .lt('end_date', new Date().toISOString())
                    .order('end_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                seasonNo = lastSeason ? lastSeason.season_no : null;
            }

            // 3. 만약 시즌 정보가 끝내 없다면 (DB가 비었거나 초기 상태)
            if (!seasonNo) {
                contentArea.innerHTML = `<div class="text-center py-12 text-slate-500 font-bold">현재 진행 중인 시즌이 없으며, 이전 시즌 데이터도 존재하지 않습니다.</div>`;
                return;
            }

            console.log("적용된 시즌 번호:", seasonNo);

            // 4. 게임 목록 호출 (이후 동일)
            const { data: games, error } = await Boako.db
                .from('grandprix_games')
                .select('id, game_name, game_logo_url')
                .eq('season_no', seasonNo)
                .order('selection_rank', { ascending: true });

            if (error) throw error;

            if (!games || games.length === 0) {
                contentArea.innerHTML = `<div class="text-center py-12 text-slate-400 font-bold border border-dashed border-slate-300 rounded-xl">이번 시즌 등록된 후보 종목이 없습니다.</div>`;
                return;
            }

            // 3. 카드 UI 렌더링
            let html = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">`;
            
            games.forEach(game => {
                html += `
                    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group">
                        <div class="aspect-square bg-slate-100 flex items-center justify-center relative overflow-hidden border-b border-slate-100">
                            ${game.game_logo_url 
                                ? `<img src="${game.game_logo_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">` 
                                : `<span class="text-5xl drop-shadow-md">🎲</span>`
                            }
                        </div>
                        
                        <div class="p-4 text-center flex-1 flex flex-col justify-between gap-3">
                            <h4 class="font-black text-slate-700 text-sm break-keep leading-tight">${game.game_name}</h4>
                            <button onclick="Boako.Team.submitBanVote('${game.id}', '${game.game_name}')" 
                                    class="w-full bg-slate-50 hover:bg-red-600 hover:text-white text-slate-600 text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-200 hover:border-red-600 shadow-sm active:scale-95">
                                🚫 이 종목 밴(Ban)
                            </button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            contentArea.innerHTML = html;

        } catch (err) {
            console.error("후보 로드 실패:", err);
            contentArea.innerHTML = `<div class="text-center py-12 text-red-500 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 🌟 [추가 3] 실제 투표 버튼을 눌렀을 때 작동할 함수 뼈대
    submitBanVote: async (gameId, gameName) => {
        const confirmVote = confirm(`정말 [${gameName}] 종목을 밴(Ban) 하시겠습니까?\n투표가 완료되면 결과가 반영됩니다.`);
        
        if (confirmVote) {
            try {
                // 소장님이 만드신 DB 함수 호출
                // 시즌 번호는 DB 함수 내부 로직(MAX season_no)을 타도록 생략하거나 null로 넘깁니다.
                const { error } = await Boako.db.rpc('fn_vote_grandprix_ban', {
                    p_season_no: null, 
                    p_banned_game_name: gameName
                });

                if (error) throw error;

                // 투표 성공 시 팝업 닫기 및 알림
                Boako.Util.toast(`[${gameName}] 밴 투표가 성공적으로 완료되었습니다!`);
                
                const modal = document.getElementById('ban-vote-modal');
                if (modal) modal.remove();
                
            } catch (err) {
                console.error("투표 에러:", err);
                alert("투표 처리 중 오류가 발생했습니다:\n" + err.message);
            }
        }
    },
    // 🌟 팀 채팅 전용 모듈
    Chat: {
        channel: null,

        // 🌟 [추가 1] 알림 뱃지 켜기 스위치
        showNotification: () => {
            const badge = document.getElementById('team-chat-badge');
            if (badge) {
                badge.classList.remove('hidden');
                badge.style.display = 'flex'; // 버튼 UI의 inline 스타일 충돌 방지용 강제 표시
            }
        },

        // 🌟 [추가 2] 알림 뱃지 끄기 스위치
        clearNotification: () => {
            const badge = document.getElementById('team-chat-badge');
            if (badge) {
                badge.classList.add('hidden');
                badge.style.display = 'none'; // 강제 숨김
            }
        },

        init: async (containerId) => {
            if (!Boako.state.team) return;
            const teamId = Boako.state.team.info.id;
            
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

            try {
                const { data: messages, error } = await Boako.db
                    .from('team_chats')
                    .select('*, profiles(full_name, profile_url)')
                    .eq('team_id', teamId)
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                if (messages) {
                    messages.reverse().forEach(msg => Boako.Team.Chat.renderMessage(msg));
                    Boako.Team.Chat.scrollToBottom();
                }
            } catch (err) { console.error("채팅 로드 실패:", err); }

            if (Boako.Team.Chat.channel) Boako.db.removeChannel(Boako.Team.Chat.channel);

            Boako.Team.Chat.channel = Boako.db.channel(`team-chat-${teamId}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'team_chats',
                    filter: `team_id=eq.${teamId}`
                }, (payload) => {
                    const newMsg = payload.new;
                    if (newMsg.sender_id !== Boako.state.user.id) {
                         newMsg.profiles = { full_name: "팀원" }; 
                         Boako.Team.Chat.renderMessage(newMsg);
                         Boako.Team.Chat.scrollToBottom();

                         // 🌟 [추가 3] 남이 쓴 채팅이 도착하면 스위치 켜기!
                         Boako.Team.Chat.showNotification();
                         Boako.Util.toast("💬 팀 작전 회의실에 새로운 메시지가 있습니다!");
                    }
                })
                .subscribe();
        },

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

        send: async () => {
            const input = document.getElementById('chat-input');
            const content = input.value.trim();
            if (!content || !Boako.state.team) return;

            input.value = '';

            const payload = {
                team_id: Boako.state.team.info.id,
                sender_id: Boako.state.user.id,
                content: content
            };

            const tempMsg = { ...payload, profiles: { full_name: Boako.state.user.nickname } };
            Boako.Team.Chat.renderMessage(tempMsg);
            Boako.Team.Chat.scrollToBottom();

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
