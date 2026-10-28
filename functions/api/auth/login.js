import { errorResponse, redirect } from "../../_shared/response.js";
import { randomId, redirectUri, stateCookie, returnPath } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  try {
    if (!env.SESSIONS) throw Object.assign(new Error("尚未绑定 SESSIONS KV 命名空间。"), { status: 503 });
    const clientId = String(env.OSU_CLIENT_ID || "").trim();
    if (!clientId) throw Object.assign(new Error("Cloudflare Secret OSU_CLIENT_ID 尚未配置。"), { status: 503 });
    if (!env.OSU_CLIENT_SECRET) return redirect("/?login=error&message=" + encodeURIComponent("osu! 登录暂未配置，请管理员配置 OAuth 应用。"));
    const state = randomId();
    const returnTo = returnPath(new URL(request.url).searchParams.get('returnTo'));
    await env.SESSIONS.put(`oauth-state:${state}`, JSON.stringify({ returnTo }), { expirationTtl: 600 });
    const authorize = new URL("https://osu.ppy.sh/oauth/authorize");
    authorize.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(request, env),
      response_type: "code",
      scope: "identify public",
      state,
    }).toString();
    return redirect(authorize.toString(), { "set-cookie": stateCookie(state) });
  } catch (error) {
    return redirect("/?login=error&message=" + encodeURIComponent(error.status === 503 ? "osu! 登录暂未配置，请管理员配置 OAuth 应用。" : error.message));
  }
}
