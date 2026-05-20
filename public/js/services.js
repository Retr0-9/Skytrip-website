
      /************************************************************
       * CONFIG
       ************************************************************/
      const API_BASE_URL =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

      // ???? ????
      const ENDPOINT_ALL_SERVICES = "/api/Services/All";

      // ??????? Endpoints ?????/??????? (Fallback)
      const CANDIDATE_TICKET_SERVICES = {
        getList: (ticketId) => [
          `/api/tickets/${ticketId}/services`,
          `/api/Tickets/${ticketId}/Services`,
          `/api/TicketServices/ByTicket/${ticketId}`,
          `/api/TicketServices/ByTicketId/${ticketId}`,
          `/api/TicketServices/Ticket/${ticketId}`,
          `/api/TicketServices/${ticketId}`,
        ],
        add: (ticketId) => [
          `/api/tickets/${ticketId}/services`,
          `/api/Tickets/${ticketId}/Services`,
          `/api/TicketServices`,
          `/api/TicketServices/Add`,
        ],
        update: (ticketId, serviceId) => [
          `/api/tickets/${ticketId}/services/${serviceId}`,
          `/api/Tickets/${ticketId}/Services/${serviceId}`,
          `/api/TicketServices/${ticketId}/${serviceId}`,
          `/api/TicketServices/Update/${ticketId}/${serviceId}`,
          `/api/TicketServices/${serviceId}`,
        ],
        remove: (ticketId, serviceId) => [
          `/api/tickets/${ticketId}/services/${serviceId}`,
          `/api/Tickets/${ticketId}/Services/${serviceId}`,
          `/api/TicketServices/${ticketId}/${serviceId}`,
          `/api/TicketServices/Delete/${ticketId}/${serviceId}`,
          `/api/TicketServices/${serviceId}`,
        ],
      };

      /************************************************************
       * HELPERS
       ************************************************************/
      const $ = (id) => document.getElementById(id);

      function qs(name) {
        return new URLSearchParams(window.location.search).get(name);
      }

      function getAuthHeaders() {
        const token = localStorage.getItem("auth_token");
        return token ? { Authorization: "Bearer " + token } : {};
      }

      function showToast(msg, ok = true) {
        const t = $("toast");
        t.innerHTML = ok ? `? ${msg}` : `?? ${msg}`;
        t.classList.add("show");
        clearTimeout(showToast._tm);
        showToast._tm = setTimeout(() => t.classList.remove("show"), 2600);
      }

      async function safeJson(text) {
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      }

      async function parseError(res) {
        const txt = await res.text().catch(() => "");
        const j = await safeJson(txt);
        return (
          j?.detail ||
          j?.message ||
          j?.title ||
          (typeof j === "string" ? j : "") ||
          txt ||
          res.statusText
        );
      }

      function normalizeServicesList(data) {
        if (Array.isArray(data)) return data;
        return data?.data || data?.results || [];
      }

      function getServiceId(obj) {
        return Number(
          obj?.serviceID ??
            obj?.ServiceID ??
            obj?.serviceId ??
            obj?.ServiceId ??
            obj?.id ??
            obj?.ID ??
            0,
        );
      }

      function getServiceName(obj) {
        return (
          obj?.nameService ??
          obj?.NameService ??
          obj?.serviceName ??
          obj?.ServiceName ??
          obj?.name ??
          obj?.title ??
          "Service"
        );
      }

      function getServiceDesc(obj) {
        return obj?.description ?? obj?.Description ?? obj?.desc ?? "";
      }

      function getServiceFees(obj) {
        return Number(obj?.fees ?? obj?.Fees ?? obj?.fee ?? obj?.Fee ?? 0) || 0;
      }

      function getTSServiceId(obj) {
        return Number(
          obj?.serviceID ??
            obj?.ServiceID ??
            obj?.serviceId ??
            obj?.ServiceId ??
            0,
        );
      }

      function getTSQty(obj) {
        return Number(
          obj?.quantity ?? obj?.Quantity ?? obj?.qty ?? obj?.Qty ?? 0,
        );
      }

      function getTicketServiceId(obj) {
        return Number(
          obj?.ticketServiceId ??
            obj?.TicketServiceId ??
            obj?.ticketServicesId ??
            obj?.TicketServicesId ??
            obj?.id ??
            obj?.ID ??
            0,
        );
      }

      function moneyJOD(n) {
        const num = Number(n);
        if (Number.isNaN(num)) return "0.00 JOD";
        return num.toFixed(2) + " JOD";
      }

      function pickIconByName(name) {
        const s = String(name || "").toLowerCase();
        if (s.includes("meal") || s.includes("food")) return "???";
        if (s.includes("wheel") || s.includes("chair")) return "?";
        if (s.includes("assist")) return "?????";
        if (s.includes("luggage") || s.includes("baggage")) return "??";
        if (s.includes("seat")) return "??";
        return "?";
      }

      /************************************************************
       * API (with fallback endpoints)
       ************************************************************/
      async function apiFetch(path, opts = {}) {
        const url = API_BASE_URL.replace(/\/+$/, "") + path;
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(await parseError(res));

        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("application/json")) return await res.json();
        const t = await res.text().catch(() => "");
        return (await safeJson(t)) ?? t;
      }

      async function tryFirst(paths, makeOpts) {
        let lastErr = null;
        for (const p of paths) {
          try {
            const data = await apiFetch(p, makeOpts(p));
            return { ok: true, path: p, data };
          } catch (e) {
            lastErr = e;
          }
        }
        return { ok: false, error: lastErr };
      }

      /************************************************************
       * STATE
       ************************************************************/
      const ticketId =
        Number(qs("ticketId") || sessionStorage.getItem("ticketId") || "0") ||
        0;
      const bookId =
        Number(qs("bookId") || sessionStorage.getItem("bookId") || "0") || 0;

      let services = [];
      let selectedQty = new Map(); // serviceId -> qty
      let ticketServiceIds = new Map(); // serviceId -> ticketServiceId

      /************************************************************
       * TOTALS (FIXED)
       * ? totalPrice here is ONLY services total
       * ? grandTotal = flightTotal(from FlightDetails) + servicesTotal + seatsTotal
       ************************************************************/
      function readFlightTotalFromFlightDetails() {
        return Number(sessionStorage.getItem("flightTotal") || "0") || 0;
      }

      function computeServicesTotalNow() {
        let total = 0;
        for (const s of services) {
          const sid = getServiceId(s);
          const fees = getServiceFees(s);
          const q = Number(selectedQty.get(sid) || 0);
          total += fees * q;
        }
        sessionStorage.setItem("servicesTotal", String(total));
        return total;
      }

      function readSeatsTotal() {
        return Number(sessionStorage.getItem("seatsTotal") || "0") || 0;
      }

      /************************************************************
       * RENDER
       ************************************************************/
      function computeTotalUI() {
        const total = computeServicesTotalNow();
        $("totalPrice").textContent = moneyJOD(total);
      }

      function render() {
        const root = $("servicesList");
        root.innerHTML = "";

        for (const s of services) {
          const sid = getServiceId(s);
          const name = getServiceName(s);
          const desc = getServiceDesc(s);
          const fees = getServiceFees(s);

          const qty = Number(selectedQty.get(sid) || 0);
          const isFree = fees === 0;

          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `
        <div class="service">
          <div class="left">
            <div class="ico">${pickIconByName(name)}</div>
            <div class="meta">
              <p class="name">${name}</p>
              <p class="desc">${desc || ""}</p>
              <p class="price">${isFree ? "Free" : moneyJOD(fees)}</p>
            </div>
          </div>

          <div class="right">
            ${
              isFree
                ? `<button class="addBtn ${qty > 0 ? "added" : ""}"
                           data-action="toggle" data-sid="${sid}">
                    ${qty > 0 ? "Added" : "Add"}
                   </button>`
                : `<div class="qtybox">
                    <button class="pill minus" data-action="dec" data-sid="${sid}">-</button>
                    <div class="qty" id="qty_${sid}">${qty}</div>
                    <button class="pill" data-action="inc" data-sid="${sid}">+</button>
                   </div>`
            }
          </div>
        </div>
      `;
          root.appendChild(card);
        }

        computeTotalUI();
      }

      /************************************************************
       * LOAD DATA
       ************************************************************/
      async function loadServicesAll() {
        const data = await apiFetch(ENDPOINT_ALL_SERVICES, {
          method: "GET",
          headers: { Accept: "application/json", ...getAuthHeaders() },
        });
        services = normalizeServicesList(data);
        if (!Array.isArray(services)) services = [];
      }

      async function loadTicketServices() {
        selectedQty = new Map();
        ticketServiceIds = new Map();

        const paths = CANDIDATE_TICKET_SERVICES.getList(ticketId);

        const r = await tryFirst(paths, () => ({
          method: "GET",
          headers: { Accept: "application/json", ...getAuthHeaders() },
        }));

        if (!r.ok) {
          console.warn(
            "TicketServices GET failed:",
            r.error?.message || r.error,
          );
          return;
        }

        const list = Array.isArray(r.data)
          ? r.data
          : r.data?.data || r.data?.results || [];
        for (const x of list) {
          const sid = getTSServiceId(x);
          const q = getTSQty(x);

          if (sid > 0 && q > 0) selectedQty.set(sid, q);

          const tsId = getTicketServiceId(x);
          if (sid > 0 && tsId > 0) ticketServiceIds.set(sid, tsId);
        }
      }

      async function loadAll() {
        if (!ticketId || ticketId < 1) {
          showToast("Missing ticketId (?ticketId=...)", false);
          return;
        }

        await loadServicesAll();
        await loadTicketServices();
        render();
      }

      /************************************************************
       * MUTATIONS (set quantity with fallback)
       ************************************************************/
      async function setQuantity(serviceId, newQty) {
        const sid = Number(serviceId);
        const target = Math.max(0, Number(newQty) || 0);
        const current = Number(selectedQty.get(sid) || 0);

        // DELETE
        if (target <= 0) {
          if (current > 0) {
            const delPaths = CANDIDATE_TICKET_SERVICES.remove(ticketId, sid);

            const tsId = ticketServiceIds.get(sid) || 0;
            const extra = tsId ? [`/api/TicketServices/${tsId}`] : [];
            const allDel = [...delPaths, ...extra];

            const r = await tryFirst(allDel, () => ({
              method: "DELETE",
              headers: { ...getAuthHeaders() },
            }));

            if (!r.ok) throw r.error;
          }

          selectedQty.delete(sid);
          ticketServiceIds.delete(sid);
          return;
        }

        // POST
        if (current <= 0) {
          const postPaths = CANDIDATE_TICKET_SERVICES.add(ticketId);

          const bodies = [
            { ticketId, serviceId: sid, quantity: target },
            { TicketID: ticketId, ServiceID: sid, Quantity: target },
            { ticketID: ticketId, serviceID: sid, quantity: target },
            { serviceID: sid, quantity: target },
            { ServiceID: sid, Quantity: target },
          ];

          let ok = false;
          let lastErr = null;

          for (const p of postPaths) {
            for (const body of bodies) {
              try {
                const data = await apiFetch(p, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...getAuthHeaders(),
                  },
                  body: JSON.stringify(body),
                });

                const tsId = getTicketServiceId(data);
                if (tsId > 0) ticketServiceIds.set(sid, tsId);

                ok = true;
                break;
              } catch (e) {
                lastErr = e;
              }
            }
            if (ok) break;
          }

          if (!ok) throw lastErr;

          selectedQty.set(sid, target);
          return;
        }

        // PUT
        {
          const putPaths = CANDIDATE_TICKET_SERVICES.update(ticketId, sid);

          const tsId = ticketServiceIds.get(sid) || 0;
          const extra = tsId ? [`/api/TicketServices/${tsId}`] : [];
          const allPut = [...putPaths, ...extra];

          const bodies = [
            { quantity: target },
            { Quantity: target },
            { ticketId, serviceId: sid, quantity: target },
            { TicketID: ticketId, ServiceID: sid, Quantity: target },
          ];

          let ok = false;
          let lastErr = null;

          for (const p of allPut) {
            for (const body of bodies) {
              try {
                const data = await apiFetch(p, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...getAuthHeaders(),
                  },
                  body: JSON.stringify(body),
                });

                const returnedTsId = getTicketServiceId(data);
                if (returnedTsId > 0) ticketServiceIds.set(sid, returnedTsId);

                ok = true;
                break;
              } catch (e) {
                lastErr = e;
              }
            }
            if (ok) break;
          }

          if (!ok) throw lastErr;

          selectedQty.set(sid, target);
        }
      }

      /************************************************************
       * EVENTS: +/- buttons
       ************************************************************/
      document.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const action = btn.dataset.action;
        if (!action) return;

        const sid = Number(btn.dataset.sid || "0");
        if (!sid) return;

        try {
          if (action === "inc") {
            const cur = Number(selectedQty.get(sid) || 0);
            await setQuantity(sid, cur + 1);
            render();
            return;
          }

          if (action === "dec") {
            const cur = Number(selectedQty.get(sid) || 0);
            await setQuantity(sid, cur - 1);
            render();
            return;
          }

          if (action === "toggle") {
            const cur = Number(selectedQty.get(sid) || 0);
            await setQuantity(sid, cur > 0 ? 0 : 1);
            render();
            return;
          }
        } catch (err) {
          console.error(err);
          showToast(err.message || "Failed to update service", false);

          try {
            await loadTicketServices();
            render();
          } catch {}
        }
      });

      /************************************************************
       * NAV: Skip / Continue  (FIXED)
       ************************************************************/
      async function goToPayment() {
        // ? flight total from FlightDetails.html
        const flightTotal = readFlightTotalFromFlightDetails();
        if (!flightTotal || flightTotal <= 0) {
          throw new Error(
            "flightTotal is missing. Go back to Flight Details then open Services again.",
          );
        }

        // services total
        const servicesTotal = computeServicesTotalNow();

        // seats total (optional)
        const seatsTotal = readSeatsTotal();

        // grand total
        const grandTotal = flightTotal + servicesTotal + seatsTotal;

        sessionStorage.setItem("flightTotal", String(flightTotal));
        sessionStorage.setItem("servicesTotal", String(servicesTotal));
        sessionStorage.setItem("seatsTotal", String(seatsTotal));
        sessionStorage.setItem("grandTotal", String(grandTotal));

        const currency = (
          sessionStorage.getItem("currency") || "jod"
        ).toLowerCase();

        window.location.href = `Payment.html?bookId=${encodeURIComponent(
          bookId || "",
        )}&ticketId=${encodeURIComponent(ticketId || "")}&amount=${encodeURIComponent(
          grandTotal,
        )}&currency=${encodeURIComponent(currency)}`;
      }

      $("skipBtn").addEventListener("click", async () => {
        try {
          await goToPayment();
        } catch (e) {
          console.error(e);
          showToast(e.message || "Failed to calculate total", false);
        }
      });

      $("continueBtn").addEventListener("click", async () => {
        try {
          await goToPayment();
        } catch (e) {
          console.error(e);
          showToast(e.message || "Failed to calculate total", false);
        }
      });

      /************************************************************
       * INIT
       ************************************************************/
      loadAll().catch((e) => {
        console.error(e);
        showToast(e.message || "Failed to load services", false);
      });
    