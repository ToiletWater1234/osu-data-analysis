export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { location, ...headers } });
}

export function errorResponse(error) {
  const status = Number(error?.status || 500);
  const message = status >= 500 ? "服务暂时不可用，请稍后重试。" : String(error?.message || "请求失败。");
  return json({ error: message }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    const error = new Error("请求内容不是有效的 JSON。");
    error.status = 400;
    throw error;
  }
}
