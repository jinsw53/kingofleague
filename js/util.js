/**
 * [UTIL] 공통 유틸리티 (토스트, 프리뷰 + 동적 파일 배달원 + 자동 스크롤)
 * 🌟 sfx.diceRoll: 게시판 주사위 연출(던지기→포물선→착지→굴러가며 통통 튐(점점 감소)→정지, 총 3초)과
 *    정확히 타이밍을 맞춘 합성 효과음. board.js의 keyframe 퍼센트/시간을 바꾸면 여기 숫자도 같이 바꿔야 함.
 *    최종 정지(3.0초) 타이밍에는 buy.mp3(실제 음원)를 추가로 재생해서 "보상 획득" 느낌을 강조함.
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
        // 🌟 게시판 "오늘의 주사위" 전용 — 던지기(휙) → 공중 스윕 → 착지 → 데구르르 굴러가며 통통 튐(점점 감소) → 정지(+buy) → 포인트 차임
        // board.js의 showDiceRollOverlay CSS 애니메이션(총 3초, 55%=1.65초 첫 착지, 65/75/83/90/95%=바운스들, 100%=3.0초 정지)과
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
