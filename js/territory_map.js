/**
 * [TERRITORY MAP] 전적기록실 "히스토리" 탭 — 최근 90일 RP 비중 기반 세력지도
 * 목적: "역대 기록 아카이브"가 아니라 "최근 활동 독려" — 최근 90일치 RP만 보고,
 *       팀 소속 유저의 개인 RP를 팀 안 팀원별 서브블록으로 표시(팀 미소속은 개인 단위).
 *       세력 크기는 절대 RP가 아니라 그 시점 전체 대비 상대 비중으로 계산 (sqrt(share)를
 *       가중치로 쓰는 weighted Voronoi 근사 — 절대 RP가 아니라 상대 비중이라 모두가 같이
 *       커져도 화면상 크기는 그대로, 상대 순위가 바뀔 때만 경계가 움직임).
 * 팀 소속: team_members.is_active 기준 "지금" 소속으로 묶음 (기록 시점 스냅샷 b_all_team 아님).
 * 🌟 [좌표 방식 변경] 방향(각도)은 golden-angle spiral로 개체별 영구 고정(개체 늘어나도 기존
 *    개체 방향은 안 흔들림, 정렬 기준은 "최근 90일 내 첫 활동일"). 대신 중심으로부터의 거리는
 *    고정이 아니라 "그날의 순위"로 매번 다시 계산 — 1등은 항상 정중앙(거리 0), 순위가 밀릴수록
 *    자기 방향선을 따라 바깥쪽으로. 그래서 신흥 강자는 가장자리에서 나타나 중앙으로 다가오며
 *    커지고, 밀리는 쪽은 중앙에서 바깥으로 밀려남 — 보로노이 경계 밀림과 합쳐져 서로 부딪히며
 *    영역을 다투는 느낌을 냄. 팀 안 팀원 배치도 팀 내부 순위 기준으로 동일하게 적용.
 * 시각화: 화면 전체를 빈틈없이 채우는 보로노이 테셀레이션. 진한 경계선=팀/개인 간 경계,
 *        얇은 경계선=팀 안 팀원 간 경계. 라벨(닉네임/팀명)은 실제로 칠해진 영역의 무게중심을
 *        따라다님 (경계가 밀려도 라벨이 안 겉돎).
 * 🌟 그 날짜까지 실제 rp 누적이 0인 팀/개인(EPS 제외 순수값)은 그날의 계산에서 통째로 제외
 *    (아직 창단/활동 전인 개체는 안 보임) — 팀 안 개별 팀원 단위로도 동일 적용.
 * 클릭 동작: 아직 미정이라 클릭 핸들러 없음 (추후 결정 시 추가).
 */
