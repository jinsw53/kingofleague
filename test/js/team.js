/**
 * [TEAM] 팀 관리 (창단, 정보수정, 멤버관리, 밴 투표, 채팅 등)
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
