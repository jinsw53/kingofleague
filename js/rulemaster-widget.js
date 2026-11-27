/*!
 * 룰 마스터 위젯 — 고객사 사이트에 넣는 게임 규칙 보기 + 상황 질문 창
 *
 * 넣는 법
 *   <div id="rule-master"></div>
 *   <script src="rulemaster-widget.js"></script>
 *   <script>
 *     RuleMaster.mount("#rule-master", {
 *       api: "https://<프로젝트>.supabase.co/functions/v1/rulemaster-api",
 *       gameId: "<룰 마스터 게임 ID>",          // 또는 externalGameId: "<고객사 게임 ID>"
 *       expansionIds: [],                       // 또는 externalExpansionIds: [...]
 *       // 인증은 둘 중 하나
 *       getToken: async () => (await fetch("/my-server/rulemaster-token")).json().then(r => r.token), // 회원
 *       widgetKey: "rmw_...",                   // 비회원 (고객사 허용 도메인에서만)
 *     });
 *   </script>
 *
 * 옵션: lang("ko"|"en"), brand(머리글 이름), accent(강조색), startTab("setup" 등), onAnswer(콜백)
 *       expansionPicker(false 면 이용자용 확장 칩을 숨김. 기본은 보임, 고른 확장은 브라우저에 기억)
 *       wikiEdit(false 면 "고치기" 버튼을 숨김. 회원 토큰 없이 쓰는 사이트에서는 고치기가 "고치는 사이트"로 가는 링크가 됨)
 * 회원 토큰은 고객사 서버가 비밀 키로 POST /v1/widget-token 을 불러 받는다(비밀 키를 브라우저에 두지 말 것).
 */
