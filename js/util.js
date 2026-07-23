/**
 * [UTIL] 공통 유틸리티 (토스트, 프리뷰 + 동적 파일 배달원 + 자동 스크롤)
 * 🌟 sfx.diceRoll: 오늘의 주사위 연출(던지기→포물선→착지→굴러가며 통통 튐(점점 감소)→정지, 총 3초)과
 *    정확히 타이밍을 맞춘 합성 효과음. showDiceRollOverlay의 keyframe 퍼센트/시간을 바꾸면 여기 숫자도 같이 바꿔야 함.
 *    최종 정지(3.0초) 타이밍에는 buy.mp3(실제 음원)를 추가로 재생해서 "보상 획득" 느낌을 강조함.
 * 🌟 [이전] 오늘의 주사위(showDiceRollOverlay/dismissDiceOverlay/tryRollDailyDice)를 board.js에서 이곳으로 이전.
 *    모든 페이지에서 항상 로드되는 파일이라, 게시글 작성뿐 아니라 라이벌전/토너먼트/같이하자 등
 *    "팀 리그 외" 활동 어디서든 하루 1회 무료 주사위를 발동시킬 수 있게 하기 위함 (결제 없는 순수 보상 연출).
 * 🌟 getTitleSponsor / applyTitleSponsorPrefix: 팀 리그 타이틀 스폰서(네이밍권) 공용 조회+표시 함수.
 *    랭킹/대항전/리그콘텐츠/전적기록 4개 배너가 전부 이 함수만 공유해서 사용 (단순 알약 모양 배지, 원래 디자인으로 복원).
 * 🌟 getTitleSponsorForSeason / setTitleSponsorBadge: 전적기록(archive.js) 시즌 드롭다운 전용.
 *    시즌 번호를 직접 받아서 그 시즌의 스폰서만 조회하고, 기존 배지를 지운 뒤 다시 그려서
 *    시즌을 바꿀 때마다 배지가 즉시 갱신되도록 함.
 */
