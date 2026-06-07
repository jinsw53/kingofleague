/**
 * [TEAM] 팀 관리 (창단, 정보수정, 멤버관리, 밴 투표, 작전판, 채팅 등)
 */
Boako.Team = {
    syncStatus: async () => {
        const user = Boako.state.user;
        const menuTxt = document.getElementById('team-menu-text');
        if (!user) { Boako.state.team = null; if (menuTxt) menuTxt.innerText = "팀 창단"; return; }
        
        try {
            // 1. 내 닉네임 확보
            const { data: profile } = await Boako.db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
            Boako.state.user.nickname = profile?.full_name || user.user_metadata?.full_name || "사용자";

            // 🌟 2. 파편화 방지: 팀 소속 여부는 오직 'team_members'만 뒤져서 확인
            const { data: memberEntry } = await Boako.db
                .from('team_members')
                .select('team_id, role') 
                .eq('player_name', Boako.state.user.nickname)
                .eq('is_active', true)
                .maybeSingle();

            if (memberEntry) {
                const { data: teamInfo } = await Boako.db.from('teams').select('*').eq('id', memberEntry.team_id).maybeSingle();
                if (teamInfo) {
                    // 팀장 여부 판단 (DB 스키마 구조에 따라 memberEntry.role === 'LEADER' 등을 사용해도 무방)
                    const isLeader = teamInfo.owner_id === user.id; 
                    Boako.state.team = { type: isLeader ? 'LEADER' : 'MEMBER', info: teamInfo };
                    if (menuTxt) menuTxt.innerText = "팀 메뉴";
                    return;
                }
            }
            
            Boako.state.team = null; 
            if (menuTxt) menuTxt.innerText = "팀 창단";
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
            
            // 🌟 1. 팀 데이터 생성 (존재하지 않는 leader_name 컬럼 삭제)
            const { data: newTeam, error: teamError } = await Boako.db.from('teams').insert([{ 
                team_name: document.getElementById('team_name').value.trim(), 
                owner_id: Boako.state.user.id, 
                team_motto: document.getElementById('team_motto').value.trim(),
                team_desc: document.getElementById('team_desc').value.trim(),
                logo_url: uData.publicUrl 
            }]).select().single();

            if (teamError) throw teamError;

            // 🌟 2. 치명적 누락 해결: 팀을 만든 본인을 team_members에 즉시 등록
            const { error: memberError } = await Boako.db.from('team_members').insert([{
                team_id: newTeam.id,
                player_name: Boako.state.user.nickname,
                role: 'LEADER', // DB 스키마 직급 컬럼에 맞게 수정 필요 시 수정
                is_active: true
            }]);

            if (memberError) throw memberError;

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

    addMember: () => {
        const existing = document.getElementById('boako-invite-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="boako-invite-modal" class="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style="animation: fadeIn 0.2s ease-out;">
                <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                    <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <h3 class="font-black text-lg text-slate-800 flex items-center gap-2">🔍 멤버 스카웃</h3>
                        <button onclick="document.getElementById('boako-invite-modal').remove()" class="text-slate-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">✕</button>
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
            users.forEach(u => {
                if (u.id === Boako.state.user.id) return;
                
                // 보안 연결 처리 방어 코드 적용
                const secureProfileUrl = u.profile_url ? u.profile_url.replace(/^http:\/\//i, 'https://') : null;
                
                listHtml += `
                    <div class="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-indigo-100 transition-all group">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center border border-slate-200 flex-shrink-0">
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

            if (listHtml === '') listHtml = `<div class="text-center text-slate-400 text-sm py-8 font-bold">초대 가능한 유저가 없습니다.</div>`;
            resultContainer.innerHTML = listHtml;

        } catch (err) {
            resultContainer.innerHTML = `<div class="text-center text-red-500 text-sm py-8 font-bold">검색 중 오류 발생:<br>${err.message}</div>`;
        }
    },

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

    openBanVote: async () => {
        const existingModal = document.getElementById('ban-vote-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="ban-vote-modal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onclick="if(event.target === this) this.remove()">
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
        setTimeout(() => { Boako.Team.loadBanCandidates(); }, 500); 
    },

    loadBanCandidates: async () => {
        const contentArea = document.getElementById('ban-vote-content');
        if (!contentArea) return;

        console.log("========================================");
        console.log("🕵️‍♂️ [추적 시작] 밴 투표소 로드 및 팀장 밴픽 판별 로직");
        console.log("========================================");

        try {
            // 1. 시즌 번호 가져오기
            const { data: currentSeason } = await Boako.db.from('seasons')
                .select('season_no').lte('start_date', new Date().toISOString()).gte('end_date', new Date().toISOString()).maybeSingle();
            let seasonNo = currentSeason ? currentSeason.season_no : null;
            
            if (!seasonNo) {
                const { data: lastSeason } = await Boako.db.from('seasons')
                    .select('season_no').lt('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
                seasonNo = lastSeason ? lastSeason.season_no : null;
            }

            console.log("▶️ 1. 시즌 번호:", seasonNo);

            if (!seasonNo) {
                contentArea.innerHTML = `<div class="text-center py-12 text-slate-500 font-bold">진행 중인 시즌 정보가 없습니다.</div>`;
                return;
            }

            const teamId = Boako.state.team.info.id;
            const teamName = Boako.state.team.info.team_name;
            const myName = Boako.state.user.nickname;
            const isLeader = Boako.state.team.type === 'LEADER';

            console.log(`▶️ 2. 접속자 닉네임: [${myName}], 권한상태: [${Boako.state.team.type}]`);

            // 🌟 [소장님 로직 구현 1단계] 현재 팀의 모든 멤버 데이터를 가져옵니다.
            const { data: teamMembers, error: memErr } = await Boako.db
                .from('team_members')
                .select('player_name, role')
                .eq('team_id', teamId)
                .eq('is_active', true);

            if (memErr) throw memErr;
            console.log("▶️ 3. [team_members] 데이터 로드 완료:", teamMembers);

            // 🌟 [소장님 로직 구현 2단계] 투표 내역을 가져옵니다.
            const { data: teamVotes, error: voteError } = await Boako.db
                .from('grandprix_ban_votes')
                .select('banned_game_name, voter_name, updated_at')
                .eq('season_no', seasonNo)
                .eq('team_name', teamName);

            if (voteError) throw voteError;
            console.log("▶️ 4. [grandprix_ban_votes] 투표 내역 로드 완료:", teamVotes);

            // 🌟 3. 투표 대조 및 팀장 판별
            let myBannedGame = null;
            let leaderVotedGame = null;
            const voteCounts = {}; 
            const firstVoteTimes = {}; 

            console.log("▶️ 5. 투표자 ↔ 팀 멤버 직급 대조 시작");
            (teamVotes || []).forEach(v => {
                if (v.voter_name === myName) {
                    myBannedGame = v.banned_game_name;
                }

                // 🔥 [소장님 로직 구현 3단계] voter_name과 일치하는 player_name을 찾고, 그 사람의 role이 LEADER인지 확인
                const matchedMember = teamMembers.find(m => m.player_name === v.voter_name);
                
                if (matchedMember) {
                    console.log(`   👉 투표자 [${v.voter_name}] 매칭 성공 -> 직급(role): [${matchedMember.role}]`);
                    if (matchedMember.role === 'LEADER') {
                        leaderVotedGame = v.banned_game_name;
                        console.log(`      👑 [팀장 투표 감지!] 팀장 권한 밴 종목 확정: [${leaderVotedGame}]`);
                    }
                } else {
                    console.log(`   👉 투표자 [${v.voter_name}] 매칭 실패 (팀 멤버 목록에 없음)`);
                }

                // 다수결 집계
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

            // 🌟 4. 전광판 렌더링 최우선순위 설정
            const isBanConfirmed = (leaderVotedGame !== null);
            let leadingGame = leaderVotedGame; 
            let leadingReason = isBanConfirmed ? 'LEADER' : '';
            
            // 팀장이 투표하지 않았을 때만 다수결 시뮬레이션
            if (!isBanConfirmed && Object.keys(voteCounts).length > 0) {
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

            console.log(`▶️ 6. 최종 판독 결과 -> 밴 확정 여부: [${isBanConfirmed}], 표기될 게임: [${leadingGame}], 사유: [${leadingReason}]`);

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
            const hasIVoted = myBannedGame !== null; 
            
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
                        아직 밴(Ban) 투표 내역이 없습니다. 가장 먼저 의견을 내주세요!
                    </div>`;
            }

            html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">`;
            
            games.forEach(game => {
                const isLeaderPick = isBanConfirmed && (game.game_name === leaderVotedGame);
                const isMyPick = myBannedGame === game.game_name;
                const isLeadingByMajority = (!isBanConfirmed) && (leadingGame === game.game_name);
                const currentVotes = voteCounts[game.game_name] || 0;
                
                const showBannedEffect = isLeaderPick || (isLeadingByMajority && hasIVoted);

                const cardClass = showBannedEffect 
                    ? 'bg-slate-200 border-2 border-red-600 shadow-none' 
                    : (isMyPick && !isBanConfirmed ? 'bg-indigo-50 border-2 border-indigo-400 shadow-md' : 'bg-white border border-slate-200 shadow-sm hover:shadow-md');
                
                let btnClass = '';
                let btnText = '';
                let disableVote = false;

                // 🔥 팀장/팀원 권한별 버튼 상태 분리
                if (isLeader) {
                    if (isMyPick) {
                        btnClass = 'w-full bg-slate-800 text-yellow-400 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-700 shadow-inner';
                        btnText = '👑 팀장 밴 확정됨';
                        disableVote = true; 
                    } else {
                        btnClass = 'w-full bg-slate-800 hover:bg-red-600 hover:text-white text-yellow-400 text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-700 shadow-sm active:scale-95';
                        btnText = '👑 이 종목으로 변경';
                        disableVote = false; 
                    }
                } else {
                    if (isBanConfirmed) {
                        if (isLeaderPick) {
                            btnClass = 'w-full bg-slate-800 text-yellow-400 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-700 shadow-inner';
                            btnText = '👑 팀장 밴 확정됨';
                        } else {
                            btnClass = 'w-full bg-slate-100 text-slate-400 text-xs font-bold py-2.5 rounded-lg cursor-not-allowed';
                            btnText = '🔒 투표 마감';
                        }
                        disableVote = true;
                    } else {
                        if (isMyPick) {
                            btnClass = 'w-full bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-lg cursor-default shadow-inner';
                            btnText = '✅ 내 투표 반영됨';
                            disableVote = true; 
                        } else if (showBannedEffect) {
                            btnClass = 'w-full bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-lg cursor-default border border-slate-800';
                            btnText = '🛑 현재 밴 유력';
                            disableVote = false;
                        } else {
                            btnClass = 'w-full bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-600 text-xs font-bold py-2.5 rounded-lg transition-all border border-slate-200 shadow-sm active:scale-95';
                            btnText = '✋ 이 종목 밴 투표';
                            disableVote = false;
                        }
                    }
                }

                const imgClass = showBannedEffect
                    ? 'w-full h-full object-contain p-3 grayscale opacity-30'
                    : 'w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-300';

                const textClass = showBannedEffect ? 'text-slate-400 line-through' : 'text-slate-700';

                html += `
                    <div class="rounded-xl overflow-hidden transition-all flex flex-col group ${cardClass} relative">
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
            console.log("========================================");
            console.log("🏁 [추적 종료] 렌더링 완료");
            console.log("========================================");

        } catch (err) {
            console.error("데이터 로드 실패:", err);
            contentArea.innerHTML = `<div class="text-center py-12 text-red-500 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    submitBanVote: async (gameId, gameName) => {
        const confirmVote = confirm(`정말 [${gameName}] 종목을 밴(Ban) 하시겠습니까?\n투표가 완료되면 결과가 반영됩니다.`);
        
        if (confirmVote) {
            try {
                const { error } = await Boako.db.rpc('fn_vote_grandprix_ban', {
                    p_season_no: null, 
                    p_banned_game_name: gameName
                });

                if (error) throw error;

                Boako.Util.toast(`[${gameName}] 밴 투표가 성공적으로 완료되었습니다!`);
                Boako.Team.loadBanCandidates();
                
            } catch (err) {
                console.error("투표 에러:", err);
                alert("투표 처리 중 오류가 발생했습니다:\n" + err.message);
            }
        }
    },

   // 🌟 1. 엔트리 작전판(모달) 열기 (팀장/팀원 권한 분리 적용)
    openEntryForm: async () => {
        try {
            // 1. 현재 시즌 및 팀 정보 가져오기
            const { data: currentSeason } = await Boako.db.from('seasons')
                .select('*')
                .lte('start_date', new Date().toISOString())
                .gte('end_date', new Date().toISOString())
                .maybeSingle();
            
            const seasonNo = currentSeason ? currentSeason.season_no : 1;
            const teamName = Boako.state.team.info.team_name;
            const isLeader = Boako.state.team.type === 'LEADER'; // 💡 팀장 여부 확인
            const myName = Boako.state.user.nickname; // 💡 내 닉네임

            // 2. 본선(FINAL) 확정된 종목만 가져오기
            const { data: finalGames } = await Boako.db.from('grandprix_games')
                .select('*')
                .eq('season_no', seasonNo)
                .eq('status', 'FINAL')
                .order('selection_rank', { ascending: true });

            if (!finalGames || finalGames.length === 0) {
                Boako.Util.toast('본선 확정 종목이 없습니다. 정산을 기다려주세요.', 'error');
                return;
            }

            // 3. 우리 팀 멤버 목록 (팀장용 드롭다운에 사용)
            const { data: members } = await Boako.db.from('team_members')
                .select('*')
                .eq('team_id', Boako.state.team.info.id)
                .eq('is_active', true);

            // 4. 기존에 저장해둔 엔트리가 있는지 불러오기
            const { data: existingEntries } = await Boako.db.from('grandprix_entries')
                .select('*')
                .eq('season_no', seasonNo)
                .eq('team_name', teamName);

            // 5. 모달 UI 생성
            let html = `
                <div id="entry-modal-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div class="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        
                        <div class="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h2 class="text-2xl font-black flex items-center gap-2">
                                    <span class="text-3xl">📝</span> 엔트리 작전판 ${isLeader ? '<span class="text-sm bg-yellow-500 text-black px-2 py-0.5 rounded ml-2">팀장 모드</span>' : ''}
                                </h2>
                                <p class="text-emerald-100 text-sm font-bold mt-1">
                                    ${isLeader ? '팀장은 전체 엔트리를 자유롭게 수정할 수 있습니다.' : '출전을 원하는 종목에 본인을 등록하세요.'}
                                </p>
                            </div>
                            <button onclick="document.getElementById('entry-modal-overlay').remove()" class="text-white hover:text-emerald-200 p-2 transition-colors">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div class="p-6 overflow-y-auto custom-scrollbar bg-slate-50 flex-1">
                            <form id="team-entry-form" onsubmit="Boako.Team.saveEntry(event, ${seasonNo}, '${teamName}')" class="space-y-4">
            `;

            finalGames.forEach(game => {
                const saved = existingEntries?.find(e => e.game_name === game.game_name);
                const savedPlayer = saved ? saved.player_name : '';
                
                let selectHtml = '';

                // 🔥 [핵심 로직] 권한에 따른 드롭다운 분기 처리
                if (isLeader) {
                    // 👑 1. 팀장: 모든 팀원을 선택할 수 있는 전권 드롭다운
                    selectHtml = `
                        <select name="entry_game_${game.game_name}" class="w-full appearance-none bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm shadow-inner transition-all">
                            <option value="">미정 / 출전 포기</option>
                            ${members.map(m => `
                                <option value="${m.player_name}" ${m.player_name === savedPlayer ? 'selected' : ''}>
                                    ${m.player_name} ${m.role === 'LEADER' ? '(팀장)' : ''}
                                </option>
                            `).join('')}
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-600">▼</div>
                    `;
                } else {
                    // 👤 2. 일반 팀원 로직
                    if (savedPlayer && savedPlayer !== myName) {
                        // 다른 사람이 이미 선점한 경우 -> 수정 불가 (읽기 전용)
                        selectHtml = `
                            <select disabled class="w-full appearance-none bg-slate-100 border border-slate-200 text-slate-500 font-bold py-3 px-4 rounded-xl cursor-not-allowed text-sm">
                                <option>${savedPlayer} 출전 예정</option>
                            </select>
                            <div class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">🔒</div>
                            <!-- 폼 제출 시 빈값 날아가는 걸 방지하기 위해 hidden input으로 값 유지 -->
                            <input type="hidden" name="entry_game_${game.game_name}" value="${savedPlayer}">
                        `;
                    } else {
                        // 빈자리이거나, 내가 선점한 자리인 경우 -> 본인 선택 또는 취소(미정) 가능
                        selectHtml = `
                            <select name="entry_game_${game.game_name}" class="w-full appearance-none bg-white border border-blue-200 text-blue-700 font-bold py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-sm shadow-sm transition-all hover:bg-blue-50">
                                <option value="">미정 (빈자리)</option>
                                <option value="${myName}" ${savedPlayer === myName ? 'selected' : ''}>🙋‍♂️ ${myName} (본인 출전)</option>
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-blue-500">▼</div>
                        `;
                    }
                }

                html += `
                    <div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 hover:border-emerald-300 transition-colors shadow-sm">
                        <div class="w-16 h-16 shrink-0 bg-slate-100 rounded-xl flex items-center justify-center p-2 border border-slate-200 relative">
                            ${game.game_logo_url ? `<img src="${game.game_logo_url}" class="max-h-full max-w-full object-contain">` : '<span class="text-3xl">🎲</span>'}
                        </div>
                        <div class="flex-1 text-center sm:text-left w-full">
                            <h4 class="font-black text-slate-800 text-lg">${game.game_name}</h4>
                            <p class="text-slate-400 text-xs font-bold mt-1">출전 선수를 할당하세요.</p>
                        </div>
                        
                        <!-- 렌더링된 드롭다운 삽입 -->
                        <div class="w-full sm:w-48 shrink-0 relative">
                            ${selectHtml}
                        </div>
                    </div>
                `;
            });

            html += `
                            </form>
                        </div>
                        
                        <div class="p-6 bg-white border-t border-slate-100 shrink-0">
                            <button type="submit" form="team-entry-form" class="w-full bg-emerald-600 text-white font-black text-lg py-4 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2">
                                💾 작전판 임시 저장하기
                            </button>
                            <p class="text-center text-slate-400 text-xs font-bold mt-3">저장해도 마감 전까지 다른 팀에게는 🔒 비공개 처리됩니다.</p>
                        </div>

                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', html);

        } catch (err) {
            console.error("작전판 로드 에러:", err);
            Boako.Util.toast('엔트리 작전판을 여는 중 오류가 발생했습니다.', 'error');
        }
    },

    // 🌟 2. 엔트리 데이터 DB에 저장 (로딩 함수 제거)
    saveEntry: async (e, seasonNo, teamName) => {
        e.preventDefault();
        try {
            const formData = new FormData(e.target);
            const upsertData = [];
            const gamesToDelete = []; 

            for (const [key, value] of formData.entries()) {
                if (key.startsWith('entry_game_')) {
                    const gameName = key.replace('entry_game_', '');
                    if (value) {
                        upsertData.push({
                            season_no: seasonNo,
                            team_name: teamName,
                            game_name: gameName,
                            player_name: value,
                            registered_by: Boako.state.user.nickname
                        });
                    } else {
                        gamesToDelete.push(gameName);
                    }
                }
            }

            if (gamesToDelete.length > 0) {
                await Boako.db.from('grandprix_entries')
                    .delete()
                    .eq('season_no', seasonNo)
                    .eq('team_name', teamName)
                    .in('game_name', gamesToDelete);
            }

            if (upsertData.length > 0) {
                const { error: upsertErr } = await Boako.db.from('grandprix_entries')
                    .upsert(upsertData, { 
                        onConflict: 'season_no, team_name, game_name' 
                    });
                
                if (upsertErr) throw upsertErr;
            }

            Boako.Util.toast('✅ 엔트리가 성공적으로 업데이트 되었습니다!');
            
            // 모달 닫기
            document.getElementById('entry-modal-overlay').remove();
            
        } catch (err) {
            console.error("엔트리 저장 에러:", err);
            Boako.Util.toast('저장 중 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
        }
    },

    Chat: {
        channel: null,
        showNotification: () => {
            const badge = document.getElementById('team-chat-badge');
            if (badge) {
                badge.classList.remove('hidden');
                badge.style.display = 'flex';
            }
        },
        clearNotification: () => {
            const badge = document.getElementById('team-chat-badge');
            if (badge) {
                badge.classList.add('hidden');
                badge.style.display = 'none';
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
