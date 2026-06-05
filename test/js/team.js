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

    // 🌟 팝업창 내부에 실제 DB 데이터를 불러와 렌더링
    loadBanCandidates: async () => {
        const contentArea = document.getElementById('ban-vote-content');
        if (!contentArea) return;

        try {
            // 1. 시즌 번호 가져오기
            const { data: currentSeason } = await Boako.db
                .from('seasons')
                .select('season_no')
                .lte('start_date', new Date().toISOString())
                .gte('end_date', new Date().toISOString())
                .maybeSingle();

            let seasonNo = currentSeason ? currentSeason.season_no : null;
            
            if (!seasonNo) {
                const { data: lastSeason } = await Boako.db
                    .from('seasons')
                    .select('season_no')
                    .lt('end_date', new Date().toISOString())
                    .order('end_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                seasonNo = lastSeason ? lastSeason.season_no : null;
            }

            if (!seasonNo) {
                contentArea.innerHTML = `<div class="text-center py-12 text-slate-500 font-bold">진행 중인 시즌 정보가 없습니다.</div>`;
                return;
            }

            // 2. 우리 팀 전체의 투표 내역 가져오기
            const teamName = Boako.state.team.info.team_name;
            const leaderName = Boako.state.team.info.leader_name;
            const myName = Boako.state.user.nickname;
            const isLeader = Boako.state.team.type === 'LEADER';

            const { data: teamVotes, error: voteError } = await Boako.db
                .from('grandprix_ban_votes')
                .select('banned_game_name, voter_name, updated_at')
                .eq('season_no', seasonNo)
                .eq('team_name', teamName);

            // =====================================================================
            // 🚨 [복구된 부분] 변수 선언 및 투표 데이터 계산 반복문 (여기가 빠져있었습니다!)
            let myBannedGame = null;
            let leaderVotedGame = null;
            const voteCounts = {}; 
            const firstVoteTimes = {}; 

            (teamVotes || []).forEach(v => {
                if (v.voter_name === myName) myBannedGame = v.banned_game_name;
                if (v.voter_name === leaderName) leaderVotedGame = v.banned_game_name;

                if (!voteCounts[v.banned_game_name]) {
                    voteCounts[v.banned_game_name] = 0;
                    firstVoteTimes[v.banned_game_name] = new Date(v.updated_at).getTime();
                }
                voteCounts[v.banned_game_name] += 1;
                
                const vTime = new Date(v.updated_at).getTime();
                if (vTime < firstVoteTimes[v.banned_game_name]) {
                    firstVoteTimes[v.banned_game_name] = vTime;
                }
            });
            // =====================================================================

            // 🌟 3. 현재 밴 종목 시뮬레이션 (팀장 우선순위 강제 적용)
            let leadingGame = null;
            let leadingReason = ''; 
            
            // 팀장 투표가 있다면, 다른 모든 다수결/선착순 계산을 무시하고 무조건 팀장 픽을 1위로 올림
            if (leaderVotedGame) {
                leadingGame = leaderVotedGame;
                leadingReason = 'LEADER';
            } else if (Object.keys(voteCounts).length > 0) {
                // 팀장 투표가 없을 때만 다수결/선착순 로직 실행
                let maxCount = 0;
                let earliestTime = Infinity;

                for (const [gameName, count] of Object.entries(voteCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        leadingGame = gameName;
                        earliestTime = firstVoteTimes[gameName];
                        leadingReason = 'MAJORITY';
                    } else if (count === maxCount) {
                        if (firstVoteTimes[gameName] < earliestTime) {
                            leadingGame = gameName;
                            earliestTime = firstVoteTimes[gameName];
                            leadingReason = 'FIRST_COME';
                        }
                    }
                }
            }

            // 4. 게임 목록 호출 (이하 코드 동일)

            // 4. 게임 목록 호출
            const { data: games, error } = await Boako.db
                .from('grandprix_games')
                .select('id, game_name, game_logo_url')
                .eq('season_no', seasonNo)
                .order('selection_rank', { ascending: true });

            if (error) throw error;

            if (!games || games.length === 0) {
                contentArea.innerHTML = `<div class="text-center py-12 text-slate-400 font-bold">후보 종목이 없습니다.</div>`;
                return;
            }

            // 🌟 5. UI 렌더링
            let html = ``;
            const hasIVoted = myBannedGame !== null; // 내가 투표를 했는지 여부
            const isBanConfirmed = leadingReason === 'LEADER'; // 🌟 팀장이 밴을 확정했는지 여부
            
            // 상단 전광판 브리핑
            if (isBanConfirmed) {
                html += `
                    <div class="mb-5 p-4 bg-slate-800 border border-slate-700 rounded-xl text-center shadow-md">
                        <span class="text-yellow-400 font-black text-sm block mb-1">👑 팀장 권한으로 밴 확정됨</span>
                        <span class="text-red-500 font-black text-lg line-through decoration-red-600/50">🚫 ${leadingGame}</span>
                        <p class="text-xs text-slate-400 mt-2 font-bold">팀장 권한으로 밴이 확정되어 투표가 마감되었습니다.</p>
                    </div>`;
            } else if (leadingGame) {
                html += `
                    <div class="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center shadow-sm">
                        <span class="text-blue-600 font-black text-sm block mb-1">👥 현재 팀 밴 유력 종목 (다수결/선착순)</span>
                        <span class="text-red-600 font-black text-lg ${hasIVoted ? 'line-through decoration-red-600/50' : ''}">🚫 ${leadingGame}</span>
                        ${!hasIVoted ? `<p class="text-xs text-blue-500 mt-2 font-bold animate-pulse">투표를 완료해야 밴(Ban) 효과가 표시됩니다.</p>` : ''}
                    </div>`;
            } else {
                html += `
                    <div class="mb-5 p-4 bg-slate-100 border border-slate-200 rounded-xl text-center text-slate-500 font-bold text-sm shadow-sm">
                        아직 밴(Ban) 투표 내역이 없습니다. 의견을 내주세요!
                    </div>`;
            }

            html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">`;
            
            games.forEach(game => {
                const isLeading = leadingGame === game.game_name;
                const isMyPick = myBannedGame === game.game_name;
                const currentVotes = voteCounts[game.game_name] || 0;
                
                // 🌟 핵심: 팀장이 밴을 확정(isBanConfirmed)했거나, 내가 투표를 했을 때(hasIVoted)만 흑백 효과 적용
                const showBannedEffect = isLeading && (isBanConfirmed || hasIVoted);

                // 카드 틀 디자인
                const cardClass = showBannedEffect 
                    ? 'bg-slate-200 border-2 border-red-600 shadow-none' 
                    : (isMyPick && !isBanConfirmed ? 'bg-indigo-50 border-2 border-indigo-400 shadow-md' : 'bg-white border border-slate-200 shadow-sm hover:shadow-md');
                
                // 버튼 디자인 로직 (우선순위에 맞게 엄격하게 분기)
                let btnClass = '';
                let btnText = '';

                if (isLeading && isBanConfirmed) {
                    // 팀장이 확정한 밴 카드
                    btnClass = 'w-full bg-slate-800 text-yellow-400 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-700 shadow-inner';
                    btnText = '👑 팀장 밴 확정됨';
                } else if (isBanConfirmed) {
                    // 팀장이 확정해서 나머지 투표 못하게 닫힌 카드들
                    btnClass = 'w-full bg-slate-100 text-slate-400 text-xs font-bold py-2.5 rounded-lg cursor-not-allowed';
                    btnText = '🔒 투표 마감';
                } else if (isMyPick) {
                    // 다수결 진행 중, 내가 던진 픽
                    btnClass = 'w-full bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-lg cursor-default shadow-inner';
                    btnText = '✅ 내 투표 반영됨';
                } else if (showBannedEffect) {
                    // 다수결 진행 중 1위 종목
                    btnClass = 'w-full bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-800';
                    btnText = '🛑 현재 밴 유력';
                } else {
                    // 아직 확정 안 났고, 내가 투표 가능한 카드들
                    btnClass = isLeader 
                        ? 'w-full bg-slate-800 hover:bg-red-600 hover:text-white text-yellow-400 text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-700 shadow-sm active:scale-95'
                        : 'w-full bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-600 text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-200 shadow-sm active:scale-95';
                    btnText = isLeader ? '👑 팀장 밴 확정하기' : '✋ 이 종목 밴 투표';
                }
                
                // 🌟 버튼 클릭 가능 여부 철저히 차단
                const disableVote = isBanConfirmed || showBannedEffect || isMyPick;

                const imgClass = showBannedEffect
                    ? 'w-full h-full object-contain p-3 grayscale opacity-30'
                    : 'w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-300';

                const textClass = showBannedEffect ? 'text-slate-400 line-through' : 'text-slate-700';

                html += `
                    <div class="rounded-xl overflow-hidden transition-all flex flex-col group ${cardClass} relative">
                        <!-- 투표를 마쳤거나 팀장이 확정한 상태일 때 다른 유저의 투표 분포 노출 -->
                        ${currentVotes > 0 && (hasIVoted || isBanConfirmed) && !showBannedEffect ? `
                            <div class="absolute top-2 right-2 z-10 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md">
                                👤 ${currentVotes}표
                            </div>
                        ` : ''}

                        <div class="aspect-square flex items-center justify-center relative overflow-hidden border-b ${showBannedEffect ? 'border-red-600 bg-slate-300' : 'border-slate-100 bg-slate-100'}">
                            ${game.game_logo_url 
                                ? `<img src="${game.game_logo_url}" class="${imgClass}">` 
                                : `<span class="text-5xl drop-shadow-md ${showBannedEffect ? 'grayscale opacity-30' : ''}">🎲</span>`
                            }
                            
                            ${showBannedEffect ? `
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                    <span class="text-red-600 font-black text-2xl tracking-widest rotate-[-15deg] border-4 border-red-600 px-2 py-1 rounded opacity-90 shadow-sm bg-white/50 backdrop-blur-sm">BANNED</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="p-4 text-center flex-1 flex flex-col justify-between gap-3 ${showBannedEffect ? 'bg-slate-200' : ''}">
                            <h4 class="font-black ${textClass} text-sm break-keep leading-tight">${game.game_name}</h4>
                            <button ${disableVote ? 'disabled' : `onclick="Boako.Team.submitBanVote('${game.id}', '${game.game_name}')"`} 
                                    class="${btnClass}">
                                ${btnText}
                            </button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            contentArea.innerHTML = html;

        } catch (err) {
            console.error("데이터 로드 실패:", err);
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
                
                Boako.Team.loadBanCandidates();
                
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
