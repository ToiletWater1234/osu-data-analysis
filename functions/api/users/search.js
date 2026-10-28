import { getSession, osuFetch } from "../../_shared/auth.js";
import { errorResponse, json } from "../../_shared/response.js";

function mapUser(user) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatar_url,
    countryCode: user.country_code,
    url: `https://osu.ppy.sh/users/${user.id}`,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const query = String(new URL(request.url).searchParams.get("q") || "").trim();
    if (!query) throw Object.assign(new Error("请输入玩家名或用户 ID。"), { status: 400 });
    const session = await getSession(request, env, { required: true });
    if (/^\d+$/.test(query)) {
      const user = await osuFetch(env, session, `/users/${query}?key=id`);
      return json({ results: [mapUser(user)] });
    }
    const data = await osuFetch(env, session, `/search?mode=user&query=${encodeURIComponent(query)}`);
    const users = data.user?.data || [];
    return json({ results: users.slice(0, 10).map(mapUser) });
  } catch (error) {
    return errorResponse(error);
  }
}
