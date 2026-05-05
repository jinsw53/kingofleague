/**
 * [INVENTORY] 소장님 전용 배지/아이템 관리 시스템
 */
Boako.Inventory = {
    // 1. 화면에 아이템 목록 불러오기
    loadItems: async function() {
        if (!Boako.state.user) return;

        const badgeArea = document.getElementById('equipped-badges');
        const listArea = document.getElementById('inventory-list');

        try {
            // [A] 프로필 정보 가져오기 (장착 배열 및 해금 슬롯 수)
            const { data: profile, error: pError } = await Boako.db
                .from('profiles')
                .select('equipped_badges, unlocked_badge_slots')
                .eq('id', Boako.state.user.id)
                .single();

            if (pError) throw pError;
            
            const equippedIds = profile.equipped_badges || []; // [UUID, UUID, ...]
            const maxSlots = profile.unlocked_badge_slots || 1;

            // [B] 내 인벤토리 아이템 가져오기 (상점 정보 조인)
            const { data: myItems, error: iError } = await Boako.db
                .from('inventory') 
                .select(`
                    id,
                    item_id,
                    quantity,
                    is_equipped,
                    shop_items ( name, icon, item_type )
                `)
                .eq('user_id', Boako.state.user.id);

            if (iError) throw iError;

            // [C] 데이터 분류 (장착된 것 vs 가방에 있는 것)
            const equippedList = [];
            const bagList = [];

            (myItems || []).forEach(row => {
                const info = row.shop_items;
                if (!info) return;

                // 🌟 프로필의 equipped_badges 배열에 내 인벤토리 ID가 들어있는지 확인
                if (equippedIds.includes(row.id)) {
                    equippedList.push({ id: row.id, ...info });
                } else {
                    bagList.push({ id: row.id, ...info, quantity: row.quantity });
                }
            });

            // [D] 화면 그리기 - 1. 장착 중인 배지 슬롯
            badgeArea.innerHTML = `
                <p style="font-size:12px; color:#64748b; margin-bottom:10px;">사용 중인 슬롯: ${equippedList.length} / ${maxSlots}</p>
                <div style="display:flex; flex-wrap:wrap; gap:10px;">
                    ${equippedList.map(b => `
                        <div onclick="Boako.Inventory.unequip('${b.id}')" style="background:white; border:2px solid #10b981; border-radius:50px; padding:8px 16px; display:flex; align-items:center; gap:8px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);" title="클릭하면 장착 해제">
                            <span style="font-size:18px;">${b.icon}</span>
                            <span style="font-weight:800; font-size:14px;">${b.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;

            // [E] 화면 그리기 - 2. 가방 속 아이템
            if (bagList.length === 0) {
                listArea.innerHTML = "<p style='color:#94a3b8; padding:20px 0;'>가방이 비어있습니다.</p>";
            } else {
                listArea.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:15px;">` + 
                    bagList.map(item => `
                        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px 10px; text-align:center;">
                            <div style="font-size:40px; margin-bottom:12px; position:relative;">
                                ${item.icon}
                                ${item.quantity > 1 ? `<span style="position:absolute; bottom:-5px; right:20px; background:#ef4444; color:white; font-size:11px; font-weight:900; padding:2px 6px; border-radius:10px;">x${item.quantity}</span>` : ''}
                            </div>
                            <div style="font-size:13px; font-weight:800; color:#334155; margin-bottom:15px;">${item.name}</div>
                            <button style="width:100%; padding:8px; font-size:12px; font-weight:700; background:${item.item_type === 'BADGE' ? '#10b981' : '#f59e0b'}; color:white; border:none; border-radius:6px; cursor:pointer;" 
                                    onclick="Boako.Inventory.useItem('${item.id}', '${item.item_type}')">
                                ${item.item_type === 'BADGE' ? '장착하기' : '사용하기'}
                            </button>
                        </div>
                    `).join('') + `</div>`;
            }

        } catch (err) {
            console.error(err);
            badgeArea.innerHTML = "데이터 로딩 실패";
        }
    },

    // 2. 배지 장착하기
    useItem: async function(inventoryId, itemType) {
        if (itemType !== 'BADGE') {
            alert("사용 가능한 아이템이 아닙니다.");
            return;
        }

        try {
            const { data: profile } = await Boako.db.from('profiles').select('*').eq('id', Boako.state.user.id).single();
            const equipped = profile.equipped_badges || [];
            const maxSlots = profile.unlocked_badge_slots || 1;

            if (equipped.length >= maxSlots) {
                alert(`슬롯이 꽉 찼습니다! (최대 ${maxSlots}개)`);
                return;
            }

            // [DB 업데이트] 프로필 배열에 추가 + 인벤토리 상태 변경
            const newEquipped = [...equipped, inventoryId];
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            await Boako.db.from('inventory').update({ is_equipped: true }).eq('id', inventoryId);

            alert("장착 완료! ✨");
            this.loadItems();
        } catch (err) { alert("장착 중 에러 발생"); }
    },

    // 3. 배지 해제하기
    unequip: async function(inventoryId) {
        if (!confirm("장착을 해제하시겠습니까?")) return;

        try {
            const { data: profile } = await Boako.db.from('profiles').select('equipped_badges').eq('id', Boako.state.user.id).single();
            
            // 배열에서 해당 ID 제거
            const newEquipped = (profile.equipped_badges || []).filter(id => id !== inventoryId);

            // [DB 업데이트] 프로필 배열 갱신 + 인벤토리 상태 변경
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            await Boako.db.from('inventory').update({ is_equipped: false }).eq('id', inventoryId);

            alert("해제되었습니다. 💨");
            this.loadItems();
        } catch (err) { alert("해제 중 에러 발생"); }
    }
};
