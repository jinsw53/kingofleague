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
            // 🌟 1. 진짜 Supabase DB에서 내 아이템 가져오기 (수량 quantity 포함!)
            const { data: myItems, error } = await Boako.db
                .from('user_items') // 👈 소장님의 진짜 '유저 인벤토리' 테이블 이름
                .select(`
                    id,
                    is_equipped,
                    item_id,
                    quantity,
                    shop_items ( name, icon, type )
                `)
                .eq('user_id', Boako.state.user.id);

            if (error) throw error;

            // 🌟 2. 가져온 아이템을 '장착 중인 배지'와 '가방 속 아이템'으로 분류
            const equippedBadges = [];
            const inventoryItems = [];

            (myItems || []).forEach(row => {
                const info = row.shop_items; 
                if (!info) return; // 상점 정보가 없으면 패스

                if (row.is_equipped && info.type === 'BADGE') {
                    // 장착된 배지
                    equippedBadges.push({ id: row.id, name: info.name, icon: info.icon });
                } else {
                    // 장착 안 된 아이템 (가방으로)
                    inventoryItems.push({ 
                        id: row.id, 
                        item_id: row.item_id,
                        name: info.name, 
                        icon: info.icon, 
                        type: info.type,
                        quantity: row.quantity
                    });
                }
            });

            // ----------------------------------------------------
            // 🌟 3. 장착 중인 배지 화면에 그리기
            // ----------------------------------------------------
            if (equippedBadges.length === 0) {
                badgeArea.innerHTML = "<p style='color:#94a3b8;'>장착 중인 배지가 없습니다.</p>";
            } else {
                badgeArea.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:10px;">` + 
                    equippedBadges.map(b => `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:50px; padding:8px 16px; display:flex; align-items:center; gap:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                            <span style="font-size:18px;">${b.icon}</span>
                            <span style="font-weight:800; font-size:14px;">${b.name}</span>
                        </div>
                    `).join('') + `</div>`;
            }

            // ----------------------------------------------------
            // 🌟 4. 내 가방 아이템 화면에 그리기 (바둑판 모양 & 수량 표시)
            // ----------------------------------------------------
            if (inventoryItems.length === 0) {
                listArea.innerHTML = "<p style='color:#94a3b8; padding:20px 0;'>가방이 텅 비어있습니다. 상점을 방문해보세요!</p>";
            } else {
                listArea.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:15px;">` + 
                    inventoryItems.map(item => `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px 10px; text-align:center; box-shadow:0 2px 4px rgba(0,0,0,0.02); transition:0.2s; cursor:pointer;" onmouseover="this.style.borderColor='#f59e0b'; this.style.transform='translateY(-3px)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
                            <div style="font-size:40px; margin-bottom:12px; position:relative;">
                                ${item.icon}
                                ${item.quantity > 1 ? `<span style="position:absolute; bottom:-5px; right:20px; background:#ef4444; color:white; font-size:11px; font-weight:900; padding:2px 6px; border-radius:10px;">x${item.quantity}</span>` : ''}
                            </div>
                            <div style="font-size:13px; font-weight:800; color:#334155; word-break:keep-all; margin-bottom:15px;">${item.name}</div>
                            <button style="width:100%; padding:8px; font-size:12px; font-weight:700; background:${item.type === 'BADGE' ? '#10b981' : '#f59e0b'}; color:white; border:none; border-radius:6px; cursor:pointer;" onclick="Boako.Inventory.useItem('${item.id}', '${item.type}')">
                                ${item.type === 'BADGE' ? '장착하기' : '사용하기'}
                            </button>
                        </div>
                    `).join('') + `</div>`;
            }

        } catch (error) {
            console.error("인벤토리 로드 에러:", error);
            listArea.innerHTML = `<span style="color:#ef4444;">데이터를 불러오는데 실패했습니다.</span>`;
        }
    },

    // 앞으로 만들 아이템 사용/장착 함수 뼈대 (에러 안 나게 미리 만들어 둠)
    useItem: function(inventoryId, itemType) {
        if (itemType === 'BADGE') {
            console.log("배지 장착 시도:", inventoryId);
            // TODO: 배지 장착 로직
        } else {
            console.log("아이템 사용 시도:", inventoryId);
            // TODO: 아이템 사용 로직
        }
    }
};
