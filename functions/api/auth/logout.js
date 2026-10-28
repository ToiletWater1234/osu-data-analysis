import { clearSessionCookie, getSession } from "../../_shared/auth.js";
import { errorResponse, json } from "../../_shared/response.js";

export async function onRequestPost({ request, env }) {
  try {
    const { id } = await getSession(request, env);
    if (id) await env.SESSIONS.delete(`session:${id}`);
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
  } catch (error) {
    return errorResponse(error);
  }
}
