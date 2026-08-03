// 상단에 슈파베이스 설정 정보를 넣어주세요
const SUPABASE_URL = "https://qrredwrxdnvqwdxzanba.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFycmVkd3J4ZG52cXdkeHphbmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjYxNjEsImV4cCI6MjA5Mjg0MjE2MX0.RrDMN1uxGe9YoonomO-Ibq_dhyaSaKMa7B05i-j0LuY";

// ==============================================================================
// 🌟 [신규] 아카이브 로그인 연동 (쪽지함/팀챗/토스트 알림용)
// 사이트 로그인과는 완전히 별개의 독립 로그인. chrome.identity.launchWebAuthFlow로
// 카카오 로그인 → Supabase가 발급한 토큰을 확장 프로그램 전용 콜백 주소로 직접 받아옴.
// 사이트의 localStorage는 전혀 건드리지 않음 (host_permissions로 사이트에 콘텐츠 스크립트를
// 심을 필요 없음 — 그래서 매니페스트에도 boakoarchive.co.kr은 안 들어감).
// ==============================================================================

const ARCHIVE_SESSION_KEY = "archiveSession";

// 저장된 세션(액세스 토큰 등)을 가져옴. 저장 안 돼있으면 null.
async function getStoredArchiveSession() {
    const result = await chrome.storage.local.get(ARCHIVE_SESSION_KEY);
    return result[ARCHIVE_SESSION_KEY] || null;
}

// Supabase에서 받은 사용자 id로 profiles 테이블 조회 (닉네임/프사 등 표시용 최소 정보만)
async function fetchArchiveProfile(userId, accessToken) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,full_name,profile_url,custom_avatar_url`, {
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${accessToken}`
        }
    });
    const rows = await res.json();
    return rows?.[0] || null;
}

// 리프레시 토큰으로 액세스 토큰을 갱신 (만료됐을 때 재로그인 없이 자동 연장)
async function refreshArchiveSession(refreshToken) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) return null;
    return await res.json(); // { access_token, refresh_token, expires_in, user }
}

// 실제 로그인 팝업을 띄우고, 성공하면 세션을 저장까지 마친 뒤 최종 세션 객체를 반환
async function performArchiveLogin() {
    const redirectUri = chrome.identity.getRedirectURL(); // https://<확장ID>.chromiumapp.org/
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=kakao&redirect_to=${encodeURIComponent(redirectUri)}`;

    const resultUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
    if (!resultUrl) throw new Error("로그인이 취소되었습니다.");

    // 🌟 [디버깅] 실제로 뭐가 돌아왔는지 전체를 그대로 남김 — access_token(#) 대신 code(?)나
    // error 파라미터가 왔을 수도 있어서(PKCE 플로우 등) 원인 파악용으로 전체를 남겨둠
    console.log("🔍 [로그인 디버그] launchWebAuthFlow 최종 리다이렉트 URL 전체:", resultUrl);

    const urlObj = new URL(resultUrl);
    const fragment = urlObj.hash.startsWith("#") ? urlObj.hash.slice(1) : "";
    const fragParams = new URLSearchParams(fragment);
    const queryParams = urlObj.searchParams;

    const accessToken = fragParams.get("access_token");
    const refreshToken = fragParams.get("refresh_token");
    const expiresIn = parseInt(fragParams.get("expires_in") || "3600", 10);
    const errorParam = fragParams.get("error") || queryParams.get("error");
    const errorDesc = fragParams.get("error_description") || queryParams.get("error_description");
    const codeParam = queryParams.get("code");

    console.log("🔍 [로그인 디버그] 파싱 결과:", {
        hasAccessToken: !!accessToken,
        code: codeParam,
        error: errorParam,
        errorDescription: errorDesc,
        rawFragment: fragment,
        rawQuery: urlObj.search
    });

    if (errorParam) {
        throw new Error(`Supabase 인증 오류: ${errorParam}${errorDesc ? ' - ' + decodeURIComponent(errorDesc) : ''}`);
    }

    if (!accessToken && codeParam) {
        throw new Error(`PKCE 방식(code=${codeParam})으로 응답이 왔어요. 구현을 PKCE 교환 방식으로 바꿔야 합니다.`);
    }

    if (!accessToken) {
        throw new Error(`로그인 토큰을 받아오지 못했습니다. 반환된 URL: ${resultUrl}`);
    }

    // 액세스 토큰으로 본인 유저 id 확인
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    const profile = await fetchArchiveProfile(userData.id, accessToken);

    const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Date.now() + expiresIn * 1000,
        user: { id: userData.id, nickname: profile?.full_name || "사용자", avatar: profile?.custom_avatar_url || profile?.profile_url || null }
    };

    await chrome.storage.local.set({ [ARCHIVE_SESSION_KEY]: session });
    return session;
}

// content.js가 페이지 로드 시 "지금 로그인 상태 맞는지" 확인할 때 호출.
// 토큰이 곧 만료되거나 이미 만료됐으면 조용히 리프레시까지 시도함.
async function getValidArchiveSession() {
    let session = await getStoredArchiveSession();
    if (!session) return null;

    // 만료 5분 전부터는 미리 갱신 시도
    if (Date.now() > session.expires_at - 5 * 60 * 1000) {
        const refreshed = await refreshArchiveSession(session.refresh_token);
        if (!refreshed) {
            // 리프레시도 실패하면 세션이 죽은 것 — 로그아웃 처리
            await chrome.storage.local.remove(ARCHIVE_SESSION_KEY);
            return null;
        }
        const profile = await fetchArchiveProfile(refreshed.user.id, refreshed.access_token);
        session = {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: Date.now() + refreshed.expires_in * 1000,
            user: { id: refreshed.user.id, nickname: profile?.full_name || "사용자", avatar: profile?.custom_avatar_url || profile?.profile_url || null }
        };
        await chrome.storage.local.set({ [ARCHIVE_SESSION_KEY]: session });
    }
    return session;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "archiveLogin") {
        performArchiveLogin()
            .then(session => sendResponse({ success: true, user: session.user }))
            .catch(err => {
                console.error("❌ 아카이브 로그인 실패:", err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    if (message.action === "archiveLogout") {
        chrome.storage.local.remove(ARCHIVE_SESSION_KEY).then(() => sendResponse({ success: true }));
        return true;
    }

    if (message.action === "getArchiveSession") {
        getValidArchiveSession()
            .then(session => sendResponse({ session }))
            .catch(err => {
                console.error("❌ 아카이브 세션 확인 실패:", err);
                sendResponse({ session: null });
            });
        return true;
    }
});

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
