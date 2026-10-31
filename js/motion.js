/**
 * [MOTION] 스태거(순차 등장) 애니메이션 + 마이크로 인터랙션 공통 층
 *
 * 화면 코드(view.js / mobile_*.js / 각 기능 js)를 고치지 않고 거의 모든 화면에 적용되도록
 * "새로 들어온 DOM"을 감시해서 자동으로 순차 등장을 붙인다.
 *
 * 동작 방식
 *  1) 메인 영역(#main-content-area, 모바일은 #mobile-content-area)에 MutationObserver 를 건다.
 *  2) 화면 전환/클릭/입력 직후 짧은 시간(WINDOW_MS) 안에 들어온 DOM 만 애니메이션한다.
 *     → 실시간 갱신(채팅, 전광판, 주기적 재렌더)이 계속 깜빡이는 일을 막는다.
 *  3) 새로 들어온 DOM 에서
 *       - 최상위 블록들(배너, 섹션 카드 등)은 위에서 아래로 빠르게 순차 등장,
 *       - 같은 태그가 3개 이상 반복되는 묶음(목록/카드 그리드/표 행)은 안쪽에서 한 번 더 순차 등장.
 *     화면 밖에 있는 항목은 스크롤로 보일 때 등장한다.
 *  4) 명시적으로 제어하고 싶으면 [data-stagger="간격ms"] 컨테이너 또는 [data-no-motion] 을 쓴다.
 *
 * 구현 메모
 *  - opacity + 개별 속성 translate 만 WAAPI(element.animate)로 쓴다 → 끝나면 흔적이 남지 않고,
 *    요소 자체의 transform 과도 충돌하지 않는다. (fill: 'backwards' 라 지연 시간 동안은 숨김 상태)
 *  - 움직임 줄이기(prefers-reduced-motion) 이거나 translate 를 못 쓰는 브라우저에서는 전부 꺼진다.
 *
 * 마이크로 인터랙션 보조 API: Boako.Motion.pop / shake / countUp / play
 * CSS 쪽(눌림, 호버, 포커스 링, 토스트, 모달)은 css/motion.css 가 담당한다.
 */
