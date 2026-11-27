/**
 * rulemaster-proxy 의 실제 처리 (테스트하기 쉽게 index.ts 와 분리)
 *
 * 아카이브는 룰 마스터의 "고객사 1호"다. 룰 마스터 API 키는 이 함수에만 두고 브라우저에는 내보내지 않는다.
 *   action: 'linked'            룰 가이드가 열린 아카이브 게임 ID 목록 (누구나)
 *           'ask'               상황 질문 { game_id, question, anonymous_key? }  (로그인 회원은 가명, 비로그인은 브라우저 표식)
 *           'feedback'          추천·오류 제보 { qa_id, type, suggested_fix }  (로그인 필요)
 *           'sync_games'        아카이브 게임 목록을 룰 마스터로 보내기 (관리자만)
 *           'wiki_token'        깃뿔 위키를 고칠 회원 토큰 (로그인 필요) → { token, expires_at, api_url }
 *           'wiki_contributors' 위키 기여자 순위를 아카이브 회원으로 되돌려 보기 (관리자만)
 *
 * 깃뿔에는 회원 ID 를 그대로 보내지 않는다. WIKI_PSEUDONYM_SECRET 으로 만든 HMAC 가명만 보낸다
 * (개인정보처리방침 제3조). 이 비밀값은 바꾸면 기존 기여 기록과 회원이 끊기므로 절대 바꾸지 않는다.
 * IP 주소는 쓰지 않는다.
 */
export interface Deps {
  apiUrl: string;                                  // 예: https://<룰마스터 프로젝트>.supabase.co/functions/v1/rulemaster-api
  apiKey: string;                                  // 룰 마스터가 발급한 아카이브 전용 키
  fetch: typeof fetch;
  userIdFromToken(token: string): Promise<string | null>;
  isAdmin(userId: string): Promise<boolean>;
  listArchiveGames(): Promise<Record<string, unknown>[]>;
  listMembers(): Promise<{ id: string; full_name: string | null }[]>;
  pseudonym(userId: string): Promise<string>;   // HMAC-SHA256(비밀값, 회원 ID) 앞 32자
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

export function createProxy(d: Deps) {
  let linkedCache: { at: number; ids: string[] } | null = null;

  async function api(method: string, path: string, body?: unknown) {
    const res = await d.fetch(`${d.apiUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': d.apiKey },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: unknown = null;
    try { data = await res.json(); } catch { /* 빈 응답 */ }
    return { status: res.status, data: data as any };
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    let body: any;
    try { body = await req.json(); } catch { return json(400, { error: 'bad_request', message: 'JSON body 가 필요합니다' }); }

    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const userId = token ? await d.userIdFromToken(token) : null;

    try {
      switch (body?.action) {
        case 'linked': {
          // 5분 동안은 다시 묻지 않는다
          if (!linkedCache || Date.now() - linkedCache.at > 5 * 60_000) {
            const r = await api('GET', '/v1/games');
            if (r.status !== 200) return json(502, { error: 'upstream', status: r.status });
            const ids = (r.data.games ?? []).map((g: any) => g.external_game_id).filter((x: unknown) => x != null).map(String);
            linkedCache = { at: Date.now(), ids };
          }
          return json(200, { game_ids: linkedCache.ids });
        }
        case 'ask': {
          const question = typeof body.question === 'string' ? body.question.trim() : '';
          if (!question || question.length > 500) return json(400, { error: 'bad_request', message: '질문은 1~500자로 적어 주세요' });
          if (body.game_id === undefined || body.game_id === null) return json(400, { error: 'bad_request', message: 'game_id 가 필요합니다' });
          const ak = typeof body.anonymous_key === 'string' ? body.anonymous_key.slice(0, 64) : '';
          if (!userId && !ak) return json(400, { error: 'bad_request', message: 'anonymous_key 가 필요합니다' });
          const who = userId ? { external_user_id: await d.pseudonym(userId) } : { anonymous_key: ak };
          const r = await api('POST', '/v1/ask', {
            external_game_id: String(body.game_id),
            external_expansion_ids: Array.isArray(body.expansion_ids) ? body.expansion_ids.map(String) : [],
            question, ...who,
          });
          return json(r.status, { ...r.data, is_member: !!userId });
        }
        case 'feedback': {
          if (!userId) return json(401, { error: 'login_required', message: '제보와 추천은 로그인 후 할 수 있어요' });
          const r = await api('POST', '/v1/feedback', {
            qa_id: body.qa_id, type: body.type, suggested_fix: body.suggested_fix, external_user_id: await d.pseudonym(userId),
          });
          return json(r.status, r.data);
        }
        case 'sync_games': {
          if (!userId || !(await d.isAdmin(userId))) return json(403, { error: 'admin_only' });
          const games = await d.listArchiveGames();
          let upserted = 0;
          for (let i = 0; i < games.length; i += 200) {
            const r = await api('POST', '/v1/webhook/games', { games: games.slice(i, i + 200) });
            if (r.status !== 200) return json(502, { error: 'upstream', status: r.status, detail: r.data, upserted });
            upserted += r.data.upserted;
          }
          linkedCache = null;
          return json(200, { upserted });
        }
        case 'wiki_token': {
          if (!userId) return json(401, { error: 'login_required', message: '위키는 로그인한 회원만 고칠 수 있어요' });
          const r = await api('POST', '/v1/widget-token', { external_user_id: await d.pseudonym(userId), ttl_minutes: 60 });
          if (r.status !== 200) return json(502, { error: 'upstream', status: r.status });
          return json(200, { token: r.data.token, expires_at: r.data.expires_at, api_url: d.apiUrl.replace(/\/$/, '') });
        }
        case 'wiki_contributors': {
          if (!userId || !(await d.isAdmin(userId))) return json(403, { error: 'admin_only' });
          const days = Math.min(Math.max(Number(body.days) || 30, 1), 365);
          const r = await api('GET', `/v1/contributors?days=${days}`);
          if (r.status !== 200) return json(502, { error: 'upstream', status: r.status });
          // 가명 → 회원: 아카이브 회원마다 가명을 다시 만들어 맞춰 본다 (깃뿔은 이 짝을 모른다)
          const members = await d.listMembers();
          const byRef = new Map<string, { id: string; full_name: string | null }>();
          for (const m of members) byRef.set(await d.pseudonym(m.id), m);
          const list = (r.data.contributors ?? []).map((c: any) => {
            const m = byRef.get(String(c.user_ref));
            return { user_id: m?.id ?? null, full_name: m?.full_name ?? null, edits: c.edits, kept: c.kept, last_edit_at: c.last_edit_at };
          });
          return json(200, { days, contributors: list });
        }
        default:
          return json(400, { error: 'bad_request', message: 'action 은 linked, ask, feedback, sync_games, wiki_token, wiki_contributors 중 하나' });
      }
    } catch (e) {
      console.error(e);
      return json(502, { error: 'upstream', message: '룰 마스터 서버에 연결하지 못했습니다' });
    }
  };
}

// 아카이브 games 행 → 룰 마스터 웹훅 형식
export function toRulemasterGame(g: Record<string, any>) {
  return {
    external_game_id: String(g.id),
    title: g.game_name,
    min_players: g.min_players ?? null,
    max_players: g.max_players ?? null,
    play_time_min: g.playtime ?? null,
    weight: g.is_weight_unknown ? null : (g.weight ?? null),
    logo_url: g.image_url ?? null,
  };
}
