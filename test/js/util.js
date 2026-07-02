/**
 * [UTIL] 공통 유틸리티 (토스트, 프리뷰 + 동적 파일 배달원 + 자동 스크롤)
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
    }
};
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
