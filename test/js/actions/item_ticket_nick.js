// js/actions/item_ticket_nick.js

// 불려오는 순간, Boako 서랍장에 자기 기능을 쏙 넣습니다.
Boako.ItemActions['item_ticket_nick'] = async (user, targetItem) => {
    let newValue = prompt("새로운 닉네임을 입력하세요:");
    if (!newValue) throw new Error("취소");
    
    // 닉네임 변경
    const { error: updateErr } = await Boako.db.from('profiles').update({ full_name: newValue.trim() }).eq('id', user.id);
    if (updateErr) throw new Error(updateErr.message);
    
    Boako.state.user.nickname = newValue.trim();
};
