/**
 * [SEARCH] 헤더 통합검색 결과 페이지 — 팀 / 유저 / 게시글 / 게임명 전체 검색
 */
Boako.Search = {
    lastQuery: '',

    init: async (containerId, query) => {
        Boako.Search.lastQuery = query || '';
        const container = document.getElementById(containerId);
        if (!container) return;

        // 🌟 큰 배너 박스 대신 간단한 텍스트 헤더 + 보라색 밑줄 하나만
        container.innerHTML = `
            <div style="margin-bottom:20px;">
                <div style="font-size:20px; font-weight:900; color:#1e293b;">🔍 통합 검색</div>
                <div style="font-size:14px; font-weight:700; color:#64748b; margin-top:4px;">"${Boako.Search.escapeHtml(query)}" 검색 결과</div>
                <div style="height:3px; background:linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border-radius:3px; margin-top:14px;"></div>
            </div>
            <div id="search-results-body">
                <div style="text-align:center; padding:60px; color:#94a3b8; font-weight:700;">검색 중...</div>
            </div>
        `;

        if (!query) {
            document.getElementById('search-results-body').innerHTML = `
                <div style="text-align:center; padding:60px; color:#94a3b8; font-weight:700;">검색어를 입력해주세요.</div>
            `;
            return;
        }

        try {
            const [teams, users, posts, games] = await Promise.all([
                Boako.Search.searchTeams(query),
                Boako.Search.searchUsers(query),
                Boako.Search.searchPosts(query),
                Boako.Search.searchGames(query),
            ]);
            Boako.Search.render({ teams, users, posts, games });
        } catch (err) {
            console.error('통합검색 실패:', err);
            const body = document.getElementById('search-results-body');
            if (body) body.innerHTML = `<div style="text-align:center; padding:60px; color:#ef4444; font-weight:700;">검색 중 오류가 발생했습니다.</div>`;
        }
    },

    searchTeams: async (query) => {
        const { data, error } = await Boako.db
            .from('teams')
            .select('id, team_name, logo_url, leader_name')
            .ilike('team_name', `%${query}%`)
            .limit(20);
        if (error) { console.error('팀 검색 실패:', error); return []; }
        return data || [];
    },

    searchUsers: async (query) => {
        const { data, error } = await Boako.db
            .from('profiles')
            .select('id, full_name, profile_url, custom_avatar_url')
            .ilike('full_name', `%${query}%`)
            .limit(20);
        if (error) { console.error('유저 검색 실패:', error); return []; }
        return data || [];
    },

    searchPosts: async (query) => {
        const { data, error } = await Boako.db
            .from('board_posts')
            .select('id, title, category, game_name, created_at')
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
            .eq('is_deleted', false)
            .eq('is_draft', false)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) { console.error('게시글 검색 실패:', error); return []; }
        return data || [];
    },

    searchGames: async (query) => {
        const { data, error } = await Boako.db
            .from('games')
            .select('id, game_name, image_url')
            .ilike('game_name', `%${query}%`)
            .limit(20);
        if (error) { console.error('게임 검색 실패:', error); return []; }
        return data || [];
    },

    render: ({ teams, users, posts, games }) => {
        const body = document.getElementById('search-results-body');
        if (!body) return;

        const totalCount = teams.length + users.length + posts.length + games.length;

        if (totalCount === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:80px 20px; color:#94a3b8;">
                    <div style="font-size:40px; margin-bottom:12px;">🔍</div>
                    <h3 style="font-weight:900; font-size:18px; color:#64748b;">검색 결과가 없습니다.</h3>
                    <p style="font-size:13px; margin-top:6px;">다른 검색어로 다시 시도해보세요.</p>
                </div>
            `;
            return;
        }

        const section = (title, icon, count, itemsHtml) => count > 0 ? `
            <section class="section-card">
                <div class="card-header" style="font-size:16px;">${icon} ${title} <span style="color:#94a3b8; font-weight:700;">(${count})</span></div>
                <div class="card-body" style="padding:20px 25px;">
                    ${itemsHtml}
                </div>
            </section>
        ` : '';

        const teamsHtml = teams.map(t => `
            <div class="search-result-item" onclick="Boako.Util.navigateToLink('TEAM', '${t.id}')">
                <div class="thumb">${t.logo_url ? `<img src="${Boako.Util.cdn(t.logo_url)}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">` : '🛡️'}</div>
                <div>
                    <div class="title">${Boako.Search.escapeHtml(t.team_name)}</div>
                    <div class="desc">${t.leader_name ? '팀장 ' + Boako.Search.escapeHtml(t.leader_name) : '팀'}</div>
                </div>
            </div>
        `).join('');

        const usersHtml = users.map(u => {
            const avatarUrl = u.custom_avatar_url || u.profile_url;
            return `
            <div class="search-result-item" onclick="Boako.Util.navigateToLink('USER', '${u.id}')">
                <div class="thumb">${avatarUrl ? `<img src="${Boako.Util.cdn(avatarUrl)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤'}</div>
                <div>
                    <div class="title">${Boako.Search.escapeHtml(u.full_name)}</div>
                    <div class="desc">유저</div>
                </div>
            </div>
        `;
        }).join('');

        const postsHtml = posts.map(p => `
            <div class="search-result-item" onclick="Boako.Util.navigateToLink('BOARD_POST', '${p.id}')">
                <div class="thumb">📝</div>
                <div>
                    <div class="title">${Boako.Search.escapeHtml(p.title)}</div>
                    <div class="desc">[${Boako.Search.escapeHtml(p.category || '게시글')}]${p.game_name ? ' · ' + Boako.Search.escapeHtml(p.game_name) : ''}</div>
                </div>
            </div>
        `).join('');

        // 🌟 게임 클릭 시 board.js의 openGuideForGame이 game_name으로 필터링하므로,
        // id가 아니라 game_name 문자열을 link_id로 넘긴다.
        // (onclick 속성 자체가 큰따옴표라서, 인자는 반드시 작은따옴표로 감싸고 내부 작은따옴표만 이스케이프한다)
        const gamesHtml = games.map(g => `
            <div class="search-result-item" onclick="Boako.Util.navigateToLink('GAME', '${(g.game_name || '').replace(/'/g, "\\'")}')">
                <div class="thumb">${g.image_url ? `<img src="${Boako.Util.cdn(g.image_url)}" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">` : '🎲'}</div>
                <div>
                    <div class="title">${Boako.Search.escapeHtml(g.game_name)}</div>
                    <div class="desc">게임 · 공략 게시판 보기</div>
                </div>
            </div>
        `).join('');

        body.innerHTML = [
            section('팀', '🛡️', teams.length, teamsHtml),
            section('유저', '👤', users.length, usersHtml),
            section('게시글', '📝', posts.length, postsHtml),
            section('게임', '🎲', games.length, gamesHtml),
        ].join('');
    },

    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.innerText = str || '';
        return div.innerHTML;
    }
};
