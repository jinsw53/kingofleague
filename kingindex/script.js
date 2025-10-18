const dataJsonUrl = "https://jinsw53.github.io/kingofleague/data.json";
const logJsonUrl = "https://jinsw53.github.io/kingofleague/logs.json";

const container = document.getElementById("team-container");
const board = document.getElementById("board-area");
const logBox = document.querySelector(".log-box");

let audioCtx = null;
function ensureAudioContext() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

/* -------------------
   로그 박스 크기 조정
------------------- */
function adjustLogBox() {
  const boardRect = board.getBoundingClientRect();
  const maxHeight = boardRect.height * 0.4;
  const maxWidth = boardRect.width * 0.25;
  const height = Math.min(maxHeight, boardRect.height * 0.4);
  const width = Math.min(height * 2, maxWidth);
  logBox.style.maxHeight = height + "px";
  logBox.style.height = height + "px";
  logBox.style.width = width + "px";
}

/* -------------------
   데이터 불러오기 + 카드 생성
------------------- */
async function fetchData() {
  try {
    const response = await fetch(dataJsonUrl);
    const data = await response.json();
    container.innerHTML = "";

    const visibleData = data.filter((item) => item.팀명?.trim() !== "");
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
      card.dataset.team = name;
      card.dataset.game = game;

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
   팀 카드 배치
------------------- */
function positionCards() {
  const cards = document.querySelectorAll(".team-card");
  const logRect = logBox.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  if (!cards.length || !logRect) return;

  const centerX = logRect.left + logRect.width / 2 - boardRect.left;
  const centerY = logRect.top + logRect.height / 2 - boardRect.top;

  const margin = 60;
  const radiusX =
    Math.min(boardRect.width * 0.35, logRect.width * 1.2) + margin;
  const radiusY =
    Math.min(boardRect.height * 0.25, logRect.height * 1) + margin;
  const total = cards.length;

  cards.forEach((card, i) => {
    const img = card.querySelector(".team-logo");
    const title = card.querySelector(".team-name");
    const life = card.querySelector(".team-life");

    const baseH = Math.min(boardRect.height * 0.08, 100);
    const logoSize = baseH * 0.9;
    img.style.width = logoSize + "px";
    img.style.height = logoSize + "px";
    img.style.marginRight = "6px";

    const titleFont = Math.max(baseH * 0.25, 10);
    const lifeFont = Math.max(baseH * 0.15, 9);
    title.style.fontSize = titleFont + "px";
    life.style.fontSize = lifeFont + "px";

    const infoWidth = Math.max(title.scrollWidth, life.scrollWidth);
    const cardWidth = Math.min(
      img.offsetWidth + infoWidth + 8,
      boardRect.width * 0.3
    );
    card.style.width = cardWidth + "px";
    card.style.height = baseH + "px";

    const angle = ((2 * Math.PI) / total) * i;
    const x = centerX + radiusX * Math.cos(angle) - cardWidth / 2;
    const y = centerY + radiusY * Math.sin(angle) - baseH / 2;
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  });
}

/* -------------------
   로그 헤더
------------------- */
function updateLogHeader() {
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

/* -------------------
   미사일 + 공격 사운드
------------------- */
function launchMissile(fromCard, toCard) {
  if (!fromCard || !toCard) return;
  ensureAudioContext();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(500, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
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
    const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * midX + t ** 2 * endX;
    const y = (1 - t) ** 2 * startY + 2 * (1 - t) * t * midY + t ** 2 * endY;
    missile.style.left = x + "px";
    missile.style.top = y + "px";

    if (t < 1) requestAnimationFrame(animate);
    else {
      missile.classList.add("explode");
      missile.style.left = endX + "px";
      missile.style.top = endY + "px";
      playExplosionSound();
      setTimeout(() => missile.remove(), 500);
    }
  }
  requestAnimationFrame(animate);
}

/* -------------------
   폭발음
------------------- */
function playExplosionSound() {
  ensureAudioContext();
  const ctx = audioCtx;
  const now = ctx.currentTime;

  // 저역 펀치
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);

  // 노이즈
  const bufferSize = ctx.sampleRate * 0.6;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++)
    output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1000;
  filter.Q.value = 0.6;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.5);
}

/* -------------------
   회복 사운드
------------------- */
function playHealingSound() {
  ensureAudioContext();
  const ctx = audioCtx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

/* -------------------
   로그 불러오기 + 클릭 이벤트
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

        const isHealing = (item["공격 / 회복 판단"] || "").includes("회복");

        const targets = Array.from(
          document.querySelectorAll(".team-card")
        ).filter((c) => {
          const cardGame = (c.dataset.game || "").trim().toLowerCase();
          const gameToMatch = (gameName || "").trim().toLowerCase();
          return (
            cardGame.includes(gameToMatch) && c.dataset.team !== attackerName
          );
        });

        targets.forEach((t, idx) => {
          setTimeout(() => {
            if (isHealing) {
              playHealingSound();
              t.classList.add("healing");
              setTimeout(() => t.classList.remove("healing"), 700);
            } else {
              launchMissile(attackerCard, t);
              setTimeout(() => {
                t.classList.add("shake");
                setTimeout(() => t.classList.remove("shake"), 500);
              }, 700);
            }
          }, idx * 180);
        });
      };

      logBox.prepend(logDiv);
    });
  } catch (e) {
    console.error(e);
  }
}

/* -------------------
   초기화
------------------- */
window.addEventListener("load", async () => {
  updateLogHeader();
  adjustLogBox();
  await fetchData();
  await fetchLogs();
  positionCards();
});
window.addEventListener("resize", () => {
  adjustLogBox();
  positionCards();
});