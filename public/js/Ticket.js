
      /* =========================
     Tickets Logic (MY PAID ONLY)
     Source of truth: /api/tickets/my/paid
     Details: /api/tickets/my/{ticketId}
     ✅ FIXED:
     - No cache (cache:no-store + ts param)
     - Reads PaymentStatus/Amount/Currency
     - Sort newest first
     - Active only = confirmed
  ========================= */

      const API = {
        base: "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net",
        endpoints: {
          myPaidTickets: "/api/tickets/my/paid",
          myTicketDetails: (ticketId) =>
            `/api/tickets/my/${encodeURIComponent(ticketId)}`,
          passengerClassAll: "/api/PassengerClass/all",
        },
      };

      const $ = (id) => document.getElementById(id);

      function toast(msg, ok = true) {
        const t = $("toast");
        t.textContent = msg;
        t.className = "toast show " + (ok ? "ok" : "bad");
        clearTimeout(toast._tm);
        toast._tm = setTimeout(() => (t.className = "toast"), 3000);
      }

      function getToken() {
        return (
          localStorage.getItem("auth_token") ||
          localStorage.getItem("token") ||
          ""
        );
      }

      function safe(v, fallback = "—") {
        if (v === null || v === undefined || v === "") return fallback;
        return v;
      }

      function fmtDateTime(iso) {
        if (!iso) return "—";
        try {
          const d = new Date(iso);
          if (isNaN(d.getTime())) return String(iso);
          return d.toLocaleString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return String(iso);
        }
      }

      function money(amount, currency) {
        const n = Number(amount);
        if (!Number.isFinite(n)) return safe(amount);
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

      // ✅ Robust fetch: no cache + ts param + supports json/text/plain
      async function apiFetch(path, options = {}) {
        const baseUrl = API.base + path;
        const url =
          baseUrl + (baseUrl.includes("?") ? "&" : "?") + "_ts=" + Date.now();

        const headers = {
          Accept: "application/json, text/plain, */*",
          ...(options.headers || {}),
        };

        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const hasBody = options.body != null;
        if (hasBody && !headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch(url, {
          ...options,
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
          throw err;
        }

        return body;
      }

      /* =========================
     PassengerClass map
  ========================= */
      let CLASS_MAP = new Map(); // id -> name

      function normalizeClassName(obj) {
        return (
          obj.nameClass ??
          obj.NameClass ??
          obj.className ??
          obj.ClassName ??
          obj.name ??
          obj.Name ??
          `Class #${obj.classID ?? obj.ClassID ?? obj.id ?? obj.ID}`
        );
      }

      async function loadPassengerClasses() {
        try {
          const data = await apiFetch(API.endpoints.passengerClassAll, {
            method: "GET",
          });
          const arr = Array.isArray(data) ? data : [];
          CLASS_MAP = new Map();
          for (const c of arr) {
            const id = c.classID ?? c.ClassID ?? c.id ?? c.ID;
            if (id !== undefined && id !== null) {
              CLASS_MAP.set(Number(id), normalizeClassName(c));
            }
          }
        } catch {
          CLASS_MAP = new Map();
        }
      }

      /* =========================
     Normalize MyPaidTicket row
     ✅ now supports PaymentStatus/Amount/Currency
  ========================= */
      function normPaidRow(x) {
        const bookingStatus = (
          x.bookingStatus ??
          x.BookingStatus ??
          ""
        ).toString();
        const paymentStatus = (
          x.paymentStatus ??
          x.PaymentStatus ??
          ""
        ).toString();

        return {
          bookId: x.bookID ?? x.bookId ?? x.BookID,
          ticketId: x.ticketID ?? x.ticketId ?? x.TicketID,
          clientId: x.clientID ?? x.clientId ?? x.ClientID,
          ticketPrice: x.ticketPrice ?? x.TicketPrice ?? 0,
          passengerClassId:
            x.passengerClassID ?? x.PassengerClassID ?? x.classID ?? x.ClassID,
          passengersCount:
            x.passengersCount ?? x.PassengersCount ?? x.count ?? 0,
          bookingDate: x.bookingDate ?? x.BookingDate,
          bookingStatus: bookingStatus,
          isConfirmed: bookingStatus.trim().toLowerCase() === "confirmed",

          // ✅ new fields
          paymentStatus: paymentStatus,
          amount: x.amount ?? x.Amount ?? null,
          currency: x.currency ?? x.Currency ?? "USD",
          isPaid: paymentStatus.trim().toLowerCase() === "paid",
        };
      }

      /* =========================
     Render
  ========================= */
      let ALL = []; // normalized paid rows

      function cardHTML(r) {
        const className =
          CLASS_MAP.get(Number(r.passengerClassId)) ||
          `Class #${safe(r.passengerClassId)}`;

        const confirmedBadge = r.isConfirmed
          ? '<span class="badge success">✓ Confirmed</span>'
          : '<span class="badge info">Pending</span>';

        const paidBadge = r.isPaid
          ? '<span class="badge success">PAID ✅</span>'
          : '<span class="badge info">UNPAID</span>';

        const priceText =
          r.amount != null
            ? money(r.amount, r.currency)
            : money(r.ticketPrice, r.currency || "USD");

        return `
      <div class="card">
        <div class="card-top">
          <div class="card-title">Booking #${safe(r.bookId)} • Ticket #${safe(r.ticketId)}</div>
          <div class="sub">
            <span class="tag"><span class="dot"></span>${className}</span>
            <span>•</span>
            <span>${safe(r.bookingStatus)}</span>
            <span>•</span>
            ${confirmedBadge}
            <span>•</span>
            ${paidBadge}
          </div>
        </div>

        <div class="card-mid">
          <div class="meta">
            <div class="kv"><div class="k">Passengers</div><div class="v">${safe(r.passengersCount)}</div></div>
            <div class="kv"><div class="k">Class ID</div><div class="v">${safe(r.passengerClassId)}</div></div>
            <div class="kv"><div class="k">Book ID</div><div class="v">${safe(r.bookId)}</div></div>
            <div class="kv"><div class="k">Ticket ID</div><div class="v">${safe(r.ticketId)}</div></div>
          </div>
        </div>

        <div class="card-actions">
          <div class="price">${priceText} <small>${(r.currency || "USD").toUpperCase()}</small></div>
          <button class="btn primary" data-act="details">📄 View Details</button>
        </div>
      </div>
    `;
      }

      function render(list) {
        const grid = $("grid");
        const state = $("state");
        grid.innerHTML = "";

        if (!list || list.length === 0) {
          state.style.display = "block";
          state.textContent = "No tickets found.";
          return;
        }

        state.style.display = "none";
        for (const r of list) {
          const wrap = document.createElement("div");
          wrap.innerHTML = cardHTML(r);
          const card = wrap.firstElementChild;

          card
            .querySelector('[data-act="details"]')
            .addEventListener("click", () => openDetails(r.ticketId));

          grid.appendChild(card);
        }
      }

      function applyFilters() {
        const q = ($("q").value || "").trim().toLowerCase();
        const onlyActive = $("onlyActive").checked;

        let list = ALL.slice();

        // ✅ Active only = confirmed
        if (onlyActive) list = list.filter((x) => x.isConfirmed);

        if (q) {
          list = list.filter((r) => {
            const hay = [
              r.bookId,
              r.ticketId,
              r.clientId,
              r.passengerClassId,
              r.passengersCount,
              r.ticketPrice,
              r.amount,
              r.currency,
              r.paymentStatus,
              r.bookingDate,
              r.bookingStatus,
              CLASS_MAP.get(Number(r.passengerClassId)),
            ]
              .filter((x) => x !== null && x !== undefined)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          });
        }

        render(list);
      }

      /* =========================
     Modal (Details) — ONE CALL
     GET /api/tickets/my/{ticketId}
  ========================= */
      function openModal() {
        $("modal").classList.add("show");
      }
      function closeModal() {
        $("modal").classList.remove("show");
      }

      function fillTableEmpty(tbody, colspan, text) {
        tbody.innerHTML = `<tr><td colspan="${colspan}">${text}</td></tr>`;
      }

      function normalizePassengerName(p) {
        const fn = p.firstName ?? p.FirstName ?? "";
        const ln = p.lastName ?? p.LastName ?? "";
        const sn = p.secondName ?? p.SecondName ?? "";
        const tn = p.thirdName ?? p.ThirdName ?? "";
        const full = [fn, sn, tn, ln].filter(Boolean).join(" ").trim();
        return full || "—";
      }

      function renderPassengers(passengers) {
        const tb = $("mPassengers").querySelector("tbody");
        tb.innerHTML = "";
        if (!Array.isArray(passengers) || passengers.length === 0) {
          fillTableEmpty(tb, 3, "No passengers.");
          return;
        }

        for (const p of passengers) {
          const tr = document.createElement("tr");
          const doc = `${safe(p.documentationType)} • ${safe(p.issueCountryID)} • ${
            p.expirationDate ? fmtDateTime(p.expirationDate).split(",")[0] : "—"
          }`;
          tr.innerHTML = `
        <td>${normalizePassengerName(p)}</td>
        <td>${safe(p.gender ?? p.Gender)}</td>
        <td>${doc}</td>
      `;
          tb.appendChild(tr);
        }
      }

      function renderFlights(flights) {
        const tb = $("mFlights").querySelector("tbody");
        tb.innerHTML = "";
        if (!Array.isArray(flights) || flights.length === 0) {
          fillTableEmpty(tb, 3, "No flights for this ticket.");
          return;
        }

        for (const f of flights) {
          const route = `${safe(f.departureCity)} → ${safe(f.arrivalCity)}`;
          const time = `${
            f.departureDateTime ? fmtDateTime(f.departureDateTime) : "—"
          } / ${f.arrivalDateTime ? fmtDateTime(f.arrivalDateTime) : "—"}`;

          const tr = document.createElement("tr");
          tr.innerHTML = `
        <td>Schedule #${safe(f.flightScheduleID)}
          <div style="margin-top:4px; color:var(--muted); font-weight:650;">${route}</div>
        </td>
        <td>${time}</td>
        <td>${safe(f.flightType)}</td>
      `;
          tb.appendChild(tr);
        }
      }

      function renderServices(services) {
        const tb = $("mServices").querySelector("tbody");
        tb.innerHTML = "";
        if (!Array.isArray(services) || services.length === 0) {
          fillTableEmpty(tb, 3, "No services for this ticket.");
          return;
        }

        for (const s of services) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${safe(s.serviceName)}</td><td>${safe(
            s.quantity,
          )}</td><td>${safe(s.serviceFee)}</td>`;
          tb.appendChild(tr);
        }
      }

      function fillSummary(summary) {
        const tb = $("mSummary").querySelector("tbody");
        tb.innerHTML = "";

        const className =
          CLASS_MAP.get(Number(summary.passengerClassID)) ||
          `Class #${safe(summary.passengerClassID)}`;

        const rows = [
          ["BookID", safe(summary.bookID)],
          ["TicketID", safe(summary.ticketID)],
          ["ClientID", safe(summary.clientID)],
          ["BookingStatus", safe(summary.bookingStatus)],
          ["Reference", safe(summary.bookingReference)],
          ["Class", className],
          ["PassengersCount", safe(summary.passengersCount)],
          ["TicketPrice", `${safe(summary.ticketPrice)} USD`],
          ["BookingDate", fmtDateTime(summary.bookingDate)],
        ];

        for (const [k, v] of rows) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<th style="width:42%">${k}</th><td>${v}</td>`;
          tb.appendChild(tr);
        }
      }

      async function openDetails(ticketId) {
        try {
          $("mTitle").textContent = `Ticket #${safe(ticketId)}`;
          $("mSub").textContent = "Loading details…";

          const data = await apiFetch(API.endpoints.myTicketDetails(ticketId), {
            method: "GET",
          });

          const summary = data?.summary || {};
          $("mSub").textContent =
            `${safe(summary.bookingStatus)} • ${fmtDateTime(
              summary.bookingDate,
            )}`;

          renderFlights(data?.flights || []);
          renderServices(data?.services || []);
          renderPassengers(data?.passengers || []);
          fillSummary(summary);

          openModal();
        } catch (e) {
          toast("Failed to load details: " + e.message, false);
        }
      }

      /* =========================
     Tabs Navigation
  ========================= */
      function setupTabs() {
        const map = {
          home: "/index.html",
          book: "/BookingPage.html",
          tickets: "/Ticket.html",
          profile: "/Profile.html",
        };

        document.querySelectorAll(".hTab").forEach((btn) => {
          btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            const url = map[tab];
            if (url) window.location.href = url;
          });
        });

        $("userPill")?.addEventListener(
          "click",
          () => (window.location.href = "Profile.html"),
        );
      }

      /* =========================
     Load User Profile for Header
  ========================= */
      function loadUserProfile() {
        const token = getToken();
        if (!token) return;

        try {
          const payload = token.split(".")[1];
          const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
          const decoded = JSON.parse(decodeURIComponent(escape(json)));

          const firstName = decoded.firstName || decoded.FirstName || "";
          const lastName = decoded.lastName || decoded.LastName || "";
          const email =
            decoded.email ||
            decoded[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
            ] ||
            "";

          let fullName = "";
          if (firstName && lastName)
            fullName = `${firstName} ${lastName}`.toUpperCase();
          else if (firstName) fullName = firstName.toUpperCase();
          else if (email) fullName = email.split("@")[0].toUpperCase();
          else fullName = "User";

          $("username").textContent = fullName;
          $("avatar").textContent = fullName[0];
        } catch (e) {
          console.warn("Could not parse token", e);
        }
      }

      /* =========================
     INIT
  ========================= */
      async function loadAll() {
        const token = getToken();
        const hint = $("hintLine");

        loadUserProfile();

        if (!token) {
          hint.innerHTML =
            '⚠️ You are not logged in. <code class="inline">auth_token</code> missing.';
          $("state").textContent = "Please login first.";
          $("state").style.display = "block";
          $("grid").innerHTML = "";
          toast("Please login first.", false);
          return;
        }

        hint.innerHTML =
          'Loaded from <code class="inline">/api/tickets/my/paid</code> (JWT ownership, no-cache).';

        try {
          $("state").textContent = "Loading your paid tickets…";
          $("state").style.display = "block";

          await loadPassengerClasses();

          const rows = await apiFetch(API.endpoints.myPaidTickets, {
            method: "GET",
          });
          const arr = Array.isArray(rows) ? rows : [];

          // ✅ Normalize + sort newest first
          ALL = arr
            .map(normPaidRow)
            .sort(
              (a, b) =>
                new Date(b.bookingDate || 0) - new Date(a.bookingDate || 0),
            );

          applyFilters();
          toast("✓ Tickets loaded successfully");
        } catch (e) {
          $("grid").innerHTML = "";
          $("state").textContent = "Error: " + e.message;
          $("state").style.display = "block";
          toast("✗ Failed: " + e.message, false);
        }
      }

      $("btnRefresh").addEventListener("click", loadAll);
      $("btnClear").addEventListener("click", () => {
        $("q").value = "";
        applyFilters();
      });
      $("q").addEventListener("input", applyFilters);
      $("onlyActive").addEventListener("change", applyFilters);

      $("mClose").addEventListener("click", closeModal);
      $("modal").addEventListener("click", (e) => {
        if (e.target === $("modal")) closeModal();
      });
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });

      $("btnPrint").addEventListener("click", () => window.print());

      setupTabs();
      loadAll();
    