import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createProxy, toRulemasterGame } from "./handler.ts";

/**
 * rulemaster-proxy: 아카이브 화면 → (로그인 확인) → 룰 마스터 API
 * 배포: supabase functions deploy rulemaster-proxy --no-verify-jwt   (비로그인 질문도 받으므로)
 * 시크릿: RULEMASTER_API_URL, RULEMASTER_API_KEY, WIKI_PSEUDONYM_SECRET (한 번 정하면 절대 바꾸지 않음)
 */
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(createProxy({
  apiUrl: Deno.env.get("RULEMASTER_API_URL") ?? "",
  apiKey: Deno.env.get("RULEMASTER_API_KEY") ?? "",
  fetch,
  async userIdFromToken(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data?.user ? null : data.user.id;
  },
  async isAdmin(userId) {
    const { data } = await admin.from("profiles").select("is_admin").eq("id", userId).single();
    return !!data?.is_admin;
  },
  async listArchiveGames() {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("games")
        .select("id, game_name, min_players, max_players, playtime, weight, is_weight_unknown, image_url")
        .order("id").range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []).map(toRulemasterGame));
      if (!data || data.length < 1000) break;
    }
    return rows;
  },
  async listMembers() {
    const rows: { id: string; full_name: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("profiles").select("id, full_name").order("id").range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  },
  async pseudonym(userId) {
    const secret = Deno.env.get("WIKI_PSEUDONYM_SECRET");
    if (!secret) throw new Error("WIKI_PSEUDONYM_SECRET 이 없습니다");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  },
}));
