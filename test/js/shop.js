/**
 * [SHOP] 포인트 샵 기능 (지연 로딩 아키텍처 적용)
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

            // 2) 내 포인트 및 현재 슬롯 개수 같이 조회
            const { data: profile, error: profErr } = await Boako.db.from('profiles')
                .select('points, unlocked_badge_slots')
                .eq('id', user.id)
                .single();
            if (profErr) throw profErr;

            const currentPoints = profile.points || 0;
            const currentSlots = profile.unlocked_badge_slots || 1;

            // 3) 잔액 부족 체크
            if (currentPoints < targetItem.price) {
                return Boako.Util.toast(`❌ 포인트가 부족합니다. (필요: ${targetItem.price} P)`);
            }

            // 4) 아이템 타입에 따른 구매 프로세스 분기
            
            // ==========================================
            // ⚡ [티켓 / 업그레이드] 즉시 실행 (지연 로딩 방식)
            // ==========================================
            if (targetItem.item_type === 'TICKET' || targetItem.item_type === 'UPGRADE') {
                if (!confirm(`[경고] ${targetItem.name}은(는) 즉시 사용/적용됩니다.\n${targetItem.price} P를 사용하여 진행하시겠습니까?`)) {
                    return; 
                }

                // ① 서랍에 기능이 있는지 확인
                let actionFunc = Boako.ItemActions[targetItem.item_id];
                
                // ② 서랍에 없다면? 지금 바로 파일을 다운로드한다! (지연 로딩)
                if (!actionFunc) {
                    try {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = `js/actions/${targetItem.item_id}.js`; // 아이템 ID와 동일한 파일명 호출
                            script.onload = resolve;
                            script.onerror = () => reject(new Error("스크립트 파일을 찾을 수 없습니다."));
                            document.head.appendChild(script);
                        });
                        // 파일이 다운로드되며 서랍을 채웠을 테니 다시 꺼냄
                        actionFunc = Boako.ItemActions[targetItem.item_id];
                    } catch (e) {
                        console.error("액션 파일 로드 실패:", e);
                        return Boako.Util.toast("해당 아이템의 기능을 불러오지 못했습니다.");
                    }
                }

                // ③ 서랍에서 기능을 무사히 꺼냈다면 실행!
                if (actionFunc) {
                    try {
                        // 액션 함수 실행 (취소 시 여기서 Error를 던짐)
                        await actionFunc(user, targetItem, currentSlots);
                        
                        // 성공적으로 실행되었으니 결제 진행
                        await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                        await Boako.db.from('point_history').insert([{
                            user_id: user.id, point_change: -targetItem.price, description: `[아이템 즉시 사용] ${targetItem.name}`
                        }]);
                        
                        Boako.Util.toast(`✅ ${targetItem.name} 사용 완료!`);
                        Boako.Auth.renderWidget(); 
                        Boako.View.render('shop'); 

                    } catch (error) {
                        // 액션 로직 내부에서 취소했거나 에러가 났을 때 방어
                        if (error.message !== "취소") {
                            Boako.Util.toast("실행 오류: " + error.message);
                        }
                    }
                } else {
                    return Boako.Util.toast("아직 시스템에 구현되지 않은 아이템입니다.");
                }

            } 
            // ==========================================
            // 🎒 [배지, 색상 등] 인벤토리 보관형
            // ==========================================
            else {
                if (confirm(`[${targetItem.name}] 아이템을 ${targetItem.price} P에 구매하시겠습니까?`)) {
                    
                    // 결제 진행
                    await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                    await Boako.db.from('point_history').insert([{
                        user_id: user.id, point_change: -targetItem.price, description: `[상점 구매] ${targetItem.name}`
                    }]);

                    // 인벤토리 저장 로직
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
