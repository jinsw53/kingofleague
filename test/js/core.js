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

Boako.Util = {};         // util.js 전담 (토스트 및 공통 유틸)
Boako.Auth = {};         // auth.js 전담 (로그인, 세션 및 위젯)
Boako.Main = {};         // main.js 전담 (메인 페이지 제어)
Boako.View = {};         // view.js 전담 (화면 전환 라우터)
Boako.Shop = {};         // shop.js 전담 (포인트 샵 및 구매)
Boako.Inventory = {};    // inventory.js 전담 (가방 및 배지 장착)
Boako.Team = {};         // team.js 전담 (팀 창단 및 관리)
Boako.Ranking = {};      // ranking.js 전담 (실시간 팀 리더보드)
Boako.Archive = {};      // archive.js 전담 (기록실 및 역사 장부)
Boako.AdminReview = {};  // admin_review.js 전담 (검수 센터 관리자 기능)
Boako.RecordVerify = {}; // record_verify.js 전담 (교차 검증 및 보상 지급)

// 💡 추후 추가 예정인 기능 서랍들
Boako.ItemActions = {};  // 아이템 효과 상세 로직
Boako.Messenger = {};    // 회원간 메세지 시스템
Boako.Schedule = {};     // 일정 관리 및 조율
