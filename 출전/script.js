async function loadParticipants() {
  const response = await fetch('https://raw.githubusercontent.com/jinsw53/kingofleague/refs/heads/main/participants.json');
  const data = await response.json();

  const container = document.getElementById('tables');
  container.innerHTML = ''; // 기존 테이블 제거

  // 팀 필터 (팀명 또는 이미지 주소가 있는 항목만)
  const teams = data.filter(item => (item['팀명'] && item['팀명'].trim() !== '') || (item['이미지 주소'] && item['이미지 주소'].trim() !== ''));

  // 종목 키 자동 추출 & 정렬
  const gameKeys = Array.from(
    new Set(
      teams.flatMap(team =>
        Object.keys(team).filter(key => key.includes('종목'))
      )
    )
  ).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || 0);
    const numB = parseInt(b.match(/\d+/)?.[0] || 0);
    return numA - numB;
  });

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  for (const team of teams) {
    const row = document.createElement('tr');

    // 팀명 + 팀로고 (첫 번째 열)
    const teamCell = document.createElement('td');

    let teamImgUrl = '';
    if (team['팀명']?.startsWith('http')) {
      teamImgUrl = team['팀명'].trim();
    } else if (team['이미지 주소']) {
      teamImgUrl = team['이미지 주소'].trim();
    }

    if (teamImgUrl) {
      const img = document.createElement('img');
      img.src = teamImgUrl;
      img.alt = team['팀명'] || 'team';
      img.classList.add('team-logo');
      teamCell.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = team['팀명']?.startsWith('http') ? '' : team['팀명'];
    teamCell.appendChild(span);

    row.appendChild(teamCell);

    // 종목별 데이터
    for (const key of gameKeys) {
      const cell = document.createElement('td');
      const value = team[key];

      if (value?.startsWith('http')) {
        const gImg = document.createElement('img');
        gImg.src = value.trim();
        gImg.alt = key;
        gImg.classList.add('game-logo');
        cell.appendChild(gImg);
      } else {
        cell.textContent = value || '';
      }

      row.appendChild(cell);
    }

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

loadParticipants();