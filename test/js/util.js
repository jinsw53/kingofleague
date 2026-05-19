/**
 * [UTIL] 공통 유틸리티 (토스트, 프리뷰 + 동적 파일 배달원 추가)
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
    }
};
