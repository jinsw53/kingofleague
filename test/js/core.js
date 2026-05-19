/**
 * [CORE] 전역 설정 및 상태 객체 선언
 */
const Boako = {
    db: null,
    state: {
        user: null,
        team: null,
        appId: 'boako-archive-master'
    },
    config: {
        url: 'https://qrredwrxdnvqwdxzanba.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFycmVkd3J4ZG52cXdkeHphbmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjYxNjEsImV4cCI6MjA5Mjg0MjE2MX0.RrDMN1uxGe9YoonomO-Ibq_dhyaSaKMa7B05i-j0LuY'
    }
};

// 추후 추가될 기능들을 위한 빈 객체 선언 (이후 해당 파일만 생성해서 연결하면 됨)
Boako.Shop = {};       // 포인트샵+포인트 시스템
Boako.ItemActions = {}; // 아이템 효과
Boako.Messenger = {};  // 회원간 메세지
Boako.Schedule = {};   // 일정관리 및 조율
Boako.League = {};     // 대시보드, 밴 투표, 라이벌 매치 등
Boako.Archive = {}; // 🌟 기록실 기능 전담 객체 추가
Boako.RecordVerify = {}; // 경기 기록 인증 전담
Boako.Ranking = {};      // 실시간 팀 리더보드 전담
