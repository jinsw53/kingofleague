/**
 * [SHOP] 포인트 샵 기능 (DB 완벽 연동 및 즉시 사용/보관 분기형)
 */
Boako.Shop = {
    // 구매 로직
    buyItem: async (itemId) => {
        const user = Boako.state.user;
        if (!user) return Boako.Util.toast("🔒 로그인이 필요합니다.");

        try {
            // 1) DB에서 아이템 정보 가져오기 (item_id 기준)
            const { data: targetItem, error: itemErr } = await Boako.db.from('shop_items')
                .select('*')
                .eq('item_id', itemId)
                .single();
                
            if (itemErr || !targetItem) return Boako.Util.toast("판매하지 않는 아이템입니다.");
            if (!targetItem.is_active) return Boako.Util.toast("현재 판매가 중단된 아이템입니다.");

            // 2) 내 포인트 및 ★현재 슬롯 개수★ 같이 조회
            const { data: profile, error: profErr } = await Boako.db.from('profiles')
                .select('points, unlocked_badge_slots')
                .eq('id', user.id)
                .single();
            if (profErr) throw profErr;

            const currentPoints = profile.points || 0;
            const currentSlots = profile.unlocked_badge_slots || 1; // 기본값 1

            // 3) 잔액 부족 체크
            if (currentPoints < targetItem.price) {
                return Boako.Util.toast(`❌ 포인트가 부족합니다. (필요: ${targetItem.price} P)`);
            }

            // 4) 아이템 타입에 따른 구매 프로세스 분기
            
            // ==========================================
            // 🎟️ [티켓 류] 즉시 소모형 (닉네임/팀명 변경)
            // ==========================================
            if (targetItem.item_type === 'TICKET') {
                if (!confirm(`[경고] ${targetItem.name}은(는) 즉시 사용됩니다.\n${targetItem.price} P를 사용하여 지금 진행하시겠습니까?`)) {
                    return; 
                }

                let newValue = "";
                
                if (targetItem.item_id === 'item_ticket_nick') {
                    newValue = prompt("새로운 닉네임을 입력하세요:");
                    if (!newValue || !newValue.trim()) return Boako.Util.toast("취소되었습니다. (포인트 미차감)");
                    
                    const { error: updateErr } = await Boako.db.from('profiles').update({ full_name: newValue.trim() }).eq('id', user.id);
                    if (updateErr) return Boako.Util.toast("닉네임 변경 실패: " + updateErr.message);
                    
                    Boako.state.user.nickname = newValue.trim(); 
                } 
                else if (targetItem.item_id === 'item_ticket_rename') {
                    if (!Boako.state.team || Boako.state.team.type !== 'LEADER') {
                        return Boako.Util.toast("팀명 변경권은 팀장만 사용할 수 있습니다! (포인트 미차감)");
                    }
                    newValue = prompt("새로운 팀 이름을 입력하세요:");
                    if (!newValue || !newValue.trim()) return Boako.Util.toast("취소되었습니다. (포인트 미차감)");
                    
                    const { error: updateErr } = await Boako.db.from('teams').update({ team_name: newValue.trim() }).eq('id', Boako.state.team.info.id);
                    if (updateErr) return Boako.Util.toast("팀명 변경 실패: " + updateErr.message);
                    
                    Boako.state.team.info.team_name = newValue.trim(); 
                }

                // 결제 진행
                await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                await Boako.db.from('point_history').insert([{
                    user_id: user.id, point_change: -targetItem.price, description: `[아이템 사용] ${targetItem.name}`
                }]);
                
                Boako.Util.toast(`✅ ${targetItem.name} 사용 완료!`);
                Boako.Auth.renderWidget(); 
                Boako.View.render('shop'); 

            } 
            // ==========================================
            // 🔓 [업그레이드 류] 즉시 적용형 (슬롯 확장)
            // ==========================================
            else if (targetItem.item_type === 'UPGRADE') {
                if (targetItem.item_id === 'item_slot_expand') {
                    // ★ 최대 슬롯 제한 방어 로직 (7개)
                    if (currentSlots >= 7) {
                        return Boako.Util.toast("❌ 이미 모든 배지 슬롯(7칸)을 개방하셨습니다!");
                    }

                    if (!confirm(`[경고] ${targetItem.name}은(는) 즉시 적용되어 슬롯이 늘어납니다.\n${targetItem.price} P를 사용하여 진행하시겠습니까?`)) {
                        return;
                    }

                    // 포인트 차감과 슬롯 확장을 한 번의 DB 요청으로 처리!
                    const { error: updateErr } = await Boako.db.from('profiles')
                        .update({ 
                            points: currentPoints - targetItem.price,
                            unlocked_badge_slots: currentSlots + 1
                        })
                        .eq('id', user.id);

                    if (updateErr) return Boako.Util.toast("슬롯 확장 실패: " + updateErr.message);

                    // 영수증 기록
                    await Boako.db.from('point_history').insert([{
                        user_id: user.id, point_change: -targetItem.price, description: `[시스템 업그레이드] ${targetItem.name}`
                    }]);

                    Boako.Util.toast(`🔓 배지 슬롯이 ${currentSlots + 1}칸으로 확장되었습니다!`);
                    Boako.View.render('shop');
                }
            } 
            // ==========================================
            // 🎒 [배지, 색상 등] 인벤토리 보관형
            // ==========================================
            else {
                if (confirm(`[${targetItem.name}] 아이템을 ${targetItem.price} P에 구매하시겠습니까?`)) {
                    
                    await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                    await Boako.db.from('point_history').insert([{
                        user_id: user.id, point_change: -targetItem.price, description: `[상점 구매] ${targetItem.name}`
                    }]);

                    const { data: existItem } = await Boako.db.from('inventory')
                        .select('*').eq('user_id', user.id).eq('item_id', itemId).maybeSingle();

                    if (existItem) {
                        await Boako.db.from('inventory').update({ quantity: existItem.quantity + 1 }).eq('id', existItem.id);
                    } else {
                        await Boako.db.from('inventory').insert([{
                            user_id: user.id, item_id: itemId, item_type: targetItem.item_type, quantity: 1
                        }]);
                    }
                    
                    Boako.Util.toast("🎁 구매 완료! 인벤토리에 지급되었습니다.");
                    Boako.View.render('shop');
                }
            }
        } catch (err) {
            console.error(err);
            Boako.Util.toast("오류가 발생했습니다: " + err.message);
        }
    }
};