(function () {
    'use strict';

    window.Boako = window.Boako || {};

    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var supported = typeof Element.prototype.animate === 'function' &&
        !!(window.CSS && CSS.supports && CSS.supports('translate', '0 1px'));
    var enabled = supported && !(mq && mq.matches);
    if (mq && mq.addEventListener) {
        mq.addEventListener('change', function () { enabled = supported && !mq.matches; });
    }

    var EASE = 'cubic-bezier(.2,.8,.2,1)';
    var SPRING = 'cubic-bezier(.34,1.56,.64,1)';
    var WINDOW_MS = 3500;          // 화면 전환/사용자 조작 후 애니메이션을 허용하는 시간
    var MAX_SCAN = 500;            // 한 번에 훑는 최대 노드 수(큰 DOM 보호)
    var MAX_WAVE = 380;            // 한 묶음에서 가장 늦게 시작하는 항목의 지연 상한(ms)
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, BR: 1, OPTION: 1, OPTGROUP: 1, SVG: 1, IMG: 1, INPUT: 1, I: 1, HR: 1, TD: 1, TH: 1, THEAD: 1 };
    // 실시간으로 계속 바뀌는 영역/직접 제어하는 영역은 건드리지 않는다
    var SKIP_ZONE = '[data-no-motion], .ticker-bar, #boako-ticker-track, #hot-issue-list, [id*="chat"], [class*="chat-"], [id*="toast"], canvas';

    // 첫 로드는 데이터 도착이 느릴 수 있어 넉넉히(12초) 열어두되, 같은 컨테이너는 한 번만 순차 등장시킨다
    // (진행형 로딩/실시간 갱신이 같은 자리를 여러 번 다시 그리며 깜빡이는 것 방지).
    // 사용자가 직접 조작(클릭/입력)한 뒤에는 짧게(3.5초) 열고, 그때는 매번 등장시킨다.
    var LOAD_MS = 12000;
    var openUntil = Date.now() + LOAD_MS;
    var loadMode = true;
    var slots = new Map();
    var area = null;               // 메인 영역
    var areas = [];                // 관찰 중인 모든 영역(메인 + 모바일 드로어/시트)
    var pending = new Set();
    var scheduled = false;
    var io = null;

    function openWindow() { loadMode = false; openUntil = Date.now() + WINDOW_MS; }

    // ── 단일 요소 등장 ─────────────────────────────────────────────
    function play(el, delay, dist) {
        if (!enabled || !el || el.__mo) return;
        el.__mo = 1;
        try {
            if (el.getAnimations && el.getAnimations().length) return;   // 이미 자체 애니메이션이 있으면 양보
            el.animate(
                [{ opacity: 0, translate: '0 ' + (dist == null ? 14 : dist) + 'px' }, { opacity: 1, translate: '0 0' }],
                { duration: 440, delay: delay || 0, easing: EASE, fill: 'backwards' }
            );
        } catch (e) { /* 애니메이션 실패는 조용히 무시 */ }
    }

    // ── 화면 밖 항목은 보일 때 등장 ────────────────────────────────
    function ensureIO() {
        if (io || !('IntersectionObserver' in window)) return io;
        io = new IntersectionObserver(function (entries) {
            var n = 0;
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                io.unobserve(en.target);
                play(en.target, Math.min(n++ * 40, 200), 12);
            });
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
        return io;
    }

    function inViewport(r) {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        return r.bottom > -40 && r.top < vh + 40;
    }

    function usable(el) {
        if (!el || el.nodeType !== 1 || SKIP_TAGS[el.tagName.toUpperCase()]) return false;
        if (el.hidden || el.__mo) return false;
        if (el.closest && el.closest(SKIP_ZONE)) return false;
        var r = el.getBoundingClientRect();
        if (r.width < 60 || r.height < 24) return false;       // 칩/아이콘 같은 작은 조각은 제외
        var pos = getComputedStyle(el).position;
        return pos !== 'fixed' && pos !== 'absolute';
    }

    // ── 묶음 재생 ─────────────────────────────────────────────────
    function playGroup(items, base, step, dist) {
        var shown = 0;
        items.forEach(function (it) {
            if (!usable(it)) return;
            var r = it.getBoundingClientRect();
            if (inViewport(r)) {
                play(it, base + Math.min(shown++ * step, MAX_WAVE), dist);
            } else if (ensureIO()) {
                io.observe(it);
            }
        });
    }

    // 같은 태그가 3개 이상 반복되는 자식 묶음 찾기
    function repeatedKids(el) {
        if (el.children.length < 3) return null;
        var counts = {}, best = null;
        for (var i = 0; i < el.children.length; i++) {
            var t = el.children[i].tagName;
            if (SKIP_TAGS[t.toUpperCase()]) continue;
            counts[t] = (counts[t] || 0) + 1;
            if (!best || counts[t] > counts[best]) best = t;
        }
        if (!best || counts[best] < 3) return null;
        var out = [];
        for (var j = 0; j < el.children.length; j++) if (el.children[j].tagName === best) out.push(el.children[j]);
        return out;
    }

    // root 안의 반복 묶음을 최대 2단계(바깥 묶음 → 그 안의 묶음)까지 수집
    function scan(root) {
        var groups = [], budget = MAX_SCAN;
        var queue = [{ el: root, lvl: 0 }];
        while (queue.length && budget-- > 0) {
            var cur = queue.shift(), el = cur.el;
            if (SKIP_TAGS[el.tagName.toUpperCase()] || el.hidden) continue;
            if (el.closest && el.closest(SKIP_ZONE)) continue;
            var explicit = el.getAttribute && el.getAttribute('data-stagger');
            var kids = explicit !== null && explicit !== undefined && el.children.length ? Array.prototype.slice.call(el.children) : repeatedKids(el);
            if (kids) {
                groups.push({ parent: el, items: kids, lvl: cur.lvl, step: explicit ? (parseInt(explicit, 10) || 40) : 0 });
                if (cur.lvl >= 1) continue;                      // 더 깊은 묶음은 만들지 않음
                kids.forEach(function (k) {
                    for (var i = 0; i < k.children.length; i++) queue.push({ el: k.children[i], lvl: cur.lvl + 1 });
                });
            } else {
                for (var c = 0; c < el.children.length; c++) queue.push({ el: el.children[c], lvl: cur.lvl });
            }
        }
        return groups;
    }

    // 같은 "자리"(메인 영역에서 그 컨테이너까지의 경로)가 다시 그려지는 경우를 걸러낸다.
    // 앱이 같은 자리를 여러 번 재렌더(스켈레톤→데이터, 진행형 로딩, 실시간 갱신)해도 깜빡이지 않게 한다.
    //  - 로드 모드: 자리당 한 번만
    //  - 사용자 조작 모드: 자리당 2.5초에 한 번 (화면을 다시 열면 다시 등장)
    function slotKey(el) {
        var parts = [];
        while (el && areas.indexOf(el) === -1) {
            var p = el.parentElement, idx = p ? Array.prototype.indexOf.call(p.children, el) : 0;
            parts.push(el.tagName + (el.id || String(el.className || '').slice(0, 20)) + idx);
            el = p;
        }
        return parts.join('>');
    }
    function claim(parent) {
        var key = slotKey(parent), now = Date.now(), last = slots.get(key);
        if (loadMode ? last !== undefined : (last !== undefined && now - last < 2500)) return false;
        // 자리 경로가 형제 추가로 살짝 밀려도(인덱스 변화) 같은 모양의 묶음이 곧바로 다시 그려진 경우는 건너뜀
        var shape = parent.tagName + String(parent.className || '').slice(0, 40) + ':' + parent.children.length;
        var seen = slots.get(shape);
        if (seen !== undefined && now - seen < 2000) return false;
        slots.set(key, now);
        slots.set(shape, now);
        return true;
    }

    // ── 한 번의 배치 처리 ──────────────────────────────────────────
    function flush() {
        scheduled = false;
        var nodes = Array.from(pending);
        pending.clear();
        if (!enabled || Date.now() > openUntil) return;

        var roots = nodes.filter(function (n) { return n.isConnected && !(n.closest && n.closest(SKIP_ZONE)); });
        roots = roots.filter(function (n) { return !roots.some(function (o) { return o !== n && o.contains(n); }); });
        if (!roots.length) return;

        // 1) 메인 영역 직계 자식 = 화면 전체 블록 → 위에서 아래로 빠르게 순차 등장
        var blocks = roots.filter(function (n) { return areas.indexOf(n.parentElement) !== -1; });
        var blockSet = new Set(blocks);
        var seenAreas = [];
        blocks.forEach(function (b) { if (seenAreas.indexOf(b.parentElement) === -1) seenAreas.push(b.parentElement); });
        seenAreas.forEach(function (ar) {
            var mine = blocks.filter(function (b) { return b.parentElement === ar; });
            if (claim(ar)) playGroup(mine, 0, 70, 18);
        });

        // 2) 안쪽 반복 묶음(목록/카드/표 행)
        var parents = new Set();
        roots.forEach(function (r) {
            scan(r).forEach(function (g) {
                if (!claim(g.parent)) return;
                var base = (blockSet.has(r) || g.lvl > 0) ? 140 : 0;
                playGroup(g.items, base, g.step || (g.lvl > 0 ? 32 : 42), g.lvl > 0 ? 10 : 14);
            });
            // 목록에 항목이 하나씩 append 되는 방식이면 새 노드의 부모가 반복 묶음이다
            var p = r.parentElement;
            if (p && areas.indexOf(p) === -1 && !blockSet.has(r)) parents.add(p);
        });
        parents.forEach(function (p) {
            var sib = repeatedKids(p);
            if (sib && claim(p)) playGroup(sib, 0, 42, 14);
        });

        // 3) data-countup 숫자 올라가기
        roots.forEach(function (r) {
            var list = r.matches && r.matches('[data-countup]') ? [r] : [];
            if (r.querySelectorAll) list = list.concat(Array.prototype.slice.call(r.querySelectorAll('[data-countup]')));
            list.forEach(function (el) { if (!el.__mc && claim(el)) { el.__mc = 1; countUp(el, Number(el.getAttribute('data-countup'))); } });
        });
    }

    // 채팅 목록: 상대가 보낸 새 메시지는 사용자 조작 없이도 들어오므로 창과 무관하게 처리한다.
    // 한 번에 1~2개만 붙을 때(새 메시지)만 살짝 올라오며 등장하고, 이력 일괄 로드(3개 이상)는 건드리지 않는다.
    var CHAT = '[id*="chat"], [class*="chat-"]';
    function handleChat(list) {
        var byParent = new Map();
        for (var i = 0; i < list.length; i++) {
            var m = list[i], t = m.target;
            if (!t || t.nodeType !== 1 || !t.closest || !t.closest(CHAT) || t.closest('[data-no-motion]')) continue;
            for (var j = 0; j < m.addedNodes.length; j++) {
                var n = m.addedNodes[j];
                if (n.nodeType !== 1 || SKIP_TAGS[n.tagName.toUpperCase()]) continue;
                if (!byParent.has(t)) byParent.set(t, []);
                byParent.get(t).push(n);
            }
        }
        byParent.forEach(function (nodes) {
            if (nodes.length > 2) return;
            nodes.forEach(function (n) {
                var r = n.getBoundingClientRect();
                if (r.height >= 20 && r.width >= 40) play(n, 0, 10);
            });
        });
    }

    function onMutations(list) {
        if (enabled) handleChat(list);
        if (!enabled || Date.now() > openUntil) return;
        for (var i = 0; i < list.length; i++) {
            var add = list[i].addedNodes;
            for (var j = 0; j < add.length; j++) if (add[j].nodeType === 1) pending.add(add[j]);
        }
        if (!scheduled && pending.size) {
            scheduled = true;
            requestAnimationFrame(flush);
        }
    }

    // ── 마이크로 인터랙션 보조 ─────────────────────────────────────
    /** 눌렀을 때 톡 튀는 반응 (추천/북마크/장착 같은 토글 버튼용) */
    function pop(el) {
        if (!enabled || !el || !el.animate) return;
        try { el.animate([{ scale: 1 }, { scale: 1.22 }, { scale: 1 }], { duration: 340, easing: SPRING }); } catch (e) {}
    }

    /** 좌우로 흔들기 (입력 검증 실패 같은 경고용) */
    function shake(el) {
        if (!enabled || !el || !el.classList) return;
        el.classList.remove('mo-shake');
        void el.offsetWidth;
        el.classList.add('mo-shake');
        setTimeout(function () { el.classList.remove('mo-shake'); }, 420);
    }

    /** 숫자가 0(또는 현재값)에서 목표값까지 부드럽게 올라간다. "🏆 1,200 LP" 처럼 앞뒤 글자는 유지하고 숫자만 바뀐다. */
    function countUp(el, to, opts) {
        if (!el) return;
        opts = opts || {};
        var target = Number(to);
        if (!isFinite(target)) return;
        var original = el.textContent;
        var m = original.match(/^(\D*?)([\d,]+(?:\.\d+)?)(\D*)$/);
        var pre = m ? m[1] : '', suf = m ? m[3] : '';
        var fmt = function (n) { return Math.round(n).toLocaleString('ko-KR'); };
        if (!enabled) return;                                   // 움직임 줄이기: 원래 표시 그대로 둔다
        var from = opts.from != null ? opts.from : 0;
        var dur = opts.duration || 700, t0 = null;
        function frame(ts) {
            if (t0 === null) t0 = ts;
            var k = Math.min(1, (ts - t0) / dur);
            var e = 1 - Math.pow(1 - k, 3);                      // easeOutCubic
            if (k < 1) { el.textContent = pre + fmt(from + (target - from) * e) + suf; requestAnimationFrame(frame); }
            else el.textContent = original;                      // 마지막은 원래 문구로 정확히 복원
        }
        el.textContent = pre + fmt(from) + suf;
        requestAnimationFrame(frame);
    }

    // ── 시작 ─────────────────────────────────────────────────────
    function init() {
        area = document.getElementById('main-content-area') || document.getElementById('mobile-content-area');
        if (!area) return;

        ['click', 'keydown', 'change', 'submit', 'input', 'popstate', 'hashchange'].forEach(function (ev) {
            document.addEventListener(ev, openWindow, { capture: true, passive: true });
        });

        // 모바일 드로어/시트 안의 목록도 열릴 때마다 순차 등장하도록 함께 관찰
        areas = [area];
        ['mobile-drawer-content', 'mobile-sheet-content'].forEach(function (id) {
            var e = document.getElementById(id);
            if (e) areas.push(e);
        });
        var mo = new MutationObserver(onMutations);
        areas.forEach(function (a) { mo.observe(a, { childList: true, subtree: true }); });

        // 이미지는 로드가 끝나는 순간 부드럽게 나타난다(깨진 빈칸이 뚝 튀어나오는 느낌 방지)
        area.addEventListener('load', function (e) {
            var t = e.target;
            if (enabled && t && t.tagName === 'IMG' && !(t.closest && t.closest(SKIP_ZONE))) {
                try { t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: EASE }); } catch (er) {}
            }
        }, true);

        // 추천/좋아요 류 버튼은 눌렀을 때 톡 튄다 (onclick 에 like 가 들어간 버튼, 또는 data-pop)
        document.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('[data-pop], [onclick*="ike"]');
            if (b) pop(b);
        }, true);

        // 이미 그려진 첫 화면도 한 번 훑는다
        Array.prototype.forEach.call(area.children, function (c) { pending.add(c); });
        if (pending.size) { scheduled = true; requestAnimationFrame(flush); }
    }

    window.Boako.Motion = { play: play, pop: pop, shake: shake, countUp: countUp, openWindow: openWindow, get enabled() { return enabled; } };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
