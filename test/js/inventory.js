/**
 * [INVENTORY SYSTEM] 
 * 1. 이미지/이모지 스마트 아이콘 대응
 * 2. JSONB 배열 기반 배지 장착 시스템 (profiles 연동)
 * 3. 슬롯 해금 수량 제한 로직 포함
 */
Boako.Inventory = {
    // [1] 인벤토리 데이터 로드 및 화면 그리기
    loadItems: async function() {
        if (!Boako.state.user) return;

        const badgeArea = document.getElementById('equipped-badges');
        const listArea = document.getElementById('inventory-list');

        try {
            // A. 프로필 정보 가져오기 (배지 슬롯 상태 확인)
            const { data: profile, error: pError } = await Boako.db
                .from('profiles')
                .select('equipped_badges, unlocked_badge_slots')
                .eq('id', Boako.state.user.id)
                .single();

            if (pError) throw pError;

            // 🛡️ 안전장치: JSONB가 배열이 아니면 빈 배열로 초기화
            const equippedIds = Array.isArray(profile.equipped_badges) ? profile.equipped_badges : [];
            const maxSlots = profile.unlocked_badge_slots || 1;

            // B. 인벤토리 목록 가져오기 (상점 아이템 정보 Join)
            const { data: myItems, error: iError } = await Boako.db
                .from('inventory')
                .select(`
                    id, 
                    item_id, 
                    quantity, 
                    shop_items ( name, icon, item_type )
                `)
                .eq('user_id', Boako.state.user.id);

            if (iError) throw iError;

            // C. 데이터 분류 (장착됨 vs 가방에 있음)
            const equippedList = [];
            const bagList = [];

            (myItems || []).forEach(row => {
                const info = row.shop_items;
                if (!info) return;

                const itemData = { 
                    inv_id: row.id, // 인벤토리 고유 UUID
                    name: info.name, 
                    icon: info.icon, 
                    type: info.item_type,
                    quantity: row.quantity 
                };

                // 프로필 배열에 해당 인벤토리 ID가 있으면 장착 목록으로
                if (equippedIds.includes(row.id)) {
                    equippedList.push(itemData);
                } else {
                    bagList.push(itemData);
                }
            });

            // D. 아이콘 렌더링 헬퍼 (이미지 URL vs 이모지)
            const getIconHTML = (icon, size) => {
                if (!icon) return '❓';
                if (icon.startsWith('http')) {
                    return `<img src="${icon}" style="width:${size}; height:${size}; object-fit:contain;">`;
                }
                return `<span style="font-size:${size}; line-height:1;">${icon}</span>`;
            };

            // E. 화면 출력 - 1. 장착 중인 배지 슬롯
            badgeArea.innerHTML = `
                <p style="font-size:12px; color:#64748b; margin-bottom:12px; font-weight:700;">
                    🛡️ 장착 슬롯: ${equippedList.length} / ${maxSlots}
                </p>
                <div style="display:flex; flex-wrap:wrap; gap:10px; min-height:50px;">
                    ${equippedList.map(b => `
                        <div onclick="Boako.Inventory.unequip('${b.inv_id}')" 
                             style="background:white; border:2px solid #10b981; border-radius:50px; padding:6px 14px; display:flex; align-items:center; gap:8px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);" 
                             title="클릭하여 장착 해제">
                            ${getIconHTML(b.icon, '20px')}
                            <span style="font-weight:800; font-size:13px; color:#064e3b;">${b.name}</span>
                        </div>
                    `).join('')}
                    ${equippedList.length === 0 ? '<p style="color:#cbd5e1; font-size:13px;">장착된 배지가 없습니다.</p>' : ''}
                </div>
            `;

            // F. 화면 출력 - 2. 가방 속 아이템 (그리드)
            if (bagList.length === 0) {
                listArea.innerHTML = "<div style='text-align:center; padding:40px; color:#94a3b8;'>가방이 텅 비어 있습니다.</div>";
            } else {
                listArea.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:12px;">` + 
                    bagList.map(item => `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:15px 10px; text-align:center; transition:transform 0.2s;">
                            <div style="height:50px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; position:relative;">
                                ${getIconHTML(item.icon, '44px')}
                                ${item.quantity > 1 ? `<span style="position:absolute; bottom:0; right:10px; background:#ef4444; color:white; font-size:10px; font-weight:900; padding:1px 5px; border-radius:8px;">x${item.quantity}</span>` : ''}
                            </div>
                            <div style="font-size:12px; font-weight:800; color:#334155; margin-bottom:12px; height:32px; display:flex; align-items:center; justify-content:center; word-break:keep-all;">
                                ${item.name}
                            </div>
                            <button style="width:100%; padding:7px; font-size:11px; font-weight:800; background:${item.type === 'BADGE' ? '#10b981' : '#f59e0b'}; color:white; border:none; border-radius:6px; cursor:pointer;" 
                                    onclick="Boako.Inventory.useItem('${item.inv_id}', '${item.type}')">
                                ${item.type === 'BADGE' ? '장착하기' : '사용하기'}
                            </button>
                        </div>
                    `).join('') + `</div>`;
            }

        } catch (err) {
            console.error("인벤토리 로드 실패:", err);
            badgeArea.innerHTML = "<span style='color:red;'>데이터를 불러오지 못했습니다.</span>";
        }
    },

    // [2] 배지 장착 로직
    useItem: async function(inventoryId, itemType) {
        if (itemType !== 'BADGE') {
            alert("소모성 아이템 사용 기능은 준비 중입니다! 🛠️");
            return;
        }

        try {
            // 1. 최신 슬롯 정보 가져오기
            const { data: profile } = await Boako.db.from('profiles').select('equipped_badges, unlocked_badge_slots').eq('id', Boako.state.user.id).single();
            
            let equipped = Array.isArray(profile.equipped_badges) ? profile.equipped_badges : [];
            const maxSlots = profile.unlocked_badge_slots || 1;

            // 2. 슬롯 꽉 찼는지 확인
            if (equipped.length >= maxSlots) {
                alert(`배지 슬롯이 부족합니다! (현재 최대 ${maxSlots}개)`);
                return;
            }

            // 3. 중복 장착 방지
            if (equipped.includes(inventoryId)) return;

            // 4. DB 업데이트 (프로필 배열 추가 + 인벤토리 상태 변경)
            const newEquipped = [...equipped, inventoryId];
            
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            await Boako.db.from('inventory').update({ is_equipped: true }).eq('id', inventoryId);

            this.loadItems(); // UI 갱신

        } catch (err) {
            alert("장착 중 오류가 발생했습니다.");
        }
    },

    // [3] 배지 해제 로직
    unequip: async function(inventoryId) {
        try {
            const { data: profile } = await Boako.db.from('profiles').select('equipped_badges').eq('id', Boako.state.user.id).single();
            const equipped = Array.isArray(profile.equipped_badges) ? profile.equipped_badges : [];

            // 배열에서 해당 ID만 제외
            const newEquipped = equipped.filter(id => id !== inventoryId);

            // DB 업데이트 (프로필 배열 갱신 + 인벤토리 상태 변경)
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            await Boako.db.from('inventory').update({ is_equipped: false }).eq('id', inventoryId);

            this.loadItems(); // UI 갱신

        } catch (err) {
            alert("해제 중 오류가 발생했습니다.");
        }
    }
};
