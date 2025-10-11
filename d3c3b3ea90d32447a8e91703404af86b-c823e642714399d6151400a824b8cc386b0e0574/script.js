async function loadTournament() {
  const url = 'https://raw.githubusercontent.com/jinsw53/kingofleague/main/tournament.json';
  const res = await fetch(url);
  const data = await res.json();
  if (!data || data.length === 0) {
    document.body.innerHTML = "<p>데이터가 없습니다.</p>";
    return;
  }

  const headerRow = document.getElementById('header-row');
  const fixedKeys = ['선정 게임', '항목'];
  const dynamicKeys = [];

  data.forEach(row => {
    Object.keys(row).forEach(k => {
      if (!fixedKeys.includes(k) && !dynamicKeys.includes(k)) dynamicKeys.push(k);
    });
  });

  [...fixedKeys, ...dynamicKeys].forEach(k => {
    const th = document.createElement('th');
    th.textContent = k;
    headerRow.appendChild(th);
  });

  const tbody = document.getElementById('tournament-body');

  data.forEach(row => {
    const tr = document.createElement('tr');
    [...fixedKeys, ...dynamicKeys].forEach(k => {
      const td = document.createElement('td');
      const val = row[k];

      if (typeof val === 'string' && /^https?:\/\//i.test(val)) {
        const img = document.createElement('img');
        img.src = val;
        img.alt = k;
        img.onerror = () => img.replaceWith(document.createTextNode('[이미지 로딩 실패]'));
        td.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'fit-text';
        span.textContent = val ?? '';
        td.appendChild(span);
        adjustFontSize(span);
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  mergeFirstBlock();
  mergeBelowImageRow();
  mergeFirstColumn();
  mergeLastBlock();
 const table = document.querySelector("table");
mergeScoresAbove2Rows(table, table.rows[0].cells.length - 2); // 뒤에서 2번째 열
mergeThirdLastScoresAbove2Rows(table); // 뒤에서 3번째 열


}

function mergeFirstBlock() {
  const table = document.querySelector("table");
  const rows = table.querySelectorAll("tbody tr");
  if (rows.length === 0) return;

  const baseCell = rows[0].cells[0];
  baseCell.setAttribute("rowspan", 3);
  baseCell.setAttribute("colspan", 2);

  baseCell.innerHTML = "";
  baseCell.style.backgroundImage = "url('https://jinsw53.github.io/kingofleague/BOAKO%20%ED%8C%80%20%EB%A6%AC%EA%B7%B8%20%EB%8C%80%ED%95%AD%EC%A0%84.png')";
  baseCell.style.backgroundSize = "contain";
  baseCell.style.backgroundRepeat = "no-repeat";
  baseCell.style.backgroundPosition = "center";

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      if (r === 0 && c === 0) continue;
      if (rows[r].cells[c]) rows[r].cells[c].style.display = 'none';
    }
  }
}

function mergeBelowImageRow() {
  const table = document.querySelector("table");
  const rows = table.querySelectorAll("tbody tr");
  if (rows.length < 4) return;

  const baseCell = rows[3].cells[0];
  baseCell.setAttribute("colspan", 2);
  if (rows[3].cells[1]) rows[3].cells[1].style.display = 'none';
}

function mergeFirstColumn() {
  const table = document.querySelector("table");
  const rows = table.querySelectorAll("tbody tr");

  for (let r = 0; r < rows.length - 1; r++) {
    const cell = rows[r].cells[0];
    const nextCell = rows[r + 1].cells[0];

    // 조건: 위 셀에 이미지 존재 && 아래 셀 비어 있음
    if (cell && cell.querySelector('img') && nextCell && nextCell.textContent.trim() === '') {
      cell.setAttribute('rowspan', 2);      // 위 셀 rowspan
      nextCell.style.display = 'none';      // 아래 셀 숨김
    }
  }
}


function mergeLastBlock() {
  const table = document.querySelector("table");
  const rows = table.querySelectorAll("tbody tr");
  if (rows.length < 3) return;
  const lastColIndex = rows[0].cells.length - 1;

  for (let r = 0; r < 3; r++) {
    const row = rows[r];
    for (let c = lastColIndex-2; c <= lastColIndex; c++) {
      if (r === 0 && c === lastColIndex-2) {
        const baseCell = row.cells[c];
        baseCell.setAttribute("rowspan", 3);
        baseCell.setAttribute("colspan", 3);
        baseCell.innerHTML = "";
        baseCell.style.backgroundImage = "url('https://jinsw53.github.io/kingofleague/wlskstlwms.png')";
        baseCell.style.backgroundSize = "contain";
        baseCell.style.backgroundRepeat = "no-repeat";
        baseCell.style.backgroundPosition = "center";
      } else {
        if (row.cells[c]) row.cells[c].style.display = 'none';
      }
    }
  }
}
function mergeScoresAbove2Rows(table, colIndex) {
  const rows = Array.from(table.querySelectorAll('tbody tr'));

  for (let r = 0; r < rows.length; r++) {
    const cell = rows[r].cells[colIndex];
    if (!cell) continue;

    const val = cell.textContent.trim();
    if (val === '' || isNaN(Number(val))) continue; // 숫자가 아니면 스킵

    let mergeCount = 0;

    for (let k = 1; k <= 2; k++) {
      const aboveCell = rows[r - k]?.cells[colIndex];
      if (aboveCell && aboveCell.textContent.trim() === '') {
        mergeCount++;
      } else break;
    }

    if (mergeCount > 0) {
      const targetCell = rows[r - mergeCount].cells[colIndex];
      targetCell.setAttribute('rowspan', mergeCount + 1);
      targetCell.textContent = cell.textContent;

      // 합쳐진 빈 셀 제거
      for (let k = 0; k < mergeCount; k++) {
        const emptyCell = rows[r - k].cells[colIndex];
        emptyCell.remove();
      }

      cell.remove(); // 현재 숫자 셀 제거, 위로 이동했으므로
    }
  }
}
function mergeThirdLastScoresAbove2Rows(table) {
  const colIndex = table.rows[0].cells.length - 3; // 뒤에서 3번째 열
  const rows = Array.from(table.querySelectorAll('tbody tr'));

  for (let r = 0; r < rows.length; r++) {
    const cell = rows[r].cells[colIndex];
    if (!cell) continue;

    const val = cell.textContent.trim();
    if (val === '' || isNaN(Number(val))) continue; // 숫자가 아니면 스킵

    let mergeCount = 0;

    for (let k = 1; k <= 2; k++) {
      const aboveCell = rows[r - k]?.cells[colIndex];
      if (aboveCell && aboveCell.textContent.trim() === '') {
        mergeCount++;
      } else break;
    }

    if (mergeCount > 0) {
      const targetCell = rows[r - mergeCount].cells[colIndex];
      targetCell.setAttribute('rowspan', mergeCount + 1);
      targetCell.textContent = cell.textContent;

      // 합쳐진 빈 셀 제거
      for (let k = 0; k < mergeCount; k++) {
        const emptyCell = rows[r - k].cells[colIndex];
        emptyCell.remove();
      }

      cell.remove(); // 현재 숫자 셀 제거, 위로 이동했으므로
    }
  }
}

function adjustFontSize(element) {
  let fontSize = 16;
  const parentWidth = element.parentElement.clientWidth;
  element.style.fontSize = fontSize + 'px';
  while (element.scrollWidth > parentWidth && fontSize > 6) {
    fontSize -= 1;
    element.style.fontSize = fontSize + 'px';
  }
}

window.addEventListener('resize', () => {
  document.querySelectorAll('.fit-text').forEach(el => adjustFontSize(el));
});

loadTournament();
