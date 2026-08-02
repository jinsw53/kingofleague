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
        .then(async (data) => {
            console.log("📌 첫승 저장 응답:", data);

            // 👊 [기존 유지] '이미' 단어 검열 로직 적용
            const serverMessage = data.message || "";
            const isDuplicate = serverMessage.includes("이미");

            // 🌟 [수정] content.js의 영구 마킹 기준을 "PHP 응답을 받았는지"가 아니라
            // "실제로 Supabase까지 도달이 확인됐는지"로 옮기기 위해, 그 결과를 supabaseSaved로 같이 실어보냄.
            // PHP 응답만 믿고 마킹했다가 그 이후 Supabase 전송이 조용히 실패하면(fire-and-forget이었음)
            // 실제로는 안 들어갔는데 영구 기록엔 "보냈음"으로 남아 재시도가 막히는 문제가 있었음.
            let supabaseSaved = false;

            if (data.success === true && !isDuplicate) {
                // 🌟 PHP의 '이미' 판정이 부실해서 같은 첫승이 계속 신규로 통과되는 문제가 있어,
                // Supabase로 push하기 직전에 raw_ingest_buffer에 이미 같은 (닉네임, 게임명) 조합의
                // FIRST_WIN이 있는지 한 번 더 확인함 (fn_check_first_win_ingested RPC, SECURITY DEFINER).
                try {
                    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_check_first_win_ingested`, {
                        method: "POST",
                        headers: {
                            "apikey": SUPABASE_KEY,
                            "Authorization": `Bearer ${SUPABASE_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            p_nickname: message.data.playerNickname,
                            p_game_name: message.data.gameName
                        })
                    });
                    const alreadyIngested = await checkRes.json();

                    if (alreadyIngested === true) {
                        console.log("🚫 [중복 컷] Supabase에 이미 같은 첫승이 존재함. 슈파베이스 전송 취소!");
                        supabaseSaved = true; // 이미 들어가 있는 상태 = 결과적으로 도달 완료
                    } else {
                        console.log("✅ 신규 첫승 기록 확인! 슈파베이스 전송!");
                        // 🌟 [수정] fire-and-forget(pushToSupabase)이 아니라 응답을 직접 기다려서
                        // 실제 성공 여부를 확인함
                        const pushRes = await fetch(`${SUPABASE_URL}/rest/v1/raw_ingest_buffer`, {
                            method: "POST",
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": `Bearer ${SUPABASE_KEY}`,
                                "Content-Type": "application/json",
                                "Prefer": "return=minimal"
                            },
                            body: JSON.stringify({ data_type: "FIRST_WIN", payload: message.data })
                        });
                        supabaseSaved = pushRes.ok;
                        if (supabaseSaved) {
                            console.log("🚀 [Supabase] FIRST_WIN 추가 배달 성공");
                        } else {
                            const errText = await pushRes.text().catch(() => '');
                            console.error(`❌ [Supabase] FIRST_WIN 추가 배달 실패 (HTTP ${pushRes.status}):`, errText);
                        }
                    }
                } catch (checkErr) {
                    console.error("❌ [Supabase] 첫승 처리 중 오류, 도달 실패로 간주:", checkErr);
                    supabaseSaved = false;
                }
            } else if (isDuplicate) {
                console.log("🚫 [중복 컷] 첫승 응답에 '이미' 포함. 슈파베이스 전송 취소!");
                supabaseSaved = true; // 서버가 이미 처리된 것으로 판단 → 재전송 불필요
            }

            sendResponse({ ...data, supabaseSaved });
        })
        .catch(error => {
            console.error("❌ 첫승 저장 요청 실패:", error);
            sendResponse({ success: false, error: "server_error", supabaseSaved: false });
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

    // 🌟 [v2.19 수정] 토너먼트 개최 공지 자동 등록 — 이전엔 슈파베이스 응답을 확인 안 하고
    // 무조건 성공으로 응답해서, 실제로 DB에 저장이 실패해도(예: 체크 제약조건 위반, 트리거 에러 등)
    // 화면엔 항상 "등록 완료"로 표시되는 문제가 있었음. 이제 실제 HTTP 응답 상태를 확인해서
    // 진짜 성공/실패를 그대로 전달함.
    else if (message.action === "saveTournamentAnnouncement") {
        console.log("📩 토너먼트 개최 공지 등록 요청:", message.data);

        fetch(`${SUPABASE_URL}/rest/v1/raw_ingest_buffer`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                data_type: "TOURNAMENT_ANNOUNCEMENT",
                payload: message.data
            })
        })
        .then(async (res) => {
            if (res.ok) {
                console.log("🚀 [Supabase] TOURNAMENT_ANNOUNCEMENT 등록 성공");
                sendResponse({ success: true, message: "공지 등록 완료" });
            } else {
                const errText = await res.text().catch(() => '');
                console.error(`❌ [Supabase] TOURNAMENT_ANNOUNCEMENT 등록 실패 (HTTP ${res.status}):`, errText);
                sendResponse({ success: false, error: "server_error", message: `등록 실패 (서버 오류 HTTP ${res.status})` });
            }
        })
        .catch(err => {
            console.error("❌ [Supabase] 요청 자체 실패:", err);
            sendResponse({ success: false, error: "network_error", message: "네트워크 오류로 등록 실패" });
        });

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
