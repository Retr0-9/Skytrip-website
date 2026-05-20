
      /************************************************************
       * ? Payment.html - Back-end only (SAFE + CLEAN)
       * - FE sends ONLY { ticketId } to create checkout session
       * - FE reads status from: GET /api/payments/my/status/{ticketId}
       * - Supports both token keys: auth_token OR token
       ************************************************************/

      const API_BASE =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

      const EP_PAYMENT_STATUS = (ticketId) =>
        `${API_BASE}/api/payments/my/status/${encodeURIComponent(ticketId)}`;

      const EP_CHECKOUT_SESSION = `${API_BASE}/api/payments/checkout-session`;

      const $ = (id) => document.getElementById(id);

      function qs(name) {
        return new URLSearchParams(location.search).get(name);
      }

      function toast(msg, ok = true) {
        const t = $("toast");
        if (!t) return;
        t.textContent = msg;
        t.className = "toast show " + (ok ? "" : "bad");
        clearTimeout(toast._tm);
        toast._tm = setTimeout(() => (t.className = "toast"), 3200);
      }

      function getToken() {
        // ? Support both
        return (
          localStorage.getItem("auth_token") ||
          localStorage.getItem("token") ||
          ""
        );
      }

      function authHeaders() {
        const token = getToken();
        return token ? { Authorization: "Bearer " + token } : {};
      }

      function setPill(text, bad = false) {
        const p = $("pill");
        if (!p) return;
        p.textContent = text;
        p.className = "pill" + (bad ? " bad" : "");
      }

      function setPayEnabled(enabled) {
        const b = $("payBtn");
        if (!b) return;
        b.disabled = !enabled;
      }

      function money(amount, currency) {
        const n = Number(amount);
        if (!Number.isFinite(n)) return "—";
        const cur = (currency || "USD").toUpperCase();
        try {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: cur,
          }).format(n);
        } catch {
          return `${cur} ${n.toFixed(2)}`;
        }
      }

      async function readBody(res) {
        const text = await res.text().catch(() => "");
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }

      async function apiFetch(url, options = {}) {
        const headers = {
          Accept: "application/json, text/plain, */*",
          ...(options.headers || {}),
          ...authHeaders(),
        };

        const hasBody = options.body != null;
        const isFormData = hasBody && options.body instanceof FormData;

        if (hasBody && !isFormData && !headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch(url, {
          ...options,
          headers,
          cache: "no-store",
        });

        const body = await readBody(res);

        if (!res.ok) {
          const msg =
            (body &&
              typeof body === "object" &&
              (body.detail || body.title || body.message)) ||
            (typeof body === "string" && body) ||
            `HTTP ${res.status}`;

          const err = new Error(msg);
          err.status = res.status;
          err.body = body;
          throw err;
        }

        return body;
      }

      function normalizePayStatus(s) {
        return {
          ticketId: Number(s?.ticketID ?? s?.ticketId ?? 0) || null,
          bookId: Number(s?.bookID ?? s?.bookId ?? 0) || null,
          bookingReference: s?.bookingReference ?? s?.BookingReference ?? null,
          paymentStatus: String(s?.paymentStatus ?? s?.PaymentStatus ?? "—"),
          isConfirmed: s?.isConfirmed === true || Number(s?.isConfirmed) === 1,
          amount: s?.amount ?? s?.Amount ?? null,
          currency: s?.currency ?? s?.Currency ?? null,
          bookingStatus: s?.bookingStatus ?? s?.BookingStatus ?? null,
        };
      }

      function isPaid(statusText) {
        const t = String(statusText || "")
          .trim()
          .toLowerCase();
        return t === "paid";
      }

      function goLogin() {
        // ?? ???? storage ???? ?? ???? Login
        window.location.href = "Login.html";
      }

      async function loadPage() {
        setPayEnabled(false);
        setPill("Loading…");
        if ($("hint")) $("hint").textContent = "Loading payment status…";

        const ticketId = Number(qs("ticketId") || "0") || 0;

        if (!ticketId) {
          setPill("Invalid", true);
          if ($("hint")) {
            $("hint").textContent =
              "Missing ticketId (example: Payment.html?ticketId=4021)";
          }
          toast("Missing ticketId in URL.", false);
          return;
        }

        if ($("ticketId")) $("ticketId").textContent = String(ticketId);

        if (!getToken()) {
          setPill("Unauthorized", true);
          if ($("hint")) $("hint").textContent = "Please login first.";
          toast("Please login first (token missing).", false);
          setTimeout(goLogin, 600);
          return;
        }

        // ? Source of truth: status endpoint
        let status;
        try {
          const s = await apiFetch(EP_PAYMENT_STATUS(ticketId), {
            method: "GET",
          });
          status = normalizePayStatus(s);
        } catch (e) {
          if (e.status === 401 || e.status === 403) {
            setPill("Unauthorized", true);
            if ($("hint"))
              $("hint").textContent = "Session expired. Login again.";
            toast("Unauthorized. Please login again.", false);
            setTimeout(goLogin, 700);
            return;
          }

          if (e.status === 404) {
            setPill("Not found", true);
            if ($("hint")) {
              $("hint").textContent =
                "No payment status found (or this ticket is not yours).";
            }
            if ($("payStatus")) $("payStatus").textContent = "—";
            toast("Ticket not found / not yours.", false);
            return;
          }

          setPill("Error", true);
          if ($("hint"))
            $("hint").textContent = "Failed to load payment status.";
          toast(e.message || "Failed to load.", false);
          return;
        }

        // Fill UI
        if ($("bookId"))
          $("bookId").textContent = status.bookId ? String(status.bookId) : "—";
        if ($("ref")) $("ref").textContent = status.bookingReference || "—";
        if ($("payStatus"))
          $("payStatus").textContent = status.paymentStatus || "—";
        if ($("currency"))
          $("currency").textContent = (status.currency || "USD").toUpperCase();

        if ($("total")) {
          $("total").textContent =
            status.amount != null
              ? money(status.amount, status.currency || "USD")
              : "Calculated at checkout";
        }

        // Already paid
        if (isPaid(status.paymentStatus)) {
          setPill("Paid ?");
          if ($("hint")) $("hint").textContent = "Already paid ?";
          setPayEnabled(false);
          if ($("payHelp"))
            $("payHelp").textContent = "This ticket is already paid.";
          return;
        }

        setPill("Ready");
        if ($("hint")) $("hint").textContent = "Ready to pay.";
        setPayEnabled(true);
      }

      async function createCheckoutAndRedirect() {
        const ticketId = Number(qs("ticketId") || "0") || 0;
        if (!ticketId) throw new Error("Missing ticketId.");
        if (!getToken()) throw new Error("Unauthorized: token missing.");

        // ? back-end only payload
        const payload = { ticketId };

        const res = await apiFetch(EP_CHECKOUT_SESSION, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        let url = null;

        if (res && typeof res === "object") {
          url = res.url || res.Url || null;
        } else if (typeof res === "string" && res.startsWith("http")) {
          url = res;
        }

        if (!url) throw new Error("Server did not return checkout URL.");

        // ? Redirect to Stripe checkout
        window.location.href = url;
      }

      $("payBtn")?.addEventListener("click", async () => {
        const btn = $("payBtn");
        if (btn) btn.disabled = true;

        setPill("Creating session…");
        if ($("hint")) $("hint").textContent = "Connecting to Stripe…";

        try {
          await createCheckoutAndRedirect();
        } catch (e) {
          console.error(e);
          if (btn) btn.disabled = false;
          setPill("Error", true);
          if ($("hint")) $("hint").textContent = "Could not start payment.";
          toast(e.message || "Payment error", false);
        }
      });

      (function init() {
        loadPage().catch((e) => {
          console.error(e);
          setPill("Error", true);
          if ($("hint")) $("hint").textContent = "Failed to load payment page.";
          toast(e.message || "Failed to load payment page", false);
          setPayEnabled(false);
        });
      })();
    