/**
 * [MOBILE INVENTORY] 모바일 전용 — 인벤토리(가방)
 * 🌟 [재사용 원칙] js/inventory.js의 loadItems()/useItem()/unequip()은 'equipped-badges'/
 *    'inventory-list' 두 컨테이너 id만 참조하는 완전 자기완결형 로직(장착 슬롯 계산, 서포터즈/
 *    업적 배지 합성, 만료 체크 등)이라 전혀 손대지 않고 그대로 재사용함. View.render 같은 PC
 *    전용 화면 전환 호출도 없어서(로컬 화면 갱신은 loadItems() 재호출로 처리) 완전히 안전함.
 * 🌟 [수정 범위] PC 페이지의 바깥 틀(2단 레이아웃: 왼쪽 장착슬롯 카드 + 오른쪽 가방 그리드)만
 *    모바일 1단 레이아웃(위: 장착 슬롯 / 아래: 가방 목록)으로 새로 그림 — 내부에 같은 id
 *    (equipped-badges/inventory-list)만 정확히 넣어주면 loadItems() 등은 수정 없이 동작함.
 * 🌟 [버그수정] 배너 색을 임의로 초록색으로 지정했었는데, PC는 이 페이지만 배너 색을 따로
 *    지정하지 않고 .main-banner 기본값(보라색 #8b5cf6→#6d28d9)을 그대로 씀 — PC와 동일하게 수정.
 *    소제목("✨ 장착 중인 배지"/"📦 내 가방")도 PC 문구 그대로 통일.
 * 🌟 [버그수정] 배너 텍스트가 왼쪽 정렬돼있었음 — PC .main-banner는 가운데 정렬(align-items:
 *    center, text-align:center)인데 그 클래스가 모바일엔 정의돼있지 않아 정렬이 다르게 보임.
 *    이 화면은 인라인 스타일이라 클래스 정의 없이 직접 가운데 정렬 속성을 추가.
 */
window.Boako = window.Boako || {};
Boako.MobileInventory = {

    render: async (container) => {
        if (!Boako.state.user) {
            container.innerHTML = `<div style="padding:60px 16px; text-align:center; color:#94a3b8; font-weight:700; font-size:13px;">🔒 로그인 후 이용할 수 있어요.</div>`;
            return;
        }
        // 🌟 core.js가 미리 Boako.Inventory = {}로 이름을 예약해두는 구조라, 반드시 구체적
        // 메서드(.loadItems) 존재 여부로 체크해야 함 (mobile_team_list.js에서 겪은 것과 동일한
        // 함정 — !Boako.Inventory만 체크하면 항상 false라 스크립트가 영원히 안 불러와짐)
        if (!Boako.Inventory || !Boako.Inventory.loadItems) await Boako.Util.loadScript('/js/inventory.js');

        container.innerHTML = `
            <div style="background:linear-gradient(135deg,#8b5cf6,#6d28d9); border-radius:16px; padding:20px; margin-bottom:14px; color:#fff; display:flex; flex-direction:column; align-items:center; text-align:center;">
                <div style="font-size:17px; font-weight:900;">🎒 내 인벤토리</div>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:16px; margin-bottom:14px;">
                <div style="font-size:13.5px; font-weight:900; color:#1e293b; margin-bottom:10px;">✨ 장착 중인 배지</div>
                <div id="equipped-badges"></div>
            </div>

            <div style="font-size:13.5px; font-weight:900; color:#1e293b; margin-bottom:10px;">📦 내 가방</div>
            <div id="inventory-list"></div>
        `;

        // 🌟 PC와 완전히 동일한 함수 그대로 재사용 (장착 슬롯 + 가방 목록 렌더링 전부 위임)
        await Boako.Inventory.loadItems();
    }
};
