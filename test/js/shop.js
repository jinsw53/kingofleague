/**
 * [SHOP] 포인트 샵 기능
 */
Boako.Shop = {
    // 1. 판매할 아이템 목록 (type 속성 추가!)
    items: [
        { id: 'item_badge_vip', type: 'BADGE', name: '프리미엄 VIP 배지', price: 1000, icon: '👑', desc: '프로필 옆에 영구적인 간지폭발 VIP 배지가 달립니다.' },
        { id: 'item_color_gold', type: 'COLOR', name: '닉네임 황금색 변경권', price: 500, icon: '✨', desc: '아카이브에서 닉네임이 황금색으로 빛납니다.' },
        { id: 'item_ticket_rename', type: 'TICKET', name: '팀명 변경권', price: 2000, icon: '🎫', desc: '소속 팀의 이름을 1회 변경할 수 있는 희귀 아이템입니다.' },
        { id: 'item_slot_expand', type: 'UPGRADE', name: '배지 슬롯 확장권', price: 3000, icon: '🔓', desc: '배지를 장착할 수 있는 슬롯을 1칸 늘려줍니다.' }
    ],
    
    // 2. 구매 로직
    buyItem: async (itemId, price, itemName) => {
        const user = Boako.state.user;
        if (!user) return Boako.Util.toast("🔒 로그인이 필요합니다.");

        try {
            // 내가 누른 아이템의 상세 정보(type 등) 찾기
            const targetItem = Boako.Shop.items.find(i => i.id === itemId);
            if (!targetItem) return;

            // 1) 현재 유저의 포인트 조회
            const { data: profile, error } = await Boako.db.from('profiles').select('points').eq('id', user.id).single();
            if (error) throw error;

            const currentPoints = profile.points || 0;

            // 2) 잔액 부족 체크
            if (currentPoints < price) {
                return Boako.Util.toast(`❌ 포인트가 부족합니다. (현재 잔액: ${currentPoints} P)`);
            }

            // 3) 구매 확인 프로세스 시작
            if (confirm(`[${itemName}] 아이템을 ${price} P에 구매하시겠습니까?`)) {
                
                // ① 포인트 차감
                await Boako.db.from('profiles').update({ points: currentPoints - price }).eq('id', user.id);
                
                // ② 포인트 내역(영수증) 기록
                await Boako.db.from('point_history').insert([{
                    user_id: user.id,
                    point_change: -price,
                    description: `[상점 구매] ${itemName}`
                }]);

                // ③ ★ 인벤토리 저장 로직 ★
                // 먼저 인벤토리에 이 아이템이 이미 있는지 확인합니다 (수량 증가를 위해)
                const { data: existItem } = await Boako.db.from('inventory')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('item_id', itemId)
                    .maybeSingle();

                if (existItem) {
                    // 이미 있으면 수량(quantity)만 +1 업데이트
                    await Boako.db.from('inventory')
                        .update({ quantity: existItem.quantity + 1 })
                        .eq('id', existItem.id);
                } else {
                    // 없으면 새로 인서트
                    await Boako.db.from('inventory').insert([{
                        user_id: user.id,
                        item_id: itemId,
                        item_type: targetItem.type,
                        quantity: 1
                    }]);
                }
                
                Boako.Util.toast("🎁 구매 완료! 인벤토리에 지급되었습니다.");
                Boako.View.render('shop'); // 화면 갱신
            }
        } catch (err) {
            console.error(err);
            Boako.Util.toast("오류가 발생했습니다: " + err.message);
        }
    }
};
