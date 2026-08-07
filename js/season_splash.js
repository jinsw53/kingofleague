/**
 * [SEASON SPLASH] 시즌 진행중/우승팀 로고 스플래시 오버레이
 * 🌟 팀 소속 유저: 사이트 아무 페이지나 접속 시 (auth.js에서 호출) — 하루 1번
 * 🌟 무소속 로그인 유저 / 비로그인 방문객: 랭킹 페이지 진입 시 (view.js에서 호출) — 하루 1번
 * 🌟 오늘 날짜가 start_date~end_date 사이인 시즌이 있으면(=진행 중) 그 시즌 로고,
 *    없고 가장 최근에 끝난 시즌에 season_final_rankings 결과가 확정돼 있으면(=시즌 종료) 우승팀 로고.
 *    둘 다 없으면(아직 시작 전이거나, 끝났는데 결과 미집계) 아무것도 안 띄움.
 * 🌟 로고 진입 애니메이션은 목업(궤적 드로잉 도구로 직접 그린 궤적 + 좌우반전 반복 + 200% 피크)을
 *    그대로 이식. 사운드도 Web Audio로 직접 합성(외부 음원 파일 없음).
 */
Boako.SeasonSplash = {
  _shown: false, // 이번 페이지 로드에서 이미 띄웠으면 중복 방지

  _todayStr: () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }), // YYYY-MM-DD (KST 기준)

  // 🌟 context: 'global'(팀 소속자, 사이트 전체 트리거) | 'ranking'(무소속/비로그인, 랭킹 페이지 트리거)
  // 이 함수 하나로 두 트리거 지점 모두 커버 — 소속 여부에 안 맞는 context는 조용히 무시함
  maybeShow: async (context) => {
    if (Boako.SeasonSplash._shown) return;

    const isTeamMember = !!(Boako.state.team && Boako.state.team.info);
    if (context === 'global' && !isTeamMember) return;   // 팀 소속자 전용 트리거
    if (context === 'ranking' && isTeamMember) return;   // 팀 소속자는 이미 global에서 처리됨 (중복 방지)

    try {
      const today = Boako.SeasonSplash._todayStr();
      const anonKey = 'boako_season_splash_seen';

      if (Boako.state.user) {
        const { data: profile } = await Boako.db.from('profiles').select('tutorial_status').eq('id', Boako.state.user.id).single();
        const status = profile?.tutorial_status || {};
        if (status.season_splash_last_shown === today) return;

        const didShow = await Boako.SeasonSplash._render();
        if (!didShow) return;
        Boako.SeasonSplash._shown = true;

        status.season_splash_last_shown = today;
        await Boako.db.from('profiles').update({ tutorial_status: status }).eq('id', Boako.state.user.id);
      } else {
        if (localStorage.getItem(anonKey) === today) return;
        const didShow = await Boako.SeasonSplash._render();
        if (!didShow) return;
        Boako.SeasonSplash._shown = true;
        localStorage.setItem(anonKey, today);
      }
    } catch (err) {
      console.error('시즌 스플래시 확인 실패:', err);
    }
  },

  // 실제로 오버레이를 그리고, 확인 버튼 눌릴 때까지 기다림. 보여줄 데이터가 없으면 false 반환(하루 소진 처리 안 함).
  _render: async () => {
    let season, champion = null;
    try {
      const nowIso = new Date().toISOString();

      // 1) 오늘 날짜가 start_date~end_date 사이인 "진행 중" 시즌부터 확인
      const { data: liveSeasons } = await Boako.db.from('seasons')
        .select('season_no, title, start_date, end_date, season_logo_url')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso)
        .limit(1);
      season = liveSeasons?.[0];

      if (!season) {
        // 2) 진행 중인 시즌이 없으면, 가장 최근에 끝난 시즌 중 실제로 결과가 확정된 것만 찾음
        const { data: pastSeasons } = await Boako.db.from('seasons')
          .select('season_no, title, start_date, end_date, season_logo_url')
          .lt('end_date', nowIso)
          .order('end_date', { ascending: false })
          .limit(1);
        season = pastSeasons?.[0];
        if (!season) return false; // 아직 시작된 시즌 자체가 없음

        const { data: finals } = await Boako.db.from('season_final_rankings')
          .select('team_name, logo_url')
          .eq('season_no', season.season_no)
          .eq('final_rank', 1)
          .limit(1);
        champion = finals?.[0] || null;
        if (!champion) return false; // 시즌은 끝났지만 아직 결과 집계 전이면 스킵
      }
    } catch (err) {
      console.error('시즌 스플래시 데이터 조회 실패:', err);
      return false;
    }

    const logoUrl = champion ? champion.logo_url : season.season_logo_url;
    if (!logoUrl) return false; // 보여줄 로고가 없으면 스킵

    Boako.SeasonSplash._ensureStyle();

    const fmtDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
    };

    let eyebrowClass, eyebrowText, titleHtml, subText, badgeText;
    if (champion) {
      eyebrowClass = 'champion';
      eyebrowText = '🏆 시즌 종료';
      titleHtml = `${champion.team_name}<br><span style="font-size:16px; color:#fde68a; font-weight:700;">시즌 ${season.season_no} 우승팀</span>`;
      subText = '치열했던 이번 시즌, 축하드려요!';
      badgeText = '🎉 최종 우승';
    } else {
      eyebrowClass = 'ongoing';
      eyebrowText = '🌀 이번 시즌';
      titleHtml = season.title || `시즌 ${season.season_no} 진행 중`;
      subText = '지금 리그가 한창이에요';
      badgeText = `📅 ${fmtDate(season.start_date)} ~ ${fmtDate(season.end_date)}`;
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = 'season-splash-overlay';
      overlay.innerHTML = `
        <div class="ss-wipe-panel ss-left"></div>
        <div class="ss-wipe-panel ss-right"></div>
        <div class="ss-impact-flash" id="ss-impact-flash"></div>
        <div class="ss-card">
          <div class="ss-logo-stage">
            <div class="ss-logo-fly" id="ss-logo-fly"><img src="${Boako.Util.cdn(logoUrl)}" alt="시즌 로고"></div>
          </div>
          <div class="ss-eyebrow ${eyebrowClass}">${eyebrowText}</div>
          <div class="ss-title">${titleHtml}</div>
          <div class="ss-sub">${subText}</div>
          <div class="ss-badge">${badgeText}</div>
          <button class="ss-confirm" id="ss-confirm">확인</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const flash = document.getElementById('ss-impact-flash');
      flash.style.animation = 'ss-impact-flash-anim 0.5s ease 1.06s both';

      Boako.SeasonSplash._playWhoosh(1.15);
      Boako.SeasonSplash._playImpact(1.06);

      document.getElementById('ss-confirm').addEventListener('click', () => {
        overlay.remove();
        resolve();
      }, { once: true });
    }).then(() => true);
  },

  _ensureStyle: () => {
    if (document.getElementById('season-splash-style')) return;
    const style = document.createElement('style');
    style.id = 'season-splash-style';
    style.textContent = `
      #season-splash-overlay {
        position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center;
        background: #0f172a; overflow: hidden;
      }
      .ss-wipe-panel { position: absolute; top: 0; bottom: 0; width: 60%; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); z-index: 3; }
      .ss-wipe-panel.ss-left { left: 0; clip-path: polygon(0 0, 100% 0, 78% 100%, 0% 100%); animation: ss-wipe-in-left 0.5s cubic-bezier(.76,0,.24,1) forwards, ss-wipe-out-left 0.4s cubic-bezier(.76,0,.24,1) 0.85s forwards; }
      .ss-wipe-panel.ss-right { right: 0; clip-path: polygon(22% 0, 100% 0, 100% 100%, 0% 100%); animation: ss-wipe-in-right 0.5s cubic-bezier(.76,0,.24,1) forwards, ss-wipe-out-right 0.4s cubic-bezier(.76,0,.24,1) 0.85s forwards; }
      @keyframes ss-wipe-in-left  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      @keyframes ss-wipe-out-left { to   { transform: translateX(-100%); } }
      @keyframes ss-wipe-in-right  { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes ss-wipe-out-right { to   { transform: translateX(100%); } }
      .ss-wipe-panel.ss-left::after, .ss-wipe-panel.ss-right::after { content: ''; position: absolute; top: 0; bottom: 0; width: 6px; }
      .ss-wipe-panel.ss-left::after { right: -3px; background: #fbbf24; transform: skewX(-12deg); }
      .ss-wipe-panel.ss-right::after { left: -3px; background: #fbbf24; transform: skewX(-12deg); }

      .ss-impact-flash {
        position: absolute; left: calc(50% - 20px); top: 110px; width: 40px; height: 40px; border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%);
        opacity: 0; z-index: 5; pointer-events: none;
      }
      @keyframes ss-impact-flash-anim {
        0%   { transform: scale(0.2); opacity: 0; }
        12%  { transform: scale(7); opacity: 1; }
        45%  { transform: scale(11); opacity: 0; }
        100% { transform: scale(11); opacity: 0; }
      }

      .ss-card { position: relative; z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: 28px; max-width: 420px; }

      .ss-logo-stage { position: relative; width: 214px; height: 100px; }
      .ss-logo-fly { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; animation: ss-fly-curve-in 1.15s linear both; }
      .ss-logo-fly img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 0 24px rgba(99,102,241,.55)); }

      @keyframes ss-fly-curve-in {
            0.0%  { transform: translate(434px, -230px) scale(0.140, 0.140); opacity: 0; }
        2.6%  { transform: translate(404px, -218px) scale(0.143, 0.162); opacity: 1; }
        5.1%  { transform: translate(373px, -207px) scale(0.105, 0.184); }
        7.7%  { transform: translate(342px, -196px) scale(0.025, 0.206); }
        10.3%  { transform: translate(311px, -186px) scale(-0.083, 0.228); }
        12.8%  { transform: translate(280px, -177px) scale(-0.186, 0.250); }
        15.4%  { transform: translate(249px, -167px) scale(-0.264, 0.272); }
        17.9%  { transform: translate(218px, -159px) scale(-0.286, 0.294); }
        20.5%  { transform: translate(186px, -150px) scale(-0.237, 0.316); }
        23.1%  { transform: translate(154px, -142px) scale(-0.118, 0.338); }
        25.6%  { transform: translate(123px, -134px) scale(0.041, 0.361); }
        28.2%  { transform: translate(91px, -125px) scale(0.217, 0.383); }
        30.8%  { transform: translate(59px, -118px) scale(0.360, 0.405); }
        33.3%  { transform: translate(28px, -109px) scale(0.427, 0.427); }
        35.9%  { transform: translate(-4px, -100px) scale(0.397, 0.449); }
        38.5%  { transform: translate(-35px, -91px) scale(0.265, 0.471); }
        41.0%  { transform: translate(-66px, -82px) scale(0.062, 0.493); }
        43.6%  { transform: translate(-98px, -73px) scale(-0.184, 0.515); }
        46.2%  { transform: translate(-129px, -64px) scale(-0.405, 0.537); }
        48.7%  { transform: translate(-160px, -54px) scale(-0.542, 0.559); }
        51.3%  { transform: translate(-191px, -43px) scale(-0.564, 0.581); }
        53.8%  { transform: translate(-222px, -32px) scale(-0.455, 0.603); }
        56.4%  { transform: translate(-252px, -19px) scale(-0.223, 0.625); }
        59.0%  { transform: translate(-282px, -6px) scale(0.081, 0.647); }
        61.5%  { transform: translate(-312px, 7px) scale(0.376, 0.669); }
        64.1%  { transform: translate(-341px, 22px) scale(0.612, 0.691); }
        66.7%  { transform: translate(-369px, 38px) scale(0.713, 0.713); }
        69.2%  { transform: translate(-388px, 62px) scale(0.653, 0.735); }
        71.8%  { transform: translate(-366px, 82px) scale(0.511, 0.900); }
        74.4%  { transform: translate(-334px, 88px) scale(0.152, 1.350); }
        76.9%  { transform: translate(-301px, 89px) scale(-0.701, 2.000); }   /* 최하단, 200% 피크 */
        79.5%  { transform: translate(-268px, 88px) scale(-1.313, 1.750); }
        82.1%  { transform: translate(-236px, 85px) scale(-1.460, 1.500); }
        84.6%  { transform: translate(-204px, 80px) scale(-1.283, 1.320); }
        87.2%  { transform: translate(-171px, 74px) scale(-0.880, 1.180); }
        89.7%  { transform: translate(-140px, 66px) scale(-0.399, 1.100); }
        92.3%  { transform: translate(-108px, 57px) scale(0.124, 1.040); }
        94.9%  { transform: translate(-77px, 48px) scale(0.584, 1.020); }
        97.4%  { transform: translate(-47px, 36px) scale(0.882, 1.000); }
        100.0%  { transform: translate(0px, 0px) scale(1.000, 1.000); }
      }

      .ss-eyebrow { font-size: 12px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; margin-top: 4px; }
      .ss-eyebrow.ongoing { color: #93c5fd; }
      .ss-eyebrow.champion { color: #fbbf24; }

      .ss-title { font-size: 25px; font-weight: 900; color: #fff; line-height: 1.35; clip-path: inset(0 100% 0 0); animation: ss-text-wipe 0.32s ease 1.06s forwards; }
      .ss-sub { font-size: 12.5px; font-weight: 700; color: #cbd5e1; margin: -6px 0 0; clip-path: inset(0 100% 0 0); animation: ss-text-wipe 0.32s ease 1.16s forwards; }
      @keyframes ss-text-wipe { to { clip-path: inset(0 0 0 0); } }

      .ss-badge { font-size: 15px; font-weight: 900; color: #fff; background: rgba(0,0,0,0.3); padding: 7px 20px; border-radius: 999px; opacity: 0; transform: translateY(6px); animation: ss-badge-pop 0.3s ease 1.28s forwards; }
      @keyframes ss-badge-pop { to { opacity: 1; transform: translateY(0); } }

      .ss-confirm { width: 100%; background: #fff; color: #0f172a; font-weight: 900; font-size: 14px; padding: 12px; border-radius: 12px; border: none; cursor: pointer; margin-top: 6px; opacity: 0; animation: ss-badge-pop 0.3s ease 1.38s forwards; }
    `;
    document.head.appendChild(style);
  },

  // ========================================================================
  // 🌟 Web Audio로 직접 합성한 사운드 (외부 음원 파일 없음)
  // ========================================================================
  _audioCtx: null,
  _getAudioCtx: () => {
    if (!Boako.SeasonSplash._audioCtx) {
      Boako.SeasonSplash._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (Boako.SeasonSplash._audioCtx.state === 'suspended') Boako.SeasonSplash._audioCtx.resume();
    return Boako.SeasonSplash._audioCtx;
  },

  _playWhoosh: (duration) => {
    try {
      const ctx = Boako.SeasonSplash._getAudioCtx();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(2600, ctx.currentTime + duration * 0.5);
      filter.frequency.linearRampToValueAtTime(900, ctx.currentTime + duration * 0.92);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + duration * 0.15);
      gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + duration * 0.7);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration * 0.95);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + duration);
    } catch (e) { /* 오디오 자동재생 정책 등으로 실패해도 조용히 무시 */ }
  },

  _tone: (freq, dur, type, startGain, delay) => {
    const ctx = Boako.SeasonSplash._getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + (delay || 0));
    gain.gain.setValueAtTime(startGain, ctx.currentTime + (delay || 0));
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (delay || 0) + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + (delay || 0));
    osc.stop(ctx.currentTime + (delay || 0) + dur);
  },

  _playImpact: (delaySec) => {
    try {
      const t = Boako.SeasonSplash._tone;
      t(70, 0.35, 'triangle', 0.35, delaySec);
      t(140, 0.28, 'sawtooth', 0.2, delaySec);
      t(523.25, 0.5, 'triangle', 0.22, delaySec + 0.03);
      t(659.25, 0.5, 'triangle', 0.2, delaySec + 0.03);
      t(783.99, 0.5, 'triangle', 0.2, delaySec + 0.03);
      t(1046.5, 0.6, 'sine', 0.14, delaySec + 0.05);
    } catch (e) { /* 조용히 무시 */ }
  }
};
