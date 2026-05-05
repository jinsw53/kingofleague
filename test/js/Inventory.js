/**
 * [INVENTORY] 인벤토리 및 배지 관리 시스템
 */
Boako.Inventory = {
    loadItems: async function() {
        if (!Boako.state.user) return; // 로그인 안 했으면 튕겨내기

        const badgeArea = document.getElementById('equipped-badges');
        const listArea = document.getElementById('inventory-list');

        // 로딩 중 표시
        badgeArea.innerHTML = `<span style="color:#94a3b8;">데이터를 불러오는 중...</span>`;
        listArea.innerHTML = `<span style="color:#94a3b8;">가방을 뒤지는 중...</span>`;

        try {
            // 🌟 [임시 데이터] 실제 DB를 연결하기 전에, 화면이 예쁘게 나오는지 테스트하기 위한 가짜 아이템들입니다!
            const fakeEquippedBadges = [
                { id: 1, name: "얼리버드", icon: "🐣" },
                { id: 2, name: "게시판 요정", icon: "🧚‍♀️" }
            ];
            
            const fakeInventoryItems = [
                { id: 3, name: "닉네임 변경권", icon: "🎫", type: "TICKET" },
                { id: 4, name: "황금 주사위", icon: "🎲", type: "BADGE" },
                { id: 5, name: "팀 확성기", icon: "📢", type: "ITEM" }
            ];

            // ----------------------------------------------------
            // 1. 장착 중인 배지 그리기 (가로 뱃지 형태)
            // ----------------------------------------------------
            if (fakeEquippedBadges.length === 0) {
                badgeArea.innerHTML = "<p style='color:#94a3b8;'>장착 중인 배지가 없습니다.</p>";
            } else {
                badgeArea.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:10px;">` + 
                    fakeEquippedBadges.map(b => `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:50px; padding:8px 16px; display:flex; align-items:center; gap:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                            <span style="font-size:18px;">${b.icon}</span>
                            <span style="font-weight:800; font-size:14px;">${b.name}</span>
                        </div>
                    `).join('') + `</div>`;
            }

            // ----------------------------------------------------
            // 2. 내 가방 아이템 그리기 (바둑판 그리드 형태)
            // ----------------------------------------------------
            if (fakeInventoryItems.length === 0) {
                listArea.innerHTML = "<p style='color:#94a3b8; padding:20px 0;'>가방이 텅 비어있습니다. 포인트 샵을 방문해보세요!</p>";
            } else {
                listArea.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:15px;">` + 
                    fakeInventoryItems.map(item => `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px 10px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.02); transition:0.2s; cursor:pointer;" onmouseover="this.style.borderColor='#f59e0b'; this.style.transform='translateY(-3px)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
                            <div style="font-size:40px; margin-bottom:12px;">${item.icon}</div>
                            <div style="font-size:13px; font-weight:800; color:#334155; word-break:keep-all; margin-bottom:15px;">${item.name}</div>
                            <button style="width:100%; padding:8px; font-size:12px; font-weight:700; background:${item.type === 'BADGE' ? '#10b981' : '#f59e0b'}; color:white; border:none; border-radius:6px; cursor:pointer;">
                                ${item.type === 'BADGE' ? '장착하기' : '사용하기'}
                            </button>
                        </div>
                    `).join('') + `</div>`;
            }

        } catch (error) {
            console.error("인벤토리 에러:", error);
            listArea.innerHTML = "데이터를 불러오는데 실패했습니다.";
        }
    }
};
