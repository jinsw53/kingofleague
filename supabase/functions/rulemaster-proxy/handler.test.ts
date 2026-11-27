// rulemaster-proxy 자동 테스트 (Node 22.18+): node --test supabase/functions/rulemaster-proxy/handler.test.ts
// 룰 마스터 API 는 가짜 fetch 로 흉내 낸다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProxy, toRulemasterGame } from './handler.ts';

const sent: { path: string; body: any }[] = [];
function proxy(over: Partial<Parameters<typeof createProxy>[0]> = {}) {
  sent.length = 0;
  return createProxy({
    apiUrl: 'https://rm.example/functions/v1/rulemaster-api/',
    apiKey: 'secret-key',
    fetch: (async (url: string, init: any) => {
      const path = url.replace('https://rm.example/functions/v1/rulemaster-api', '');
      assert.equal(init.headers['x-api-key'], 'secret-key');
      const body = init.body ? JSON.parse(init.body) : undefined;
      sent.push({ path, body });
      if (path === '/v1/games') return Response.json({ games: [{ external_game_id: '12' }, { external_game_id: null }] });
      if (path === '/v1/ask') return Response.json({ source: 'cache', answer: '답' });
      if (path === '/v1/feedback') return Response.json({ accepted: true });
      if (path === '/v1/webhook/games') return Response.json({ upserted: body.games.length });
      if (path === '/v1/widget-token') return Response.json({ token: 'rmt_x', expires_at: 't' });
      if (path.startsWith('/v1/contributors')) return Response.json({ contributors: [{ user_ref: 'p:user-1', edits: 3, kept: 2, last_edit_at: 't' }, { user_ref: 'p:gone', edits: 1, kept: 1 }] });
      return new Response('{}', { status: 404 });
    }) as any,
    userIdFromToken: async (t) => (t === 'good' ? 'user-1' : t === 'admin' ? 'admin-1' : null),
    isAdmin: async (id) => id === 'admin-1',
    listArchiveGames: async () => Array.from({ length: 450 }, (_, i) => toRulemasterGame({ id: i, game_name: 'g' + i })),
    listMembers: async () => [{ id: 'user-1', full_name: '진' }, { id: 'admin-1', full_name: '관' }],
    pseudonym: async (id) => 'p:' + id,
    ...over,
  });
}
const post = (h: any, body: unknown, token?: string, ip = '1.2.3.4') => h(new Request('http://x/', {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) },
}));

test('linked: 룰 가이드 있는 아카이브 게임 ID 만', async () => {
  const r = await post(proxy(), { action: 'linked' });
  assert.deepEqual((await r.json()).game_ids, ['12']);
});

test('ask: 로그인 회원은 가명, 비로그인은 브라우저 표식 (IP 는 안 씀)', async () => {
  const h = proxy();
  await post(h, { action: 'ask', game_id: 12, question: ' 질문 ' }, 'good');
  assert.deepEqual(sent[0].body, { external_game_id: '12', external_expansion_ids: [], question: '질문', external_user_id: 'p:user-1' });
  await post(h, { action: 'ask', game_id: 12, question: '질문', anonymous_key: 'browser-1' });
  assert.deepEqual([sent[1].body.anonymous_key, sent[1].body.external_user_id], ['browser-1', undefined]);
  assert.ok(!JSON.stringify(sent).includes('1.2.3.4'));
  assert.equal((await post(h, { action: 'ask', game_id: 12, question: '질문' })).status, 400);
  assert.equal((await post(h, { action: 'ask', game_id: 12, question: '' })).status, 400);
});

test('feedback: 로그인 필요', async () => {
  const h = proxy();
  assert.equal((await post(h, { action: 'feedback', qa_id: 'q', type: 'upvote' })).status, 401);
  const r = await post(h, { action: 'feedback', qa_id: 'q', type: 'upvote' }, 'good');
  assert.equal(r.status, 200);
  assert.equal(sent[0].body.external_user_id, 'p:user-1');
});

test('sync_games: 관리자만, 200개씩 나눠 보냄', async () => {
  const h = proxy();
  assert.equal((await post(h, { action: 'sync_games' }, 'good')).status, 403);
  const r = await post(h, { action: 'sync_games' }, 'admin');
  assert.equal((await r.json()).upserted, 450);
  assert.deepEqual(sent.map((s) => s.body.games.length), [200, 200, 50]);
});

test('룰 마스터 서버가 죽으면 502', async () => {
  const h = proxy({ fetch: (async () => { throw new Error('down'); }) as any });
  assert.equal((await post(h, { action: 'ask', game_id: 1, question: 'q', anonymous_key: 'b' })).status, 502);
});

test('wiki_token: 로그인 회원만, 깃뿔에는 가명만 간다', async () => {
  const h = proxy();
  assert.equal((await post(h, { action: 'wiki_token' })).status, 401);
  const r = await post(h, { action: 'wiki_token' }, 'good');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { token: 'rmt_x', expires_at: 't', api_url: 'https://rm.example/functions/v1/rulemaster-api' });
  assert.deepEqual(sent[0].body, { external_user_id: 'p:user-1', ttl_minutes: 60 });
});

test('wiki_contributors: 관리자만, 가명을 아카이브 회원으로 되돌려 본다', async () => {
  const h = proxy();
  assert.equal((await post(h, { action: 'wiki_contributors' }, 'good')).status, 403);
  const r = await post(h, { action: 'wiki_contributors', days: 7 }, 'admin');
  const b = await r.json();
  assert.equal(sent[0].path, '/v1/contributors?days=7');
  assert.deepEqual(b.contributors[0], { user_id: 'user-1', full_name: '진', edits: 3, kept: 2, last_edit_at: 't' });
  assert.equal(b.contributors[1].user_id, null);
});
