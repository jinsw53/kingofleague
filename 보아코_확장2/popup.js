document.addEventListener('DOMContentLoaded', () => {
  const archiveBtn = document.getElementById('archive-btn');

  archiveBtn.addEventListener('click', () => {
    // 실제 운영 중인 아카이브 주소로 변경해줘
    const archiveUrl = "https://boakoarchive.co.kr/";
    
    // 새 탭으로 아카이브 열기
    chrome.tabs.create({ url: archiveUrl });
  });
});
