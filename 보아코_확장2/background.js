// 상단에 슈파베이스 설정 정보를 넣어주세요
const SUPABASE_URL = "https://qrredwrxdnvqwdxzanba.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFycmVkd3J4ZG52cXdkeHphbmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjYxNjEsImV4cCI6MjA5Mjg0MjE2MX0.RrDMN1uxGe9YoonomO-Ibq_dhyaSaKMa7B05i-j0LuY";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    // [추가] 슈파베이스 직송 전용 함수 (기존 로직 방해 안 함)
    const pushToSupabase = (dataType, payload) => {
        fetch(`${SUPABASE_URL}/rest/v1/raw_ingest_buffer`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                data_type: dataType,
                payload: payload
            })
        })
        .then(() => console.log(`🚀 [Supabase] ${dataType} 추가 배달 성공`))
        .catch(err => console.error(`❌ [Supabase] 추가 배달 실패:`, err));
    };

    if (message.action === "saveGameRecord") {
        console.log("📩 서버로 게임 기록 저장 요청:", message.data);

        // 1. [기존 유지] PHP 서버 전송
        fetch("https://boako.dev-play.kr/api/relay_api.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message.data)
        })
        .then(response => response.json())
        .then(data => {
            console.log("📌 서버 응답:", data);

            // 👊 [수정] '이미' 단어 검열 및 슈파베이스 전송 로직 추가
            const serverMessage = data.message || "";
            const isDuplicate = serverMessage.includes("이미");

            if (data.success === true && !isDuplicate) {
                console.log("✅ 신규 게임 기록 확인! 슈파베이스 전송!");
                pushToSupabase("GAME", message.data);
            } else if (isDuplicate) {
                console.log("🚫 [중복 컷] 일반 게임 응답에 '이미' 포함. 슈파베이스 전송 취소!");
            }

            sendResponse(data);
        })
        .catch(error => {
            console.error("❌ 서버 요청 실패:", error);
            sendResponse({ success: false, error: "server_error" });
        });
        return true;
    }
    
    else if (message.action === "checkGameRecord") {
        console.log("📩 서버로 게임 기록 확인 요청:", message.data);
        
        // [기존 유지] 이 로직은 확인 절차이므로 기존 서버 것만 유지합니다.
        fetch("https://boako.dev-play.kr/api/check_single_game_record.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message.data)
        })
        .then(response => response.json())
        .then(data => {
            console.log("📌 게임 기록 확인 응답:", data);
            sendResponse(data);
        })
        .catch(error => {
            console.error("❌ 게임 기록 확인 요청 실패:", error);
            sendResponse({ exists: false, error: "server_error" });
        });
        
        return true;
    }
    
    else if (message.action === "saveFirstWin") {
        console.log("📩 서버로 첫승 저장 요청:", message.data);

        // 1. [기존 유지] PHP 서버 전송
        fetch("https://boako.dev-play.kr/api/save_first_win.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message.data)
        })
        .then(response => response.json())
        .then(data => {
            console.log("📌 첫승 저장 응답:", data);

            // 👊 [수정] '이미' 단어 검열 로직 적용
            const serverMessage = data.message || "";
            const isDuplicate = serverMessage.includes("이미");

            if (data.success === true && !isDuplicate) {
                console.log("✅ 신규 첫승 기록 확인! 슈파베이스 전송!");
                pushToSupabase("FIRST_WIN", message.data);
            } else if (isDuplicate) {
                console.log("🚫 [중복 컷] 첫승 응답에 '이미' 포함. 슈파베이스 전송 취소!");
            }

            sendResponse(data);
        })
        .catch(error => {
            console.error("❌ 첫승 저장 요청 실패:", error);
            sendResponse({ success: false, error: "server_error" });
        });

     
        return true;
    }

    else if (message.action === "saveTournamentRecord") {
        console.log("📩 서버로 토너먼트 기록 저장 요청:", message.data);

        // 1. [기존 유지] PHP 서버 전송
        fetch("https://boako.dev-play.kr/api/save_tournament_record.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message.data)
        })
        .then(response => response.json())
        .then(data => {
            console.log("📌 토너먼트 기록 저장 응답:", data);

            // 👊 [수정] '이미' 단어 검열 로직 적용
            const serverMessage = data.message || "";
            const isDuplicate = serverMessage.includes("이미");

            if (data.success === true && !isDuplicate) {
                console.log("✅ 신규 토너먼트 기록 확인! 슈파베이스 전송!");
                pushToSupabase("TOURNAMENT", message.data);
            } else if (isDuplicate) {
                console.log("🚫 [중복 컷] 토너먼트 응답에 '이미' 포함. 슈파베이스 전송 취소!");
            }

            sendResponse(data);
        })
        .catch(error => {
            console.error("❌ 토너먼트 기록 저장 요청 실패:", error);
            sendResponse({ success: false, error: "server_error" });
        });

        return true;
    }

    // 🌟 [신규] 토너먼트 개최 공지 자동 등록 (PHP 중계 없이 슈파베이스 직행, 중복 방지는 DB가 담당)
    else if (message.action === "saveTournamentAnnouncement") {
        console.log("📩 토너먼트 개최 공지 등록 요청:", message.data);
        pushToSupabase("TOURNAMENT_ANNOUNCEMENT", message.data);
        sendResponse({ success: true, message: "공지 등록 요청 완료" });
        return true;
    }
});

// ==============================================================================
// [추가] 우클릭 메뉴 (Context Menu) 설정
// ==============================================================================

// 확장 프로그램이 설치되거나 업데이트될 때 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "open-boako-archive",      // 메뉴의 고유 ID
        title: "BOAKO 아카이브 열기",    // 우클릭 시 보여질 텍스트
        contexts: ["all"]              // 페이지 어디서든 우클릭하면 보이게 설정
    });
});

// 우클릭 메뉴를 클릭했을 때의 동작
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open-boako-archive") {
        // 아카이브 주소로 새 탭 열기
        chrome.tabs.create({ url: "https://boakoarchive.co.kr/" });
    }
});