Boako.TerritoryMap = {
    WINDOW_DAYS: 90,
    STEP: 3,
    W: 680,
    H: 380,
    dayIndex: 89,
    topEntities: null,
    GOLDEN: 137.5 * Math.PI / 180,

    HUES: [
        { 200:'#F0997B', 400:'#D85A30', 600:'#993C1D', 800:'#712B13' },
        { 200:'#5DCAA5', 400:'#1D9E75', 600:'#0F6E56', 800:'#085041' },
        { 200:'#AFA9EC', 400:'#7F77DD', 600:'#534AB7', 800:'#3C3489' },
        { 200:'#ED93B1', 400:'#D4537E', 600:'#993556', 800:'#72243E' },
        { 200:'#EF9F27', 400:'#BA7517', 600:'#854F0B', 800:'#633806' },
        { 200:'#85B7EB', 400:'#378ADD', 600:'#185FA5', 800:'#0C447C' }
    ],
    NATIONAL_BORDER: '#241a12',

    kstDateStr: function(dateInput) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateInput));
    },

    windowStartKst: function() {
        const todayStr = this.kstDateStr(new Date());
        const todayKst = new Date(todayStr + 'T00:00:00+09:00');
        return new Date(todayKst.getTime() - (this.WINDOW_DAYS - 1) * 86400000);
    },

    dayIndexOf: function(createdAtIso) {
        const dStr = this.kstDateStr(createdAtIso);
        const d = new Date(dStr + 'T00:00:00+09:00');
        const idx = Math.round((d - this.windowStartKst()) / 86400000);
        return Math.max(0, Math.min(this.WINDOW_DAYS - 1, idx));
    },

    formatDateLabel: function(idx) {
        const d = new Date(this.windowStartKst().getTime() + idx * 86400000);
        return this.kstDateStr(d).replace(/-/g, '.');
    },

    buildUI: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                <label for="tm-day-slider" style="font-size:13px; font-weight:800; color:#64748b; white-space:nowrap;">날짜</label>
                <input type="range" id="tm-day-slider" min="0" max="${this.WINDOW_DAYS - 1}" step="1" value="${this.dayIndex}" style="flex:1;">
                <span id="tm-day-label" style="font-size:13px; font-weight:900; color:#1e293b; min-width:90px; text-align:right;"></span>
            </div>
            <div id="tm-wrap" style="position:relative; width:100%; border-radius:16px; overflow:hidden; background:#f8fafc; border:1px solid #e2e8f0;">
                <canvas id="tm-canvas"></canvas>
            </div>
            <p style="font-size:11px; color:#94a3b8; font-weight:700; margin-top:10px;">최근 90일간 인증완료된 기록의 RP 비중으로 팀/개인 영역을 나눈 지도입니다. 1등은 정중앙, 순위가 밀릴수록 바깥쪽으로 배치돼요. 슬라이더로 특정 날짜까지의 누적 상황을 볼 수 있어요.</p>
        `;
        this.init();
    },

    init: async function() {
        if (!Boako.db) { setTimeout(() => this.init(), 300); return; }
        const wrap = document.getElementById('tm-wrap');
        try {
            const windowStartIso = this.windowStartKst().toISOString();
            const [{ data: teams, error: tErr }, { data: members, error: mErr }, { data: records, error: rErr }] = await Promise.all([
                Boako.db.from('teams').select('id, team_name, logo_url').order('id', { ascending: true }),
                Boako.db.from('team_members').select('team_name, player_name, joined_at').eq('is_active', true),
                Boako.db.from('v_boako_total_records').select('nickname, created_at, rp').eq('is_verified', 0).gte('created_at', windowStartIso)
            ]);
            if (tErr) throw tErr;
            if (mErr) throw mErr;
            if (rErr) throw rErr;

            this.buildModel(teams || [], members || [], records || []);

            if (this.topEntities.length === 0) {
                if (wrap) wrap.innerHTML = `<div style="padding:60px; text-align:center; color:#94a3b8; font-weight:700;">최근 90일간 인증된 기록이 없습니다.</div>`;
                return;
            }

            this.setupDom();
            this.render(this.dayIndex);
        } catch (err) {
            console.error('세력지도 데이터 로드 실패:', err);
            if (wrap) wrap.innerHTML = `<div style="padding:60px; text-align:center; color:#f87171; font-weight:700;">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    buildModel: function(teams, members, records) {
        const memberToTeam = {};
        members.forEach(m => { memberToTeam[m.player_name] = m.team_name; });

        const teamByName = {};
        teams.forEach(t => { teamByName[t.team_name] = { name: t.team_name, logoUrl: t.logo_url, members: {} }; });

        members.forEach(m => {
            const t = teamByName[m.team_name];
            if (!t) return;
            t.members[m.player_name] = { name: m.player_name, joinedAt: m.joined_at, daily: new Array(this.WINDOW_DAYS).fill(0), firstDay: null };
        });

        const solos = {};

        records.forEach(r => {
            const nick = r.nickname;
            if (!nick) return;
            const idx = this.dayIndexOf(r.created_at);
            const teamName = memberToTeam[nick];
            if (teamName && teamByName[teamName] && teamByName[teamName].members[nick]) {
                const m = teamByName[teamName].members[nick];
                m.daily[idx] += (r.rp || 0);
                if (m.firstDay === null) m.firstDay = idx;
            } else {
                if (!solos[nick]) solos[nick] = { name: nick, daily: new Array(this.WINDOW_DAYS).fill(0), firstDay: null };
                solos[nick].daily[idx] += (r.rp || 0);
                if (solos[nick].firstDay === null) solos[nick].firstDay = idx;
            }
        });

        const activeTeams = Object.values(teamByName)
            .map(t => {
                t.memberList = Object.values(t.members)
                    .filter(m => m.firstDay !== null)
                    .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
                return t;
            })
            .filter(t => t.memberList.length > 0);
        activeTeams.forEach(t => { t.firstDay = Math.min(...t.memberList.map(m => m.firstDay)); });

        const activeSolos = Object.values(solos).filter(s => s.firstDay !== null);

        this.topEntities = [
            ...activeTeams.map(t => ({ kind: 'team', key: t.name, firstDay: t.firstDay, team: t })),
            ...activeSolos.map(s => ({ kind: 'solo', key: s.name, firstDay: s.firstDay, solo: s }))
        ].sort((a, b) => a.firstDay - b.firstDay);
    },

    weightOf: function(share) { return Math.sqrt(Math.max(0, share)); },

    setupDom: function() {
        const canvas = document.getElementById('tm-canvas');
        this.ctx = canvas.getContext('2d');
        this.canvasEl = canvas;
        this.resize();

        window.addEventListener('resize', () => { this.resize(); this.render(this.dayIndex); });

        const slider = document.getElementById('tm-day-slider');
        slider.addEventListener('input', () => {
            this.dayIndex = parseInt(slider.value, 10);
            this.render(this.dayIndex);
        });

        this.labelDivs = {};
        const wrap = document.getElementById('tm-wrap');
        const makeLabel = () => {
            const el = document.createElement('div');
            el.style.cssText = 'position:absolute; transform:translate(-50%,-50%); pointer-events:none; text-align:center; white-space:nowrap;';
            wrap.appendChild(el);
            return el;
        };
        this.topEntities.forEach(e => {
            if (e.kind === 'team') {
                this.labelDivs[e.key + '-team'] = makeLabel();
                e.team.memberList.forEach(m => { this.labelDivs[m.name] = makeLabel(); });
            } else {
                this.labelDivs[e.key] = makeLabel();
            }
        });
    },

    resize: function() {
        const wrap = document.getElementById('tm-wrap');
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        this.W = Math.max(320, Math.round(rect.width));
        this.H = Math.round(this.W * (380 / 680));
        this.canvasEl.width = this.W;
        this.canvasEl.height = this.H;
        this.canvasEl.style.width = this.W + 'px';
        this.canvasEl.style.height = this.H + 'px';
        this.computeAnchors();
    },

    // 🌟 방향(각도)만 개체별로 영구 고정. 거리(중심에서 얼마나 떨어졌는지)는 render()에서
    // 그날의 순위로 매번 다시 계산함 — 그래서 여기선 반지름 스텝(스케일)만 같이 갱신해둠.
    computeAnchors: function() {
        this.scaleTop = this.W / 30;
        this.scaleMember = this.scaleTop * 0.7;
        this.topEntities.forEach((e, i) => {
            e.angle = i * this.GOLDEN;
            if (e.kind === 'team') {
                e.team.memberList.forEach((m, mi) => { m.angle = mi * this.GOLDEN; });
            }
        });
    },

    render: function(dayIdx) {
        const label = document.getElementById('tm-day-label');
        if (label) label.textContent = this.formatDateLabel(dayIdx);

        const EPS = 0.05;
        const sumUpTo = (arr) => arr.slice(0, dayIdx + 1).reduce((a, b) => a + b, 0);

        // 🌟 그 날짜까지 실제 활동(rp)이 0인 팀/개인은 지도에서 아예 제외 (아직 창단/활동 전)
        const topRaw = this.topEntities
            .map((e, i) => {
                const rawValue = e.kind === 'team'
                    ? e.team.memberList.reduce((s, m) => s + sumUpTo(m.daily), 0)
                    : sumUpTo(e.solo.daily);
                return { e, rawValue, hueIdx: i % this.HUES.length };
            })
            .filter(x => x.rawValue > 0)
            .map(x => Object.assign({}, x, { value: x.rawValue + EPS }));

        // 라벨은 매번 전부 비우고, 이번 날짜에 실제로 존재하는 개체만 다시 채움
        Object.values(this.labelDivs).forEach(el => { el.innerHTML = ''; });

        const ctx = this.ctx;
        if (topRaw.length === 0) {
            ctx.clearRect(0, 0, this.W, this.H);
            return;
        }

        // 🌟 [핵심] 그날 순위로 중심으로부터의 거리를 결정 — 1등(rankIdx 0)은 거리 0(정중앙),
        // 순위가 밀릴수록 자기 고정 방향(e.angle)을 따라 바깥쪽으로. 방향 자체는 안 바뀜.
        const cx = this.W / 2, cy = this.H / 2;
        const ranked = topRaw.slice().sort((a, b) => b.value - a.value);
        ranked.forEach((x, rankIdx) => {
            const dist = this.scaleTop * rankIdx;
            x.e.cx = cx + dist * Math.cos(x.e.angle);
            x.e.cy = cy + dist * Math.sin(x.e.angle);
        });

        const topSum = topRaw.reduce((s, x) => s + x.value, 0);
        topRaw.forEach(x => { x.weight = this.weightOf(x.value / topSum); });

        const memberWeightsByTeam = {};
        topRaw.forEach(x => {
            if (x.e.kind !== 'team') return;
            const activeMembers = x.e.team.memberList
                .map((m, mi) => ({ m, mi, raw: sumUpTo(m.daily) }))
                .filter(o => o.raw > 0);

            // 팀원도 동일 원리: 방향(m.angle)은 고정, 팀 내부 그날 순위로 팀 중심에서의 거리만 결정
            const rankedMembers = activeMembers.slice().sort((a, b) => b.raw - a.raw);
            rankedMembers.forEach((o, rankIdx) => {
                const dist = this.scaleMember * rankIdx;
                o.m.dx = dist * Math.cos(o.m.angle);
                o.m.dy = dist * Math.sin(o.m.angle);
            });

            const raws = activeMembers.map(o => o.raw + EPS);
            const sum = raws.reduce((a, b) => a + b, 0);
            memberWeightsByTeam[x.e.key] = activeMembers.map((o, idx) => ({ m: o.m, mi: o.mi, weight: this.weightOf(raws[idx] / sum) }));
        });

        const W = this.W, H = this.H, STEP = this.STEP;
        const COLS = Math.ceil(W / STEP), ROWS = Math.ceil(H / STEP);
        const topKeyGrid = new Array(ROWS), ownerKeyGrid = new Array(ROWS), fillGrid = new Array(ROWS);
        const topCentroid = {}, ownerCentroid = {};

        for (let r = 0; r < ROWS; r++) {
            topKeyGrid[r] = new Array(COLS); ownerKeyGrid[r] = new Array(COLS); fillGrid[r] = new Array(COLS);
            const y = r * STEP + STEP / 2;
            for (let c = 0; c < COLS; c++) {
                const x = c * STEP + STEP / 2;
                let best = null, bestRatio = Infinity;
                for (let i = 0; i < topRaw.length; i++) {
                    const t = topRaw[i];
                    const d = Math.hypot(x - t.e.cx, y - t.e.cy);
                    const ratio = d / t.weight;
                    if (ratio < bestRatio) { bestRatio = ratio; best = t; }
                }
                let ownerKey, fillColor;
                const hue = this.HUES[best.hueIdx];
                if (best.e.kind === 'solo') {
                    ownerKey = best.e.key; fillColor = hue[400];
                } else {
                    const mws = memberWeightsByTeam[best.e.key];
                    let bestM = null, bestMi = 0, bestMR = Infinity;
                    mws.forEach((info) => {
                        const mx = best.e.cx + info.m.dx, my = best.e.cy + info.m.dy;
                        const d = Math.hypot(x - mx, y - my);
                        const ratio = d / info.weight;
                        if (ratio < bestMR) { bestMR = ratio; bestM = info; bestMi = info.mi; }
                    });
                    ownerKey = bestM.m.name;
                    fillColor = hue[bestMi % 2 === 0 ? 400 : 200];
                }
                topKeyGrid[r][c] = best.e.key; ownerKeyGrid[r][c] = ownerKey; fillGrid[r][c] = fillColor;
                const tc = topCentroid[best.e.key] || (topCentroid[best.e.key] = { sx: 0, sy: 0, n: 0 });
                tc.sx += x; tc.sy += y; tc.n++;
                const oc = ownerCentroid[ownerKey] || (ownerCentroid[ownerKey] = { sx: 0, sy: 0, n: 0 });
                oc.sx += x; oc.sy += y; oc.n++;
            }
        }

        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { ctx.fillStyle = fillGrid[r][c]; ctx.fillRect(c * STEP, r * STEP, STEP + 1, STEP + 1); }

        const hueByTop = {};
        topRaw.forEach(x => { hueByTop[x.e.key] = this.HUES[x.hueIdx]; });

        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (c < COLS - 1 && ownerKeyGrid[r][c] !== ownerKeyGrid[r][c + 1]) {
                const thick = topKeyGrid[r][c] !== topKeyGrid[r][c + 1];
                ctx.fillStyle = thick ? this.NATIONAL_BORDER : hueByTop[topKeyGrid[r][c]][800];
                const bw = thick ? 2.4 : 1.2;
                ctx.fillRect((c + 1) * STEP - bw / 2, r * STEP, bw, STEP + 1);
            }
            if (r < ROWS - 1 && ownerKeyGrid[r][c] !== ownerKeyGrid[r + 1][c]) {
                const thick = topKeyGrid[r][c] !== topKeyGrid[r + 1][c];
                ctx.fillStyle = thick ? this.NATIONAL_BORDER : hueByTop[topKeyGrid[r][c]][800];
                const bh = thick ? 2.4 : 1.2;
                ctx.fillRect(c * STEP, (r + 1) * STEP - bh / 2, STEP + 1, bh);
            }
        }

        const centroidOf = (dict, key, fx, fy) => {
            const e = dict[key];
            if (!e || e.n === 0) return { x: fx, y: fy };
            return { x: e.sx / e.n, y: e.sy / e.n };
        };

        topRaw.forEach(x => {
            const e = x.e;
            if (e.kind === 'team') {
                const total = e.team.memberList.reduce((s, m) => s + sumUpTo(m.daily), 0);
                const center = centroidOf(topCentroid, e.key, e.cx, e.cy);
                const el = this.labelDivs[e.key + '-team'];
                el.style.left = center.x + 'px'; el.style.top = Math.max(16, center.y - 46) + 'px';
                const logoHtml = e.team.logoUrl
                    ? `<img src="${Boako.Util.cdn(e.team.logoUrl)}" style="width:20px; height:20px; object-fit:contain; border-radius:4px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.4);">`
                    : `<span style="width:20px; height:20px; border-radius:50%; background:${this.HUES[x.hueIdx][800]}; color:#fff; font-size:10px; font-weight:700; display:inline-flex; align-items:center; justify-content:center;">${e.key.charAt(0)}</span>`;
                el.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; gap:5px;">${logoHtml}<span style="font-size:13px; font-weight:800; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.6);">${e.key}</span></div>
                    <div style="font-size:11px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.6); margin-top:2px;">${Math.round(total)} RP</div>`;
                const mws = memberWeightsByTeam[e.key] || [];
                mws.forEach(info => {
                    const m = info.m;
                    const mCenter = centroidOf(ownerCentroid, m.name, e.cx + m.dx, e.cy + m.dy);
                    const mel = this.labelDivs[m.name];
                    mel.style.left = mCenter.x + 'px'; mel.style.top = mCenter.y + 'px';
                    mel.innerHTML = `<div style="font-size:11px; font-weight:600; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.6);">${m.name}</div>`;
                });
            } else {
                const total = sumUpTo(e.solo.daily);
                const center = centroidOf(ownerCentroid, e.key, e.cx, e.cy);
                const el = this.labelDivs[e.key];
                el.style.left = center.x + 'px'; el.style.top = center.y + 'px';
                el.innerHTML = `<div style="font-size:13px; font-weight:700; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.6);">${e.key}</div>
                    <div style="font-size:11px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.6);">${Math.round(total)} RP</div>`;
            }
        });
    }
};
