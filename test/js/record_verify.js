/**
 * [RECORD VERIFY] 타 팀 경기 기록 교차 검증 및 승인 센터 (마스터-디테일 & 휠 줌 탑재)
 */
Boako.RecordVerify = {
    pendingList: [],
    selectedItem: null, // 현재 선택된 결재 서류 행 저장소
    scale: 1,           // 기록 근원 모니터 실시간 확대 배율

    // 1. view.js에서 도화지가 깔리면 호출되는 진입점
    init: async function() {
        if (!Boako.db || !Boako.state.team) {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        // 🌟 [동적 빌드] view.js 수정 없이, 왼쪽 수칙 카드 바디 하단에 버튼 부착 구역을 개척합니다.
        this.injectActionArea();
        await this.loadPendingData();
    },

    // 2. 왼쪽 수칙 구역 하단에 버튼용 전용 컨테이너 강제 이식
    injectActionArea: function() {
        const leftCardBody = document.querySelector('.section-card.col-span-1 .card-body');
        if (leftCardBody && !document.getElementById('verify-action-area')) {
            const actionArea = document.createElement('div');
            actionArea.id = 'verify-action-area';
            actionArea.className = 'mt-6 pt-6 border-t border-slate-200 flex flex-col gap-3';
            actionArea.style.display = 'none'; // 평소엔 숨김
            leftCardBody.appendChild(actionArea);
        }
    },

    // 3. 수파베이스에서 타 팀의 미인증 전적 로드
    loadPendingData: async function() {
        const container = document.getElementById('team-verify-list-container');
        if (container) container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">결재 서류를 불러오는 중...</div>`;

        try {
            const myTeamName = Boako.state.team.info.team_name;

            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('*')
                .neq('b_all_team', myTeamName)
                .eq('is_verified', 1)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.pendingList = data || [];
            this.renderList();

        } catch (err) {
            console.error("인증 대기열 로드 에러:", err);
            if (container) container.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 4. 껍데기 가공 및 대기열 리스트 조건부 렌더링
    renderList: function() {
        const container = document.getElementById('team-verify-list-container');
        if (!container) return;

        if (this.pendingList.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">현재 인증 대기 중인 타 팀 전적이 없습니다.</div>`;
            const actionArea = document.getElementById('verify-action-area');
            if (actionArea) actionArea.style.display = 'none';
            return;
        }

        // 레이아웃 스플릿: 상단은 슬림 리스트 열차, 하단은 대형 프리뷰 존 배치
        let html = `
            <div class="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1" style="scrollbar-width: thin;">
        `;
        
        html += this.pendingList.map(item => {
            const isTournament = item.match_type === 'TOURNAMENT';
            
            // 🎯 [조건부 배지 표기] 토너먼트면 배수 값, 아니면 첫 승 기록 확인 문구 주입
            const conditionBadge = isTournament
                ? `<span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-lg font-black">🔥 배수: ${item.multiplier || 1}배</span>`
                : `<span class="px-2 py-1 bg-sky-100 text-sky-800 text-xs rounded-lg font-black">🛡️ 첫 승 기록 확인</span>`;

            return `
                <div id="verify-item-${item.id}" onclick="Boako.RecordVerify.selectItem('${item.id}')" 
                     class="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/20 transition-all shadow-sm">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded">${item.b_all_team}</span>
                            <strong class="text-slate-800 text-sm font-black">${item.nickname}</strong>
                        </div>
                        <div class="text-slate-700 text-sm font-bold mt-1">🎮 ${item.game_name}</div>
                    </div>
                    <div>
                        ${conditionBadge}
                    </div>
                </div>
            `;
        }).join('');

        html += `
            </div>
            
            <div id="verify-preview-zone" class="mt-6 border-t border-slate-200 pt-5" style="display:none;">
                <div class="flex justify-between items-center mb-3">
                    <h5 class="text-slate-800 font-black text-sm">🔍 기록 근원 실시간 모니터 <small class="text-slate-400 font-normal">(마우스 휠 줌 가능)</small></h5>
                    <a id="preview-external-link" href="#" target="_blank" class="text-xs text-indigo-600 font-black hover:underline">🔗 새 창에서 원본 열기</a>
                </div>
                <div id="zoom-container" class="w-full h-[400px] bg-slate-900 rounded-xl overflow-hidden relative flex items-center justify-center select-none" style="cursor: grab;">
                    <div id="zoom-target" class="w-full h-full transition-transform duration-75 origin-center flex items-center justify-center">
                        <iframe id="preview-frame" src="" class="w-full h-full border-0 hidden"></iframe>
                        <img id="preview-img" src="" class="max-w-full max-h-full object-contain hidden" draggable="false">
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        
        // 결재 후 리스트 갱신 시 기존 선택 상태 초기화 복구망
        this.selectedItem = null;
    },

    // 5. 대기열 리스트 중 하나를 클릭(선택)했을 때의 액션 제어기
    selectItem: function(id) {
        const item = this.pendingList.find(p => p.id == id);
        if (!item) return;

        this.selectedItem = item;
        this.scale = 1; // 아이템 교체 시 배율 초기화

        // 5-1. 리스트 아이템 하이라이팅 교체 작업
        this.pendingList.forEach(p => {
            const el = document.getElementById(`verify-item-${p.id}`);
            if (el) el.className = el.className.replace(/border-emerald-500 bg-emerald-50\/40 ring-2 ring-emerald-500\/20/g, 'border-slate-200 bg-white');
        });
        const targetEl = document.getElementById(`verify-item-${id}`);
        if (targetEl) targetEl.className = "bg-white p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all shadow-sm border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20";

        // 5-2. 🎯 승인/반려 버튼을 왼쪽 수칙 수호대 아래 구역으로 쏴버립니다!
        const actionArea = document.getElementById('verify-action-area');
        if (actionArea) {
            actionArea.style.display = 'flex';
            actionArea.innerHTML = `
                <div class="text-xs font-black text-slate-500 bg-slate-100 p-2.5 rounded-lg text-center leading-tight">
                    선택된 타 팀 장부<br><span class="text-indigo-600">[${item.b_all_team}] ${item.nickname}</span>
                </div>
                <button onclick="Boako.RecordVerify.approve('${item.id}', '${item.match_type}')" 
                        class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-black rounded-xl shadow-md transition-all active:scale-[0.98]">
                    ✅ 결재 승인 (확정)
                </button>
                <button onclick="Boako.RecordVerify.reject('${item.id}', '${item.match_type}')" 
                        class="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-base font-black rounded-xl shadow-md transition-all active:scale-[0.98]">
                    ❌ 전적 반려 (삭제)
                </button>
            `;
        }

        // 5-3. 🎯 우측 하단 대기열 아래 칸에 기록 근원(post_url) 바인딩 및 활성화
        const previewZone = document.getElementById('verify-preview-zone');
        if (previewZone) {
            previewZone.style.display = 'block';
            document.getElementById('preview-external-link').href = item.post_url || '#';

            const frame = document.getElementById('preview-frame');
            const img = document.getElementById('preview-img');
            const zoomTarget = document.getElementById('zoom-target');

            if (zoomTarget) zoomTarget.style.transform = `scale(1)`;

            // URL 확장자 판별을 통해 스크린샷 이미지인지 외부 링크(BGA 주소)인지 감지 및 스위칭
            const isImg = item.post_url && /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(item.post_url);
            if (isImg) {
                frame.classList.add('hidden');
                img.classList.remove('hidden');
                img.src = item.post_url;
            } else {
                img.classList.add('hidden');
                frame.classList.remove('hidden');
                frame.src = item.post_url || '';
            }

            // 5-4. 🌟 [핵심] 마우스 휠 리스너 실시간 정밀 연동 (확대/축소)
            const zoomContainer = document.getElementById('zoom-container');
            if (zoomContainer) {
                zoomContainer.onwheel = null; // 잔상 이벤트 초기화
                zoomContainer.onwheel = (e) => {
                    e.preventDefault();
                    this.scale += e.deltaY * -0.001; // 감도 조절
                    this.scale = Math.min(Math.max(0.6, this.scale), 4); // 최소 0.6배, 최대 4배 제약
                    if (zoomTarget) zoomTarget.style.transform = `scale(${this.scale})`;
                };
            }
        }
    },

    // 6. 승인 처리 엔진
    approve: async function(recordId, matchType) {
        if (!confirm("이 기록을 정상적인 경기로 승인하시겠습니까?")) return;
        
        try {
            let targetTable = matchType === 'TOURNAMENT' ? 'boako_tournaments' : 'BTLDB';
            const leaderUuid = Boako.state.user.id;
            const nowTimestamp = new Date().toISOString();

            const { error } = await Boako.db
                .from(targetTable) 
                .update({ 
                    verified_by: leaderUuid,   
                    verified_at: nowTimestamp   
                })
                .eq('id', recordId);

            if (error) throw error;

            Boako.Util.toast("✅ 서명이 완료되어 기록이 정상 승인되었습니다.");
            await this.loadPendingData();

            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') {
                Boako.Auth.checkLeaderMenu();
            }

        } catch (err) {
            console.error("승인 처리 에러:", err);
            Boako.Util.toast("승인 처리 중 오류가 발생했습니다.");
        }
    },

    // 7. 반려 처리 엔진
    reject: async function(recordId, matchType) {
        if (!confirm("어뷰징 또는 오류가 확인되어 반려하시겠습니까?\n(반려 시 해당 기록은 삭제되며, 다시 등록해야 합니다)")) return;
        
        try {
            let targetTable = matchType === 'TOURNAMENT' ? 'boako_tournaments' : 'BTLDB';

            const { error } = await Boako.db
                .from(targetTable) 
                .delete()
                .eq('id', recordId);

            if (error) throw error;

            Boako.Util.toast("❌ 해당 기록이 반려(삭제) 되었습니다.");
            await this.loadPendingData();
            
            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') {
                Boako.Auth.checkLeaderMenu();
            }

        } catch (err) {
            console.error("반려 처리 에러:", err);
            Boako.Util.toast("반려 처리 중 오류가 발생했습니다.");
        }
    }
};
