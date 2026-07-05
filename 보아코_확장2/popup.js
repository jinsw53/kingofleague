document.addEventListener('DOMContentLoaded', () => {
  const archiveBtn = document.getElementById('archive-btn');

  archiveBtn.addEventListener('click', () => {
    // 실제 운영 중인 아카이브 주소로 변경해줘
    const archiveUrl = "https://jinsw53.github.io/kingofleague/test/%EB%A0%88%EC%9D%B4%EC%95%84%EC%9B%83-%EB%A1%9C%EA%B7%B8%EC%9D%B8.html#";
    
    // 새 탭으로 아카이브 열기
    chrome.tabs.create({ url: archiveUrl });
  });
});