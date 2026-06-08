/**
 * [MATCH] 대항전 메인 대시보드 관리
 */
Boako.Match = {
    // 🌟 1. 대시보드 초기화 (상단 UI 군더더기 제거 및 로고 영역 추가)
    init: async (containerId) => {
        const targetId = containerId || 'main-content';
        const container = document.getElementById(targetId); 
        
        if (!container) {
            console.error(`렌더링할 컨테이너(#${targetId})를 찾을 수 없습니다.`);
            return;
        }

        container.innerHTML = `
            <div class="max-w-5xl mx-auto p-4 space-y-6" style="animation: fadeIn 0.3s ease-out;">
                
                <div class="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <div class="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500 rounded-full blur-[80px] opacity-40 pointer-events-none"></div>
                    <div class="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-blue-600 rounded-full blur-[80px] opacity-30 pointer-events-none"></div>
                    
                    <div class="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
                        <div>
                            <h1 class="text-3xl md:text-4xl font-black mb-3" id="match-season-title">대항전 데이터 로딩 중...</h1>
                            <div id="match-season-logo-area" class="h-10 flex items-center">
                                <span class="text-white/50 text-sm font-bold border border-white/20 px-3 py-1 rounded-lg animate-pulse">로고 데이터 대기 중...</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2 text-xs font-black bg-black/30 p-2 rounded-2xl backdrop-blur-md border border-white/10">
                            <span class="px-4 py-2 rounded-xl bg-blue-600 text-white shadow-lg transition-colors" id="status-ban">🚫 밴픽 진행</span>
                            <span class="text-slate-600">▶</span>
                            <span class="px-4 py-2 rounded-xl text-slate-400 transition-colors" id="status-entry">⚔️ 엔트리 제출</span>
                            <span class="text-slate-600">▶</span>
                            <span class="px-4 py-2 rounded-xl text-slate-400 transition-colors" id="status-play">🏆 본선 경기</span>
                        </div>
                    </div>
                </div>

                <div class="flex gap-1 border-b-2 border-slate-100 pb-px overflow-x-auto custom-scrollbar">
                    <button onclick="Boako.Match.switchTab('tab-ban')" id="btn-tab-ban" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-indigo-600 text-indigo-600 transition-colors">🚫 밴(Ban) 결과</button>
                    <button onclick="Boako.Match.switchTab('tab-entry')" id="btn-tab-entry" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-transparent text-slate-400 hover:text-slate-700 transition-colors">⚔️ 게임별 매치업</button>
                    <button onclick="Boako.Match.switchTab('tab-score')" id="btn-tab-score" class="whitespace-nowrap px-6 py-3 text-sm font-black border-b-4 border-transparent text-slate-400 hover:text-slate-700 transition-colors">📊 스코어보드</button>
                </div>

                <div id="tab-ban" class="space-y-4"><div id="match-ban-content"></div></div>
                <div id="tab-entry" class="hidden space-y-4"><div id="match-entry-content"></div></div>
                <div id="tab-score" class="hidden space-y-4">
                    <div class="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm">
                        <span class="text-6xl block mb-4 drop-shadow-md">🏆</span>
                        <h3 class="text-xl font-black text-slate-800">스코어보드 집계 중</h3>
                        <p class="text-sm text-slate-500 font-bold mt-2">본선 경기가 시작되면 각 팀의 실시간 승점이 기록됩니다.</p>
                    </div>
                </div>

            </div>
        `;

        await Boako.Match.loadData();
    },

    // (switchTab 함수는 그대로 유지)
    switchTab: (tabId) => {
        ['tab-ban', 'tab-entry', 'tab-score'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
            const btn = document.getElementById(`btn-${id}`);
            btn.classList.remove('border-indigo-600', 'text-indigo-600');
            btn.classList.add('border-transparent', 'text-slate-400');
        });
        
        document.getElementById(tabId).classList.remove('hidden');
        const activeBtn = document.getElementById(`btn-${tabId}`);
        activeBtn.classList.remove('border-transparent', 'text-slate-400');
        activeBtn.classList.add('border-indigo-600', 'text-indigo-600');
    },

    // 🌟 3. 데이터 로드 (쿼리 수정)
    loadData: async () => {
        try {
            const { data: currentSeason } = await Boako.db.from('seasons')
                .select('*')
                .lte('start_date', new Date().toISOString())
                .gte('end_date', new Date().toISOString())
                .maybeSingle();
            
            let seasonNo = currentSeason ? currentSeason.season_no : 1;
            
            if (currentSeason) {
                document.getElementById('match-season-title').innerText = currentSeason.title || `시즌 ${seasonNo} 대항전`;
                
                const logoArea = document.getElementById('match-season-logo-area');
                if (currentSeason.logo_url) {
                    logoArea.innerHTML = `<img src="${currentSeason.logo_url}" class="h-10 object-contain drop-shadow-md">`;
                } else {
                    logoArea.innerHTML = `<span class="text-white/50 text-sm font-bold border border-white/20 px-3 py-1 rounded-lg">시즌 로고 대기 중</span>`;
                }
            }

            const { data: allGames, error: gamesErr } = await Boako.db
                .from('grandprix_games')
                .select('*')
                .eq('season_no', seasonNo)
                .order('selection_rank', { ascending: true });
            
            if (gamesErr) throw gamesErr;

            const isFinalized = allGames.some(g => g.status === 'FINAL');
            let displayGames = [];

            if (isFinalized) {
                displayGames = allGames;
                document.getElementById('status-ban').classList.replace('bg-blue-600', 'bg-slate-700');
                document.getElementById('status-ban').classList.replace('text-white', 'text-slate-400');
                document.getElementById('status-entry').classList.replace('text-slate-400', 'bg-blue-600');
                document.getElementById('status-entry').classList.add('text-white', 'shadow-lg');
            } else {
                displayGames = allGames.filter(g => g.status === 'CANDIDATE').slice(0, 10);
            }

            let confirmedEntries = [];
            if (isFinalized) {
                // 💡 [핵심] 여기서 teams 테이블을 JOIN하여 logo_url을 함께 가져옵니다!
                const { data: entriesData, error: entriesErr } = await Boako.db
                    .from('grandprix_entries')
                    .select('*, teams(logo_url)') 
                    .eq('season_no', seasonNo)
                    .eq('is_finalized', true);
                
                if (entriesErr) console.error("엔트리 로드 에러:", entriesErr);
                else confirmedEntries = entriesData || [];
            }

            Boako.Match.renderBanTab(displayGames, isFinalized);
            Boako.Match.renderEntryTab(displayGames, isFinalized, confirmedEntries);

        } catch (err) {
            console.error("대항전 데이터 로드 에러:", err);
            document.getElementById('match-ban-content').innerHTML = `
                <div class="bg-red-50 text-red-500 p-6 rounded-xl font-bold border border-red-200 text-center">
                    🚨 데이터를 불러오는 중 오류가 발생했습니다.<br><span class="text-sm font-normal">${err.message}</span>
                </div>
            `;
        }
    },

    // 🌟 4. [탭 1] 밴 결과 렌더링 (SURVIVED 삭제, 텍스트 넘침 방지)
    renderBanTab: (games, isFinalized) => {
        const content = document.getElementById('match-ban-content');
        content.className = "w-full block"; 

        if (!games.length) {
            content.innerHTML = `<div class="text-center py-12 text-slate-400 font-bold">등록된 대회 종목이 없습니다.</div>`;
            return;
        }

        let html = '';
        
        if (!isFinalized) {
            html += `
                <div class="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center shadow-sm w-full">
                    <div>
                        <h4 class="text-indigo-700 font-black text-sm">⏳ 현재 밴(Ban) 투표가 치열하게 진행 중입니다!</h4>
                        <p class="text-indigo-500 text-xs font-bold mt-1">투표하러 가기 버튼을 클릭하여 우리 팀 투표소로 이동하세요.</p>
                    </div>
                    <span class="text-2xl animate-pulse">🗳️</span>
                </div>
            `;
        }

        html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">`;
        
        games.forEach(game => {
            const isBanned = isFinalized && game.status !== 'FINAL';
            const isCandidate = !isFinalized;

            let cardClass = isBanned 
                ? 'bg-slate-100 border-2 border-red-500/50 shadow-none' 
                : 'bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-1';

            const textClass = isBanned ? 'text-slate-400 line-through decoration-red-500/50' : 'text-slate-800';
            const imgClass = isBanned ? 'grayscale opacity-30' : 'drop-shadow-sm';

            const clickEvent = isCandidate 
                ? `onclick="Boako.View.render('team').then(() => setTimeout(() => Boako.View.switchTeamTab('record'), 100))"` 
                : '';

            html += `
                <div class="rounded-2xl p-5 flex flex-col items-center justify-between text-center transition-all duration-200 relative ${cardClass}">
                    
                    <!-- 💡 SURVIVED 배지 삭제, BANNED만 남김 -->
                    ${isBanned ? `
                        <div class="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm z-10 rotate-12">BANNED</div>
                    ` : ''}
                    
                    <div class="w-20 h-20 mb-4 flex items-center justify-center relative">
                        ${game.game_logo_url 
                            ? `<img src="${game.game_logo_url}" class="max-h-full max-w-full object-contain ${imgClass}">` 
                            : `<span class="text-5xl ${imgClass}">🎲</span>`
                        }
                    </div>
                    
                    <h4 class="font-black text-sm break-keep mb-3 ${textClass}">${game.game_name}</h4>
                    
                    <!-- 💡 하단 텍스트 수정 (글씨 넘침 방지) -->
                    ${isBanned ? `
                        <div class="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-1.5 rounded-lg w-full truncate border border-red-100">
                            밴 확정 종목
                        </div>
                    ` : isCandidate ? `
                        <button ${clickEvent} class="text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1.5 rounded-lg w-full shadow-sm transition-colors cursor-pointer active:scale-95">
                            👉 투표하러 가기
                        </button>
                    ` : `
                        <div class="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg w-full border border-slate-100">
                            본선 진출 종목
                        </div>
                    `}
                </div>
            `;
        });
        html += `</div>`;
        content.innerHTML = html;
    },

  // 🌟 5. [탭 2] 게임별 매치업 (로고 렌더링 적용)
    renderEntryTab: (games, isFinalized, entries = []) => {
        const content = document.getElementById('match-entry-content');
        content.className = "w-full block";
        
        if (!isFinalized) {
            content.innerHTML = `
                <div class="bg-slate-50 border border-slate-200 p-10 rounded-2xl text-center">
                    <span class="text-4xl block mb-3 animate-bounce">⏳</span>
                    <h3 class="text-slate-600 font-black">아직 밴(Ban) 투표가 진행 중입니다.</h3>
                    <p class="text-sm font-bold text-slate-400 mt-2">투표가 종료되고 본선 종목이 확정되면 대진표가 공개됩니다.</p>
                </div>`;
            return;
        }

        const survivingGames = games.filter(g => g.status === 'FINAL');

        if (!survivingGames.length) {
            content.innerHTML = `<div class="bg-slate-50 border border-slate-200 p-10 rounded-2xl text-center"><span class="text-4xl block mb-3">☠️</span><h3 class="text-slate-600 font-black">모든 종목이 밴 당했습니다. (진행 불가)</h3></div>`;
            return;
        }

        let html = `<div class="space-y-6">`;
        
        survivingGames.forEach(game => {
            const gameEntries = entries.filter(e => e.game_name === game.game_name);
            
            html += `
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    
                    <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div class="flex items-center gap-3 cursor-pointer group" onclick="Boako.Team.openEntryForm()">
                            <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm p-1 group-hover:scale-110 transition-transform duration-300">
                                ${game.game_logo_url ? `<img src="${game.game_logo_url}" class="w-full h-full object-contain">` : '🎲'}
                            </div>
                            <div>
                                <h3 class="font-black text-white text-lg group-hover:text-indigo-300 transition-colors">${game.game_name}</h3>
                                <span class="text-slate-300 text-xs font-bold">본선 출전 엔트리</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            ${gameEntries.length === 0 ? `
                                <button onclick="Boako.Team.openEntryForm()" class="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-emerald-600 transition-colors shadow-sm flex items-center gap-2">
                                    📝 작전판 열기
                                </button>
                            ` : ''}
                           
<button onclick="Boako.Match.Chat.open(${game.season_no}, '${game.game_name}')" class="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-indigo-600 transition-colors shadow-sm flex items-center gap-2">
    💬 소통 채널
</button>
                        </div>
                    </div>

                    <div class="p-6 bg-slate-50/50">
                        ${gameEntries.length > 0 ? `
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                ${gameEntries.map(entry => `
                                    <div class="bg-white border-2 border-indigo-100 rounded-xl p-4 text-center shadow-sm relative overflow-hidden flex flex-col items-center">
                                        <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center mb-2 z-10">
                                            ${entry.teams?.logo_url ? `<img src="${entry.teams.logo_url}" class="w-full h-full object-cover">` : '<span class="text-xl">🏴</span>'}
                                        </div>
                                        <span class="text-indigo-600 font-black text-sm mb-2 block relative z-10">${entry.team_name}</span>
                                        <div class="text-slate-700 font-bold text-sm bg-slate-50 py-3 rounded-lg border border-slate-200 relative z-10 w-full">
                                            ${entry.player_name}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div onclick="Boako.Team.openEntryForm()" class="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/50 cursor-pointer hover:bg-indigo-100/50 hover:border-indigo-400 transition-all group">
                                <span class="text-4xl mb-3 group-hover:scale-125 transition-transform duration-300">🔒</span>
                                <h4 class="text-indigo-700 font-black text-sm">엔트리 제출 및 블라인드 진행 중</h4>
                                <p class="text-slate-500 font-bold text-xs mt-1 mb-4">상대방의 꼼수를 막기 위해, 제출 마감일 전까지 모든 엔트리는 비공개됩니다.</p>
                                <span class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md group-hover:bg-indigo-700 transition-colors group-active:scale-95">
                                    👇 여기를 클릭하여 우리 팀 엔트리 작성하기
                                </span>
                            </div>
                        `}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        content.innerHTML = html;
    },
    // 🌟 6. [전역 모듈] 종목별 소통 채널 (메신저 연동 가능 구조)
    Chat: {
        channel: null,
        currentSeason: null,
        currentGame: null,

        open: async (seasonNo, gameName) => {
            Boako.Match.Chat.currentSeason = seasonNo;
            Boako.Match.Chat.currentGame = gameName;

            const existingModal = document.getElementById('match-chat-modal');
            if (existingModal) existingModal.remove();

            // 💡 z-index를 9999로 올려 메뉴바 가림 현상 해결 & 헤더에 [📅 일정 제안] 버튼 추가
            const modalHtml = `
                <div id="match-chat-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div class="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col h-[80vh] overflow-hidden">
                        
                        <div class="bg-indigo-600 px-5 py-4 flex justify-between items-center text-white shrink-0 shadow-md z-10">
                            <div>
                                <h2 class="text-lg font-black flex items-center gap-2">💬 [${gameName}] 소통 채널</h2>
                                <p class="text-indigo-200 text-xs font-bold mt-0.5">상대 팀 선수들과 일정을 조율하세요.</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="Boako.Match.Chat.promptSchedule()" class="text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-lg font-black hover:bg-indigo-50 shadow-sm transition-colors">
                                    📅 일정 제안
                                </button>
                                <button onclick="Boako.Match.Chat.close()" class="text-white hover:text-indigo-200 transition-colors p-1">
                                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        </div>

                        <div id="match-chat-messages" class="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-slate-100 custom-scrollbar">
                            <div class="text-center text-slate-400 text-xs font-bold py-4">채팅 기록을 불러오는 중... ⏳</div>
                        </div>

                        <div class="p-3 bg-white border-t border-slate-200 shrink-0 flex gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <input type="text" id="match-chat-input" placeholder="메시지를 입력하세요 (엔터 전송)" class="flex-1 px-4 py-2.5 bg-slate-100 border border-transparent rounded-xl text-sm font-bold focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" onkeypress="if(event.key === 'Enter') Boako.Match.Chat.send()">
                            <button onclick="Boako.Match.Chat.send()" class="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">전송</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            try {
                // 💡 단일 필터(room_id)를 사용하여 에러 방지
                const { data: messages, error } = await Boako.db
                    .from('grandprix_match_chats')
                    .select('*, profiles(full_name, profile_url)')
                    .eq('room_id', `${seasonNo}_${gameName}`) 
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                
                const container = document.getElementById('match-chat-messages');
                container.innerHTML = ''; 

                if (messages && messages.length > 0) {
                    messages.reverse().forEach(msg => Boako.Match.Chat.renderMessage(msg));
                    Boako.Match.Chat.scrollToBottom();
                } else {
                    container.innerHTML = `<div class="text-center text-slate-400 text-xs font-bold py-8">아직 메시지가 없습니다. 일정을 조율해 보세요!</div>`;
                }
            } catch (err) {
                console.error("채팅 로드 실패:", err);
            }

            if (Boako.Match.Chat.channel) Boako.db.removeChannel(Boako.Match.Chat.channel);

            Boako.Match.Chat.channel = Boako.db.channel(`match-chat-${seasonNo}-${gameName}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'grandprix_match_chats',
                    filter: `room_id=eq.${seasonNo}_${gameName}`
                }, (payload) => {
                    const newMsg = payload.new;
                    if (newMsg.sender_id !== Boako.state.user.id) {
                         newMsg.profiles = { full_name: "상대 선수" }; 
                         Boako.Match.Chat.renderMessage(newMsg);
                         Boako.Match.Chat.scrollToBottom();
                    }
                })
                .on('postgres_changes', { 
                    event: 'UPDATE', // 💡 일정 수락/거절 시 실시간 갱신 감지
                    schema: 'public', 
                    table: 'grandprix_match_chats',
                    filter: `room_id=eq.${seasonNo}_${gameName}`
                }, (payload) => {
                    // 상태가 변경되면 모달창을 새로 그려서 버튼을 변경합니다
                    Boako.Match.Chat.open(seasonNo, gameName);
                })
                .subscribe();
            
            setTimeout(() => document.getElementById('match-chat-input').focus(), 100);
        },

        close: () => {
            const modal = document.getElementById('match-chat-modal');
            if (modal) modal.remove();
            if (Boako.Match.Chat.channel) {
                Boako.db.removeChannel(Boako.Match.Chat.channel);
                Boako.Match.Chat.channel = null;
            }
        },

        send: async () => {
            const input = document.getElementById('match-chat-input');
            const content = input.value.trim();
            if (!content) return;
            input.value = ''; 

            const myTeamName = Boako.state.team?.info?.team_name || null;
            const payload = {
                season_no: Boako.Match.Chat.currentSeason,
                game_name: Boako.Match.Chat.currentGame,
                sender_id: Boako.state.user.id,
                team_name: myTeamName,
                content: content
            };

            const tempMsg = { ...payload, profiles: { full_name: Boako.state.user.nickname } };
            const container = document.getElementById('match-chat-messages');
            if (container.innerHTML.includes('아직 메시지가 없습니다')) container.innerHTML = '';

            Boako.Match.Chat.renderMessage(tempMsg);
            Boako.Match.Chat.scrollToBottom();

            await Boako.db.from('grandprix_match_chats').insert([payload]);
        },

        // 💡 [신규] 일정 제안 전송 기능
        promptSchedule: async () => {
            const inputTime = prompt("제안할 날짜와 시간을 입력해주세요.\n(입력 예시: 2026-06-05 20:00)");
            if (!inputTime) return;

            const myTeamName = Boako.state.team?.info?.team_name || null;
            const payload = {
                season_no: Boako.Match.Chat.currentSeason,
                game_name: Boako.Match.Chat.currentGame,
                sender_id: Boako.state.user.id,
                team_name: myTeamName,
                content: "매치 일정을 제안합니다.",
                action_type: 'SCHEDULE_PROPOSE',
                metadata: { proposed_time: inputTime }
            };

            const { error } = await Boako.db.from('grandprix_match_chats').insert([payload]);
            if (!error) Boako.Util.toast("📅 일정 제안이 전송되었습니다.");
        },

        // 💡 [신규] 일정 수락/거절 처리
        replySchedule: async (messageId, status) => {
            if (!confirm(`이 일정을 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) return;

            const { error } = await Boako.db.from('grandprix_match_chats')
                .update({ action_status: status })
                .eq('id', messageId);

            if (error) {
                Boako.Util.toast("❌ 처리 중 오류가 발생했습니다.");
            } else {
                Boako.Util.toast(status === 'ACCEPTED' ? "✅ 일정이 확정되었습니다!" : "❌ 일정을 거절했습니다.");
            }
        },

        renderMessage: (msg) => {
            const container = document.getElementById('match-chat-messages');
            if (!container) return;

            const isMe = msg.sender_id === Boako.state.user.id;
            const senderName = msg.profiles?.full_name || "알 수 없음";
            const teamBadge = msg.team_name ? `<span class="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] mr-1 font-black shadow-sm">[${msg.team_name}]</span>` : '';

            let displayContent = msg.content;

            // 💡 [신규] 일정 카드 UI 조립
            if (msg.action_type === 'SCHEDULE_PROPOSE') {
                const proposedTime = msg.metadata?.proposed_time || '미정';
                const status = msg.action_status || 'PENDING';
                
                let actionButtons = '';
                let statusBadge = '';

                if (status === 'PENDING') {
                    if (!isMe) {
                        actionButtons = `
                            <div class="flex gap-2 mt-3">
                                <button onclick="Boako.Match.Chat.replySchedule('${msg.id}', 'ACCEPTED')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-sm">🟢 수락</button>
                                <button onclick="Boako.Match.Chat.replySchedule('${msg.id}', 'REJECTED')" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 rounded-lg transition-colors">❌ 거절</button>
                            </div>
                        `;
                    } else {
                        statusBadge = `<div class="mt-3 text-xs text-slate-500 font-bold text-center bg-white/50 py-1.5 rounded-lg">상대방의 응답 대기 중...</div>`;
                    }
                } else if (status === 'ACCEPTED') {
                    statusBadge = `<div class="mt-3 text-xs text-emerald-600 font-bold text-center bg-emerald-50 py-1.5 rounded-lg border border-emerald-100">✅ 매치 일정 확정됨</div>`;
                } else if (status === 'REJECTED') {
                    statusBadge = `<div class="mt-3 text-xs text-red-500 font-bold text-center bg-red-50 py-1.5 rounded-lg border border-red-100">❌ 거절됨</div>`;
                }

                displayContent = `
                    <div class="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 shadow-sm text-slate-800 w-56 my-1">
                        <div class="font-black text-indigo-900 text-xs mb-2 flex items-center gap-1">📅 일정 제안</div>
                        <div class="text-sm font-black bg-white p-2.5 rounded-lg text-center border border-indigo-100 shadow-inner">
                            ${proposedTime}
                        </div>
                        ${actionButtons}
                        ${statusBadge}
                    </div>
                `;
            }

            const html = isMe ? `
                <div class="flex flex-col items-end gap-1 animate-in slide-in-from-right-2 duration-200">
                    <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm shadow-md break-words font-medium">
                        ${displayContent.replace(/\n/g, '<br>')}
                    </div>
                </div>
            ` : `
                <div class="flex flex-col items-start gap-1 animate-in slide-in-from-left-2 duration-200">
                    <span class="text-[11px] font-bold text-slate-600 flex items-center ml-1">
                        ${teamBadge} ${senderName}
                    </span>
                    <div class="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[75%] text-sm shadow-md break-words font-medium">
                        ${displayContent.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        },

        scrollToBottom: () => {
            const el = document.getElementById('match-chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
        }
    }
};
