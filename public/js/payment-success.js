
      /************************************************************
       * ? payment-success.html
       * - polls GET /api/payments/my/status/{ticketId}
       * - supports token keys: auth_token OR token
       * - if unauthorized -> redirect login (NO random logout)
       ************************************************************/

      const API_BASE =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";
      const $ = (id) => document.getElementById(id);

      function qs(name) {
        return new URLSearchParams(location.search).get(name);
      }

      function getToken() {
        return (
          localStorage.getItem("auth_token") ||
          localStorage.getItem("token") ||
          ""
        );
      }

      function goLogin() {
        window.location.href = "Login.html";
      }

      async function apiGet(path) {
        const headers = { Accept: "application/json" };
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(API_BASE + path, {
          headers,
          cache: "no-store",
        });

        const text = await res.text().catch(() => "");
        let body = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }

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

      function showError(msg) {
        if (!$("errLine")) return;
        $("errLine").style.display = "block";
        $("errLine").textContent = msg;
      }

      function clearError() {
        if (!$("errLine")) return;
        $("errLine").style.display = "none";
        $("errLine").textContent = "";
      }

      function showButtons(showGoTickets, showRetry) {
        if ($("goTicketsBtn"))
          $("goTicketsBtn").style.display = showGoTickets
            ? "inline-block"
            : "none";
        if ($("retryBtn"))
          $("retryBtn").style.display = showRetry ? "inline-block" : "none";
      }

      function isConfirmedStatus(s) {
        const paid =
          String(s?.paymentStatus || s?.PaymentStatus || "")
            .trim()
            .toLowerCase() === "paid";

        const confirmed =
          s?.isConfirmed === true || Number(s?.isConfirmed) === 1;

        return paid || confirmed;
      }

      async function pollStatus(ticketId) {
        clearError();
        showButtons(false, false);

        if ($("payStatus")) $("payStatus").textContent = "Checking…";
        if ($("subtitle"))
          $("subtitle").textContent = "Your booking is being confirmed…";

        const maxMs = 25000; // 25s
        const intervalMs = 1500; // 1.5s
        const start = Date.now();

        while (Date.now() - start < maxMs) {
          try {
            const s = await apiGet(
              `/api/payments/my/status/${encodeURIComponent(ticketId)}`,
            );

            // Fill UI if elements exist
            if ($("bookId"))
              $("bookId").textContent = s.bookID ?? s.bookId ?? "—";
            if ($("payStatus"))
              $("payStatus").textContent =
                s.paymentStatus ?? s.PaymentStatus ?? "—";
            if ($("ref"))
              $("ref").textContent =
                s.bookingReference ?? s.BookingReference ?? "—";

            if (isConfirmedStatus(s)) {
              if ($("subtitle"))
                $("subtitle").textContent =
                  "Booking confirmed ? Redirecting to your tickets…";
              showButtons(true, false);

              setTimeout(() => {
                window.location.href = "Ticket.html";
              }, 900);

              return;
            }
          } catch (e) {
            console.error(e);

            // ? if token missing/expired => go login
            if (e.status === 401 || e.status === 403) {
              showError("Session expired. Please login again.");
              setTimeout(goLogin, 700);
              return;
            }

            // not fatal: keep polling
            showError("Couldn’t verify payment yet: " + (e.message || "Error"));
          }

          await new Promise((r) => setTimeout(r, intervalMs));
        }

        // timeout
        if ($("subtitle"))
          $("subtitle").textContent =
            "Payment received. Confirmation may take a bit longer. You can retry or go to tickets.";
        showButtons(true, true);
      }

      (function init() {
        const ticketId = Number(qs("ticketId") || "0");

        if ($("ticketId"))
          $("ticketId").textContent = ticketId ? String(ticketId) : "—";

        if (!ticketId) {
          if ($("subtitle"))
            $("subtitle").textContent = "Missing ticketId in URL.";
          showError(
            "Open this page from the Stripe success redirect (ticketId is required).",
          );
          showButtons(true, false);
          return;
        }

        if (!getToken()) {
          showError("Missing token. Please login first.");
          setTimeout(goLogin, 600);
          return;
        }

        $("retryBtn")?.addEventListener("click", (e) => {
          e.preventDefault();
          pollStatus(ticketId);
        });

        pollStatus(ticketId);
      })();
    