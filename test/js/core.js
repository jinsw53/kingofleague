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

// ==============================================================================
// 👑 [BOAKO MEGA ARCHITECTURE - 미래 확장 기능 호적 선언부]
// ==============================================================================

// 📁 [1] 현재 가동 중인 상시 11개 기본 부서 (기존 파일 일치 완료)
Boako.Util = {};         // util.js (토스트 및 공통 유틸)
Boako.Auth = {};         // auth.js (로그인, 세션 및 위젯)
Boako.Main = {};         // main.js (메인 페이지 제어)
Boako.View = {};         // view.js (화면 전환 라우터)
Boako.Shop = {};         // shop.js (포인트 샵 및 구매)
Boako.Inventory = {};    // inventory.js (가방 및 배지 장착)
Boako.Team = {};         // team.js (팀 창단 및 관리)
Boako.Ranking = {};      // ranking.js (실시간 팀 리더보드)
Boako.Archive = {};      // archive.js (기록실 및 역사 장부)
Boako.AdminReview = {};  // admin_review.js (검수 센터 관리자)
Boako.RecordVerify = {}; // record_verify.js (기록 인증 및 보상)

// 📁 [2] 소장님의 신규 기획 맞춤 전용 예약 부서
Boako.League = {};       // 🎯 5개 리그 콘텐츠 전반 제어 전담
Boako.Rival = {};        // 🎯 라이벌 매칭 및 도전장 송수신 시스템 전담
Boako.Board = {};        // 🎯 2~3개 자유/전적 게시판 업로드 및 관리 전담
Boako.Ticker = {};       // 🎯 전광판 롤링 바 (라이벌 매칭 + 게시판 글) 데이터 처리 전담
Boako.HotIssue = {};     // 🎯 사이드 바의 실시간 아카이브 핫 이슈 갱신 전담

// 📁 [3] 유저 동작에 반응하는 실시간 지연 로딩 부서
Boako.ItemActions = {};  // 아이템 사용 시 발동되는 효과 로직창
Boako.Messenger = {};    // 회원간 1:1 메시지 시스템
Boako.Schedule = {};     // 경기 일정 조율 및 캘린더 매칭
