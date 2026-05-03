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
    }
};