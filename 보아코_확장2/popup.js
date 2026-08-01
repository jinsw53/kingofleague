document.addEventListener('DOMContentLoaded', () => {
  const archiveBtn = document.getElementById('archive-btn');

  archiveBtn.addEventListener('click', () => {
    // 실제 운영 중인 아카이브 주소로 변경해줘
    const archiveUrl = "https://boakoarchive.co.kr/";
    
    // 새 탭으로 아카이브 열기
    chrome.tabs.create({ url: archiveUrl });
  });

  // manifest.json의 version을 그대로 읽어서 표시 (버전 하드코딩 방지)
  const versionFooter = document.getElementById('version-footer');
  if (versionFooter && chrome.runtime && chrome.runtime.getManifest) {
    const manifestVersion = chrome.runtime.getManifest().version;
    versionFooter.textContent = `버전 ${manifestVersion}`;
  }
});