(function (global) {
  "use strict";

  var SECTIONS = [
    { key: "setup", ko: "게임 준비", en: "Setup" },
    { key: "how_to_play", ko: "게임 방법", en: "How to play" },
    { key: "clarification", ko: "헷갈리는 규칙", en: "Clarifications" },
    { key: "game_info", ko: "게임 정보", en: "Tips & info" },
  ];
  var TXT = {
    ko: {
      ask: "질문하기", placeholder: "지금 상황을 적어 물어보세요. 예) 온도가 최대인데 온도 카드를 낼 수 있나요?",
      empty: "아직 정리된 내용이 없습니다.", loading: "불러오는 중…", thinking: "규칙을 찾아보는 중…",
      helpful: "도움 됐어요", wrong: "틀렸어요", sendFix: "보내기", fixPh: "어디가 틀렸는지 알려 주세요 (선택)",
      thanks: "고맙습니다. 확인 후 반영할게요.", already: "이미 보내 주셨어요.", busy: "AI 가 잠시 바쁩니다. 조금 뒤 다시 물어봐 주세요. (횟수는 차감되지 않았어요)",
      limit: "오늘 새 질문 횟수를 다 썼어요. 이미 답이 있는 질문은 계속 볼 수 있어요.", fail: "답을 받지 못했어요. 잠시 뒤 다시 해 주세요.",
      opinion: "참고 의견", verified: "검수된 답", cached: "저장된 답", fresh: "새 답", left: "오늘 남은 새 질문",
      noGround: "규칙만으로 판정하기 어려운 질문이에요.", source: "근거", loginFb: "로그인하면 제보할 수 있어요.",
      edit: "✎ 고치기", editAway: "로그인하고 고치는 곳으로 이동해요 (새 창)", hist: "고친 기록", save: "저장", cancel: "취소", titlePh: "제목", notePh: "고친 이유 (선택)",
      editHint: "저장하면 바로 모두에게 보이고, 누가 언제 고쳤는지 기록이 남아요. 고친 글은 룰 마스터에 실려 함께 씁니다.",
      locked: "운영자가 잠근 글이라 고칠 수 없어요.", editLimit: "오늘 고칠 수 있는 횟수를 다 썼어요.", saved: "고쳤어요.",
      noHist: "아직 고친 기록이 없어요.", edited: "이용자가 고침", before: "고치기 전", revert: "되돌림",
    },
    en: {
      ask: "Ask", placeholder: "Describe the situation. e.g. Can I play a temperature card when it is maxed?",
      empty: "Nothing here yet.", loading: "Loading…", thinking: "Checking the rules…",
      helpful: "Helpful", wrong: "Wrong", sendFix: "Send", fixPh: "What is wrong? (optional)",
      thanks: "Thanks. We will review it.", already: "Already sent.", busy: "The AI is busy. Please try again shortly. (Not counted)",
      limit: "You have used today's new questions. Saved answers still work.", fail: "Could not get an answer. Please try again.",
      opinion: "Opinion", verified: "Verified", cached: "Saved answer", fresh: "New answer", left: "New questions left today",
      noGround: "The rules alone cannot settle this.", source: "Source", loginFb: "Log in to send feedback.",
      edit: "✎ Edit", editAway: "Sign in to edit (opens a new tab)", hist: "History", save: "Save", cancel: "Cancel", titlePh: "Title", notePh: "Reason (optional)",
      editHint: "Your edit is shown to everyone right away and recorded in the history.",
      locked: "This page is locked by the admin.", editLimit: "You have used today's edits.", saved: "Saved.",
      noHist: "No edits yet.", edited: "Edited by users", before: "Before", revert: "Revert",
    },
  };

  var CSS = [
    ":host{all:initial;display:block;--rm-accent:#3b6fd8;--rm-bg:#fff;--rm-fg:#1d2330;--rm-muted:#667085;--rm-line:#e4e7ec;--rm-soft:#f5f7fb;--rm-warn:#9a6700;--rm-warn-bg:#fff8e6;--rm-ok:#1d8a4e;--rm-no:#c0362c;--rm-hi:#f5b400;",
    "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Noto Sans KR','Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:var(--rm-fg)}",
    "@media (prefers-color-scheme:dark){:host(:not([data-theme=light])){--rm-bg:#171a21;--rm-fg:#e8eaf0;--rm-muted:#98a2b3;--rm-line:#2c313c;--rm-soft:#1f232c;--rm-warn:#f5c451;--rm-warn-bg:#2b2616;--rm-ok:#4fd08a;--rm-no:#ff8a80}}",
    ":host([data-theme=dark]){--rm-bg:#171a21;--rm-fg:#e8eaf0;--rm-muted:#98a2b3;--rm-line:#2c313c;--rm-soft:#1f232c;--rm-warn:#f5c451;--rm-warn-bg:#2b2616;--rm-ok:#4fd08a;--rm-no:#ff8a80}",
    "*{box-sizing:border-box}",
    ".box{background:var(--rm-bg);border:1px solid var(--rm-line);border-radius:14px;overflow:hidden}",
    ".head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:14px 16px 0}",
    ".title{font-size:17px;font-weight:700;margin:0}.brand{font-size:12px;color:var(--rm-muted)}",
    ".exp{padding:2px 16px 0;font-size:12px;color:var(--rm-muted)}",
    ".exp.pick{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:4px 16px 8px}",
    ".exp .lab{font-size:12px;color:var(--rm-muted);margin-right:2px}",
    ".exp .chip{border:1px solid var(--rm-line);background:var(--rm-bg);color:var(--rm-muted);border-radius:999px;font:inherit;font-size:12.5px;padding:5px 11px;cursor:pointer;min-height:30px;display:inline-flex;align-items:center;gap:5px}",
    ".exp .chip::before{content:'';width:9px;height:9px;border-radius:3px;border:1.5px solid currentColor;box-sizing:border-box}",
    ".exp .chip[aria-pressed=true]{border-color:var(--rm-accent);color:var(--rm-fg);background:color-mix(in srgb,var(--rm-accent) 12%,var(--rm-bg))}",
    ".exp .chip[aria-pressed=true]::before{background:var(--rm-accent);border-color:var(--rm-accent)}",
    ".exp .chip:disabled{opacity:.6;cursor:progress}",
    ".tabs{display:flex;gap:4px;padding:10px 12px 0;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--rm-line)}",
    ".tabs::-webkit-scrollbar{display:none}",
    ".tab{flex:none;border:0;background:none;color:var(--rm-muted);font:inherit;font-size:14px;padding:8px 10px 10px;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}",
    ".tab[aria-selected=true]{color:var(--rm-fg);font-weight:700;border-bottom-color:var(--rm-accent)}",
    ".tab .n{font-size:11px;color:var(--rm-muted);margin-left:3px;font-weight:400}",
    ".panel{padding:6px 16px 14px;max-height:var(--rm-panel-max,420px);overflow-y:auto}",
    "details{border-bottom:1px solid var(--rm-line);padding:10px 0}details:last-child{border-bottom:0}",
    "summary{cursor:pointer;font-weight:600;list-style:none;display:flex;gap:8px;align-items:baseline}summary::-webkit-details-marker{display:none}",
    "summary:before{content:'›';color:var(--rm-muted);transition:transform .15s;display:inline-block;width:10px}details[open] summary:before{transform:rotate(90deg)}",
    ".from{font-size:11px;color:var(--rm-muted);font-weight:400}",
    ".md{padding:6px 0 0 18px}.md p{margin:0 0 8px}.md ul,.md ol{margin:0 0 8px;padding-left:20px}.md code{background:var(--rm-soft);padding:1px 4px;border-radius:4px;font-size:13px}",
    ".empty,.muted{color:var(--rm-muted);font-size:14px;padding:12px 0}",
    ".ask{border-top:1px solid var(--rm-line);padding:12px 16px 14px;background:var(--rm-soft)}",
    ".row{display:flex;gap:8px;align-items:flex-end}",
    "textarea{flex:1;min-width:0;resize:vertical;min-height:44px;max-height:160px;font:inherit;font-size:14px;color:var(--rm-fg);background:var(--rm-bg);border:1px solid var(--rm-line);border-radius:10px;padding:10px 12px}",
    "textarea:focus{outline:2px solid var(--rm-accent);outline-offset:-1px}",
    "button.go{flex:none;border:0;border-radius:10px;background:var(--rm-accent);color:#fff;font:inherit;font-size:14px;font-weight:600;padding:11px 16px;cursor:pointer;min-height:44px}",
    "button.go:disabled{opacity:.5;cursor:default}",
    ".ans{margin-top:12px;background:var(--rm-bg);border:1px solid var(--rm-line);border-radius:12px;padding:12px 14px}",
    ".ans.opinion{border-color:var(--rm-warn);background:var(--rm-warn-bg)}",
    ".meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}",
    ".chip{font-size:11px;border:1px solid var(--rm-line);border-radius:999px;padding:1px 8px;color:var(--rm-muted)}",
    ".chip.v{color:var(--rm-accent);border-color:var(--rm-accent)}",
    ".steps{margin:8px 0 0;padding-left:20px;font-size:14px;color:var(--rm-muted)}",
    ".fb{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center}",
    ".fb button{border:1px solid var(--rm-line);background:var(--rm-bg);color:var(--rm-fg);border-radius:8px;font:inherit;font-size:13px;padding:5px 10px;cursor:pointer}",
    ".fb .note{font-size:12px;color:var(--rm-muted)}",
    ".fix{display:flex;gap:6px;margin-top:8px}.fix textarea{min-height:38px}",
    ".err{margin-top:10px;font-size:14px;color:var(--rm-warn)}",
    ".wiki{margin-top:12px;border-top:1px dashed var(--rm-line);padding-top:10px}",
    ".wiki .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
    ".wiki .bar button,.wiki a.away{border:1px solid var(--rm-line);background:var(--rm-bg);color:var(--rm-fg);border-radius:8px;font:inherit;font-size:13px;padding:5px 10px;cursor:pointer}",
    ".wiki a.away{text-decoration:none;display:inline-block}",
    ".wiki .bar .note,.wiki .hint{font-size:12px;color:var(--rm-muted)}",
    ".wiki form{display:flex;flex-direction:column;gap:6px;margin-top:8px}",
    ".wiki input,.wiki textarea{font:inherit;font-size:14px;color:var(--rm-fg);background:var(--rm-bg);border:1px solid var(--rm-line);border-radius:8px;padding:7px 9px;width:100%;box-sizing:border-box}",
    ".wiki textarea{min-height:140px;resize:vertical;line-height:1.55}",
    ".wiki .row2{display:flex;gap:6px;justify-content:flex-end}",
    ".wiki .row2 button{border:0;border-radius:8px;font:inherit;font-size:13px;padding:7px 14px;cursor:pointer;background:var(--rm-soft);color:var(--rm-fg)}",
    ".wiki .row2 button[type=submit]{background:var(--rm-accent);color:#fff}",
    ".wiki ol.h{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}",
    ".wiki ol.h li{font-size:12.5px;border:1px solid var(--rm-line);border-radius:8px;padding:6px 9px}",
    ".wiki ol.h .who{color:var(--rm-muted)}",
    ".wiki ol.h details{margin-top:4px}.wiki ol.h pre{white-space:pre-wrap;font:inherit;margin:4px 0 0;color:var(--rm-muted)}",
    ".scene{margin:8px 0 6px;padding:10px;border:1px solid var(--rm-line);border-radius:12px;background:var(--rm-soft)}",
    ".scene svg{display:block;width:100%;height:auto;max-height:440px;font-family:inherit}",
    ".scene svg .hl{animation:rmPulse 1.6s ease-in-out infinite}",
    "@keyframes rmPulse{50%{stroke-opacity:.35}}@media (prefers-reduced-motion:reduce){.scene svg .hl{animation:none}}",
    ".scene figcaption{font-size:14px;margin-top:8px;min-height:1.6em}.scene .sn{color:var(--rm-accent);margin-right:4px}",
    ".snav{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:6px}",
    ".snav>button{border:1px solid var(--rm-line);background:var(--rm-bg);color:var(--rm-fg);border-radius:999px;width:36px;height:36px;font-size:20px;line-height:1;cursor:pointer}",
    ".snav>button:disabled{opacity:.35;cursor:default}",
    ".sdots{display:flex;gap:4px}.sdots .dot{width:10px;height:10px;border-radius:50%;border:0;padding:0;background:var(--rm-line);cursor:pointer}.sdots .dot.on{background:var(--rm-accent);width:22px;border-radius:5px}",
    ".callouts{margin-top:10px;display:grid;gap:10px;border-top:1px dashed var(--rm-line);padding-top:10px}",
    ".co .cot{font-size:12px;font-weight:700;color:var(--rm-muted);margin-bottom:4px}",
    ".co ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:5px 14px}",
    ".co li{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.45}",
    ".co .cn{flex:none;width:21px;height:21px;border-radius:50%;background:var(--rm-bg);color:var(--rm-fg);border:2px solid var(--rm-fg);font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}",
    ".co .cd{color:var(--rm-muted)}",
    ".cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;padding:8px 0 2px}",
    ".card{display:flex;flex-direction:column;text-align:left;font:inherit;color:inherit;background:var(--rm-bg);border:1px solid var(--rm-line);border-radius:12px;padding:0;overflow:hidden;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}",
    ".card:hover,.card:focus-visible{border-color:var(--rm-accent);box-shadow:0 4px 14px rgba(0,0,0,.08);transform:translateY(-1px);outline:0}",
    ".card .th{height:118px;background:var(--rm-soft);border-bottom:1px solid var(--rm-line);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:6px}",
    ".card .th svg{width:100%;height:100%;display:block}",
    ".card .ct{padding:9px 11px 11px;display:flex;flex-direction:column;gap:3px}",
    ".card .ctt{font-weight:700;font-size:14px;line-height:1.4}",
    ".card .sum{font-size:12.5px;color:var(--rm-muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".card.nopic .sum{-webkit-line-clamp:5}",
    ".card .tg{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}.card .tg span{font-size:11px;color:var(--rm-muted);border:1px solid var(--rm-line);border-radius:999px;padding:0 7px}",
    ".card .tg .pic{color:var(--rm-accent);border-color:var(--rm-accent)}",
    ".ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,14,22,.5);display:flex;align-items:center;justify-content:center;padding:16px;animation:rmFade .15s ease-out}",
    ".ov[hidden]{display:none}",
    ".sheet{background:var(--rm-bg);color:var(--rm-fg);border-radius:16px;width:100%;max-width:780px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:rmUp .18s ease-out}",
    ".sh-head{display:flex;align-items:flex-start;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--rm-line)}",
    ".sh-head .st{flex:1;min-width:0}.sh-head .st b{display:block;font-size:17px;line-height:1.4}.sh-head .st span{font-size:12px;color:var(--rm-muted)}",
    ".sh-head .x{flex:none;border:0;background:var(--rm-soft);color:var(--rm-fg);width:36px;height:36px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer}",
    ".sh-body{overflow-y:auto;padding:4px 16px 12px}.sh-body .md{padding:6px 2px 0}",
    ".sh-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;border-top:1px solid var(--rm-line);font-size:13px;color:var(--rm-muted)}",
    ".sh-foot button{border:1px solid var(--rm-line);background:var(--rm-bg);color:var(--rm-fg);border-radius:10px;font:inherit;font-size:13px;padding:7px 12px;cursor:pointer;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".sh-foot button:disabled{visibility:hidden}",
    "@keyframes rmFade{from{opacity:0}}@keyframes rmUp{from{transform:translateY(12px);opacity:0}}",
    "@media (max-width:560px){.ov{align-items:flex-end;padding:0}.sheet{max-height:92vh;border-radius:16px 16px 0 0}.cards{grid-template-columns:1fr 1fr}.card .th{height:96px}}",
    "@media (prefers-reduced-motion:reduce){.ov,.sheet,.card{animation:none;transition:none}}",
  ].join("\n");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 아주 작은 마크다운: 문단, - 목록, 1. 목록, **굵게**, `코드`. HTML 은 모두 글자로 바꾼다
  function md(src) {
    var inline = function (t) {
      return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
    };
    var out = [], list = null;
    var close = function () { if (list) { out.push("</" + list + ">"); list = null; } };
    String(src || "").split(/\r?\n/).forEach(function (line) {
      var m;
      if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; }
        out.push("<li>" + inline(m[1]) + "</li>");
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; }
        out.push("<li>" + inline(m[1]) + "</li>");
      } else if (line.trim() === "") {
        close();
      } else {
        close();
        out.push("<p>" + inline(line) + "</p>");
      }
    });
    close();
    return out.join("");
  }

  // ===================================================================== 장면 그림
  // 4개 탭의 글(rule_chapters.highlight_scene)과 AI 답에 붙는 그림. 데이터만 바꾸면 어느 게임이든 그려진다.
  //
  //   layout  배치도: 칸(cols×rows) 위에 구성물(items)을 놓고, 단계(steps)마다 새로 놓을 것(add)과 강조할 것(focus)을 정한다
  //           items: { id, kind, label, sub, x, y, w, h, color, count, n, value, max, asset_code, mark, parts:[{label, mark}] }
  //           kind : board(보드) area(개인 공간) card deck(더미) hand(손패) tile(육각 타일) token(토큰) cube(큐브) track(트랙) text
  //           mark : ok(된다) no(안 된다) skip(무시) — 판정 표시. verdict: { mark, text } 는 그림 위 판정 띠
  //   flow    순서도: nodes[{ id, label, note, style: "skip" }], loop(반복 화살표), steps[{ text, focus }]
  //   tier    티어표: rows[{ tier, color, items:[{ label, asset_code }] }]
  //
  // asset_code 에 http(s) 그림 주소가 등록돼 있으면 도형 대신 그 그림을 넣는다(재작화본으로 바꿔 끼우기).
  var U = 40, FSCALE = 1; // FSCALE: 좁은 화면에서 글자를 키운다
  var PAL = { red: "#d9534f", orange: "#e0731f", yellow: "#e8a800", green: "#2f9e5b", blue: "#2f7fd1", sky: "#5aa6f0",
    purple: "#7b5cc4", brown: "#8a5a35", gray: "#8a94a6", black: "#2b2f38", white: "#ffffff", pink: "#d6336c" };
  function col(c, d) { return PAL[c] || (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : d); }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function attr(s) { return esc(s); }

  // 한글 기준 대충 글자 수로 줄 바꿈
  function lines(text, maxChars, maxLines) {
    var words = String(text || "").split(/\s+/), out = [], cur = "";
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= maxChars) cur += " " + w;
      else { out.push(cur); cur = w; }
    });
    if (cur) out.push(cur);
    if (out.length > maxLines) { out = out.slice(0, maxLines); out[maxLines - 1] = out[maxLines - 1].slice(0, Math.max(1, maxChars - 1)) + "…"; }
    return out;
  }
  function txt(x, y, text, o) {
    o = o || {};
    var fs = Math.round((o.size || 14) * FSCALE), ls = lines(text, Math.max(2, Math.floor((o.width || 400) / (fs * 0.92))), o.max || 2);
    var y0 = y - ((ls.length - 1) * fs * 1.2) / 2 * (o.middle === false ? 0 : 1);
    return '<text x="' + x + '" y="' + y0 + '" font-size="' + fs + '" text-anchor="' + (o.anchor || "middle") +
      '" dominant-baseline="middle" fill="' + (o.fill || "var(--rm-fg)") + '"' + (o.bold ? ' font-weight="700"' : "") + ">" +
      ls.map(function (l, i) { return '<tspan x="' + x + '" dy="' + (i ? fs * 1.2 : 0) + '">' + esc(l) + "</tspan>"; }).join("") + "</text>";
  }
  function hexPts(cx, cy, r) {
    var p = [];
    for (var k = 0; k < 6; k++) { var a = Math.PI / 180 * (60 * k - 30); p.push((cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1)); }
    return p.join(" ");
  }
  function markBadge(x, y, mark) {
    if (!mark) return "";
    var c = mark === "ok" ? "var(--rm-ok)" : mark === "no" ? "var(--rm-no)" : "var(--rm-muted)";
    var g = mark === "ok" ? '<path d="M-6 0 L-2 5 L7 -5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      : mark === "no" ? '<path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
      : '<path d="M-6 0 L6 0" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>';
    return '<g transform="translate(' + x + "," + y + ')"><circle r="12" fill="' + c + '"/>' + g + "</g>";
  }

  function imageOf(assets, code) {
    var a = code && assets && assets[code];
    // http(s) 주소, 또는 그림을 통째로 담은 data:image (미리보기 페이지처럼 외부 접속이 막힌 곳용)
    return a && /^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(a.image_url || "") ? a.image_url : null;
  }

  function drawItem(it, assets, uid) {
    var x = num(it.x, 0) * U, y = num(it.y, 0) * U, w = num(it.w, 2) * U, h = num(it.h, 2) * U;
    var c = col(it.color, "var(--rm-accent)"), kind = it.kind || "card", o = "", cx = x + w / 2, cy = y + h / 2;
    var img = imageOf(assets, it.asset_code), clip = uid + "-" + (it.id || Math.random().toString(36).slice(2));
    var label = it.label || "", sub = it.sub || "";
    var picture = function (rx) {
      return '<clipPath id="' + clip + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '"/></clipPath>' +
        '<image href="' + attr(img) + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + clip + ')"/>';
    };
    // 그림을 비율 그대로 상자 안에 넣는다
    var fit = function (bx, by, bw, bh, extra) {
      return '<image href="' + attr(img) + '" x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" preserveAspectRatio="xMidYMid meet"' + (extra || "") + "/>";
    };
    // 그림 위에 얹는 글자 (반투명 바탕)
    var pill = function (px, py, t, size, anchor, maxw) {
      if (!t) return "";
      var fs = Math.round((size || 13) * FSCALE), tw = Math.min(maxw || 400, String(t).length * fs * 0.95 + 16);
      var rx0 = anchor === "start" ? px - 8 : px - tw / 2;
      return '<rect x="' + rx0 + '" y="' + (py - fs * 0.85) + '" width="' + tw + '" height="' + fs * 1.7 + '" rx="' + fs * 0.85 + '" fill="var(--rm-bg)" fill-opacity=".88"/>' +
        txt(px, py, t, { anchor: anchor || "middle", bold: true, size: size || 13, width: tw - 12, max: 1 });
    };
    if (kind === "board") {
      o += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="' + c + '" fill-opacity=".16" stroke="' + c + '" stroke-width="2"/>';
      if (img) { o += fit(x + 4, y + 4, w - 8, h - 8); o += pill(x + 16, y + 20, label, 15, "start", w - 24); }
      else o += txt(x + 14, y + 20, label, { anchor: "start", bold: true, size: 16, width: w - 28, max: 1 });
      if (sub && !img) o += txt(cx, Math.max(cy + 8, y + 20 + 30 * FSCALE), sub, { size: 13, fill: "var(--rm-muted)", width: w - 30, max: 3 });
    } else if (kind === "area") {
      o += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="none" stroke="' + col(it.color, "var(--rm-muted)") + '" stroke-width="2" stroke-dasharray="7 5"/>';
      o += txt(x + 14, y + 18, label, { anchor: "start", bold: true, size: 14, width: w - 28, max: 1, fill: "var(--rm-muted)" });
    } else if (kind === "deck" || kind === "hand") {
      var n = Math.max(1, Math.min(kind === "hand" ? 5 : 3, num(it.count, 3))), cw = kind === "hand" ? Math.min(w * 0.42, h * 0.7) : w - 10, chh = h - 26;
      for (var i = 0; i < n; i++) {
        var dx = kind === "hand" ? x + (w - cw) * (n === 1 ? 0.5 : i / (n - 1)) : x + (n - 1 - i) * 4, dy = y + (kind === "hand" ? 0 : (n - 1 - i) * 4);
        var rot = kind === "hand" ? ((i - (n - 1) / 2) * 7) : 0;
        var tf = rot ? ' transform="rotate(' + rot + " " + (dx + cw / 2) + " " + (dy + chh) + ')"' : "";
        o += img ? fit(dx, dy, cw, chh, tf)
          : '<rect x="' + dx + '" y="' + dy + '" width="' + cw + '" height="' + chh + '" rx="6" fill="var(--rm-bg)" stroke="' + c + '" stroke-width="2"' + tf + "/>";
      }
      o += img ? (it.count > 1 ? pill(cx, y + chh / 2, "×" + it.count, 14) : "") : txt(cx, y + chh / 2, it.count > 1 ? "×" + it.count : "", { bold: true, size: 15, fill: c, max: 1 });
      o += txt(cx, y + h - 10, label, { size: 13, width: w + 20, max: 1, bold: true });
    } else if (kind === "tile") {
      var r = Math.min(w, h) / 2 - 2;
      if (img) {
        r = Math.min(w, h - 22) / 2 - 2; cy = y + r + 2;
        o += fit(cx - r, cy - r, r * 2, r * 2);
        o += txt(cx, y + h - 9, label, { size: 12, bold: true, width: w + 30, max: 1 });
      } else {
        o += '<polygon points="' + hexPts(cx, cy, r) + '" fill="' + c + '" stroke="var(--rm-bg)" stroke-width="2"/>';
        o += txt(cx, cy, label, { size: 13, bold: true, fill: "#fff", width: r * 1.6, max: 2 });
      }
      if (it.count > 1) o += txt(cx + r * 0.8, cy - r * 0.8, "×" + it.count, { size: 13, bold: true, fill: c });
    } else if (kind === "token" || kind === "cube") {
      var s = Math.min(w, h) * 0.55;
      if (img) { var s2 = Math.min(w, h - 22); o += fit(cx - s2 / 2, y + 1, s2, s2); }
      else o += kind === "cube"
        ? '<rect x="' + (cx - s / 2) + '" y="' + (cy - s / 2 - 8) + '" width="' + s + '" height="' + s + '" rx="4" fill="' + c + '" stroke="var(--rm-line)"/>'
        : '<circle cx="' + cx + '" cy="' + (cy - 8) + '" r="' + s / 2 + '" fill="' + c + '" stroke="var(--rm-line)"/>';
      o += txt(cx, y + h - 8, label, { size: 12, width: w + 30, max: 1 });
    } else if (kind === "track") {
      var cells = Math.max(2, Math.min(30, num(it.n, 10))), val = num(it.value, -1), cwid = w / cells, th = Math.min(h - 26, 28);
      o += txt(x, y + 8, label, { anchor: "start", bold: true, size: 13, max: 1, width: w });
      for (var k = 0; k < cells; k++) {
        o += '<rect x="' + (x + k * cwid + 1) + '" y="' + (y + 18) + '" width="' + (cwid - 2) + '" height="' + th + '" rx="3" fill="' + c + '" fill-opacity="' + (0.25 + 0.6 * k / cells).toFixed(2) + '"/>';
      }
      if (val >= 0) {
        var vx = x + Math.min(val, cells - 1) * cwid + cwid / 2;
        o += '<rect x="' + (vx - 7) + '" y="' + (y + 18 + th / 2 - 7) + '" width="14" height="14" rx="3" fill="#fff" stroke="var(--rm-fg)" stroke-width="1.5"/>';
      }
      if (it.max) o += txt(x + w, y + 8, it.max === true ? "최대" : it.max, { anchor: "end", size: 12, bold: true, fill: "var(--rm-no)", max: 1, width: w });
      if (sub) o += txt(x, y + 18 + th + 12, sub, { anchor: "start", size: 12, fill: "var(--rm-muted)", max: 1, width: w });
    } else if (kind === "text") {
      o += txt(cx, cy, label, { size: num(it.size, 14), bold: !!it.bold, width: w, max: 3 });
    } else { // card
      o += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="var(--rm-bg)" stroke="' + c + '" stroke-width="2"/>';
      if (img) o += picture(8);
      else o += '<path d="M' + x + " " + (y + 26) + "V" + (y + 8) + "Q" + x + " " + y + " " + (x + 8) + " " + y + "H" + (x + w - 8) + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + 8) + "V" + (y + 26) + 'Z" fill="' + c + '"/>';
      o += img ? pill(cx, y + 16, label, 13, "middle", w - 6) : txt(cx, y + 14, label, { size: 13, bold: true, fill: "#fff", width: w - 10, max: 1 });
      var parts = Array.isArray(it.parts) ? it.parts.slice(0, 4) : [];
      if (parts.length) {
        var ph = Math.min(30, (h - 40) / parts.length);
        parts.forEach(function (p, j) {
          var py = y + 34 + j * (ph + 4);
          o += '<rect x="' + (x + 8) + '" y="' + py + '" width="' + (w - 16) + '" height="' + ph + '" rx="5" fill="var(--rm-soft)"/>';
          o += txt(x + 16, py + ph / 2, p.label, { anchor: "start", size: 12, width: w - 52, max: 1 });
          if (p.mark === "skip" || p.mark === "no") o += '<line x1="' + (x + 14) + '" x2="' + (x + w - 34) + '" y1="' + (py + ph / 2) + '" y2="' + (py + ph / 2) + '" stroke="var(--rm-no)" stroke-width="1.6"/>';
          o += markBadge(x + w - 20, py + ph / 2, p.mark).replace("r=\"12\"", 'r="9"');
        });
      } else if (sub) o += txt(cx, cy + 10, sub, { size: 12, fill: "var(--rm-muted)", width: w - 12, max: 3 });
      if (it.count > 1) o += txt(x + w - 6, y + h - 10, "×" + it.count, { anchor: "end", size: 13, bold: true, fill: c, max: 1 });
    }
    if (it.mark) o += markBadge(x + w - 4, y + 4, it.mark);
    return o;
  }

  // 본판 그림의 물건·칸·단계에 exp: [확장 id, ...] 가 붙어 있으면 그 확장 중 하나를 켰을 때만 남긴다
  function forExpansions(scene, active) {
    if (!isScene(scene)) return scene;
    var keep = function (o) { return !o || !Array.isArray(o.exp) || o.exp.some(function (e) { return active[e]; }); };
    var s = JSON.parse(JSON.stringify(scene));
    ["items", "nodes"].forEach(function (k) { if (Array.isArray(s[k])) s[k] = s[k].filter(keep); });
    if (Array.isArray(s.steps)) {
      s.steps = s.steps.filter(keep);
      if (!s.steps.length) s.steps = [{ text: "" }];
    }
    return s;
  }

  function stepsOf(scene) { return Array.isArray(scene.steps) && scene.steps.length ? scene.steps : [{ text: "" }]; }

  function renderLayout(scene, step, assets, uid) {
    var cols = Math.max(4, Math.min(24, num(scene.cols, 12))), rows = Math.max(2, Math.min(20, num(scene.rows, 8)));
    var steps = stepsOf(scene), items = Array.isArray(scene.items) ? scene.items : [];
    var shown = {}, focus = {}, anyAdd = steps.some(function (s) { return s.add && s.add.length; });
    steps.forEach(function (s, i) { if (i <= step) (s.add || []).forEach(function (id) { shown[id] = true; }); });
    var cur = steps[step] || {};
    (cur.focus || cur.add || []).forEach(function (id) { focus[id] = true; });
    var hasFocus = Object.keys(focus).length > 0;
    var top = scene.verdict ? 1 : 0, W = cols * U, H = (rows + top) * U, o = "";
    o += '<svg viewBox="-8 -8 ' + (W + 16) + " " + (H + 16) + '" role="img" aria-label="' + attr(cur.text || scene.title || "") + '">';
    if (scene.verdict) {
      var vm = scene.verdict.mark, vc = vm === "ok" ? "var(--rm-ok)" : vm === "no" ? "var(--rm-no)" : "var(--rm-warn)";
      o += '<rect x="0" y="4" width="' + W + '" height="' + (U - 10) + '" rx="10" fill="' + vc + '" fill-opacity=".14" stroke="' + vc + '"/>';
      o += markBadge(22, U / 2 - 1, vm) + txt(42, U / 2 - 1, scene.verdict.text || "", { anchor: "start", bold: true, size: 15, fill: vc, width: W - 60, max: 1 });
    }
    o += '<g transform="translate(0,' + top * U + ')">';
    items.forEach(function (it) {
      if (anyAdd && !shown[it.id]) return;
      var dim = hasFocus && !focus[it.id] && it.kind !== "board" && it.kind !== "area";
      o += '<g class="it' + (focus[it.id] ? " on" : "") + '" opacity="' + (dim ? 0.4 : 1) + '">' + drawItem(it, assets, uid) + "</g>";
    });
    items.forEach(function (it) {
      if (!focus[it.id] || (anyAdd && !shown[it.id])) return;
      var x = num(it.x, 0) * U, y = num(it.y, 0) * U, w = num(it.w, 2) * U, h = num(it.h, 2) * U;
      o += '<rect class="hl" x="' + (x - 5) + '" y="' + (y - 5) + '" width="' + (w + 10) + '" height="' + (h + 10) + '" rx="12" fill="none" stroke="var(--rm-hi)" stroke-width="4"/>';
    });
    return o + "</g></svg>";
  }

  function renderFlow(scene, step, narrow) {
    var nodes = Array.isArray(scene.nodes) ? scene.nodes.slice(0, 12) : [], perRow = Math.min(narrow ? 2 : 4, nodes.length || 1);
    var bw = 150, bh = 64, gx = 42, gy = 50, rowsN = Math.ceil(nodes.length / perRow) || 1;
    var loop = scene.loop && nodes.length > 1, gl = loop ? 30 : 0; // 반복 화살표는 왼쪽 여백으로 돌아간다
    var W = perRow * bw + (perRow - 1) * gx + 20 + gl, H = rowsN * bh + (rowsN - 1) * gy + (loop ? 58 : 20);
    var cur = stepsOf(scene)[step] || {}, focus = {};
    (cur.focus || []).forEach(function (id) { focus[id] = true; });
    var hasFocus = Object.keys(focus).length > 0, pos = [], o = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + attr(cur.text || "") + '">';
    o += '<defs><marker id="rmArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--rm-muted)"/></marker></defs>';
    nodes.forEach(function (n, i) {
      var r = Math.floor(i / perRow), cI = r % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow); // 지그재그
      pos.push({ x: 10 + gl + cI * (bw + gx), y: 10 + r * (bh + gy), r: r });
    });
    nodes.forEach(function (n, i) {
      if (i === 0) return;
      var a = pos[i - 1], b = pos[i];
      if (a.r === b.r) {
        var ltr = b.x > a.x;
        o += '<line x1="' + (ltr ? a.x + bw : a.x) + '" y1="' + (a.y + bh / 2) + '" x2="' + (ltr ? b.x - 4 : b.x + bw + 4) + '" y2="' + (b.y + bh / 2) + '" stroke="var(--rm-muted)" stroke-width="2" marker-end="url(#rmArrow)"/>';
      } else {
        o += '<line x1="' + (a.x + bw / 2) + '" y1="' + (a.y + bh) + '" x2="' + (b.x + bw / 2) + '" y2="' + (b.y - 4) + '" stroke="var(--rm-muted)" stroke-width="2" marker-end="url(#rmArrow)"/>';
      }
    });
    if (loop) {
      // 마지막 칸 아래 → 맨 아래 줄 → 왼쪽 여백을 타고 위로 → 첫 칸 왼쪽으로 들어간다 (다른 칸을 가로지르지 않게)
      var f = pos[0], l = pos[nodes.length - 1], ly = H - 32, lx = 12, r2 = 10;
      o += '<path d="M' + (l.x + bw / 2) + " " + (l.y + bh) + " V" + (ly - r2) + " Q" + (l.x + bw / 2) + " " + ly + " " + (l.x + bw / 2 - r2) + " " + ly +
        " H" + (lx + r2) + " Q" + lx + " " + ly + " " + lx + " " + (ly - r2) + " V" + (f.y + bh / 2 + r2) + " Q" + lx + " " + (f.y + bh / 2) + " " + (lx + r2) + " " + (f.y + bh / 2) +
        " H" + (f.x - 4) + '" fill="none" stroke="var(--rm-muted)" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#rmArrow)"/>';
      o += txt(lx + 10, ly + 16, "↺ " + (scene.loop === true ? "다시 처음으로" : scene.loop), { anchor: "start", size: 12, fill: "var(--rm-muted)", max: 1, width: W - 30 });
    }
    nodes.forEach(function (n, i) {
      var p = pos[i], on = focus[n.id], skip = n.style === "skip", c = col(n.color, "var(--rm-accent)");
      o += '<g opacity="' + (hasFocus && !on ? 0.45 : 1) + '">';
      o += '<rect x="' + p.x + '" y="' + p.y + '" width="' + bw + '" height="' + bh + '" rx="12" fill="' + (skip ? "none" : "var(--rm-bg)") + '" stroke="' + (skip ? "var(--rm-no)" : c) + '" stroke-width="2"' + (skip ? ' stroke-dasharray="6 4"' : "") + "/>";
      o += '<circle cx="' + (p.x + 16) + '" cy="' + (p.y + 16) + '" r="11" fill="' + (skip ? "var(--rm-no)" : c) + '"/>' + txt(p.x + 16, p.y + 16, String(i + 1), { size: 12, bold: true, fill: "#fff", max: 1 });
      o += txt(p.x + bw / 2 + 8, p.y + (n.note ? bh / 2 - 8 : bh / 2), n.label, { size: 15, bold: true, fill: skip ? "var(--rm-no)" : "var(--rm-fg)", width: bw - 34, max: 2 });
      if (n.note) o += txt(p.x + bw / 2 + 8, p.y + bh / 2 + 14, n.note, { size: 12, fill: "var(--rm-muted)", width: bw - 30, max: 1 });
      if (on) o += '<rect x="' + (p.x - 5) + '" y="' + (p.y - 5) + '" width="' + (bw + 10) + '" height="' + (bh + 10) + '" rx="15" fill="none" stroke="var(--rm-hi)" stroke-width="4"/>';
      o += "</g>";
    });
    return o + "</svg>";
  }

  var TIER_C = { S: "#d6336c", A: "#e0731f", B: "#e8a800", C: "#2f9e5b", D: "#2f7fd1" };
  function renderTier(scene, assets) {
    var rows = Array.isArray(scene.rows) ? scene.rows.slice(0, 8) : [], cw = 96, ch = 60, lab = 56, gap = 8;
    var maxN = rows.reduce(function (m, r) { return Math.max(m, (r.items || []).length); }, 1), perRow = Math.min(6, maxN);
    var W = lab + perRow * (cw + gap) + gap, y = 0, o = "";
    rows.forEach(function (r) {
      var its = (r.items || []).slice(0, 18), lines_ = Math.max(1, Math.ceil(its.length / perRow)), rh = lines_ * (ch + gap) + gap;
      var c = col(r.color, TIER_C[r.tier] || "var(--rm-accent)");
      o += '<rect x="0" y="' + y + '" width="' + lab + '" height="' + rh + '" rx="8" fill="' + c + '"/>' + txt(lab / 2, y + rh / 2, r.tier || "", { size: 22, bold: true, fill: "#fff", max: 1 });
      o += '<rect x="' + lab + '" y="' + y + '" width="' + (W - lab) + '" height="' + rh + '" rx="8" fill="var(--rm-soft)"/>';
      its.forEach(function (it, i) {
        var ix = lab + gap + (i % perRow) * (cw + gap), iy = y + gap + Math.floor(i / perRow) * (ch + gap), img = imageOf(assets, it.asset_code);
        o += '<rect x="' + ix + '" y="' + iy + '" width="' + cw + '" height="' + ch + '" rx="6" fill="var(--rm-bg)" stroke="var(--rm-line)"/>';
        if (img) o += '<image href="' + attr(img) + '" x="' + ix + '" y="' + iy + '" width="' + cw + '" height="' + (ch - 18) + '" preserveAspectRatio="xMidYMid meet"/>';
        o += txt(ix + cw / 2, img ? iy + ch - 9 : iy + ch / 2, it.label, { size: 12, bold: !img, width: cw - 8, max: img ? 1 : 2 });
      });
      y += rh + 6;
    });
    return '<svg viewBox="0 0 ' + W + " " + Math.max(y, 10) + '" role="img" aria-label="' + attr(scene.title || "티어표") + '">' + o + "</svg>";
  }

  var SCENE_TYPES = { layout: 1, flow: 1, tier: 1 };
  function isScene(s) { return !!(s && typeof s === "object" && SCENE_TYPES[s.type]); }
  function renderScene(scene, step, assets, uid, narrow) {
    if (!isScene(scene)) return "";
    uid = uid || "rm";
    FSCALE = narrow && scene.type === "layout" ? 1.2 : 1;
    try {
      if (scene.type === "flow") return renderFlow(scene, step, narrow);
      if (scene.type === "tier") return renderTier(scene, assets);
      return renderLayout(scene, step, assets, uid);
    } finally { FSCALE = 1; }
  }

  // 그림 + 단계 넘기기 (위젯과 관리 페이지 미리보기가 같이 쓴다)
  function sceneBlock(scene, step, assets, uid, lang, narrow) {
    var steps = stepsOf(scene), n = scene.type === "tier" ? 1 : steps.length, s = Math.max(0, Math.min(step, n - 1));
    var text = (steps[s] || {}).text || "";
    var nav = n > 1
      ? '<div class="snav"><button type="button" data-sstep="' + (s - 1) + '"' + (s === 0 ? " disabled" : "") + ' aria-label="' + (lang === "en" ? "Previous" : "이전") + '">‹</button>' +
        '<span class="sdots">' + steps.map(function (_, i) { return '<button type="button" class="dot' + (i === s ? " on" : "") + '" data-sstep="' + i + '" aria-label="' + (i + 1) + '"></button>'; }).join("") + "</span>" +
        '<button type="button" data-sstep="' + (s + 1) + '"' + (s === n - 1 ? " disabled" : "") + ' aria-label="' + (lang === "en" ? "Next" : "다음") + '">›</button></div>'
      : "";
    return '<figure class="scene" data-step="' + s + '">' + renderScene(scene, s, assets, uid, narrow) +
      (text || nav ? '<figcaption>' + (n > 1 ? '<b class="sn">' + (s + 1) + "/" + n + "</b> " : "") + esc(text) + "</figcaption>" : "") + nav +
      calloutBlock(scene, s, assets, lang) + "</figure>";
  }

  // 그림 속 번호 설명: 지금 단계에 보이는 구성물 그림 중 번호 설명(callouts)이 있는 것을 "1번 ○○" 목록으로 보여 준다.
  // 강조(focus)된 것이 있으면 그것만, 없으면 보이는 것 전부.
  function calloutBlock(scene, step, assets, lang) {
    if (!assets || scene.type !== "layout") return "";
    var steps = stepsOf(scene), items = Array.isArray(scene.items) ? scene.items : [];
    var anyAdd = steps.some(function (x) { return x.add && x.add.length; }), shown = {}, focus = {};
    steps.forEach(function (x, i) { if (i <= step) (x.add || []).forEach(function (id) { shown[id] = true; }); });
    ((steps[step] || {}).focus || (steps[step] || {}).add || []).forEach(function (id) { focus[id] = true; });
    var withCo = items.filter(function (it) {
      var a = it.asset_code && assets[it.asset_code];
      return a && imageOf(assets, it.asset_code) && Array.isArray(a.callouts) && a.callouts.length && (!anyAdd || shown[it.id]);
    });
    var focused = withCo.filter(function (it) { return focus[it.id]; });
    var pick = focused.length ? focused : withCo, seen = {}, out = "";
    pick.forEach(function (it) {
      if (seen[it.asset_code]) return;
      seen[it.asset_code] = true;
      var a = assets[it.asset_code];
      out += '<div class="co"><div class="cot">' + esc(a.title || it.label || "") + (lang === "en" ? " · numbers" : " 번호 설명") + "</div><ol>" +
        a.callouts.slice(0, 40).map(function (c) {
          return '<li><span class="cn">' + esc(String(c.n)) + "</span><span><b>" + esc(c.label || "") + "</b>" + (c.desc ? ' <span class="cd">' + esc(c.desc) + "</span>" : "") + "</span></li>";
        }).join("") + "</ol></div>";
    });
    return out ? '<div class="callouts">' + out + "</div>" : "";
  }

  function anonKey() {
    var k = null;
    try { k = localStorage.getItem("rulemaster.anon"); } catch (e) { /* 저장소를 못 쓰면 이번 방문용 */ }
    if (!k) {
      k = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem("rulemaster.anon", k); } catch (e) { /* 무시 */ }
    }
    return k;
  }

  function mount(target, opts) {
    var host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) throw new Error("RuleMaster: 넣을 자리를 찾지 못했습니다 (" + target + ")");
    opts = opts || {};
    if (!opts.api) throw new Error("RuleMaster: api 주소가 필요합니다");
    var lang = opts.lang === "en" ? "en" : "ko";
    var T = TXT[lang];
    var api = String(opts.api).replace(/\/$/, "");
    var token = opts.token || null;
    var isMember = !!(opts.token || opts.getToken);
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    if (opts.accent) host.style.setProperty("--rm-accent", opts.accent);
    if (opts.theme) host.setAttribute("data-theme", opts.theme);

    var state = { tab: opts.startTab || "setup", content: null, error: null, steps: {}, answerScene: null, answerStep: 0 };
    // 이용자가 고른 확장(룰 마스터 ID). null 이면 고객사가 넘긴 expansionIds 를 쓴다
    var picker = opts.expansionPicker !== false;
    var wikiEditOn = opts.wikiEdit !== false;
    var expKey = "rulemaster.exp." + (opts.gameId || "x:" + opts.externalGameId);
    state.expSel = null;
    if (picker) {
      try { var sv = JSON.parse(localStorage.getItem(expKey) || "null"); if (Array.isArray(sv)) state.expSel = sv.slice(0, 10); } catch (e) { /* 기억 못 하면 기본값 */ }
    }

    async function auth(force) {
      if (isMember) {
        if ((!token || force) && opts.getToken) token = await opts.getToken();
        return { "x-widget-token": token || "" };
      }
      return { "x-widget-key": opts.widgetKey || "" };
    }

    async function req(method, path, body, retried) {
      var headers = Object.assign({ "content-type": "application/json" }, await auth(false));
      var res = await fetch(api + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 401 && isMember && opts.getToken && !retried) {
        await auth(true);
        return req(method, path, body, true);
      }
      return { status: res.status, body: data };
    }

    function gameQuery() {
      var q = [];
      if (opts.gameId) q.push("game_id=" + encodeURIComponent(opts.gameId));
      else if (opts.externalGameId != null) q.push("external_game_id=" + encodeURIComponent(opts.externalGameId));
      if (state.expSel) { if (state.expSel.length) q.push("expansion_ids=" + state.expSel.map(encodeURIComponent).join(",")); }
      else {
        if (opts.expansionIds && opts.expansionIds.length) q.push("expansion_ids=" + opts.expansionIds.map(encodeURIComponent).join(","));
        if (opts.externalExpansionIds && opts.externalExpansionIds.length) q.push("external_expansion_ids=" + opts.externalExpansionIds.map(encodeURIComponent).join(","));
      }
      q.push("lang=" + lang);
      return q.join("&");
    }
    function gameBody() {
      var b = { lang: lang };
      if (opts.gameId) { b.game_id = opts.gameId; b.expansion_ids = opts.expansionIds || []; }
      else { b.external_game_id = opts.externalGameId; b.external_expansion_ids = opts.externalExpansionIds || []; }
      // 이용자가 칩으로 고른 확장이 있으면 그것으로 묻는다 (지금 화면에 보이는 확장과 같게)
      if (state.content) { b.expansion_ids = (state.content.expansions || []).map(function (e) { return e.id; }); b.external_expansion_ids = []; }
      if (!isMember) b.anonymous_key = anonKey();
      return b;
    }

    root.innerHTML = "<style>" + CSS + "</style>" +
      '<div class="box" part="box">' +
      '<div class="head"><h3 class="title"></h3><span class="brand"></span></div>' +
      '<div class="exp"></div>' +
      '<div class="tabs" role="tablist"></div>' +
      '<div class="panel" role="tabpanel"><div class="muted">' + esc(T.loading) + "</div></div>" +
      '<div class="ask"><form class="row"><textarea rows="2" maxlength="500" aria-label="' + esc(T.ask) + '" placeholder="' + esc(T.placeholder) + '"></textarea>' +
      '<button class="go" type="submit">' + esc(T.ask) + "</button></form><div class=\"out\" aria-live=\"polite\"></div></div></div>" +
      '<div class="ov" hidden><div class="sheet" role="dialog" aria-modal="true"><div class="sh-head"><div class="st"><b></b><span></span></div>' +
      '<button type="button" class="x" aria-label="' + (lang === "en" ? "Close" : "닫기") + '">×</button></div>' +
      '<div class="sh-body"></div><div class="sh-foot"><button type="button" data-nav="-1"></button><span class="pos"></span><button type="button" data-nav="1"></button></div></div></div>';

    var $ = function (s) { return root.querySelector(s); };
    var narrow = function () { return (host.getBoundingClientRect().width || 600) < 560; };
    // 화면 폭이 좁음↔넓음으로 바뀌면 그림을 다시 그린다
    var wasNarrow = null;
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () {
        var n = narrow();
        if (wasNarrow !== null && n !== wasNarrow && state.content) renderPanel();
        wasNarrow = n;
      }).observe(host);
    }
    $(".brand").textContent = opts.brand || (lang === "en" ? "Rule Master" : "룰 마스터");

    function renderTabs() {
      var sec = (state.content && state.content.sections) || {};
      $(".tabs").innerHTML = SECTIONS.map(function (s) {
        var n = (sec[s.key] || []).length;
        return '<button class="tab" role="tab" data-k="' + s.key + '" aria-selected="' + (state.tab === s.key) + '">' +
          esc(s[lang]) + (state.content ? '<span class="n">' + n + "</span>" : "") + "</button>";
      }).join("");
    }

    function renderPanel() {
      var p = $(".panel");
      if (state.error) { p.innerHTML = '<div class="empty">' + esc(state.error) + "</div>"; return; }
      if (!state.content) { p.innerHTML = '<div class="muted">' + esc(T.loading) + "</div>"; return; }
      var list = state.content.sections[state.tab] || [];
      if (!list.length) { p.innerHTML = '<div class="empty">' + esc(T.empty) + "</div>"; return; }
      var base = state.content.game.id;
      if (opts.layout !== "list") {
        p.innerHTML = '<div class="cards">' + list.map(function (c, i) { return cardHtml(c, i, base); }).join("") + "</div>";
        p.scrollTop = 0;
        return;
      }
      p.innerHTML = list.map(function (c, i) {
        var from = c.game_id !== base ? ' <span class="from">' + esc(c.game_title) + "</span>" : "";
        var sc = isScene(c.highlight_scene) ? '<div data-scene="' + esc(c.id) + '">' + sceneBlock(c.highlight_scene, state.steps[c.id] || 0, state.content.assets, "c" + i, lang, narrow()) + "</div>" : "";
        return "<details" + (i === 0 ? " open" : "") + "><summary>" + esc(c.title) + from + "</summary>" + sc + '<div class="md">' + md(c.content_md) + "</div></details>";
      }).join("");
      p.scrollTop = 0;
    }

    // 카드: 그림 미리보기(배치도는 마지막 단계 = 다 차린 모습) + 제목 + 요약. 누르면 큰 카드로 띄운다
    function plain(src) {
      return String(src || "").replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`|\[\]]/g, " ").replace(/^\s*[-+]\s+/gm, "").replace(/\s+/g, " ").trim();
    }
    function cardHtml(c, i, base) {
      var th = "", tags = [];
      if (isScene(c.highlight_scene)) {
        var st = stepsOf(c.highlight_scene), last = c.highlight_scene.type === "layout" ? st.length - 1 : 0;
        try { th = '<div class="th" aria-hidden="true">' + renderScene(c.highlight_scene, last, state.content.assets, "t" + i, false) + "</div>"; } catch (e) { th = ""; }
        if (st.length > 1) tags.push('<span class="pic">' + (lang === "en" ? st.length + " steps" : "그림 " + st.length + "단계") + "</span>");
      }
      if (c.game_id !== base) tags.push("<span>" + esc(String(c.game_title || "").replace(/^.*:\s*/, "")) + "</span>");
      var sum = plain(c.content_md);
      return '<button type="button" class="card' + (th ? "" : " nopic") + '" data-open="' + i + '">' + th +
        '<span class="ct"><span class="ctt">' + esc(c.title) + "</span>" + (sum ? '<span class="sum">' + esc(sum.slice(0, 160)) + "</span>" : "") +
        (tags.length ? '<span class="tg">' + tags.join("") + "</span>" : "") + "</span></button>";
    }
    var openIdx = -1, lastFocus = null;
    function openCard(i) {
      var list = (state.content && state.content.sections[state.tab]) || [], c = list[i];
      if (!c) return;
      if (openIdx < 0) lastFocus = root.activeElement;
      openIdx = i;
      var base = state.content.game.id;
      $(".sh-head b").textContent = c.title;
      $(".sh-head span").textContent = c.game_id !== base ? c.game_title : "";
      var sc = isScene(c.highlight_scene) ? '<div data-scene="' + esc(c.id) + '">' + sceneBlock(c.highlight_scene, state.steps[c.id] || 0, state.content.assets, "s" + c.id.slice(0, 6), lang, narrow()) + "</div>" : "";
      $(".sh-body").innerHTML = sc + '<div class="md">' + md(c.content_md) + '</div><div class="w"></div>';
      wikiBox($(".sh-body .w"), { type: "chapter", id: c.id, title: c.title, text: c.content_md, locked: c.locked, edited_at: c.edited_at }, function (v) {
        c.title = v.title; c.content_md = v.text; c.edited_at = v.edited_at;
        renderPanel(); openCard(i);
      });
      $(".sh-body").scrollTop = 0;
      var prev = list[i - 1], next = list[i + 1], pb = $('[data-nav="-1"]'), nb = $('[data-nav="1"]');
      pb.disabled = !prev; pb.textContent = prev ? "‹ " + prev.title : "";
      nb.disabled = !next; nb.textContent = next ? next.title + " ›" : "";
      $(".pos").textContent = (i + 1) + " / " + list.length;
      $(".ov").hidden = false;
      $(".x").focus();
    }
    function closeCard() {
      if (openIdx < 0) return;
      openIdx = -1;
      $(".ov").hidden = true;
      if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* 무시 */ }
    }
    $(".panel").addEventListener("click", function (e) {
      var b = e.target.closest("[data-open]");
      if (b) openCard(Number(b.getAttribute("data-open")));
    });
    $(".ov").addEventListener("click", function (e) {
      if (e.target === e.currentTarget || e.target.closest(".x")) { closeCard(); return; }
      var n = e.target.closest("[data-nav]");
      if (n && !n.disabled) openCard(openIdx + Number(n.getAttribute("data-nav")));
    });
    // 그림 단계를 넘기면 버튼이 다시 그려져 초점이 밖으로 나가므로 문서 전체에서 키를 받는다
    document.addEventListener("keydown", function (e) {
      if (openIdx < 0 || !host.isConnected) return;
      var t = (e.composedPath && e.composedPath()[0]) || e.target;
      var typing = /TEXTAREA|INPUT|SELECT/.test((t && t.tagName) || "") || (t && t.isContentEditable);
      if (e.key === "Escape") { e.preventDefault(); closeCard(); }
      else if (!typing && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        var d = e.key === "ArrowRight" ? 1 : -1, nb = $('[data-nav="' + d + '"]');
        if (!nb.disabled) openCard(openIdx + d);
      }
    });

    // 그림 단계 넘기기 (정리 글과 AI 답 공용)
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sstep]");
      if (!b || b.disabled) return;
      var host_ = b.closest("[data-scene]"), step = Number(b.getAttribute("data-sstep"));
      if (!host_) return;
      var key = host_.getAttribute("data-scene");
      if (key === "answer") {
        state.answerStep = step;
        host_.innerHTML = sceneBlock(state.answerScene, step, state.content && state.content.assets, "ans", lang, narrow());
        return;
      }
      var ch = ((state.content && state.content.sections[state.tab]) || []).filter(function (c) { return c.id === key; })[0];
      if (!ch) return;
      state.steps[key] = step;
      host_.innerHTML = sceneBlock(ch.highlight_scene, step, state.content.assets, "s" + key.slice(0, 6), lang, narrow());
    });

    $(".tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (!b) return;
      state.tab = b.getAttribute("data-k");
      closeCard();
      renderTabs();
      renderPanel();
    });

    // 함께 쓸 확장 칩: 이용자가 직접 켜고 끈다
    function renderExp(body) {
      var box = $(".exp"), avail = body.available_expansions || [], on = {};
      (body.expansions || []).forEach(function (e) { on[e.id] = true; });
      if (!picker || !avail.length) {
        box.className = "exp";
        box.textContent = (body.expansions || []).map(function (e) { return "+ " + e.title; }).join("  ");
        return;
      }
      var base = body.game.title;
      box.className = "exp pick";
      box.innerHTML = '<span class="lab">' + esc(lang === "en" ? "Expansions" : "함께 쓸 확장") + "</span>" + avail.map(function (e) {
        var t = e.title.indexOf(base + ":") === 0 ? e.title.slice(base.length + 1).trim() : e.title; // "테라포밍 마스: 서곡" → "서곡"
        return '<button type="button" class="chip" data-exp="' + esc(e.id) + '" aria-pressed="' + (on[e.id] ? "true" : "false") + '" title="' + esc(e.title) + '">' + esc(t) + "</button>";
      }).join("");
    }
    $(".exp").addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".chip");
      if (!b || !state.content) return;
      var sel = (state.content.expansions || []).map(function (x) { return x.id; }), id = b.getAttribute("data-exp"), i = sel.indexOf(id);
      if (i >= 0) sel.splice(i, 1); else sel.push(id);
      state.expSel = sel.slice(0, 10);
      state.picked = true;
      try { localStorage.setItem(expKey, JSON.stringify(state.expSel)); } catch (err) { /* 기억 못 해도 이번 화면엔 반영 */ }
      root.querySelectorAll(".exp .chip").forEach(function (c) { c.disabled = true; });
      b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
      closeCard();
      state.steps = {};
      load();
    });

    async function load() {
      renderTabs();
      if (!isMember && !opts.widgetKey) {
        state.error = lang === "en" ? "Widget key is missing." : "위젯 키가 없습니다. 관리 페이지 고객사 탭에서 만든 위젯 키(rmw_...)를 넣어 주세요.";
        renderPanel();
        return;
      }
      state.error = null;
      try {
        var r = await req("GET", "/v1/content?" + gameQuery());
        if (r.status === 400 && state.expSel && !state.picked) { // 기억해 둔 확장이 더는 안 맞으면 고객사 기본값으로
          state.expSel = null;
          try { localStorage.removeItem(expKey); } catch (e) { /* 무시 */ }
          r = await req("GET", "/v1/content?" + gameQuery());
        }
        if (r.status !== 200) throw new Error(r.body.message || T.fail);
        state.content = r.body;
        // 켠 확장에 맞춰 본판 그림에 확장 단계를 끼우거나 뺀다
        var active = {};
        (r.body.expansions || []).forEach(function (e) { active[e.id] = true; });
        Object.keys(r.body.sections || {}).forEach(function (k) {
          (r.body.sections[k] || []).forEach(function (c) { c.highlight_scene = forExpansions(c.highlight_scene, active); });
        });
        // 관리 페이지에서 올린 그림은 '/v1/image/<id>' 로 오므로 API 주소를 붙인다
        Object.keys(r.body.assets || {}).forEach(function (k) {
          var a = r.body.assets[k];
          if (a && /^\/v1\/image\//.test(a.image_url || "")) a.image_url = api + a.image_url;
        });
        $(".title").textContent = r.body.game.title;
        renderExp(r.body);
        // 첫 탭이 비어 있으면 내용 있는 탭으로
        if (!(r.body.sections[state.tab] || []).length) {
          var first = SECTIONS.filter(function (s) { return (r.body.sections[s.key] || []).length; })[0];
          if (first) state.tab = first.key;
        }
      } catch (e) {
        state.error = e.message || T.fail;
      }
      renderTabs();
      renderPanel();
    }

    // 위키: 누구나 바로 고치기 + 고친 기록. item = { type, id, title?, text, locked, edited_at }
    function wikiBox(box, item, onSaved) {
      box.className = "wiki";
      // 회원만 고치는 설정이면, 회원 토큰이 없는 위젯의 "고치기"는 고치는 사이트(로그인)로 가는 링크가 된다
      var wk = (state.content && state.content.wiki) || {};
      var away = !isMember && wk.member_only ? (wk.edit_url ? wk.edit_url.replace("{type}", encodeURIComponent(item.type)).replace("{id}", encodeURIComponent(item.id)) : "") : null;
      var editBtn = !wikiEditOn || away === "" ? "" : away ? '<a class="away" href="' + esc(away) + '" target="_blank" rel="noopener" title="' + esc(T.editAway) + '">' + esc(T.edit) + " ↗</a>" :
        '<button type="button" data-w="edit">' + esc(T.edit) + "</button>";
      var bar = '<div class="bar">' + (item.locked ? '<span class="note">🔒 ' + esc(T.locked) + "</span>" : editBtn) +
        '<button type="button" data-w="hist">' + esc(T.hist) + "</button>" +
        (item.edited_at ? '<span class="note">' + esc(T.edited) + " · " + esc(day(item.edited_at)) + "</span>" : "") + '<span class="note msg"></span></div>';
      box.innerHTML = bar + '<div class="area"></div>';
      var area = box.querySelector(".area"), msg = box.querySelector(".msg");
      box.onclick = async function (e) {
        var b = e.target.closest("button[data-w]");
        if (!b) return;
        var w = b.getAttribute("data-w");
        if (w === "edit") {
          area.innerHTML = '<form>' + (item.type === "chapter" ? '<input name="t" maxlength="200" placeholder="' + esc(T.titlePh) + '">' : "") +
            '<textarea name="x" maxlength="' + (item.type === "chapter" ? 20000 : 4000) + '"></textarea>' +
            '<input name="n" maxlength="300" placeholder="' + esc(T.notePh) + '"><div class="hint">' + esc(T.editHint) + "</div>" +
            '<div class="row2"><button type="button" data-w="cancel">' + esc(T.cancel) + '</button><button type="submit">' + esc(T.save) + "</button></div></form>";
          var f = area.querySelector("form");
          if (f.t) f.t.value = item.title || "";
          f.x.value = item.text || "";
          f.x.focus();
          f.onsubmit = async function (ev) {
            ev.preventDefault();
            var sb = f.querySelector("[type=submit]"); sb.disabled = true;
            var body = { type: item.type, id: item.id, text: f.x.value.trim(), note: f.n.value.trim() || undefined };
            if (f.t) body.title = f.t.value.trim() || undefined;
            if (!isMember) body.anonymous_key = anonKey();
            var r = await req("POST", "/v1/edit", body);
            sb.disabled = false;
            if (r.status === 200) {
              area.innerHTML = "";
              msg.textContent = T.saved;
              if (r.body.saved) onSaved({ title: body.title || item.title, text: body.text, edited_at: new Date().toISOString() });
            } else {
              msg.textContent = r.status === 423 ? T.locked : r.status === 429 ? T.editLimit : (r.body.message || T.fail);
              if (r.status === 401 && r.body.edit_url) { area.innerHTML = '<a class="away" href="' + esc(r.body.edit_url) + '" target="_blank" rel="noopener">' + esc(T.editAway) + " ↗</a>"; }
            }
          };
        } else if (w === "cancel") {
          area.innerHTML = "";
        } else if (w === "hist") {
          if (area.querySelector("ol.h")) { area.innerHTML = ""; return; }
          area.innerHTML = '<div class="hint">' + esc(T.loading) + "</div>";
          var r = await req("GET", "/v1/history?type=" + item.type + "&id=" + encodeURIComponent(item.id));
          var list = (r.status === 200 && r.body.revisions) || [];
          area.innerHTML = !list.length ? '<div class="hint">' + esc(r.status === 200 ? T.noHist : (r.body.message || T.fail)) + "</div>" :
            '<ol class="h">' + list.map(function (v) {
              return "<li><span class=\"who\">" + esc(v.editor) + " · " + esc(day(v.created_at)) + (v.is_revert ? " · " + esc(T.revert) : "") + "</span>" +
                (v.note && !v.is_revert ? " " + esc(v.note) : "") +
                "<details><summary>" + esc(T.before) + "</summary><pre>" + esc((v.before.title ? v.before.title + "\n" : "") + (v.before.text || "")) + "</pre></details></li>";
            }).join("") + "</ol>";
        }
      };
    }
    function day(iso) {
      var d = new Date(iso);
      if (isNaN(d)) return "";
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    function renderAnswer(r) {
      var out = $(".out");
      var b = r.body;
      if (r.status === 429) { out.innerHTML = '<div class="err">' + esc(T.limit) + "</div>"; return; }
      if (r.status === 503) { out.innerHTML = '<div class="err">' + esc(T.busy) + "</div>"; return; }
      if (r.status !== 200) { out.innerHTML = '<div class="err">' + esc(b.message || T.fail) + "</div>"; return; }
      var opinion = /^(참고 의견|Opinion)\s*:/.test(b.answer || "");
      var text = opinion ? b.answer.replace(/^(참고 의견|Opinion)\s*:\s*/, "") : b.answer;
      var chips = [];
      if (opinion) chips.push('<span class="chip">' + esc(T.opinion) + "</span>");
      if (b.is_verified) chips.push('<span class="chip v">' + esc(T.verified) + "</span>");
      else if (b.source === "cache") chips.push('<span class="chip">' + esc(T.cached) + "</span>");
      else chips.push('<span class="chip">' + esc(T.fresh) + "</span>");
      (b.sources || []).forEach(function (s) {
        var sec = SECTIONS.filter(function (x) { return x.key === s.section; })[0];
        chips.push('<span class="chip">' + esc(T.source) + ": " + esc(sec ? sec[lang] : s.rule_category) + (s.source_ref ? " · " + esc(s.source_ref) : "") + "</span>");
      });
      if (typeof b.remaining === "number") chips.push('<span class="chip">' + esc(T.left) + " " + b.remaining + "</span>");
      var steps = "";
      if (isScene(b.scene_json)) {
        state.answerScene = b.scene_json; state.answerStep = 0;
        steps = '<div data-scene="answer">' + sceneBlock(b.scene_json, 0, state.content && state.content.assets, "ans", lang, narrow()) + "</div>";
      } else if (b.scene_json && b.scene_json.steps && b.scene_json.steps.length > 1) {
        steps = '<ol class="steps">' + b.scene_json.steps.map(function (s) { return "<li>" + esc(s.text) + "</li>"; }).join("") + "</ol>";
      }
      var fb = "";
      if (b.qa_id) {
        fb = '<div class="fb"><button data-fb="upvote">👍 ' + esc(T.helpful) + '</button><button data-fb="wrong">' + esc(T.wrong) + '</button><span class="note"></span></div>';
      }
      out.innerHTML = '<div class="ans' + (opinion ? " opinion" : "") + '"><div class="meta">' + chips.join("") + "</div>" +
        (b.grounded === false ? '<div class="muted" style="padding:0 0 4px">' + esc(T.noGround) + "</div>" : "") +
        '<div class="md" style="padding:0">' + md(text) + "</div>" + steps + fb + "</div>";
      if (b.qa_id) {
        wireFeedback(b.qa_id);
        var wb = document.createElement("div");
        $(".out .ans").appendChild(wb);
        wikiBox(wb, { type: "answer", id: b.qa_id, text: b.answer, locked: b.locked, edited_at: b.edited_at }, function (v) {
          b.answer = v.text; b.is_verified = false; b.edited_at = v.edited_at;
          renderAnswer({ status: 200, body: b });
        });
      }
      if (typeof opts.onAnswer === "function") { try { opts.onAnswer(b); } catch (e) { /* 콜백 오류는 무시 */ } }
    }

    function wireFeedback(qaId) {
      var box = $(".out .fb");
      var note = box.querySelector(".note");
      async function send(type, fix) {
        var r = await req("POST", "/v1/feedback", { qa_id: qaId, type: type, suggested_fix: fix || undefined, anonymous_key: isMember ? undefined : anonKey() });
        note.textContent = r.status === 200 ? (r.body.accepted ? T.thanks : T.already) : (r.body.message || T.fail);
      }
      box.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-fb]");
        if (!b) return;
        if (b.getAttribute("data-fb") === "upvote") { b.disabled = true; send("upvote"); return; }
        if (box.querySelector(".fix")) return;
        var f = document.createElement("div");
        f.className = "fix";
        f.innerHTML = '<textarea maxlength="2000" placeholder="' + esc(T.fixPh) + '"></textarea><button>' + esc(T.sendFix) + "</button>";
        box.appendChild(f);
        f.querySelector("button").addEventListener("click", function () {
          f.querySelector("button").disabled = true;
          send("errata_report", f.querySelector("textarea").value.trim());
        });
      });
    }

    $("form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var ta = $("textarea"), btn = $("button.go");
      var q = ta.value.trim();
      if (!q) return;
      btn.disabled = true;
      $(".out").innerHTML = '<div class="muted">' + esc(T.thinking) + "</div>";
      try {
        renderAnswer(await req("POST", "/v1/ask", Object.assign(gameBody(), { question: q })));
      } catch (err) {
        $(".out").innerHTML = '<div class="err">' + esc(T.fail) + "</div>";
      }
      btn.disabled = false;
    });
    $("textarea").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("form").requestSubmit(); }
    });

    load();
    return {
      reload: load,
      setGame: function (g) {
        Object.assign(opts, g);
        if (g.api) api = String(g.api).replace(/\/$/, "");
        if (g.token) token = g.token;
        state.content = null; state.error = null; state.steps = {}; $(".out").innerHTML = ""; load();
      },
    };
  }

  // 관리 페이지 미리보기용으로 그림 함수와 스타일도 내보낸다
  global.RuleMaster = { mount: mount, version: "1.6.0", renderScene: renderScene, sceneBlock: sceneBlock, isScene: isScene, forExpansions: forExpansions, css: CSS };
})(typeof window !== "undefined" ? window : this);