Boako.Util = {
    // 💬 1. 알림창 띄우기 (기존 코드 그대로)
    toast: (msg) => {
        const t = document.getElementById('boako-toast');
        if(!t) return;
        t.innerText = msg; t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    },

    // 🖼️ 2. 이미지 미리보기 (기존 코드 그대로)
    handleImgPreview: (input) => {
        const file = input.files[0];
        const preview = document.getElementById('preview-container');
        const placeholder = document.getElementById('upload-placeholder');
        const img = document.getElementById('logo-preview-img');
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { 
                img.src = e.target.result; 
                preview.style.display = 'flex'; 
                placeholder.style.display = 'none'; 
            }
            reader.readAsDataURL(file);
        }
    },

    // ❌ 3. 이미지 미리보기 삭제 (기존 코드 그대로)
    removeImgPreview: (e) => {
        e.stopPropagation();
        document.getElementById('team_logo').value = "";
        document.getElementById('preview-container').style.display = 'none';
        document.getElementById('upload-placeholder').style.display = 'block';
    },

    // 🚚 4. [신규 추가] 인덱스 다이어트용 동적 파일 배달원 엔진!
    // 호출되면 서버에서 해당 주소의 JS 파일을 실시간으로 수송해 옵니다.
    loadScript: function(src) {
        return new Promise((resolve, reject) => {
            // 이미 로드된 스크립트가 있다면 중복 로드 방지
            if (document.querySelector(`script[src="${src}"]`)) {
                return resolve();
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`파일 배달 실패: ${src}`));
            document.body.appendChild(script);
        });
    }, // <-- 🌟 쉼표(,) 추가됨

    // 🎯 5. [신규 추가] 메뉴바 자동 스크롤 엔진!
    // 인벤토리/팀쳇 클릭 시 해당 메뉴가 화면 중앙으로 스르륵 따라오게 만듭니다.
    scrollToMenu: (menuId) => {
        const targetBtn = document.getElementById(menuId);
        if (targetBtn) {
            targetBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    },

    // 🌟 [신규] 이미지 URL을 클라우드플레어 CDN 주소로 바꿔치는 함수
    // 저장은 원본 슈파베이스 주소 그대로 두고, 화면에 그릴 때만 여기를 거쳐서 캐싱 혜택을 받음
    cdn: (url) => {
        if (!url || typeof url !== 'string') return url;
        return url
            .replace(/^http:\/\//i, 'https://')
            .replace('qrredwrxdnvqwdxzanba.supabase.co', 'cdn.boakoarchive.co.kr');
    },

    // 🌟 [신규] 헤더 통합 검색바 실행 — 입력값을 읽어서 검색 결과 페이지로 이동
    executeSearch: () => {
        const inputEl = document.getElementById('main-search');
        if (!inputEl) return;
        const query = inputEl.value.trim();
        if (!query) {
            Boako.Util.toast('검색어를 입력해주세요!');
            return;
        }
        Boako.View.render('search', query);
    },

    // 🌟 [신규] 실시간 이슈/소식지/전광판/검색결과 공통 이동 라우터
    // link_type + link_id만 주면 알맞은 화면으로 이동시켜줌
    navigateToLink: async (linkType, linkId) => {
        try {
            switch (linkType) {
                case 'BOARD_POST':
                    await Boako.View.render('board');
                    setTimeout(() => {
                        if (Boako.Board && typeof Boako.Board.openDetail === 'function') {
                            Boako.Board.openDetail(Number(linkId));
                        }
                    }, 150);
                    break;
                case 'TOURNAMENT':
                    await Boako.View.render('tournament');
                    break;
                case 'TOGETHER_POST':
                    await Boako.View.render('together');
                    break;
                case 'RIVAL_MATCH':
                    await Boako.View.render('rival');
                    break;
                case 'TEAM':
                    await Boako.View.render('team_list');
                    break;
                case 'SEASON_RANKING':
                    await Boako.View.render('ranking');
                    break;
                case 'CHALLENGE':
                case 'GRANDPRIX':
                    await Boako.View.render('league');
                    break;
                case 'GAME':
                    // 🌟 [수정] 검색결과의 '게임' 항목 클릭 시 리그 콘텐츠가 아니라
                    // 그 게임의 공략 게시판으로 바로 진입 (linkId = 게임명 문자열)
                    await Boako.View.render('board');
                    setTimeout(() => {
                        if (Boako.Board && typeof Boako.Board.openGuideForGame === 'function') {
                            Boako.Board.openGuideForGame(linkId);
                        }
                    }, 150);
                    break;
                case 'USER':
                    // 🌟 [신규] 검색결과의 '유저' 항목 클릭 시 팀 목록에서 소속 팀을 찾아보도록 안내
                    await Boako.View.render('team_list');
                    break;
                default:
                    console.warn('알 수 없는 link_type:', linkType);
            }
        } catch (err) {
            console.error('링크 이동 실패:', err);
        }
    },

    // 🎨 6. [신규] 네이티브 <select> 대체용 공용 커스텀 드롭다운
    //    options: [{ value, label }], onSelectFn: 문자열로 된 전역 함수 경로 (예: 'Boako.Match.Chat.changeFixedTime')
    renderCSelect: (id, options, selectedValue, buttonClass, onSelectFn) => {
        const selectedOpt = options.find(o => String(o.value) === String(selectedValue)) || options[0] || { label: '' };
        const itemsHtml = options.map(o => `
            <div onclick="Boako.Util.selectCSelect('${id}', '${String(o.value).replace(/'/g, "\\'")}', '${String(o.label).replace(/'/g, "\\'")}', '${onSelectFn}')"
                 class="px-3 py-2 text-xs font-bold cursor-pointer hover:bg-indigo-50 transition-colors ${String(o.value) === String(selectedValue) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}">
                ${o.label}
            </div>
        `).join('');

        return `
            <div class="relative" id="cselect-${id}">
                <button type="button" onclick="event.stopPropagation(); Boako.Util.toggleCSelect('${id}')" class="${buttonClass} flex justify-between items-center gap-2">
                    <span id="cselect-${id}-label">${selectedOpt.label}</span>
                    <svg class="w-3 h-3 shrink-0 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"></path></svg>
                </button>
                <div id="cselect-${id}-menu" class="hidden absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg custom-scrollbar">
                    ${itemsHtml}
                </div>
            </div>
        `;
    },

    toggleCSelect: (id) => {
        // 다른 곳에 열려있는 드롭다운은 전부 닫고 이것만 토글
        document.querySelectorAll('[id^="cselect-"][id$="-menu"]').forEach(el => {
            if (el.id !== `cselect-${id}-menu`) el.classList.add('hidden');
        });
        document.getElementById(`cselect-${id}-menu`)?.classList.toggle('hidden');
    },

    selectCSelect: (id, value, label, onSelectFn) => {
        const labelEl = document.getElementById(`cselect-${id}-label`);
        if (labelEl) labelEl.innerText = label;
        document.getElementById(`cselect-${id}-menu`)?.classList.add('hidden');

        if (onSelectFn) {
            const fn = onSelectFn.split('.').reduce((o, k) => (o ? o[k] : undefined), window);
            if (typeof fn === 'function') fn(value);
        }
    },

    // ========== 🌟 [이전됨: board.js → util.js] 오늘의 주사위 (하루 1회 무료 보상 연출) ==========
    // 옆에서 툭 던져짐(포물선) → 착지 → 데구르르 굴러가며 통통 튐(점점 잦아듦) → 정지 (dice: 1~6). 총 3초.
    // 굴러가는 동안 눈이 실제로 랜덤하게 계속 바뀌다가 착지 직전(2.85초)에 진짜 결과값으로 고정됨.
    // 자동으로 안 사라지고 클릭해야 닫힘. 결제 없는 순수 활동 보상이라 게시글/라이벌전/토너먼트/같이하자 등
    // "팀 리그 외" 활동 어디서든 호출 가능 (fn_roll_daily_dice가 유저+날짜 기준으로 하루 1회만 보장).
    showDiceRollOverlay: (dice) => {
        if (document.getElementById('board-dice-overlay')) return;

        if (!document.getElementById('board-dice-style')) {
            const style = document.createElement('style');
            style.id = 'board-dice-style';
            style.innerHTML = `
                @keyframes board-dice-roll-in {
                    0%   { transform: translateX(-160vw) translateY(-40px) rotate(0deg) scale(0.85); opacity: 0; }
                    6%   { opacity: 1; }
                    35%  { transform: translateX(-45vw) translateY(-160px) rotate(540deg) scale(1.05); }
                    55%  { transform: translateX(0) translateY(0) rotate(1080deg) scale(1); }
                    65%  { transform: translateX(0) translateY(-38px) rotate(1170deg); }
                    75%  { transform: translateX(0) translateY(0) rotate(1260deg); }
                    83%  { transform: translateX(0) translateY(-16px) rotate(1305deg); }
                    90%  { transform: translateX(0) translateY(0) rotate(1350deg); }
                    95%  { transform: translateX(0) translateY(-5px) rotate(1372deg); }
                    100% { transform: translateX(0) translateY(0) rotate(1440deg) scale(1); }
                }
                @keyframes board-dice-caption-in {
                    from { opacity: 0; transform: translateY(10px) scale(0.9); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes board-dice-hint-in {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes board-dice-fade-out {
                    from { opacity: 1; }
                    to   { opacity: 0; }
                }
                .board-dice-face { animation: board-dice-roll-in 3s linear forwards; }
                .board-dice-caption { animation: board-dice-caption-in 0.35s ease-out 2.95s both; }
                .board-dice-hint { animation: board-dice-hint-in 0.4s ease-out 3.45s both; }
                .board-dice-overlay-exit { animation: board-dice-fade-out 0.35s ease-in forwards; }
            `;
            document.head.appendChild(style);
        }

        const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        const overlay = document.createElement('div');
        overlay.id = 'board-dice-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; background:rgba(15,23,42,0.55); backdrop-filter:blur(2px); cursor:pointer;';
        overlay.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:18px;">
                <div class="board-dice-face" style="font-size:130px; line-height:1; color:#fff; filter:drop-shadow(0 14px 22px rgba(0,0,0,0.4));">${faces[1 + Math.floor(Math.random() * 6)]}</div>
                <div class="board-dice-caption" style="background:#ffffff; color:#0f766e; font-weight:900; font-size:17px; padding:12px 26px; border-radius:999px; box-shadow:0 10px 24px rgba(0,0,0,0.25); text-align:center;">
                    🎉 오늘의 주사위: ${dice}눈 · <span style="color:#d97706;">+${dice}P</span> 획득!
                </div>
                <div class="board-dice-hint" style="color:rgba(255,255,255,0.75); font-size:12px; font-weight:700;">화면을 탭하면 닫혀요</div>
            </div>
        `;
        overlay.addEventListener('click', () => Boako.Util.dismissDiceOverlay());
        document.body.appendChild(overlay);

        // 🌟 구르는 동안 눈이 실제로 랜덤하게 바뀌다가(점점 느려짐), 착지 직전(2.85초)에 진짜 결과값으로 고정
        const faceEl = overlay.querySelector('.board-dice-face');
        const cycleUntilMs = 2850; // CSS 애니메이션의 마지막 잔진동(95%=2.85초) 지점과 일치
        const cycleStart = performance.now();
        (function cycleFace() {
            if (!document.body.contains(faceEl)) return; // 오버레이가 이미 닫혔으면 중단
            const elapsed = performance.now() - cycleStart;
            if (elapsed >= cycleUntilMs) {
                faceEl.textContent = faces[dice] || '🎲';
                return;
            }
            faceEl.textContent = faces[1 + Math.floor(Math.random() * 6)];
            const progress = elapsed / cycleUntilMs;
            const nextDelay = 45 + progress * 220; // 처음엔 빠르게 휙휙, 갈수록 느리게(구르는 속도가 잦아드는 것과 맞춤)
            setTimeout(cycleFace, nextDelay);
        })();
    },

    dismissDiceOverlay: () => {
        const overlay = document.getElementById('board-dice-overlay');
        if (!overlay) return;
        overlay.classList.add('board-dice-overlay-exit');
        setTimeout(() => overlay.remove(), 350);
    },

    // 활동(게시글 작성/라이벌전 제안·수락/토너먼트 개최 신청/같이하자 모집글 등) 성공 직후 호출.
    // 하루 1회만 실제로 지급되고, 그날 이미 어떤 활동으로든 굴렸으면 조용히 무시됨.
    tryRollDailyDice: async () => {
        try {
            const { data, error } = await Boako.db.rpc('fn_roll_daily_dice');
            if (error) throw error;
            if (data && data.rolled) {
                if (window.sfx && window.sfx.diceRoll) window.sfx.diceRoll();
                Boako.Util.showDiceRollOverlay(data.dice);
            }
        } catch (err) {
            console.error('주사위 굴림 처리 실패:', err);
        }
    },

    // ========== 🌟 [신규] 팀 리그 타이틀 스폰서 (네이밍권) ==========
    // 현재 진행 중이거나(없으면) 가장 가까운 다음 시즌의 title_sponsor_name을 조회.
    // 랭킹/대항전/리그콘텐츠/전적기록 4개 배너가 전부 이 함수 하나만 공유해서 씀
    // (한 군데만 고치면 4곳 다 동시에 반영되도록, 로직을 여기 한 곳에만 둠).
    getTitleSponsor: async () => {
        try {
            const nowIso = new Date().toISOString();
            const { data } = await Boako.db.from('seasons')
                .select('season_no, title_sponsor_name')
                .gte('end_date', nowIso)
                .order('start_date', { ascending: true })
                .limit(1)
                .maybeSingle();
            return data?.title_sponsor_name || null;
        } catch (e) {
            console.error('타이틀 스폰서 조회 실패:', e);
            return null;
        }
    },

    // 지정한 엘리먼트(보통 배너의 <h1>)의 맨 앞에 "🏷️ OO배" 배지를 붙임. 스폰서가 없으면 아무것도 안 함.
    applyTitleSponsorPrefix: async (elementId) => {
        const sponsorName = await Boako.Util.getTitleSponsor();
        if (!sponsorName) return;
        const el = document.getElementById(elementId);
        if (!el) return;
        const badge = document.createElement('span');
        badge.style.cssText = 'display:inline-block; background:rgba(255,255,255,0.25); padding:3px 12px; border-radius:999px; font-size:0.55em; font-weight:900; margin-right:10px; vertical-align:middle; letter-spacing:-0.5px;';
        badge.textContent = `🏷️ ${sponsorName}배`;
        el.prepend(badge, ' ');
    },

    // 🌟 [신규] 특정 시즌 번호의 title_sponsor_name을 정확히 조회 (전적기록의 시즌 드롭다운 전용)
    // seasonNo가 'all'/'none'/null이면 특정 시즌이 아니므로 조회하지 않고 null 반환
    getTitleSponsorForSeason: async (seasonNo) => {
        if (seasonNo === 'all' || seasonNo === 'none' || seasonNo === null || seasonNo === undefined) return null;
        try {
            const { data } = await Boako.db.from('seasons')
                .select('title_sponsor_name')
                .eq('season_no', seasonNo)
                .maybeSingle();
            return data?.title_sponsor_name || null;
        } catch (e) {
            console.error('시즌별 타이틀 스폰서 조회 실패:', e);
            return null;
        }
    },

    // 🌟 [신규] 시즌 필터가 바뀔 때마다 배지를 지우고 다시 그리는 버전.
    // applyTitleSponsorPrefix와 달리 기존 배지를 먼저 제거하므로 반복 호출해도 중복으로 쌓이지 않음.
    setTitleSponsorBadge: async (elementId, seasonNo) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        const existing = document.getElementById(`${elementId}-sponsor-badge`);
        if (existing) existing.remove();

        const sponsorName = await Boako.Util.getTitleSponsorForSeason(seasonNo);
        if (!sponsorName) return;

        const badge = document.createElement('span');
        badge.id = `${elementId}-sponsor-badge`;
        badge.style.cssText = 'display:inline-block; background:#eef2ff; color:#4338ca; padding:3px 12px; border-radius:999px; font-size:0.55em; font-weight:900; margin-right:10px; vertical-align:middle; letter-spacing:-0.5px; border:1px solid #c7d2fe;';
        badge.textContent = `🏷️ ${sponsorName}배`;
        el.prepend(badge, ' ');
    }
};

// 커스텀 드롭다운 바깥 클릭 시 자동 닫힘
document.addEventListener('click', function() {
    document.querySelectorAll('[id^="cselect-"][id$="-menu"]').forEach(el => el.classList.add('hidden'));
});

window.sfx = (function() {
    let ctx = null;
    function getCtx() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function tone(freq, duration, type, startGain, delay) {
        const c = getCtx();
        if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, c.currentTime + (delay || 0));
        gain.gain.setValueAtTime(startGain, c.currentTime + (delay || 0));
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay || 0) + duration);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime + (delay || 0));
        osc.stop(c.currentTime + (delay || 0) + duration);
    }

    function noiseBurst(duration, startGain, delay) {
        const c = getCtx();
        if (!c) return;
        const bufferSize = c.sampleRate * duration;
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const src = c.createBufferSource();
        src.buffer = buffer;
        const gain = c.createGain();
        gain.gain.setValueAtTime(startGain, c.currentTime + (delay || 0));
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay || 0) + duration);
        src.connect(gain);
        gain.connect(c.destination);
        src.start(c.currentTime + (delay || 0));
    }

    return {
        // 범용 클릭음 (전체 클릭 위임에서 사용)
        click: function() { tone(700, 0.05, 'sine', 0.06); },
        // 기존 코드에 이미 있던 이름들 (playClick / playBingo)
        playClick: function() { tone(700, 0.05, 'sine', 0.06); },
        playBingo: function() {
            tone(523.25, 0.12, 'triangle', 0.15);
            tone(659.25, 0.12, 'triangle', 0.13, 0.1);
            tone(783.99, 0.12, 'triangle', 0.13, 0.2);
            tone(1046.5, 0.3, 'triangle', 0.15, 0.3);
        },
        success: function() {
            tone(523.25, 0.1, 'sine', 0.15);
            tone(783.99, 0.2, 'sine', 0.13, 0.08);
        },
        // 🌟 "오늘의 주사위" 전용 — 던지기(휙) → 공중 스윕 → 착지 → 데구르르 굴러가며 통통 튐(점점 감소) → 정지(+buy) → 포인트 차임
        // showDiceRollOverlay의 CSS 애니메이션(총 3초, 55%=1.65초 첫 착지, 65/75/83/90/95%=바운스들, 100%=3.0초 정지)과
        // 정확히 같은 시간값을 사용해 싱크를 맞춤. 애니메이션 시간을 바꾸면 여기도 비례해서 같이 바꿔야 함.
        diceRoll: function() {
            // 1) 던지기(휙) — 0초, 살짝 높은 음에서 아래로 훑는 톱니파
            tone(520, 0.22, 'sawtooth', 0.05, 0);
            tone(260, 0.28, 'sawtooth', 0.04, 0.06);

            // 2) 공중에 떠 있는 구간(포물선, 0.2~1.5초) — 아주 낮은 음으로 은은하게 깔림
            tone(90, 1.3, 'sine', 0.018, 0.2);

            // 3) 첫 착지 (1.65초) — 묵직한 임팩트
            noiseBurst(0.1, 0.18, 1.65);
            tone(120, 0.16, 'triangle', 0.2, 1.65);

            // 4) 데구르르르 굴러가는 잔진동 — 착지 직후부터 정지 직전(1.7~2.85초)까지, 갈수록 작고 촘촘하게 잦아듦
            let t = 1.7;
            let ampScale = 1;
            while (t < 2.85) {
                noiseBurst(0.03, 0.06 * ampScale, t);
                tone(200 + Math.random() * 150, 0.02, 'square', 0.02 * ampScale, t);
                t += 0.035 + Math.random() * 0.02;
                ampScale *= 0.985;
            }

            // 5) 바운스 지점별 타격음 (1.95 / 2.25 / 2.49 / 2.70초, 갈수록 작아짐)
            noiseBurst(0.06, 0.11, 1.95); tone(220, 0.07, 'triangle', 0.09, 1.95);
            noiseBurst(0.05, 0.08, 2.25); tone(200, 0.06, 'triangle', 0.07, 2.25);
            noiseBurst(0.04, 0.06, 2.49);
            noiseBurst(0.03, 0.045, 2.70);

            // 6) 최종 정지 (3.0초) — 합성 착지음 + buy.mp3(실제 음원)로 "보상 획득" 강조
            noiseBurst(0.07, 0.1, 3.0);
            tone(150, 0.12, 'triangle', 0.13, 3.0);
            setTimeout(() => {
                const audio = new Audio('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/sfx/buy.mp3');
                audio.volume = 0.6;
                audio.play().catch(() => {});
            }, 3000);

            // 7) 포인트 획득 차임 (정지 직후)
            tone(523.25, 0.1, 'sine', 0.13, 3.1);
            tone(783.99, 0.2, 'sine', 0.11, 3.2);
        },
       error: function() {
            tone(180, 0.2, 'sawtooth', 0.12);
        },
        battleStart: function() {
            tone(392, 0.1, 'square', 0.15);
            tone(523.25, 0.1, 'square', 0.15, 0.08);
            tone(659.25, 0.2, 'square', 0.15, 0.16);
        },
        doubleCall: function() {
            tone(220, 0.08, 'sawtooth', 0.2);
            tone(440, 0.08, 'sawtooth', 0.2, 0.06);
            tone(880, 0.25, 'sawtooth', 0.18, 0.12);
        },
        retreat: function() {
            tone(400, 0.3, 'triangle', 0.15);
            tone(200, 0.3, 'triangle', 0.12, 0.1);
        },
        cancel: function() {
            tone(600, 0.06, 'sine', 0.1);
            tone(400, 0.1, 'sine', 0.1, 0.05);
        },
rosterLock: function() {
            const audio = new Audio('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/sfx/591155__ultraaxvii__sword-contact-with-swipe.wav');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        },
        buy: function() {
            const audio = new Audio('https://qrredwrxdnvqwdxzanba.supabase.co/storage/v1/object/public/sfx/buy.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        },
        // 킹 오브 리그 아레나 전용
        enter: function() {
            tone(220, 0.35, 'sawtooth', 0.15);
            tone(330, 0.35, 'sawtooth', 0.08, 0.03);
        },
        hit: function(enhanced) {
            noiseBurst(0.15, enhanced ? 0.35 : 0.22);
            tone(enhanced ? 130 : 180, 0.18, 'square', enhanced ? 0.25 : 0.15);
        },
recovery: function() {
            const c = getCtx();
            if (!c) return;
            const dur = 1.0;
            const o = c.createOscillator(); const g = c.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(150, c.currentTime);
            o.frequency.exponentialRampToValueAtTime(500, c.currentTime + dur * 0.8);
            g.gain.setValueAtTime(0.001, c.currentTime);
            g.gain.linearRampToValueAtTime(0.18, c.currentTime + dur * 0.5);
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
            o.connect(g); g.connect(c.destination);
            o.start(); o.stop(c.currentTime + dur);

            const o2 = c.createOscillator(); const g2 = c.createGain();
            o2.type = 'sine';
            o2.frequency.setValueAtTime(600, c.currentTime + dur * 0.5);
            g2.gain.setValueAtTime(0.001, c.currentTime + dur * 0.5);
            g2.gain.linearRampToValueAtTime(0.08, c.currentTime + dur * 0.7);
            g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
            o2.connect(g2); g2.connect(c.destination);
            o2.start(c.currentTime + dur * 0.5); o2.stop(c.currentTime + dur);
        },
        returnHome: function() { tone(180, 0.25, 'sawtooth', 0.1); }
    };
})();
// 클릭 가능한 모든 요소에 범용 클릭음 자동 부착
document.addEventListener('click', function(e) {
    const target = e.target.closest('button, [onclick], a, .btn, input[type="button"], input[type="submit"]');
    if (target && window.sfx) {
        window.sfx.click();
    }
}, true);
