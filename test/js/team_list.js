/**
 * [TEAM LIST] 생성된 팀 목록 및 현황을 보여주는 대시보드 (TO 표시 + 가입 신청 + 프로필 연동)
 */
Boako.TeamList = {
    currentPage: 1,
    itemsPerPage: 3, 

    init: async (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const html = `
            <div class="main-banner" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
                <h1>👥 리그 참여 팀 목록</h1>
                <p>BOAKO 아카이브에 등록된 전설적인 팀들을 확인하고 합류하세요!</p>
            </div>

            <section class="section-card">
                <div class="card-header flex justify-between items-center">
                    <span>방명록 및 로스터</span>
                </div>
                
                <div class="card-body" style="background: #f8fafc; min-height: 400px; padding: 25px;">
                    <!-- 검색 바 -->
                    <div class="flex gap-2 mb-8">
                        <div class="relative flex-1">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                            <input type="text" id="team-search-input" placeholder="팀명 또는 팀장 이름으로 검색" class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm font-bold transition-all shadow-sm">
                        </div>
                        <button onclick="Boako.TeamList.loadTeams(1)" class="bg-slate-800 text-white px-6 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">검색</button>
                    </div>

                    <!-- 팀 카드 그리드 영역 -->
                    <div id="team-grid-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>

                    <!-- 화살표 페이지 컨트롤 구역 -->
                    <div id="team-pagination-container" class="mt-10 flex justify-center items-center gap-4"></div>
                </div>
            </section>
        `;
        
        container.innerHTML = html;
        if(typeof lucide !== 'undefined') lucide.createIcons();

        document.getElementById('team-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') Boako.TeamList.loadTeams(1);
        });

        await Boako.TeamList.loadTeams(1);
    },

    loadTeams: async (page = 1) => {
        Boako.TeamList.currentPage = page;
        const container = document.getElementById('team-grid-container');
        const paginationContainer = document.getElementById('team-pagination-container');
        const searchWord = document.getElementById('team-search-input').value.trim();
        
        container.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 font-bold flex flex-col items-center gap-2"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>정보를 불러오는 중입니다...</div>`;
        paginationContainer.innerHTML = ''; 

        try {
            const from = (page - 1) * Boako.TeamList.itemsPerPage;
            const to = from + Boako.TeamList.itemsPerPage - 1;

            let query = Boako.db
                .from('teams')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (searchWord) {
                query = query.or(`team_name.ilike.%${searchWord}%,leader_name.ilike.%${searchWord}%`);
            }

            const { data: teams, count, error } = await query.range(from, to);

            if (error) throw error;

            if (!teams || teams.length === 0) {
                container.innerHTML = `<div class="col-span-full bg-white border border-slate-200 rounded-xl p-10 text-center flex flex-col items-center justify-center shadow-sm"><span class="text-4xl mb-3">📭</span><h4 class="font-black text-slate-600 text-lg mb-1">검색 결과 없음</h4></div>`;
                return;
            }

            const teamIds = teams.map(t => t.id);
            const ownerIds = [...new Set(teams.map(t => t.owner_id))]; // 중복 제거된 리더 ID 목록

            // 🌟 1. 팀장(Owner)들의 프로필 사진(아바타)을 DB에서 한 번에 긁어오기
            const { data: profiles } = await Boako.db.from('profiles').select('id, avatar_url').in('id', ownerIds);
            const avatarMap = {};
            if (profiles) profiles.forEach(p => avatarMap[p.id] = p.avatar_url?.replace('http://', 'https://'));

            // 🌟 2. 활동 중인 멤버 수 조회 (TO 계산)
            const { data: members } = await Boako.db.from('team_members').select('team_id').in('team_id', teamIds).eq('is_active', true);
            const memberCounts = {};
            teamIds.forEach(id => memberCounts[id] = 0);
            if (members) members.forEach(m => memberCounts[m.team_id]++);

            let listHtml = '';
            teams.forEach(team => {
                const logoSrc = team.logo_url || 'https://via.placeholder.com/150?text=NO+LOGO';
                const teamMotto = team.team_motto || '각오 한마디가 없습니다.';
                const leaderName = team.leader_name || '팀장 미지정';
                
                // 해당 팀장의 아바타 URL 꺼내기 (없으면 기본 이미지)
                const leaderAvatar = avatarMap[team.owner_id] || 'https://via.placeholder.com/50?text=👤';
                
                const currentTo = memberCounts[team.id] || 0;
                const isFull = currentTo >= 4;

                const toBadge = isFull 
                    ? `<span class="bg-slate-100 text-slate-400 px-2.5 py-1 rounded-md text-[11px] font-black tracking-tight border border-slate-200">정원 마감 (${currentTo}/4)</span>`
                    : `<span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-[11px] font-black tracking-tight border border-blue-200 animate-pulse">모집 중 (${currentTo}/4)</span>`;

                // 🌟 requestJoin에 team.id를 추가로 넘겨줍니다!
                const actionBtn = isFull
                    ? `<button disabled class="w-full mt-3 bg-slate-100 text-slate-400 py-2.5 rounded-xl font-bold text-sm cursor-not-allowed border border-slate-200">모집 마감</button>`
                    : `<button onclick="Boako.TeamList.requestJoin('${team.team_name}', '${leaderName}', ${team.id})" class="w-full mt-3 bg-slate-900 hover:bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 transform hover:-translate-y-0.5"><i data-lucide="send" class="w-4 h-4"></i> 가입 문의 쪽지 발송</button>`;

                // 🌟 마우스 호버 애니메이션 대폭 강화: hover:-translate-y-2 hover:scale-[1.02] hover:shadow-xl
                listHtml += `
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.02] group flex flex-col">
                        <div class="h-32 bg-slate-50 border-b border-slate-100 flex items-center justify-center relative overflow-hidden p-4">
                            <div class="absolute inset-0 opacity-5 bg-center bg-cover blur-sm transition-transform duration-500 group-hover:scale-110" style="background-image: url('${logoSrc}')"></div>
                            <img src="${logoSrc}" class="h-full w-full object-contain relative z-10 drop-shadow-md" onerror="this.src='https://via.placeholder.com/150?text=NO+LOGO'">
                        </div>
                        <div class="p-5 flex-1 flex flex-col">
                            <h3 class="text-xl font-black text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">${team.team_name}</h3>
                            <p class="text-sm text-blue-500 font-bold italic mb-4 line-clamp-2 leading-relaxed">"${teamMotto}"</p>
                            
                            <div class="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-2">
                                        <!-- 🌟 왕관 대신 팀장의 실제 프로필 사진 렌더링 -->
                                        <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300 shadow-sm">
                                            <img src="${leaderAvatar}" class="w-full h-full object-cover">
                                        </div>
                                        <span class="text-xs font-black text-slate-600">${leaderName}</span>
                                    </div>
                                    ${toBadge}
                                </div>
                                ${actionBtn}
                            </div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = listHtml;
            Boako.TeamList.renderPagination(count);

        } catch (err) {
            console.error("팀 목록 로드 실패:", err);
            container.innerHTML = `<div class="col-span-full text-center py-10 text-red-500 font-bold text-sm bg-red-50 rounded-xl">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
        }
    },

    renderPagination: (totalCount) => {
        const container = document.getElementById('team-pagination-container');
        const totalPages = Math.ceil(totalCount / Boako.TeamList.itemsPerPage);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const isFirstPage = Boako.TeamList.currentPage === 1;
        const isLastPage = Boako.TeamList.currentPage === totalPages;

        const prevDisabledClass = isFirstPage ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer shadow-sm';
        const nextDisabledClass = isLastPage ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer shadow-sm';
        
        const prevClick = isFirstPage ? '' : `onclick="Boako.TeamList.loadTeams(${Boako.TeamList.currentPage - 1})"`;
        const nextClick = isLastPage ? '' : `onclick="Boako.TeamList.loadTeams(${Boako.TeamList.currentPage + 1})"`;

        container.innerHTML = `
            <button ${prevClick} class="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 transition-all ${prevDisabledClass}"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
            <span class="text-sm font-black text-slate-700 mx-2 bg-slate-100 px-4 py-2 rounded-xl">${Boako.TeamList.currentPage} <span class="text-slate-400">/ ${totalPages}</span></span>
            <button ${nextClick} class="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 transition-all ${nextDisabledClass}"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
        `;
        
        if(typeof lucide !== 'undefined') lucide.createIcons();
    },

    // 🌟 가입 문의 발송 로직 (팀장이 [수락/거절] 버튼을 띄울 수 있도록 JSON 페이로드 발송)
    requestJoin: async (teamName, leaderName, teamId) => {
        if (!Boako.state.user) {
            Boako.Util.toast("카카오 로그인이 필요합니다.");
            return;
        }
        if (Boako.state.team) {
            Boako.Util.toast("❌ 현재 소속된 팀이 있습니다. 이적을 원하시면 먼저 탈퇴해 주세요.");
            return;
        }
        if (!confirm(`[${teamName}] 팀장(${leaderName})님에게 가입 신청 쪽지를 보내시겠습니까?`)) return;

        try {
            const { data: leaderProfile, error: profileErr } = await Boako.db
                .from('profiles')
                .select('id')
                .eq('full_name', leaderName)
                .single();

            if (profileErr || !leaderProfile) throw new Error("팀장 정보를 찾을 수 없습니다.");

            // 🌟 핵심 변경 포인트: 쪽지 내용을 단순 텍스트가 아닌 JSON 구조로 묶어서 보냅니다.
            // 그래야 메신저에서 이 데이터를 뜯어서 [수락] [거절] 버튼에 teamId와 신청자 정보를 연결할 수 있습니다.
            const payload = {
                sender_id: Boako.state.user.id,
                receiver_id: leaderProfile.id,
                
                // 단순 텍스트가 아닌 JSON으로 압축해서 전송!
                content: JSON.stringify({
                    text: `👋 안녕하세요! [${teamName}] 팀에 가입을 신청합니다!`,
                    team_id: teamId,
                    team_name: teamName
                }),
                
                // 🌟 액션 타입을 'TEAM_JOIN'으로 명시! (메신저가 이걸 보고 버튼을 띄울 겁니다)
                action_type: 'TEAM_JOIN' 
            };

            const { error: msgErr } = await Boako.db.from('messages').insert([payload]);
            if (msgErr) throw msgErr;

            Boako.Util.toast("🎉 성공! 팀장에게 가입 신청 쪽지가 발송되었습니다.");

        } catch (err) {
            console.error("가입 신청 실패:", err);
            Boako.Util.toast("❌ 쪽지 발송 실패: " + err.message);
        }
    }
};
