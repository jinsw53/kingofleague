const dataJsonUrl = "https://jinsw53.github.io/kingofleague/data.json";
const logJsonUrl = "https://jinsw53.github.io/kingofleague/logs.json";

const container = document.getElementById("team-container");
const board = document.getElementById("board-area");
const logBox = document.querySelector(".log-box");

let audioCtx = null;
function ensureAudioContext() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

/* -------------------
   로그 박스 크기 조정
------------------- */
function adjustLogBox() {
  const boardRect = board.getBoundingClientRect();

  const maxHeight = boardRect.height * 0.4; // 세로 최대 40%
  const maxWidth = boardRect.width * 0.25; // 가로 최대 25%

  // 세로 기준으로 가로 계산, 최대폭 제한
  const height = Math.min(maxHeight, boardRect.height * 0.4);
  const width = Math.min(height * 2, maxWidth); // 비율 0.6로 제한

  logBox.style.maxHeight = height + "px";
  logBox.style.height = height + "px";
  logBox.style.width = width + "px";
}

window.addEventListener("load", adjustLogBox);
window.addEventListener("resize", adjustLogBox);

/* -------------------
   카드 생성
------------------- */
async function fetchData() {
  try {
    const response = await fetch(dataJsonUrl);
    const data = await response.json();
    container.innerHTML = "";

    const visibleData = data.filter(
      (item) => item.팀명 && item.팀명.trim() !== ""
    );

    visibleData.forEach((item) => {
      const name = item.팀명;
      const MAX_HEARTS = 7;
      const life = Math.min(item.하트 || 0, MAX_HEARTS);
      const game = item["회복에 필요한 게임"] || "";
      const logo = item.로고 || "https://via.placeholder.com/80";

      const redHearts = "❤️".repeat(life);
      const blackHearts = "🖤".repeat(7 - life);
      const heartDisplay = redHearts + blackHearts;

      const card = document.createElement("div");
      card.className = "team-card";
      card.setAttribute("data-team", name);
      card.setAttribute("data-game", game);

      // 기존 div 구조 대신 info div 추가
      card.innerHTML = `
    <img class="team-logo" src="${logo}" alt="${name} 로고">
    <div class="team-info">
      <h3 class="team-name">${name}</h3>
      <p class="team-life">${heartDisplay}</p>
    </div>
  `;
      container.appendChild(card);
    });

    positionCards();
  } catch (e) {
    console.error(e);
  }
}

/* -------------------
   카드 배치 (타원형)
------------------- */
/* -------------------
   팀 카드 배치 (로그 박스 기준 타원)
------------------- */
function positionCards() {
  const cards = document.querySelectorAll(".team-card");
  const logRect = logBox.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  if (cards.length === 0 || !logRect) return;

  // 로그 박스 중심 좌표
  const centerX = logRect.left + logRect.width / 2 - boardRect.left;
  const centerY = logRect.top + logRect.height / 2 - boardRect.top;

  // 타원 반지름: 가로는 로그 박스 너비 기반, 세로는 조금 작게
  const baseRadiusX = logRect.width * 1.2;
  const radiusY = logRect.height * 1;

  // 카드 간 최소 간격 (px)
  const gap = 10;

  // 총 각도 계산 (360도)
  const totalCards = cards.length;

  cards.forEach((card, i) => {
    // 카드 폭은 글자 길이에 맞춰 자동
    const img = card.querySelector(".team-logo");
    const title = card.querySelector(".team-name");
    const life = card.querySelector(".team-life");

    const cardHeight = Math.min(logRect.height * 0.25, 160);
    img.style.width = cardHeight + "px";
    img.style.height = cardHeight + "px";
    img.style.marginRight = "6px";

    title.style.fontSize = Math.max(cardHeight * 0.18, 10) + "px";
    life.style.fontSize = Math.max(cardHeight * 0.1, 9) + "px";

    // 정보 영역 너비 계산
    const infoWidth = Math.max(title.offsetWidth, life.offsetWidth);

    // 카드 전체 폭
    const cardWidth = img.offsetWidth + infoWidth + 6 + 16; // 이미지 + info + 마진 + padding
    card.style.width = cardWidth + "px";
    card.style.height = cardHeight + "px";

    // 각 카드별 반지름 조정 (겹치지 않도록)
    const radiusX = baseRadiusX + cardWidth / 2;

    // 타원형 배치
    const angle = ((2 * Math.PI) / totalCards) * i;
    const x = centerX + radiusX * Math.cos(angle) - cardWidth / 2;
    const y = centerY + radiusY * Math.sin(angle) - cardHeight / 2;

    card.style.left = x + "px";
    card.style.top = y + "px";
  });
}

