/**
 * [ACTIVATION DISPATCH] ④⑤⑥⑦번 활성화 오버레이 통합 디스패처 (사이트)
 * 🌟 대기열(activation_overlay_queue) 방식으로 전환 — fn_get_my_activation_overlay() 하나만 호출해서
 *    크론이 미리 계산해둔 결과를 조회만 함 (로그인 시점에 실시간 계산 안 함).
 * 🌟 다른 온보딩 모달(닉네임/기록기가이드/공지사항)이 아직 떠 있으면 끝날 때까지 대기했다가 표시 —
 *    Boako.Auth.requireNoticeModal()과 동일한 폴링 패턴 (풀스크린 오버레이 중복 노출 방지).
 * 🌟 overlay_type에 따라 rival_recommend.js 또는 social_activation.js의 렌더러(showOverlay)만 호출.
 *    ext_help는 확장 전용 시나리오라 사이트에선 무시.
 */
Boako.ActivationDispatch = {
    checkAndShow: async () => {
        if (!Boako.state.user || !Boako.db) return;

        // 🌟 닉네임 모달/기록기 가이드/공지사항이 아직 떠 있으면, 그게 끝날 때까지 대기했다가 다시 시도
        if (document.getElementById('bga-nick-modal') || Boako.Auth._extGuidePending || document.getElementById('ext-guide-overlay') || document.getElementById('notice-modal')) {
            setTimeout(() => Boako.ActivationDispatch.checkAndShow(), 400);
            return;
        }

        try {
            const { data, error } = await Boako.db.rpc('fn_get_my_activation_overlay');
            if (error) throw error;
            if (!data || data.length === 0) return; // 대기열에 없음 — 표시할 것 없음

            const row = data[0];
            const overlayType = row.overlay_type;
            const meta = row.meta || {};

            if (overlayType === 'rival_recommend') {
                if (!Boako.RivalRecommend) await Boako.Util.loadScript('js/rival_recommend.js');
                Boako.RivalRecommend.showOverlay(meta);
            } else if (overlayType === 'social_activation') {
                if (!Boako.SocialActivation) await Boako.Util.loadScript('js/social_activation.js');
                Boako.SocialActivation.showOverlay(meta.target_type);
            }
            // 🌟 ext_help는 확장(boako-widget.js) 전용 시나리오라 사이트에선 표시 안 함
        } catch (e) {
            console.error('활성화 오버레이 대기열 확인 실패:', e);
        }
    }
};
