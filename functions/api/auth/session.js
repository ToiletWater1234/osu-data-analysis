import { errorResponse, json } from "../../_shared/response.js";
import { getSession } from "../../_shared/auth.js";
import { isAdmin, isOwner } from '../../_shared/admin.js';

export async function onRequestGet({ request, env }) {
  try {
    const { session } = await getSession(request, env);
    return json({ authenticated: Boolean(session), user: session?.user || null, isAdmin: await isAdmin(session, env), isOwner: isOwner(session, env),
      configured: Boolean(env.OSU_CLIENT_ID && env.OSU_CLIENT_SECRET) });
  } catch (error) {
    return errorResponse(error);
  }
}
