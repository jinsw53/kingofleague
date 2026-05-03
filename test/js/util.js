/**
 * [UTIL] 공통 유틸리티 (토스트, 프리뷰 등)
 */
Boako.Util = {
    toast: (msg) => {
        const t = document.getElementById('boako-toast');
        if(!t) return;
        t.innerText = msg; t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    },
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
    removeImgPreview: (e) => {
        e.stopPropagation();
        document.getElementById('team_logo').value = "";
        document.getElementById('preview-container').style.display = 'none';
        document.getElementById('upload-placeholder').style.display = 'block';
    }
};