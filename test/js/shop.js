/**
 * [SHOP] 포인트 샵 기능 (가장 가볍고 독립적인 모듈)
 */
Boako.Shop = {
    // 1. 판매할 아이템 목록 (DB 없이 배열로 초간단 구현)
    items: [
        { id: 'item_badge_vip', type: 'BADGE', name: '프리미엄 VIP 배지', price: 1000000, icon: '👑', desc: '프로필 옆에 영구적인 간지폭발 VIP 배지가 달립니다.' },
        { id: 'item_ticket_rename', type: 'TICKET', name: '닉네임 변경권', price: 1000, icon: '✨', desc: '아카이브에서 닉네임을 변경할 수 있습니다. 즉시 사용됩니다' },
        { id: 'item_ticket_reteamlogo', type: 'TICKET', name: '팀로고 변경권', price: 3000, icon: '🎫', desc: '소속 팀의 로고를 1회 변경할 수 잇는 희귀 아이템입니다. 즉시 사용됩니다.' },
        { id: 'item_slot_expand', type: 'UPGRADE', name: '배지 슬롯 확장권', price: 3000, icon: '🔓' } // 슬롯 확장권 추가!
  
           ],
    
  // 2. 구매 로직 (shop.js의 buyItem 부분을 이걸로 교체하세요)
    buyItem: async (itemId, price, itemName) => {
        const user = Boako.state.user;
        if (!user) return Boako.Util.toast("🔒 로그인이 필요합니다.");

        try {
            // 현재 유저의 포인트 조회
            const { data: profile, error } = await Boako.db.from('profiles').select('points').eq('id', user.id).single();
            if (error) throw error;

            const currentPoints = profile.points || 0;

            // 잔액 부족 체크
            if (currentPoints < price) {
                return Boako.Util.toast(`❌ 포인트가 부족합니다. (현재 잔액: ${currentPoints} P)`);
            }

            // 구매 확인 및 포인트 차감
            if (confirm(`[${itemName}] 아이템을 ${price} P에 구매하시겠습니까?`)) {
                // 1) 프로필 테이블 포인트 차감
                const { error: updateErr } = await Boako.db.from('profiles')
                    .update({ points: currentPoints - price })
                    .eq('id', user.id);
                if (updateErr) throw updateErr;
                
                // 2) ★ 포인트 내역 테이블에 기록 남기기 (추가된 부분) ★
                const { error: historyErr } = await Boako.db.from('point_history')
                    .insert([{
                        user_id: user.id,
                        point_change: -price, // 썼으니까 마이너스
                        description: `[아이템 구매] ${itemName}`
                    }]);
                if (historyErr) console.error("내역 기록 실패:", historyErr);
                
                Boako.Util.toast("🎁 구매가 완료되었습니다!");
                // 화면 리렌더링하여 포인트 및 내역 갱신
                Boako.View.render('shop'); 
            }
        } catch (err) {
            console.error(err);
            Boako.Util.toast("오류가 발생했습니다: " + err.message);
        }
    }
};
