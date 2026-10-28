const SESSION_COOKIE = "osu_toolbox_session";
const SESSION_TTL = 60 * 60 * 24 * 30;
export function returnPath(value) {
  return ['/', '/bp/', '/compare/', '/beatmaps/', '/about/'].includes(value) ? value : '/';
}

function required(env, name) {
  const value = String(env?.[name] || "").trim();
  if (!value) {
    const error = new Error(`Cloudflare Secret ${name} 尚未配置。`);
    error.status = 503;
    throw error;
  }
  return value;
}

export function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(rest.join("=")); } catch { return ""; }
    }
  }
  return "";
}

export function stateCookie(value, maxAge = 600) {
  return `osu_oauth_state=${encodeURIComponent(value)}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function sessionCookie(id, maxAge = SESSION_TTL) {
  return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function randomId() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

export function redirectUri(request, env) {
  return String(env.OSU_REDIRECT_URI || new URL("/api/auth/callback", request.url).toString());
}

async function tokenRequest(env, params) {
  const response = await fetch("https://osu.ppy.sh/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: Number(required(env, "OSU_CLIENT_ID")),
      client_secret: required(env, "OSU_CLIENT_SECRET"),
      ...params,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || data.message || `osu! OAuth 返回 ${response.status}`);
    error.status = 502;
    throw error;
  }
  return data;
}

export async function exchangeCode(request, env, code) {
  return tokenRequest(env, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(request, env),
  });
}

async function refreshSession(env, id, session) {
  const token = await tokenRequest(env, {
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });
  const refreshed = {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || session.refreshToken,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
  };
  await env.SESSIONS.put(`session:${id}`, JSON.stringify(refreshed), { expirationTtl: SESSION_TTL });
  return refreshed;
}

export async function getSession(request, env, { required: mustExist = false } = {}) {
  if (!env.SESSIONS) {
    const error = new Error("尚未绑定 SESSIONS KV 命名空间。");
    error.status = 503;
    throw error;
  }
  const id = cookieValue(request, SESSION_COOKIE);
  let session = id ? await env.SESSIONS.get(`session:${id}`, "json") : null;
  if (session?.refreshToken && Number(session.expiresAt || 0) < Date.now() + 60_000) {
    session = await refreshSession(env, id, session);
  }
  if (!session && mustExist) {
    const error = new Error("请先使用 osu! 账号登录。");
    error.status = 401;
    throw error;
  }
  return { id, session };
}

export async function osuFetch(env, sessionInfo, path, init = {}) {
  const session = sessionInfo?.session;
  if (!session?.accessToken) {
    const error = new Error("请先使用 osu! 账号登录。");
    error.status = 401;
    throw error;
  }
  const response = await fetch(`https://osu.ppy.sh/api/v2${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${session.accessToken}`,
      "x-api-version": "20220705",
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.message || `osu! API 返回 ${response.status}`);
    error.status = response.status === 404 ? 404 : response.status === 401 ? 401 : 502;
    throw error;
  }
  return data;
}

export async function saveSession(env, token, user) {
  if (!env.SESSIONS) {
    const error = new Error("尚未绑定 SESSIONS KV 命名空间。");
    error.status = 503;
    throw error;
  }
  const id = randomId();
  const session = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    user: { id: user.id, username: user.username, avatarUrl: user.avatar_url, countryCode: user.country_code },
  };
  await env.SESSIONS.put(`session:${id}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return id;
}
