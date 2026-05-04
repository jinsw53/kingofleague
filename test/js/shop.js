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

            // 2) 내 포인트 조회
            const { data: profile, error: profErr } = await Boako.db.from('profiles').select('points').eq('id', user.id).single();
            if (profErr) throw profErr;

            const currentPoints = profile.points || 0;

            // 3) 잔액 부족 체크
            if (currentPoints < targetItem.price) {
                return Boako.Util.toast(`❌ 포인트가 부족합니다. (필요: ${targetItem.price} P)`);
            }

            // 4) 아이템 타입에 따른 구매 프로세스 분기
            if (targetItem.item_type === 'TICKET') {
                // ==========================================
                // 🎟️ [티켓 류] 즉시 소모형 로직
                // ==========================================
                if (!confirm(`[경고] ${targetItem.name}은(는) 인벤토리에 보관되지 않고 즉시 사용됩니다.\n${targetItem.price} P를 사용하여 지금 바로 진행하시겠습니까?`)) {
                    return; // 취소 시 종료 (포인트 미차감)
                }

                let newValue = "";
                
                // 4-1. 닉네임 변경권인 경우
                if (targetItem.item_id === 'item_ticket_nick') {
                    newValue = prompt("새로운 닉네임을 입력하세요:");
                    if (!newValue || !newValue.trim()) return Boako.Util.toast("취소되었습니다. (포인트 미차감)");
                    
                    // DB 닉네임 변경
                    const { error: updateErr } = await Boako.db.from('profiles').update({ full_name: newValue.trim() }).eq('id', user.id);
                    if (updateErr) return Boako.Util.toast("닉네임 변경 실패: " + updateErr.message);
                    
                    Boako.state.user.nickname = newValue.trim(); // 로컬 상태 업데이트
                } 
                // 4-2. 팀명 변경권인 경우
                else if (targetItem.item_id === 'item_ticket_rename') {
                    // 팀장 권한 체크
                    if (!Boako.state.team || Boako.state.team.type !== 'LEADER') {
                        return Boako.Util.toast("팀명 변경권은 팀장만 사용할 수 있습니다! (포인트 미차감)");
                    }
                    newValue = prompt("새로운 팀 이름을 입력하세요:");
                    if (!newValue || !newValue.trim()) return Boako.Util.toast("취소되었습니다. (포인트 미차감)");
                    
                    // DB 팀명 변경
                    const { error: updateErr } = await Boako.db.from('teams').update({ team_name: newValue.trim() }).eq('id', Boako.state.team.info.id);
                    if (updateErr) return Boako.Util.toast("팀명 변경 실패: " + updateErr.message);
                    
                    Boako.state.team.info.team_name = newValue.trim(); // 로컬 상태 업데이트
                }
                else {
                    return Boako.Util.toast("알 수 없는 티켓 종류입니다.");
                }

                // 4-3. 적용이 성공적으로 끝났으니 실제 결제 진행
                await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                await Boako.db.from('point_history').insert([{
                    user_id: user.id, 
                    point_change: -targetItem.price, 
                    description: `[아이템 즉시 사용] ${targetItem.name}`
                }]);
                
                Boako.Util.toast(`✅ ${targetItem.name} 사용 완료!`);
                Boako.Auth.renderWidget(); // 좌측 로그인 위젯 닉네임 갱신
                Boako.View.render('shop'); // 상점 화면 갱신

            } else {
                // ==========================================
                // 🎒 [배지, 색상 등] 인벤토리 보관형 로직
                // ==========================================
                if (confirm(`[${targetItem.name}] 아이템을 ${targetItem.price} P에 구매하시겠습니까?`)) {
                    
                    // ① 포인트 차감
                    await Boako.db.from('profiles').update({ points: currentPoints - targetItem.price }).eq('id', user.id);
                    
                    // ② 영수증 기록
                    await Boako.db.from('point_history').insert([{
                        user_id: user.id, 
                        point_change: -targetItem.price, 
                        description: `[상점 구매] ${targetItem.name}`
                    }]);

                    // ③ 인벤토리 저장
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
                            item_type: targetItem.item_type, 
                            quantity: 1
                        }]);
                    }
                    
                    Boako.Util.toast("🎁 구매 완료! 인벤토리에 지급되었습니다.");
                    Boako.View.render('shop'); // 화면 갱신
                }
            }
        } catch (err) {
            console.error(err);
            Boako.Util.toast("오류가 발생했습니다: " + err.message);
        }
    }
};
