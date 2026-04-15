const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
};

function getAllowedOrigin(request, env) {
    const origin = request.headers.get("Origin");
    if (!origin) return "";
    const allowedOrigins = (env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    return allowedOrigins.includes(origin) ? origin : "";
}

function corsHeaders(request, env) {
    const origin = getAllowedOrigin(request, env);
    return {
        "Access-Control-Allow-Origin": origin || "null",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin"
    };
}

function jsonResponse(request, env, body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...jsonHeaders,
            ...corsHeaders(request, env)
        }
    });
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function sanitizeText(value, maxLength) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

// ====================== 记录查看 ======================
async function track(request, env) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse(request, env, { ok: false, error: "Invalid JSON" }, 400);
    }

    const visitorId = sanitizeText(payload.visitorId, 80);
    const groupName = sanitizeText(payload.group || "unknown", 100);
    const path = sanitizeText(payload.path || "/", 240) || "/";
    const referrer = sanitizeText(payload.referrer || "", 500);

    if (!visitorId) {
        return jsonResponse(request, env, { ok: false, error: "Invalid visitor" }, 400);
    }

    await env.DB.prepare(
        "INSERT INTO page_views (visitor_id, group_name, path, referrer, event_date, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
        .bind(visitorId, groupName, path, referrer || null, todayKey(), Date.now())
        .run();

    return jsonResponse(request, env, { ok: true });
}

// ====================== 查看统计 ======================
async function stats(request, env) {
    const date = todayKey();

    const [total, today, recent, groupStats] = await Promise.all([
        env.DB.prepare(`
            SELECT COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv 
            FROM page_views
        `).first(),

        env.DB.prepare(`
            SELECT COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv 
            FROM page_views WHERE event_date = ?
        `).bind(date).first(),

        env.DB.prepare(`
            SELECT event_date AS date, COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv 
            FROM page_views 
            GROUP BY event_date 
            ORDER BY event_date DESC LIMIT 14
        `).all(),

        env.DB.prepare(`
            SELECT group_name, COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv 
            FROM page_views 
            GROUP BY group_name 
            ORDER BY pv DESC
        `).all()
    ]);

    return jsonResponse(request, env, {
        ok: true,
        total: {
            pv: total?.pv || 0,
            uv: total?.uv || 0
        },
        today: {
            date,
            pv: today?.pv || 0,
            uv: today?.uv || 0
        },
        recent: recent.results || [],
        groups: groupStats.results || []   // 按组合统计
    });
}

// ====================== 主入口 ======================
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // 处理 OPTIONS 预检请求
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(request, env)
            });
        }

        // 记录查看
        if (url.pathname === "/track" && request.method === "POST") {
            return track(request, env);
        }

        // 查看统计（已移除认证）
        if (url.pathname === "/stats" && request.method === "GET") {
            return stats(request, env);
        }

        // 默认返回信息
        return jsonResponse(request, env, {
            ok: true,
            service: "comeback-countdown-analytics",
            endpoints: ["/track", "/stats"]
        });
    }
};
