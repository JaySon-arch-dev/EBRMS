/* =========================================================
   SAVE AS: /shared-view/notifications.js
   New file: add it to your project (nothing to replace).

   EBRMS NOTIFICATION BELL (Student, Faculty and Admin pages)

   A small bell at the top right of the top bar. It reads the
   transactions of the signed-in user and generates notifications:

   - Student / Faculty: their OWN borrowing and return requests.
     Red dot when one is approved or rejected (borrowing), or
     confirmed as returned (returning).
   - Admin: every borrowing and return request that needs action.
     Red dot when a new borrowing request or return request arrives.

   Click the bell to see the latest updates; opening it clears the
   dot. What was already seen is remembered in this browser.
   Updates on its own: live when Supabase Realtime is on, and every
   30 seconds + when the tab comes back otherwise.

   Load it right AFTER /shared-view/view.js.
   ========================================================= */

(() => {
    "use strict";

    // Safe to load twice (by a page tag and by session.js).
    if (window.__ebrmsBell) return;
    window.__ebrmsBell = true;

    /* ---------- Settings ---------- */

    const CONFIG = {
        pollSeconds: 30,       // check for new updates this often
        maxItems: 8,           // updates listed in the panel
        table: "borrowing_transactions",
        equipmentTable: "equipment"
    };

    // What each kind of user is notified about. The keys are the
    // borrowing_status values, lower-case.
    const MODES = {
        // Student and Faculty: their own transactions.
        borrower: {
            ownOnly: true,
            statuses: {
                approved: {
                    title: "Borrow request approved",
                    tone: "success",
                    icon: "check",
                    page: "/borrowing_transaction/"
                },
                rejected: {
                    title: "Borrow request rejected",
                    tone: "danger",
                    icon: "cross",
                    page: "/borrowing_transaction/"
                },
                declined: {
                    title: "Borrow request declined",
                    tone: "danger",
                    icon: "cross",
                    page: "/borrowing_transaction/"
                },
                returned: {
                    title: "Return confirmed",
                    tone: "info",
                    icon: "return",
                    page: "/return_request/"
                }
            },
            footer: {
                label: "View my borrowing transactions",
                href: "/borrowing_transaction/"
            },
            empty:
                "No updates yet. You'll be notified here when a borrowing " +
                "or return request is approved or rejected."
        },

        // Admin: requests waiting for a decision.
        admin: {
            ownOnly: false,
            fetchStatuses: ["Pending", "Return Requested"], // as stored
            statuses: {
                pending: {
                    title: "New borrowing request",
                    tone: "warning",
                    icon: "request",
                    page: "/admin/"
                },
                "return requested": {
                    title: "New return request",
                    tone: "warning",
                    icon: "return",
                    page: "/admin/return/"
                }
            },
            footer: {
                label: "View borrowing requests",
                href: "/admin/"
            },
            empty:
                "No requests waiting. You'll be notified here when a " +
                "borrowing or return request comes in."
        }
    };

    // Set once we know who is signed in.
    let mode = MODES.borrower;
    let WATCH = mode.statuses;

    const ICONS = {
        request:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M8 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" ' +
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
            '<rect x="8" y="3" width="8" height="5" rx="1.5" stroke="currentColor" stroke-width="1.8"/>' +
            '<path d="M8 13h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
        bell:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M6 9.5a6 6 0 0 1 12 0c0 3.2.9 4.9 1.8 5.9.4.4.1 1.1-.5 1.1H4.7c-.6 0-.9-.7-.5-1.1C5.1 14.4 6 12.7 6 9.5Z" ' +
            'stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
            '<path d="M9.8 19.5a2.3 2.3 0 0 0 4.4 0" stroke="currentColor" ' +
            'stroke-width="1.7" stroke-linecap="round"/></svg>',
        check:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" ' +
            'stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        cross:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" ' +
            'stroke-width="2.1" stroke-linecap="round"/></svg>',
        return:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<path d="M9 14 4 9l5-5" stroke="currentColor" stroke-width="1.9" ' +
            'stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke="currentColor" ' +
            'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    /* ---------- Logic: what counts as "new" ---------- */
    // [logic:start]

    const statusKey = (row) =>
        String(row.borrowing_status || "").trim().toLowerCase();

    // Rows that deserve a notification, newest first.
    function watchedRows(rows) {
        return rows.filter((row) => WATCH[statusKey(row)]);
    }

    // A row is new when its current status was not seen yet.
    function unreadRows(rows, seen) {
        return watchedRows(rows).filter(
            (row) => seen[row.id] !== statusKey(row)
        );
    }

    // Marks every row with its current status as seen.
    function withSeen(rows, seen) {
        const next = Object.assign({}, seen);
        rows.forEach((row) => { next[row.id] = statusKey(row); });
        return next;
    }

    // [logic:end]

    /* ---------- Storage (what this browser has already seen) ---------- */

    let storeKey = "";

    function readStore() {
        try {
            const saved = JSON.parse(localStorage.getItem(storeKey));
            if (saved && typeof saved.seen === "object") return saved;
        } catch (e) { /* unreadable or blocked */ }
        return null;
    }

    function writeStore(seen) {
        try {
            localStorage.setItem(storeKey, JSON.stringify({ seen }));
        } catch (e) { /* storage unavailable: dot returns on reload */ }
    }

    /* ---------- Look ---------- */

    const STYLE = `
        .nt{position:relative;display:inline-flex;flex:none}
        .nt-bell{position:relative;display:grid;place-items:center;
            width:40px;height:40px;padding:0;cursor:pointer;
            border:1px solid var(--border-color,#e6eaf3);border-radius:50%;
            color:var(--text-secondary,#68748d);
            background:var(--panel-bg,#fff);
            transition:color .16s ease,background .16s ease,
                border-color .16s ease,transform .16s ease}
        .nt-bell:hover,.nt-bell[aria-expanded="true"]{
            color:var(--brand-primary,#4263eb);
            background:var(--brand-primary-light,#edf1ff)}
        .nt-bell:active{transform:scale(.94)}
        .nt-bell svg{width:21px;height:21px}
        .nt-dot{position:absolute;top:8px;right:9px;width:10px;height:10px;
            border-radius:50%;background:var(--danger,#dc4c64);
            box-shadow:0 0 0 2px var(--panel-bg,#fff)}
        .nt-dot[hidden]{display:none}

        .nt-panel{position:absolute;top:calc(100% + 10px);right:0;z-index:60;
            width:min(360px,calc(100vw - 24px));
            border:1px solid var(--border-color,#e6eaf3);
            border-radius:var(--radius-md,15px);
            background:var(--panel-bg,#fff);
            box-shadow:0 18px 44px rgba(39,61,120,.18);
            overflow:hidden;animation:nt-pop .18s ease both}
        .nt-panel[hidden]{display:none}
        .nt-head{display:flex;align-items:center;justify-content:space-between;
            padding:14px 16px 12px;border-bottom:1px solid var(--border-color,#e6eaf3)}
        .nt-head strong{font-size:15px;letter-spacing:-.2px;
            color:var(--text-primary,#1b2540)}
        .nt-head span{font-size:12px;color:var(--text-muted,#929bb0)}
        .nt-list{max-height:min(380px,60vh);margin:0;padding:6px;
            list-style:none;overflow-y:auto}
        .nt-item{display:flex;gap:12px;align-items:flex-start;
            padding:11px 10px;border-radius:12px;text-decoration:none;
            color:var(--text-primary,#1b2540);
            transition:background .16s ease}
        .nt-item:hover{background:var(--page-bg,#f5f8ff)}
        .nt-item.is-new{background:var(--brand-primary-light,#edf1ff)}
        .nt-icon{display:grid;place-items:center;flex:none;
            width:34px;height:34px;border-radius:50%}
        .nt-icon svg{width:17px;height:17px}
        .nt-icon.is-success{color:var(--success,#20a779);
            background:var(--success-light,#e6f8f1)}
        .nt-icon.is-danger{color:var(--danger,#dc4c64);
            background:var(--danger-light,#fdecef)}
        .nt-icon.is-warning{color:#c27a06;background:#fff4de}
        .nt-icon.is-info{color:var(--brand-primary,#4263eb);
            background:var(--brand-primary-light,#edf1ff)}
        .nt-copy{display:grid;gap:2px;min-width:0}
        .nt-title{font-size:14px;font-weight:700;letter-spacing:-.1px}
        .nt-meta{font-size:12.5px;line-height:1.4;
            color:var(--text-secondary,#68748d);overflow-wrap:anywhere}
        .nt-empty{margin:0;padding:26px 18px 28px;text-align:center;
            font-size:13.5px;line-height:1.5;color:var(--text-secondary,#68748d)}
        .nt-foot{display:block;padding:12px 16px;text-align:center;
            font-size:13px;font-weight:700;text-decoration:none;
            color:var(--brand-primary,#4263eb);
            border-top:1px solid var(--border-color,#e6eaf3)}
        .nt-foot:hover{background:var(--page-bg,#f5f8ff)}

        @keyframes nt-pop{from{opacity:0;transform:translateY(-6px)}
            to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.nt-panel{animation:none}}

        /* Phones: the panel spans the screen under the top bar. */
        @media (max-width:899px){
            .nt{position:static}
            .nt-panel{top:calc(100% + 8px);right:12px;left:12px;width:auto}
        }
    `;

    /* ---------- Build the bell ---------- */

    const topbar = document.querySelector(".topbar");

    if (!topbar || !window.EBRMS || !window.EBRMS.client) return;

    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "nt";
    wrap.hidden = true; // shown once we know who is signed in

    const bell = document.createElement("button");
    bell.type = "button";
    bell.className = "nt-bell";
    bell.setAttribute("aria-label", "Notifications");
    bell.setAttribute("aria-haspopup", "true");
    bell.setAttribute("aria-expanded", "false");
    bell.setAttribute("aria-controls", "ntPanel");
    bell.innerHTML = ICONS.bell;

    const dot = document.createElement("span");
    dot.className = "nt-dot";
    dot.hidden = true;
    bell.appendChild(dot);

    const panel = document.createElement("div");
    panel.className = "nt-panel";
    panel.id = "ntPanel";
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Notifications");

    wrap.append(bell, panel);
    topbar.appendChild(wrap); // last item = far right, desktop and mobile

    /* ---------- Rendering ---------- */

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function formatDate(value) {
        if (!value) return "";
        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? ""
            : date.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric"
              });
    }

    let rows = [];
    let seen = {};
    let names = {};
    let borrowerNames = {};
    let isOpen = false;
    let highlight = new Set(); // ids shown as "new" while the panel is open
    let busy = false;
    let loadFailed = false; // shows a friendly message instead of hiding the bell

    function buildItem(row) {
        const look = WATCH[statusKey(row)];
        const name = names[row.eq_id] || row.eq_id || "Equipment";

        const link = el("a", "nt-item" + (highlight.has(row.id) ? " is-new" : ""));
        link.href = look.page;

        const icon = el("span", "nt-icon is-" + look.tone);
        icon.innerHTML = ICONS[look.icon];

        const copy = el("span", "nt-copy");
        copy.append(el("span", "nt-title", look.title));

        copy.append(el(
            "span",
            "nt-meta",
            `${name}` + (row.borrowing_id ? ` \u00B7 Request ${row.borrowing_id}` : "")
        ));

        // Admin: who is asking.
        if (!mode.ownOnly && row.borrower_id) {
            copy.append(el(
                "span",
                "nt-meta",
                `From ${borrowerNames[row.borrower_id] || row.borrower_id}`
            ));
        }

        if (statusKey(row) === "approved" && row.approved_by) {
            const when = formatDate(row.approval_date);
            copy.append(el(
                "span",
                "nt-meta",
                `By ${row.approved_by}` + (when ? ` \u00B7 ${when}` : "")
            ));
        }

        if (look.tone === "danger" && row.remarks) {
            copy.append(el("span", "nt-meta", `Reason: ${row.remarks}`));
        }

        link.append(icon, copy);

        const item = document.createElement("li");
        item.append(link);
        return item;
    }

    function renderPanel() {
        const items = watchedRows(rows).slice(0, CONFIG.maxItems);

        const head = el("div", "nt-head");
        head.append(
            el("strong", "", "Notifications"),
            el("span", "", highlight.size ? `${highlight.size} new` : "")
        );

        const body = items.length
            ? (() => {
                  const list = el("ul", "nt-list");
                  list.append(...items.map(buildItem));
                  return list;
              })()
            : el(
                  "p",
                  "nt-empty",
                  loadFailed
                      ? "We couldn't load your notifications right now. " +
                        "Please refresh the page or try again later."
                      : mode.empty
              );

        const foot = el("a", "nt-foot", mode.footer.label);
        foot.href = mode.footer.href;

        panel.replaceChildren(head, body, foot);
    }

    function renderDot() {
        const hasNew = unreadRows(rows, seen).length > 0;

        dot.hidden = !hasNew;
        bell.setAttribute(
            "aria-label",
            hasNew ? "Notifications, you have new updates" : "Notifications"
        );
    }

    /* ---------- Open and close ---------- */

    function open() {
        if (isOpen) return;
        isOpen = true;

        // What was new when the user opened the panel stays tinted.
        highlight = new Set(unreadRows(rows, seen).map((row) => row.id));

        seen = withSeen(rows, seen);
        writeStore(seen);

        panel.hidden = false;
        bell.setAttribute("aria-expanded", "true");
        renderPanel();
        renderDot();
    }

    function close(returnFocus) {
        if (!isOpen) return;
        isOpen = false;
        highlight = new Set();

        panel.hidden = true;
        bell.setAttribute("aria-expanded", "false");

        if (returnFocus) bell.focus();
    }

    bell.addEventListener("click", () => (isOpen ? close(false) : open()));

    document.addEventListener("click", (event) => {
        if (isOpen && !wrap.contains(event.target)) close(false);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close(true);
    });

    /* ---------- Data ---------- */

    let userId = "";

    async function loadNames() {
        const { client } = window.EBRMS;
        const wanted = watchedRows(rows)
            .slice(0, CONFIG.maxItems)
            .map((row) => row.eq_id)
            .filter((id) => id && !names[id]);

        if (!wanted.length) return;

        const { data, error } = await client
            .from(CONFIG.equipmentTable)
            .select("eq_id, eq_name")
            .in("eq_id", [...new Set(wanted)]);

        if (error) {
            console.error("Notifications: equipment names failed:", error.message);
            return;
        }

        data.forEach((item) => { names[item.eq_id] = item.eq_name; });
    }

    // Admin only: the names of the people who sent the requests.
    async function loadBorrowerNames() {
        if (mode.ownOnly) return;

        const { client } = window.EBRMS;
        const wanted = watchedRows(rows)
            .slice(0, CONFIG.maxItems)
            .map((row) => row.borrower_id)
            .filter((id) => id && !borrowerNames[id]);

        if (!wanted.length) return;

        const { data, error } = await client
            .from("users")
            .select("user_id, full_name")
            .in("user_id", [...new Set(wanted)]);

        if (error) {
            console.error("Notifications: borrower names failed:", error.message);
            return;
        }

        data.forEach((item) => {
            if (item.full_name) borrowerNames[item.user_id] = item.full_name;
        });
    }

    async function refresh() {
        if (busy || !userId) return;
        busy = true;

        try {
            const { client } = window.EBRMS;

            // The filters are a convenience; Supabase RLS is the real rule.
            let query = client.from(CONFIG.table).select("*");

            query = mode.ownOnly
                ? query.eq("borrower_id", userId)
                : query.in("borrowing_status", mode.fetchStatuses);

            const { data, error } = await query
                .order("id", { ascending: false })
                .limit(40);

            if (error) {
                console.error("Notifications: could not load:", error.message);
                loadFailed = true;
                if (isOpen) renderPanel();
                return;
            }

            loadFailed = false;
            rows = data || [];

            // First time in this browser: everything that exists is "seen",
            // so old approvals don't light up the dot.
            const saved = readStore();

            if (!saved) {
                seen = withSeen(rows, {});
                writeStore(seen);
            } else {
                seen = saved.seen;
            }

            await loadNames();
            await loadBorrowerNames();

            if (isOpen) {
                // New updates that arrive while the panel is open.
                unreadRows(rows, seen).forEach((row) => highlight.add(row.id));
                seen = withSeen(rows, seen);
                writeStore(seen);
                renderPanel();
            }

            renderDot();
        } catch (error) {
            console.error("Notifications: refresh failed:", error);
        } finally {
            busy = false;
        }
    }

    /* ---------- Start ---------- */

    async function start() {
        const { client, user, getProfile } = window.EBRMS;

        if (!(await user)) return;

        // The bell shows as soon as someone is signed in, so it never
        // silently disappears if the profile lookup fails.
        wrap.hidden = false;

        const profile = await getProfile();

        if (!profile || !profile.user_id) {
            console.error(
                "Notifications: no row for this account in the users table."
            );
            loadFailed = true;
            return;
        }

        // Admins see requests to act on; everyone else sees their own.
        const role = String(
            profile.role || document.body.dataset.role || ""
        ).toLowerCase();

        mode = role === "admin" ? MODES.admin : MODES.borrower;
        WATCH = mode.statuses;

        userId = profile.user_id;
        storeKey = `ebrms:notif:${userId}`;

        await refresh();

        setInterval(refresh, CONFIG.pollSeconds * 1000);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") refresh();
        });

        window.addEventListener("pageshow", (event) => {
            if (event.persisted) refresh();
        });

        // Another tab opened the bell: this tab's dot follows.
        window.addEventListener("storage", (event) => {
            if (event.key !== storeKey) return;

            const saved = readStore();

            if (saved) {
                seen = saved.seen;
                renderDot();
            }
        });

        // Instant updates when Realtime is enabled for the table
        // (Supabase: Database > Replication). Polling covers the rest.
        try {
            client
                .channel(`ebrms-notify-${userId}`)
                .on(
                    "postgres_changes",
                    Object.assign(
                        { event: "*", schema: "public", table: CONFIG.table },
                        mode.ownOnly ? { filter: `borrower_id=eq.${userId}` } : {}
                    ),
                    () => refresh()
                )
                .subscribe();
        } catch (error) {
            /* no Realtime: polling still works */
        }
    }

    start();
})(); 
