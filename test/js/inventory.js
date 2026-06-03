/**
 * ==============================================================================
 * [BOAKO INVENTORY SYSTEM - V4.0 FINAL]
 * ==============================================================================
 * 
 * 주요 해결 과제:
 * 1. 타입 불일치 해결: DB의 숫자(1)와 JSONB의 문자열("1") 비교 오류 완벽 차단
 * 2. 데이터 유효성 검사: DB 데이터가 배열이 아닌 경우(null, 숫자 등) 자동 복구
 * 3. 스마트 아이콘: 이미지 URL과 이모지를 자동 판별하여 최적화된 HTML 출력
 * 4. 사용자 피드백: 장착/해제 시 컨펌창(Confirm)을 통한 오클릭 방지
 */

Boako.Inventory = {

    /**
     * [함수] 아이콘 HTML 생성기
     * 아이콘 데이터가 이미지 주소인지 이모지인지 판단하여 적절한 태그를 반환합니다.
     */
    getIconHTML: function(icon, size) {
        if (!icon) return `<span style="font-size:${size};">❓</span>`;

        // 문자열이 'http'로 시작하면 <img> 태그로 생성
        if (icon.startsWith('http')) {
            return `<img src="${icon}" style="width:${size}; height:${size}; object-fit:contain; display:block;">`;
        } 
        // 그렇지 않으면 일반 텍스트(이모지)로 생성
        else {
            return `<span style="font-size:${size}; line-height:1; display:block;">${icon}</span>`;
        }
    },

    /**
     * [함수] 인벤토리 로드 및 전체 렌더링
     * 프로필의 장착 슬롯과 가방의 아이템 리스트를 화면에 그립니다.
     */
    loadItems: async function() {
        // 로그인 체크
        if (!Boako.state.user) {
            console.error("사용자 정보가 없습니다. 로그인을 확인하세요.");
            return;
        }

        const badgeArea = document.getElementById('equipped-badges'); // 장착 슬롯 영역
        const listArea = document.getElementById('inventory-list');   // 가방 목록 영역

        try {
            // --- 1단계: 프로필 정보(배지 슬롯) 가져오기 ---
            const { data: profile, error: pError } = await Boako.db
                .from('profiles')
                .select('equipped_badges, unlocked_badge_slots')
                .eq('id', Boako.state.user.id)
                .single();

            if (pError) throw pError;

            /**
             * 🛡️ [타입 세탁기]
             * DB의 equipped_badges가 ["1"] 형태든 [1] 형태든, 혹은 그냥 숫자 1이든
             * 무조건 자바스크립트에서 다루기 쉬운 '문자열 배열'로 변환합니다.
             */
            let equippedIds = [];
            if (profile && profile.equipped_badges) {
                if (Array.isArray(profile.equipped_badges)) {
                    equippedIds = profile.equipped_badges.map(id => String(id));
                } else {
                    // 배열이 아닌 단일 값(숫자 등)이 들어있을 경우 배열로 감싸줌
                    equippedIds = [String(profile.equipped_badges)];
                }
            }
            
            // 해금된 슬롯 수 (데이터가 없으면 기본 1개)
            const maxSlots = profile.unlocked_badge_slots || 1;

            // --- 2단계: 유저 인벤토리 아이템 가져오기 (상점 정보 조인) ---
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

            // 데이터 분류를 위한 바구니 준비
            const equippedList = []; // 장착된 배지들
            const bagList = [];      // 가방에 남은 아이템들

            // --- 3단계: 장착 여부에 따른 리스트 분류 ---
            (myItems || []).forEach(row => {
                const info = row.shop_items;
                if (!info) return; // 상점 정보가 없는 데이터는 패스

                const itemData = { 
                    inv_id: String(row.id), // 비교를 위해 ID를 문자열로 통일
                    name: info.name, 
                    icon: info.icon, 
                    type: info.item_type,
                    quantity: row.quantity 
                };

                // 프로필 장착 배열에 내 인벤토리 고유 ID가 들어있는지 확인
                if (equippedIds.includes(itemData.inv_id)) {
                    equippedList.push(itemData);
                } else {
                    bagList.push(itemData);
                }
            });

            // --- 4단계: 장착 슬롯 화면 그리기 ---
            let badgeHTML = `
                <div style="margin-bottom:15px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                    <p style="font-size:13px; color:#475569; font-weight:800;">
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
                         style="background:white; border:2px solid #10b981; border-radius:50px; padding:8px 18px; display:flex; align-items:center; gap:10px; cursor:pointer; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); transition:transform 0.2s;"
                         onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        ${this.getIconHTML(b.icon, '22px')}
                        <span style="font-weight:800; font-size:14px; color:#064e3b;">${b.name}</span>
                    </div>
                `).join('');
            }
            badgeHTML += `</div>`;
            badgeArea.innerHTML = badgeHTML;

            // --- 5단계: 가방 아이템 목록 그리기 ---
            if (bagList.length === 0) {
                listArea.innerHTML = `
                    <div style="text-align:center; padding:60px 0; color:#94a3b8;">
                        <div style="font-size:40px; margin-bottom:10px;">🎒</div>
                        <p>가방이 비어 있습니다.</p>
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
                        <button style="width:100%; padding:9px; font-size:12px; font-weight:800; background:${item.type === 'BADGE' ? '#10b981' : '#f59e0b'}; color:white; border:none; border-radius:8px; cursor:pointer;"
                                onclick="Boako.Inventory.useItem('${item.inv_id}', '${item.type}')">
                            ${item.type === 'BADGE' ? '장착하기' : '사용하기'}
                        </button>
                    </div>
                `).join('');
                bagHTML += `</div>`;
                listArea.innerHTML = bagHTML;
            }

        } catch (err) {
            console.error("인벤토리 로딩 오류:", err);
            badgeArea.innerHTML = "데이터 연동 중 오류 발생";
        }
    },

    /**
     * [함수] 아이템 사용 및 장착 처리
     */
    useItem: async function(inventoryId, itemType) {
        if (itemType !== 'BADGE') {
            alert("소모성 아이템은 현재 사용할 수 없습니다.");
            return;
        }

        // 🌟 확인 창 띄우기
        if (!confirm("이 배지를 장착하시겠습니까?")) return;

        try {
            // 최신 슬롯 정보 조회
            const { data: profile } = await Boako.db.from('profiles').select('equipped_badges, unlocked_badge_slots').eq('id', Boako.state.user.id).single();
            
            let equipped = Array.isArray(profile.equipped_badges) ? profile.equipped_badges : [];
            const maxSlots = profile.unlocked_badge_slots || 1;

            // 슬롯 초과 체크
            if (equipped.length >= maxSlots) {
                alert(`장착 슬롯이 부족합니다! (현재 최대 ${maxSlots}개)`);
                return;
            }

            // 중복 장착 방지 (이미 배열에 있다면 무시)
            if (equipped.map(id => String(id)).includes(String(inventoryId))) return;

            // 새로운 장착 목록 생성 (기존 목록 + 신규 ID)
            const newEquipped = [...equipped, String(inventoryId)];
            
            // 1. 프로필 테이블 업데이트 (JSONB 배열 갱신)
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            
            // 2. 인벤토리 테이블 업데이트 (TRUE로 변경)
            await Boako.db.from('inventory').update({ is_equipped: true }).eq('id', inventoryId);

            this.loadItems(); // 화면 새로고침

        } catch (err) {
            console.error("장착 중 오류:", err);
            alert("장착 처리에 실패했습니다.");
        }
    },

    /**
     * [함수] 배지 해제 처리
     */
    unequip: async function(inventoryId) {
        if (!confirm("이 배지를 장착 해제하시겠습니까?")) return;

        try {
            const { data: profile } = await Boako.db.from('profiles').select('equipped_badges').eq('id', Boako.state.user.id).single();
            let equipped = Array.isArray(profile.equipped_badges) ? profile.equipped_badges : [];

            // 배열에서 해당 ID만 제외 (필터링)
            const newEquipped = equipped.filter(id => String(id) !== String(inventoryId));

            // 1. 프로필 테이블 업데이트 (JSONB 배열 갱신)
            await Boako.db.from('profiles').update({ equipped_badges: newEquipped }).eq('id', Boako.state.user.id);
            
            // 2. 인벤토리 테이블 업데이트 (FALSE로 변경)
            await Boako.db.from('inventory').update({ is_equipped: false }).eq('id', inventoryId);

            this.loadItems(); // 화면 새로고침

        } catch (err) {
            console.error("해제 중 오류:", err);
            alert("해제 처리에 실패했습니다.");
        }
    }
};