/* -------------------
   로그 박스 헤더 추가
------------------- */
function updateLogHeader() {
  if (!logBox) return;
  if (!logBox.querySelector(".log-header")) {
    const header = document.createElement("div");
    header.className = "log-header";
    header.innerText = "LOGS";
    header.style.fontWeight = "bold";
    header.style.marginBottom = "4px";
    header.style.width = "100%";
    header.style.textAlign = "center";
    logBox.prepend(header);
  }
}

// 초기화 시 실행
window.addEventListener("load", () => {
  updateLogHeader();
  positionCards();
  adjustLogBox();
});

window.addEventListener("resize", () => {
  positionCards();
  adjustLogBox();
});

/* -------------------
   로그 불러오기 + 클릭 처리
------------------- */
async function fetchLogs() {
  try {
    const response = await fetch(logJsonUrl);
    const logs = await response.json();
    logBox.innerHTML = "";

    logs.forEach((item) => {
      const attackerName = item["공격 팀"];
      const gameName = item["게임"];
      const logText = `${attackerName} 팀이 (${gameName})${item["공격 / 회복 판단"]}`;

      const logDiv = document.createElement("div");
      logDiv.className = "log-item";
      logDiv.innerText = logText;

      logDiv.onclick = () => {
        const attackerCard = document.querySelector(
          `.team-card[data-team="${attackerName}"]`
        );
        if (!attackerCard) return;

        attackerCard.classList.add("shake");
        setTimeout(() => attackerCard.classList.remove("shake"), 500);

        const currentCards = document.querySelectorAll(".team-card");
        const targets = Array.from(currentCards).filter((c) => {
          const cardGame = (c.dataset.game || "").trim().toLowerCase();
          const gameToMatch = (gameName || "").trim().toLowerCase();
          return (
            cardGame.includes(gameToMatch) && c.dataset.team !== attackerName
          );
        });

        targets.forEach((t, idx) => {
          setTimeout(() => {
            launchMissile(attackerCard, t);

            // 미사일 도착 타이밍 맞춰 흔들림
            setTimeout(() => {
              t.classList.add("shake");
              setTimeout(() => t.classList.remove("shake"), 500);
            }, 700);
          }, idx * 180);
        });
      };

      logBox.prepend(logDiv);

      // 로그 폰트 리사이징
      const boardRect = board.getBoundingClientRect();
      logDiv.style.fontSize = Math.max(boardRect.width * 0.012, 10) + "px";
    });
  } catch (e) {
    console.error(e);
  }
}

/* -------------------
   초기화
------------------- */
window.addEventListener("load", async () => {
  adjustLogBox();
  await fetchData();
  await fetchLogs();
});
window.addEventListener("resize", () => {
  adjustLogBox();
  positionCards();
});

/* -------------------
   미사일 발사
------------------- */
function launchMissile(fromCard, toCard) {
  if (!fromCard || !toCard) return;
  ensureAudioContext();

  // 효과음
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(500, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);

  const missile = document.createElement("div");
  missile.classList.add("missile");
  board.appendChild(missile);

  const fromRect = fromCard.getBoundingClientRect();
  const toRect = toCard.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();

  const startX = fromRect.left + fromRect.width / 2 - boardRect.left;
  const startY = fromRect.top + fromRect.height / 2 - boardRect.top;
  const endX = toRect.left + toRect.width / 2 - boardRect.left;
  const endY = toRect.top + toRect.height / 2 - boardRect.top;

  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  missile.style.left = startX + "px";
  missile.style.top = startY + "px";

  const midX = startX + dx * 0.5;
  const midY = startY + dy * 0.5 - Math.min(100, distance * 0.3);
  const duration = 500 + distance * 0.3;

  const startTime = performance.now();
  function animate(time) {
    const t = Math.min((time - startTime) / duration, 1);
    const x =
      (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
    const y =
      (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * endY;
    missile.style.left = x + "px";
    missile.style.top = y + "px";

    if (t < 1) requestAnimationFrame(animate);
    else {
      missile.classList.add("explode");
      missile.style.left = endX + "px";
      missile.style.top = endY + "px";
      setTimeout(() => missile.remove(), 500);
    }
  }
  requestAnimationFrame(animate);
}