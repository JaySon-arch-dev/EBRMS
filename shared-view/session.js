/* =========================================================
   EBRMS SESSION HANDLER
   SAVE AS: /shared-view/session.js
   New file: add it to your project (nothing to replace).

   Load on every Student, Faculty and Admin page, right after
   the Supabase CDN script. It reads <body data-role="...">.

   What it does
   - Blocks the page until the session and role are verified
   - Sends a wrong-role visitor to their own dashboard
   - Signs out after inactivity (with a "stay signed in" prompt)
   - Keeps all open tabs in sync (sign out in one = all)
   - Re-checks the account when the tab comes back or when the
     Back button restores a cached page
   - Pages without data-role (history, profile, ...) accept any
     signed-in role; pages with data-role also check the role
   ========================================================= */

(() => {
    "use strict";

    /* ---------- Settings ---------- */

    const CONFIG = {
        idleSeconds: 90,       // sign out after 1:30 of inactivity
        warnSeconds: 10,       // prompt appears at 1:20 (10 s before sign-out)
        recheckMinutes: 5,     // re-verify the account in the background
        loginPath: "/login/",
        checkPath: "/api/auth-check"
    };    const SUPABASE_URL = "https://lrlzlzfulcajbuqeufym.supabase.co";
    const SUPABASE_KEY = "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

    const ROUTES = {
        Student: "/student/",
        Faculty: "/faculty/",
        Admin: "/admin/"
    };

    const KEY_ACTIVITY = "ebrms:last-activity";
    const KEY_LOGOUT = "ebrms:logout";

    // Optional: read now, before view.js fills in a label on shared pages.
    const expectedRole = document.body.dataset.role || "";
    const idleMs = CONFIG.idleSeconds * 1000;

    // The prompt can never be longer than half of the idle time.
    const warnSeconds = Math.max(
        1,
        Math.min(CONFIG.warnSeconds, Math.floor(CONFIG.idleSeconds / 2))
    );
    const warnMs = warnSeconds * 1000;


    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });

    let leaving = false;
    let warningOpen = false;
    let lastWrite = 0;

    /* ---------- Small helpers ---------- */

    const store = {
        get(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        }
    };

    const readActivity = () => Number(store.get(KEY_ACTIVITY)) || 0;

    function touch(force) {
        const now = Date.now();
        if (!force && now - lastWrite < 2000) return;
        lastWrite = now;
        store.set(KEY_ACTIVITY, String(now));
    }

    function toLogin(reason) {
        window.location.replace(`${CONFIG.loginPath}?reason=${reason}`);
    }

    /* ---------- Sign out ---------- */

    async function signOut(reason) {
        if (leaving) return;
        leaving = true;

        // Tell the other tabs first.
        store.set(KEY_LOGOUT, JSON.stringify({ t: Date.now(), reason }));
        store.remove(KEY_ACTIVITY);

        try {
            await client.auth.signOut({ scope: "local" });
        } catch (e) { /* the session is cleared below anyway */ }

        toLogin(reason);
    }

    /* ---------- Verify the session with the server ---------- */

    // Returns { status: "ok" | "invalid" | "denied" | "unreachable", role }
    async function verify() {
        const { data, error } = await client.auth.getSession();
        const token = data && data.session && data.session.access_token;

        if (error || !token) return { status: "invalid" };

        let response;

        try {
            response = await fetch(CONFIG.checkPath, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store"
            });
        } catch (e) {
            return { status: "unreachable" };
        }

        if (response.status === 401) return { status: "invalid" };
        if (response.status === 403) return { status: "denied" };
        if (!response.ok) return { status: "unreachable" };

        try {
            const result = await response.json();
            const role = result && result.user && result.user.role;
            return role ? { status: "ok", role } : { status: "invalid" };
        } catch (e) {
            return { status: "unreachable" };
        }
    }

    // Returns true when the visitor may stay on this page.
    async function enforce(isFirstCheck) {
        const result = await verify();

        if (result.status === "unreachable") {
            if (isFirstCheck) {
                await signOut("error");
                return false;
            }
            return true; // temporary network problem: try again later
        }

        if (result.status !== "ok") {
            await signOut(result.status === "denied" ? "denied" : "expired");
            return false;
        }

        if (expectedRole && result.role !== expectedRole) {
            const home = ROUTES[result.role];

            if (home) {
                leaving = true;
                window.location.replace(home);
            } else {
                await signOut("denied");
            }

            return false;
        }

        return true;
    }

    /* ---------- Inactivity prompt ---------- */

    const STYLE = `
        .ss-overlay{position:fixed;inset:0;z-index:9999;display:none;
            align-items:center;justify-content:center;padding:20px;
            background:rgba(27,37,64,.45);backdrop-filter:blur(3px);
            -webkit-backdrop-filter:blur(3px)}
        .ss-overlay.is-open{display:flex;animation:ss-fade .2s ease both}
        .ss-card{width:100%;max-width:380px;padding:26px 24px 22px;
            border-radius:22px;background:#fff;color:#1b2540;text-align:center;
            font-family:inherit;box-shadow:0 24px 60px rgba(27,37,64,.28);
            animation:ss-rise .28s cubic-bezier(.2,.7,.2,1) both}
        .ss-ring{position:relative;width:76px;height:76px;margin:0 auto 14px}
        .ss-ring svg{width:76px;height:76px;transform:rotate(-90deg)}
        .ss-ring circle{fill:none;stroke-width:5}
        .ss-track{stroke:#e6ecff}
        .ss-bar{stroke:#4263eb;stroke-linecap:round;
            transition:stroke-dashoffset 1s linear}
        .ss-count{position:absolute;inset:0;display:flex;align-items:center;
            justify-content:center;font-size:22px;font-weight:800;
            letter-spacing:-.5px}
        .ss-card h2{margin:0 0 6px;font-size:19px;font-weight:800;
            letter-spacing:-.4px}
        .ss-card p{margin:0 0 20px;font-size:14px;line-height:1.5;color:#5b6785}
        .ss-actions{display:flex;gap:10px}
        .ss-actions button{flex:1;padding:12px 14px;border-radius:12px;
            font:inherit;font-size:14px;font-weight:700;cursor:pointer;
            transition:transform .15s ease,background .15s ease}
        .ss-actions button:active{transform:scale(.97)}
        .ss-stay{border:0;color:#fff;background:#4263eb}
        .ss-stay:hover{background:#3552d4}
        .ss-out{border:1px solid #d7def5;color:#1b2540;background:#fff}
        .ss-out:hover{background:#f5f8ff}
        @keyframes ss-fade{from{opacity:0}to{opacity:1}}
        @keyframes ss-rise{from{opacity:0;transform:translateY(12px) scale(.98)}
            to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){
            .ss-overlay.is-open,.ss-card{animation:none}
            .ss-bar{transition:none}}
    `;

    const CIRC = 2 * Math.PI * 33;
    let overlay = null;
    let countEl = null;
    let barEl = null;
    let lastFocus = null;

    function buildPrompt() {
        const style = document.createElement("style");
        style.textContent = STYLE;
        document.head.appendChild(style);

        overlay = document.createElement("div");
        overlay.className = "ss-overlay";
        overlay.innerHTML = `
            <div class="ss-card" role="alertdialog" aria-modal="true"
                 aria-labelledby="ssTitle" aria-describedby="ssText">
                <div class="ss-ring">
                    <svg viewBox="0 0 76 76" aria-hidden="true">
                        <circle class="ss-track" cx="38" cy="38" r="33"/>
                        <circle class="ss-bar" cx="38" cy="38" r="33"
                                stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
                    </svg>
                    <span class="ss-count" id="ssCount">60</span>
                </div>
                <h2 id="ssTitle">Still there?</h2>
                <p id="ssText">For your security, you'll be signed out soon
                    because there has been no activity.</p>
                <div class="ss-actions">
                    <button type="button" class="ss-out" id="ssOut">Sign out</button>
                    <button type="button" class="ss-stay" id="ssStay">Stay signed in</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        countEl = overlay.querySelector("#ssCount");
        barEl = overlay.querySelector(".ss-bar");

        overlay.querySelector("#ssStay").addEventListener("click", staySignedIn);
        overlay.querySelector("#ssOut").addEventListener("click", () => signOut("signedout"));
    }

    function showWarning(secondsLeft) {
        if (!overlay) buildPrompt();

        if (!warningOpen) {
            warningOpen = true;
            lastFocus = document.activeElement;
            overlay.classList.add("is-open");
            overlay.querySelector("#ssStay").focus();
        }

        countEl.textContent = String(secondsLeft);
        barEl.style.strokeDashoffset =
            String(CIRC * (1 - secondsLeft / warnSeconds));
    }

    function hideWarning() {
        if (!warningOpen) return;

        warningOpen = false;
        overlay.classList.remove("is-open");

        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    async function staySignedIn() {
        const { error } = await client.auth.refreshSession();

        if (error) {
            signOut("expired");
            return;
        }

        touch(true);
        hideWarning();
    }

    /* ---------- Timers and listeners ---------- */

    function tick() {
        if (leaving) return;

        const left = idleMs - (Date.now() - readActivity());

        if (left <= 0) {
            signOut("idle");
        } else if (left <= warnMs) {
            showWarning(Math.ceil(left / 1000));
        } else {
            hideWarning();
        }
    }

    function onActivity() {
        // While the prompt is open, only its buttons count.
        if (!warningOpen && !leaving) touch(false);
    }

    function listen() {
        ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"].forEach(
            (name) => window.addEventListener(name, onActivity, { passive: true })
        );

        // Signed out in another tab.
        window.addEventListener("storage", (event) => {
            if (event.key !== KEY_LOGOUT || !event.newValue || leaving) return;

            let reason = "signedout";

            try { reason = JSON.parse(event.newValue).reason || reason; }
            catch (e) { /* use the default */ }

            leaving = true;
            toLogin(reason);
        });

        // Supabase clears the session (for example a failed refresh).
        client.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT" && !leaving) {
                leaving = true;
                toLogin("expired");
            }
        });

        // Back on the tab, or restored from the Back/Forward cache.
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState !== "visible") return;

            tick();
            if (!leaving) enforce(false);
        });

        window.addEventListener("pageshow", (event) => {
            if (!event.persisted) return;

            tick();
            if (!leaving) enforce(false);
        });

        setInterval(tick, 1000);
        setInterval(() => { if (!leaving) enforce(false); },
            CONFIG.recheckMinutes * 60 * 1000);
    }

    /* ---------- Start ---------- */

    async function init() {
        try {
            const last = readActivity();

            // Laptop slept or the browser was closed for too long.
            if (last && Date.now() - last >= idleMs) {
                await signOut("idle");
                return;
            }

            if (!(await enforce(true))) return;

            touch(true);
            document.body.style.visibility = "visible";
            listen();

        } catch (error) {
            console.error("Session check failed:", error);
            signOut("error");
        }
    }

    window.EBRMSSession = { client, signOut };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})(); 
