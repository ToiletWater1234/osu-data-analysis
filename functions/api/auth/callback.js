import { errorResponse, redirect } from "../../_shared/response.js";
import { exchangeCode, saveSession, sessionCookie, cookieValue, stateCookie, returnPath } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error")) return redirect("/?login=cancelled", { "set-cookie": stateCookie("", 0) });
    if (!code || !state || !env.SESSIONS) throw Object.assign(new Error("OAuth 回调参数不完整。"), { status: 400 });
    if (cookieValue(request, "osu_oauth_state") !== state) throw Object.assign(new Error("OAuth 浏览器校验失败，请重新登录。"), { status: 400 });
    const stateExists = await env.SESSIONS.get(`oauth-state:${state}`);
    await env.SESSIONS.delete(`oauth-state:${state}`);
    if (!stateExists) throw Object.assign(new Error("OAuth 状态已失效，请重新登录。"), { status: 400 });
    let returnTo = '/';
    try { returnTo = returnPath(JSON.parse(stateExists)?.returnTo); } catch {}
    const token = await exchangeCode(request, env, code);
    const userResponse = await fetch("https://osu.ppy.sh/api/v2/me", {
      headers: { accept: "application/json", authorization: `Bearer ${token.access_token}`, "x-api-version": "20220705" },
    });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok) throw Object.assign(new Error("无法读取 osu! 登录用户。"), { status: 502 });
    const sessionId = await saveSession(env, token, user);
    const response = redirect(`${returnTo}?login=success`, { "set-cookie": sessionCookie(sessionId) });
    response.headers.append("set-cookie", stateCookie("", 0));
    return response;
  } catch (error) {
    const response = errorResponse(error);
    if (response.status >= 500) return response;
    return redirect(`/?login=error&message=${encodeURIComponent(error.message || "授权失败")}`);
  }
}
