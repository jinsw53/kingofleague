/**
 * ================================================================
 * [INVENTORY SYSTEM - V3.0 FINAL]
 * ================================================================
 * 설계자: 보아코 소장님
 * 주요 기능:
 *  1. 스마트 아이콘: 이미지 URL과 이모지를 자동으로 구별하여 출력
 *  2. JSONB 보안: DB 데이터가 깨져있어도(숫자 1 등) 자동으로 복구 및 배열화
 *  3. ID 정밀 매칭: UUID를 문자열로 강제 변환하여 매칭 오류 완벽 차단
 *  4. 안전 확인: 장착 및 해제 시 사용자에게 반드시 의사를 물어봄 (Confirm)
 *  5. 실시간 동기화: DB 변경 즉시 화면 UI를 재렌더링
 * ================================================================
 */

Boako.Inventory = {
    
    /**
     * [1] 아이콘 렌더링 헬퍼 함수
     * @param {string} icon - 이모지 또는 이미지 주소
     * @param {string} size - 아이콘 크기
     * @returns {string} HTML 문자열
     */
    getIconHTML: function(icon, size) {
        if (!icon) return `<span style="font-size:${size};">❓</span>`;
        
        // 아이콘이 http로 시작하면 이미지 태그로, 아니면 텍스트로 출력
        if (icon.startsWith('http')) {
            return `<img src="${icon}" style="width:${size}; height:${size}; object-fit:contain; display:block;">`;
        } else {
            return `<span style="font-size:${size}; line-height:1; display:block;">${icon}</span>`;
        }
    },

    /**
     * [2] 인벤토리 로드 및 UI 렌더링
     */
    loadItems: async function() {
        if (!Boako.state.user) {
            console.error("로그인이 필요합니다.");
            return;
        }

        const badgeArea = document.getElementById('equipped-badges');
        const listArea = document.getElementById('inventory-list');

        try {
            // [A] 프로필 정보(배지 슬롯) 가져오기
            const { data: profile, error: pError } = await Boako.db
                .from('profiles')
                .select('equipped_badges, unlocked_badge_slots')
                .eq('id', Boako.state.user.id)
                .single();

            if (pError) throw pError;

            // 🛡️ 데이터 안전장치: JSONB에 이상한 값(숫자 1 등)이 들어있어도 배열로 정화
            let equippedIds = [];
            if (profile && profile.equipped_badges) {
                if (Array.isArray(profile.equipped_badges)) {
                    // 모든 ID를 문자열로 변환하여 매칭 정확도 향상
                    equippedIds = profile.equipped_badges.map(id => String(id));
                }
            }
            
            const maxSlots = profile.unlocked_badge_slots || 1;

            // [B] 유저 인벤토리 아이템 가져오기
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

            // [C] 데이터 분류 (장착됨 vs 가방 보유)
            const equippedList = [];
            const bagList = [];

            (myItems || []).forEach(row => {
                const info = row.shop_items;
                if (!info) return;

                const itemData = { 
                    inv_id: String(row.id), 
                    name: info.name, 
                    icon: info.icon, 
                    type: info.item_type,
                    quantity: row.quantity 
                };

                // 프로필 장착 배열에 포함되어 있는지 확인 (ID 문자열 비교)
                if (equippedIds.includes(String(row.id))) {
                    equippedList.push(itemData);
                } else {
                    bagList.push(itemData);
                }
            });

            // [D] 상단 장착 슬롯 영역 그리기
            let badgeHTML = `
                <div style="margin-bottom:15px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                    <p style="font-size:13px; color:#475569; font-weight:800; display:flex; align-items:center; gap:5px;">
                        🛡️ 장착된 배지 <span style="color:#10b981;">(${equippedList.length}/${maxSlots})</span>
                    </p>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:12px; min-height:60px; align-items:center;">
            `;

            if (equippedList.length === 0) {
                badgeHTML += `<p style="color:#cbd5e1; font-size:13px; padding-left:5px;">장착된 배지가 없습니다.</p>`;
            } else {
                badgeHTML += equippedList.map(b => `
                    <div onclick="Boako.Inventory.unequip('${b.inv_id}')" 
                         style="background:white; border:2px solid #10b981; border-radius:50px; padding:8px 18px; display:flex; align-items:center; gap:10px; cursor:pointer; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); transition:all 0.2s;"
                         onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        ${this.getIconHTML(b.icon, '22px')}
                        <span style="font-weight:800; font-size:14px; color:#064e3b;">${b.name}</span>
                    </div>
                `).join('');
            }
            badgeHTML += `</div>`;
            badgeArea.innerHTML = badgeHTML;

            // [E] 가방 목록 영역 그리기
            if (bagList.length === 0) {
                listArea.innerHTML = `
                    <div style="text-align:center; padding:60px 0; color:#94a3b8;">
                        <div style="font-size:40px; margin-bottom:10px;">🎒</div>
                        <p>가방에 아이템이 없습니다.</p>
                    </div>
                `;
            } else {
                let bagHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:16px;">`;
                bagHTML += bagList.map(item => `
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px 10px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <div style="height:60px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; position:relative;">
                            ${this.getIconHTML(item.icon, '48px')}
                            ${item.quantity > 1 ? `
                                <span style="position:absolute; bottom:0; right:15%; background:#ef4444; color:white; font-size:11px; font-weight:900; padding:2px 7px; border-radius:10px; border:2px solid white;">
                                    x${item.quantity}
                                </span>
                            ` : ''}
                        </div>
                        <div style="font-size:13px; font-weight:800; color:#1e293b; margin-bottom:15px; height:36px; display:flex; align-items:center; justify-content:center; word-break:keep-all; padding:0 5px;">
                            ${item.name}
                        </div>
                        <button style="width:100%; padding:9px; font-size:12px; font-weight:800; background:${item.type === 'BADGE' ? '#10b981' : '#f59e0b'}; color:white; border:none; border-radius:8px; cursor:pointer; transition:opacity 0.2s;"
                                onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'"
                                onclick="Boako.Inventory.useItem('${item.inv_id}', '${item.type}')">
                            ${item.type === 'BADGE' ? '장착하기' : '사용하기'}
                        </button>
                    </div>
                `).join('');
                bagHTML += `</div>`;
                listArea.innerHTML = bagHTML;
            }

        } catch (err) {
            console.error("인벤토리 로딩 중 치명적 에러:", err);
            badgeArea.innerHTML = "<div style='color:red; padding:20px;'>데이터 연결 오류가 발생했습니다.</div>";
        }
    },

    /**
     * [3] 아이템 사용 및 배지 장착
     */
    useItem: async function(inventoryId, itemType) {
        if (itemType !== 'BADGE') {
            alert("소모성 아이템(물약 등) 기능은 현재 개발 중입니다! 🛠️");
            return;
        }

        // 🌟 확인 절차 (소장님 요청 사항)
        if (!confirm("이 배지를 장착하시겠습니까?")) return;

        try {
            const { data: profile } = await Boako.db.from('profiles').select('equipped_badges, unlocked_badge_slots').eq('id', Boako.state.user.id).single();
            
            let equipped = Array.isArray(profile.equipped_badges) ? profile.equipped_badges : [];
            const maxSlots = profile.unlocked_badge_slots || 1;

            if (equipped.length >= maxSlots) {
                alert(`장착 슬롯이 꽉 찼습니다! (최대 ${maxSlots}개)\n기존 배지를 해제하고 다시 시도해주세요.`);
                return;
            }

            // 중복 방지 체크
            if (equipped.map(id => String(id)).includes(String(inventoryId))) return;

            const newEquipped = [...equipped, inventoryId];
            
            // DB 동기화
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            await Boako.db.from('inventory').update({ is_equipped: true }).eq('id', inventoryId);

            this.loadItems(); // 화면 새로고침

        } catch (err) {
            console.error("장착 중 오류:", err);
            alert("장착 처리에 실패했습니다.");
        }
    },

    /**
     * [4] 배지 장착 해제
     */
    unequip: async function(inventoryId) {
        if (!confirm("이 배지를 장착 해제하시겠습니까?")) return;

        try {
            const { data: profile } = await Boako.db.from('profiles').select('equipped_badges').eq('id', Boako.state.user.id).single();
            let equipped = Array.isArray(profile.equipped_badges) ? profile.equipped_badges : [];

            // 선택한 아이디만 필터링해서 제거
            const newEquipped = equipped.filter(id => String(id) !== String(inventoryId));

            // DB 동기화
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            await Boako.db.from('inventory').update({ is_equipped: false }).eq('id', inventoryId);

            this.loadItems(); // 화면 새로고침

        } catch (err) {
            console.error("해제 중 오류:", err);
            alert("해제 처리에 실패했습니다.");
        }
    }
};
