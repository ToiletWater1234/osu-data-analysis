import * as login from './functions/api/auth/login.js';
import * as callback from './functions/api/auth/callback.js';
import * as session from './functions/api/auth/session.js';
import * as logout from './functions/api/auth/logout.js';
import * as users from './functions/api/users/search.js';
import * as bp from './functions/api/bp/analyze.js';
import * as maps from './functions/api/beatmaps/search.js';
import * as mapAnalysis from './functions/api/beatmaps/analyze.js';
import * as mapFacts from './functions/api/beatmaps/facts.js';
import * as content from './functions/api/content.js';
import * as admin from './functions/api/admin.js';
import * as adminUsers from './functions/api/admin-users.js';
const routes = {
  'GET /api/admin/users': adminUsers.list, 'POST /api/admin/users': adminUsers.add,
  'POST /api/admin/users/remove': adminUsers.remove,
  'GET /api/content': content.onRequestGet, 'POST /api/admin/content': content.onRequestPost,
  'POST /api/admin/beatmap': admin.beatmap, 'POST /api/admin/image': admin.upload,
  'GET /api/auth/login': login.onRequestGet, 'GET /api/auth/callback': callback.onRequestGet,
  'GET /api/auth/session': session.onRequestGet, 'POST /api/auth/logout': logout.onRequestPost,
  'GET /api/users/search': users.onRequestGet, 'POST /api/bp/analyze': bp.onRequestPost,
  'GET /api/beatmaps/search': maps.onRequestGet, 'POST /api/beatmaps/analyze': mapAnalysis.onRequestPost,
  'POST /api/beatmaps/facts': mapFacts.onRequestPost,
};
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname.startsWith('/api/content/image/') && request.method === 'GET') return content.imageResponse(request, env);
    if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return Response.json({ error: '请求来源无效。' }, { status: 403 });
    const handler = routes[`${request.method} ${url.pathname}`];
    if (!handler) return Response.json({ error: '接口不存在。' }, { status: 404 });
    const response = await handler({ request, env, ctx });
    response.headers.set('cache-control', 'no-store');
    response.headers.set('x-content-type-options', 'nosniff');
    return response;
  },
};
