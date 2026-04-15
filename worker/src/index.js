const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
};

function getAllowedOrigin(request, env) {
    const origin = request.headers.get("Origin");
    if (!origin) {
        return "";
    }

    const allowedOrigins = (env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((item) => item.trim())
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
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, maxLength);
}
async function stats(request, env) {
    const date = todayKey();
    const [total, today, recent] = await Promise.all([
        env.DB.prepare(
            "SELECT COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv FROM page_views"
        ).first(),
        env.DB.prepare(
            "SELECT COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv FROM page_views WHERE event_date = ?"
        ).bind(date).first(),
        env.DB.prepare(
            "SELECT event_date AS date, COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv FROM page_views GROUP BY event_date ORDER BY event_date DESC LIMIT 14"
        ).all()
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
        recent: recent.results || []
    });
}
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(request, env)
            });
        }

        if (url.pathname === "/track" && request.method === "POST") {
            return track(request, env);
        }

        if (url.pathname === "/stats" && request.method === "GET") {
            return stats(request, env);
        }

        return jsonResponse(request, env, {
            ok: true,
            service: "comeback-countdown-analytics",
            endpoints: ["/track", "/stats"]
        });
    }
};
