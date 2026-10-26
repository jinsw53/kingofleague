/**
 * [RECORD VERIFY] 타 팀 경기 기록 교차 검증 및 승인 센터 (최종 최적화본)
 * 🌟 무소속(Free Agent, b_all_team IS NULL) 기록도 "내 팀이 아닌 기록"에 포함해서 같이 검증 대상으로 노출
 */
Boako.RecordVerify = {
    pendingList: [],

    // 1. view.js에서 도화지가 깔리면 가장 먼저 호출되는 진입점
    init: async function() {
        if (!Boako.db || !Boako.state.team) {
            setTimeout(() => this.init(), 500);
            return;
        }
        await this.loadPendingData();
    },

    // 2. 수파베이스에서 '타 팀(+무소속)의 미인증 데이터'만 싹 긁어오기
    loadPendingData: async function() {
        const container = document.getElementById('team-verify-list-container');
        if (container) container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">결재 서류(데이터)를 불러오는 중...</div>`;

        try {
            const myTeamName = Boako.state.team.info.team_name;

            // 🌟 b_all_team이 NULL(무소속)인 경우 .neq()만으로는 걸러지지 않으므로(NULL 비교는 항상 거짓),
            // "내 팀이 아니거나(neq) 무소속(is null)"을 or 조건으로 명시
            const { data, error } = await Boako.db
                .from('v_boako_total_records')
                .select('*')
                .or(`b_all_team.neq.${myTeamName},b_all_team.is.null`) // 내 팀만 제외, 무소속은 포함
                .eq('is_verified', 1)          // 미인증 상태(1)만 타격
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.pendingList = data || [];
            this.renderList();

        } catch (err) {
            console.error("인증 대기열 로드 에러:", err);
            if (container) container.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">데이터를 불러오지 못했습니다.</div>`;
        }
    },

    // 3. 긁어온 데이터를 화면에 렌더링 (카드 클릭 시 새 창 / 토너먼트 단계 표기법 도입)
    renderList: function() {
        const container = document.getElementById('team-verify-list-container');
        if (!container) return;

        if (this.pendingList.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400 font-bold">현재 인증 대기 중인 타 팀/무소속 전적이 없습니다.</div>`;
            return;
        }

        let html = `<div class="flex flex-col gap-4">`;
        
        html += this.pendingList.map(item => {
            const isTournament = item.match_type === 'TOURNAMENT';
            
            // 🎯 [기획 반영] 토너먼트 배수를 10으로 나누어 1단계, 2단계 구간으로 직관적 표기
            const tournamentStage = Math.floor((item.multiplier || 10) / 10);
            
            const conditionBadge = isTournament
                ? `<span class="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded font-bold">🔥 토너먼트: ${tournamentStage}단계</span>`
                : `<span class="inline-block mt-1 px-2 py-0.5 bg-sky-100 text-sky-800 text-xs rounded font-bold">🛡️ 첫 승 기록 확인</span>`;

            return `
                <div onclick="Boako.Util.openExternal('${Boako.Util.escapeJsAttr(item.post_url || '')}')" 
                     class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center cursor-pointer hover:border-indigo-400 hover:shadow transition-all group">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">${Boako.Util.escapeHtml(item.b_all_team || '무소속')}</span>
                            <h4 class="font-black text-slate-800 group-hover:text-indigo-600 transition-colors">${Boako.Util.escapeHtml(item.nickname)} - ${Boako.Util.escapeHtml(item.game_name)}</h4>
                        </div>
                        <p class="text-sm font-bold text-indigo-600 mt-1">${Math.floor(item.rp)} RP</p>
                        ${conditionBadge}
                    </div>
                    
                    <div onclick="event.stopPropagation()" class="flex gap-2 shrink-0">
                        ${(!isTournament && item.is_first == 1) ? `
                        <button onclick="Boako.RecordVerify.openReject('${item.id}')"
                                class="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-sm font-black rounded-lg transition-all active:scale-[0.98]">
                            ❌ 반려
                        </button>` : ''}
                        <button onclick="Boako.RecordVerify.approve('${item.id}', '${item.match_type}')"
                                class="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-lg transition-all shadow-sm active:scale-[0.98]">
                            ✅ 승인
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        html += `</div>`;
        container.innerHTML = html;
    },

    // ❌ 반려: 첫 승 표시를 해제하고, 실제 첫 승 판 번호를 입력하면 DB(first_wins.expected_game_id)에 기억해 두었다가
    // 그 판의 기록이 들어오는 순간 자동으로 첫 승으로 매칭(인증 대기 등록)한다.
    rejectTargetId: null,
    isRejecting: false,

    // BGA 판 번호/주소 → 숫자 문자열. 빈 값은 null, 형식 오류는 false
    parseTableNo: function(v) {
        v = String(v || '').trim();
        if (!v) return null;
        const m = v.match(/table=(\d+)/) || v.match(/^(\d{6,12})$/);
        return m ? m[1] : false;
    },

    openReject: function(recordId) {
        const item = this.pendingList.find(x => String(x.id) === String(recordId));
        if (!item) return;
        this.rejectTargetId = String(item.id);

        let modal = document.getElementById('record-reject-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'record-reject-modal';
            modal.className = 'hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm items-center justify-center p-4';
            modal.style.zIndex = '9999';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 class="text-lg font-black text-slate-800 mb-1">❌ 첫 승 기록 반려</h3>
                <p class="text-sm font-bold text-indigo-600 mb-4">${Boako.Util.escapeHtml(item.nickname)} - ${Boako.Util.escapeHtml(item.game_name)}</p>
                <p class="text-xs font-bold text-slate-500 leading-relaxed mb-4">
                    이 판은 첫 승이 아닙니다. 실제 첫 승 판의 번호(또는 BGA 판 주소)를 입력하면,
                    나중에 그 판 기록이 들어오면 <b class="text-slate-700">자동으로 첫 승 인증(승인 완료)</b>까지 처리됩니다. 번호는 꼭 BGA에서 직접 확인한 값만 입력해 주세요.
                </p>
                <label class="block text-xs font-black text-slate-600 mb-1">실제 첫 승 판 번호 / 주소</label>
                <input id="record-reject-input" type="text" autocomplete="off"
                       placeholder="예: 888919529 또는 boardgamearena.com/table?table=888919529"
                       oninput="Boako.RecordVerify.checkRejectInput()"
                       class="w-full border-2 border-slate-200 focus:border-indigo-400 outline-none rounded-xl px-3.5 py-3 text-sm font-bold text-slate-800">
                <p id="record-reject-hint" class="text-[11px] font-bold text-slate-400 mt-1.5 min-h-[16px]">모르면 비워 두세요. 이 판의 첫 승 표시만 해제됩니다.</p>
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4 text-[11px] font-bold text-slate-500 leading-relaxed">
                    반려하면<br>
                    · 이 기록은 일반 승리 기록으로 돌아갑니다 (첫 승 보너스 RP 제외)<br>
                    · 입력한 판 번호는 기억해 두었다가, 그 판이 들어오면 반려한 사람의 확인으로 자동 승인됩니다
                </div>
                <div class="flex gap-2 mt-5">
                    <button onclick="Boako.RecordVerify.closeReject()" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-black rounded-xl">취소</button>
                    <button onclick="Boako.RecordVerify.submitReject()" class="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-black rounded-xl shadow-sm active:scale-[0.98]">반려하기</button>
                </div>
            </div>`;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => { const i = document.getElementById('record-reject-input'); if (i) i.focus(); }, 50);
    },

    closeReject: function() {
        const modal = document.getElementById('record-reject-modal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        this.rejectTargetId = null;
    },

    checkRejectInput: function() {
        const input = document.getElementById('record-reject-input');
        const hint = document.getElementById('record-reject-hint');
        if (!input || !hint) return;
        const r = this.parseTableNo(input.value);
        if (r === null) {
            hint.textContent = '모르면 비워 두세요. 이 판의 첫 승 표시만 해제됩니다.';
            hint.className = 'text-[11px] font-bold text-slate-400 mt-1.5 min-h-[16px]';
        } else if (r === false) {
            hint.textContent = '판 번호(숫자) 또는 BGA 판 주소를 입력해 주세요.';
            hint.className = 'text-[11px] font-bold text-rose-500 mt-1.5 min-h-[16px]';
        } else {
            hint.textContent = '✔ 판 번호 ' + r + ' 로 기억합니다.';
            hint.className = 'text-[11px] font-bold text-emerald-600 mt-1.5 min-h-[16px]';
        }
    },

    submitReject: async function() {
        if (this.isRejecting || !this.rejectTargetId) return;
        const input = document.getElementById('record-reject-input');
        const tableNo = this.parseTableNo(input ? input.value : '');
        if (tableNo === false) { this.checkRejectInput(); return; }

        try {
            this.isRejecting = true;
            const { data, error } = await Boako.db.rpc('reject_cross_verification', {
                p_record_id: this.rejectTargetId,
                p_actual_game_id: tableNo ? Number(tableNo) : null
            });
            if (error) {
                Boako.Util.toast("❌ " + (error.message || "반려 처리에 실패했습니다."));
                return;
            }
            this.closeReject();
            if (data && data.matched_record_id) {
                Boako.Util.toast("❌ 반려했습니다. 입력한 판 기록이 이미 있어 바로 첫 승으로 인증했어요.");
            } else if (tableNo) {
                Boako.Util.toast("❌ 반려했습니다. 판 " + tableNo + " 기록이 들어오면 자동으로 첫 승 인증됩니다.");
            } else {
                Boako.Util.toast("❌ 반려했습니다. 첫 승 표시가 해제되었습니다.");
            }
            await this.loadPendingData();
            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') {
                Boako.Auth.checkLeaderMenu();
            }
        } catch (err) {
            console.error("반려 처리 에러:", err);
            Boako.Util.toast("반려 처리 중 오류가 발생했습니다.");
        } finally {
            this.isRejecting = false;
        }
    },

  // 연속 타격(더블 클릭) 방어용 락 플래그
    isApproving: false,

    // 4. 승인 버튼 눌렀을 때 실물 원본 테이블에 도장 쾅! + profiles 잔액 및 point_history 완벽 연동
    approve: async function(recordId, matchType) {
        if (this.isApproving) return;

        if (!confirm("이 기록을 정상적인 경기로 승인하시겠습니까?")) return;

        try {
            this.isApproving = true; // 🔒 진입과 동시에 락 걸기

            const { error } = await Boako.db.rpc('approve_cross_verification', {
                p_record_id: String(recordId),
                p_match_type: matchType
            });

            if (error) {
                Boako.Util.toast("❌ " + (error.message || "승인 처리에 실패했습니다."));
                this.isApproving = false;
                return;
            }

            if (window.sfx) window.sfx.buy();
            Boako.Util.toast("✅ 기록이 정상 승인되었으며 10포인트가 지급되었습니다.");

            await this.loadPendingData();

            if (Boako.Auth && typeof Boako.Auth.checkLeaderMenu === 'function') {
                Boako.Auth.checkLeaderMenu();
            }

        } catch (err) {
            console.error("승인 처리 에러:", err);
            Boako.Util.toast("승인 처리 중 오류가 발생했습니다.");
        } finally {
            this.isApproving = false; // 🔓 작업이 완전히 끝나면 락 해제
        }
    }
};
