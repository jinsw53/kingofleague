/**
 * [CORE] 전역 설정 및 상태 객체 선언
 */
// window 객체에 직접 붙여서 어떤 파일에서든 접근 가능하게 만듭니다.
window.Boako = {
    db: null,
    state: {
        user: null,
        team: null,
        appId: 'boako-archive-master'
    },
    config: {
        url: 'https://qrredwrxdnvqwdxzanba.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFycmVkd3J4ZG52cXdkeHphbmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjYxNjEsImV4cCI6MjA5Mjg0MjE2MX0.RrDMN1uxGe9YoonomO-Ibq_dhyaSaKMa7B05i-j0LuY'
    },
// 💡 [추가] 전역 권한 검증 메서드
    // 시스템 어디서든 Boako.isMyTeamLeader() 로 호출하여 즉시 확인
    isMyTeamLeader: function() {
        if (!this.state.user?.full_name || !this.state.team?.members) {
            return false;
        }
        const myName = this.state.user.full_name;
        const myInfo = this.state.team.members.find(m => m.player_name === myName);
        return myInfo?.role === 'LEADER';
    }
};
// ==============================================================================
// 👑 [BOAKO MEGA ARCHITECTURE - 미래 확장 기능 호적 선언부]
// ==============================================================================

// 📁 [1] 현재 가동 중인 상시 11개 기본 부서 (기존 파일 일치 완료)
window.Boako.Util = {};         // util.js (토스트 및 공통 유틸)
window.Boako.Auth = {};         // auth.js (로그인, 세션 및 위젯)
window.Boako.Main = {};         // main.js (메인 페이지 제어)
window.Boako.View = {};         // view.js (화면 전환 라우터)
window.Boako.Shop = {};         // shop.js (포인트 샵 및 구매)
window.Boako.Inventory = {};    // inventory.js (가방 및 배지 장착)
window.Boako.Team = {};         // team.js (팀 창단 및 관리)
window.Boako.TeamList = {};     // team_list.js (참여 팀 목록 및 로스터 조회)
window.Boako.Ranking = {};      // ranking.js (실시간 팀 리더보드)
window.Boako.Archive = {};      // archive.js (기록실 및 역사 장부)
window.Boako.AdminReview = {};  // admin_review.js (검수 센터 관리자)
window.Boako.RecordVerify = {}; // record_verify.js (기록 인증 및 보상)

// 📁 [2] 소장님의 신규 기획 맞춤 전용 예약 부서
window.Boako.League = {};       // 🎯 5개 리그 콘텐츠 전반 제어 전담
window.Boako.Rival = {};        // 🎯 라이벌 매칭 및 도전장 송수신 시스템 전담
window.Boako.Board = {};        // 🎯 2~3개 자유/전적 게시판 업로드 및 관리 전담
window.Boako.Ticker = {};       // 🎯 전광판 롤링 바 (라이벌 매칭 + 게시판 글) 데이터 처리 전담
window.Boako.HotIssue = {};     // 🎯 사이드 바의 실시간 아카이브 핫 이슈 갱신 전담

// 📁 [3] 유저 동작에 반응하는 실시간 지연 로딩 부서
window.Boako.ItemActions = {};  // 아이템 사용 시 발동되는 효과 로직창
window.Boako.Messenger = {};    // 회원간 1:1 메시지 시스템
window.Boako.Schedule = {};     // 경기 일정 조율 및 캘린더 매칭
