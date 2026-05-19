
      // ===============================
      // CONFIG
      // ===============================
      const API_BASE =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

      const BOOKING_TEMP_ID =
        localStorage.getItem("bookingTempId") ||
        localStorage.getItem("BookingTempId") ||
        sessionStorage.getItem("bookingTempId") ||
        "TMP-001";

      const ENDPOINT = {
        summary: (id) =>
          `${API_BASE}/api/Bookings/${encodeURIComponent(id)}/summary`,
        seats: (id) =>
          `${API_BASE}/api/Bookings/${encodeURIComponent(id)}/seats`,
        hold: (id) =>
          `${API_BASE}/api/Bookings/${encodeURIComponent(id)}/seats/hold`,
        confirm: (id) =>
          `${API_BASE}/api/Bookings/${encodeURIComponent(id)}/seats/confirm`,
        passengersSeats: (id) =>
          `${API_BASE}/api/Bookings/${encodeURIComponent(id)}/passengers/seats`,
        assign: (id) =>
          `${API_BASE}/api/Bookings/${encodeURIComponent(id)}/seats/assign`,
      };

      // ===============================
      // PRICING (?????? ??? ??????)
      // ===============================
      // 1) ??? ???? ????? ????? ??? SeatId (????)
      const SEAT_PRICE_BY_ID = {
        // ????:
        // 1: 5,
        // 2: 5,
        // 3: 5,
        // 4: 0,
      };

      // 2) ??? ?? ???? ??? ??? ????: Premium rows <= 3 ????? ???
      const PREMIUM_ROWS_MAX = 3;
      const PREMIUM_PRICE = 10; // JOD (??????)
      const NORMAL_PRICE = 0; // JOD

      function seatPriceByRule(seatCode) {
        // seatCode ??? "2B"
        const m = String(seatCode || "").match(/^(\d+)[A-Z]$/i);
        const row = m ? Number(m[1]) : 999;
        return row <= PREMIUM_ROWS_MAX ? PREMIUM_PRICE : NORMAL_PRICE;
      }

      // ===============================
      // HELPERS
      // ===============================
      const $ = (id) => document.getElementById(id);

      function toast(msg, ok = true) {
        const t = $("toast");
        t.textContent = msg;
        t.style.background = ok
          ? "rgba(20,20,20,0.92)"
          : "rgba(160,30,30,0.92)";
        t.className = "toast show";
        clearTimeout(toast._tm);
        toast._tm = setTimeout(() => (t.className = "toast"), 2400);
      }

      function getToken() {
        return localStorage.getItem("auth_token") || "";
      }

      function moneyJOD(n) {
        const x = Number(n);
        if (!Number.isFinite(x)) return "0.00 JOD";
        return x.toFixed(2) + " JOD";
      }

      async function apiFetch(url, opts = {}) {
        const token = getToken();
        const headers = { ...(opts.headers || {}) };

        // ???: ??? ?? Content-Type ??? ???? JSON
        if (opts.body != null && !(opts.body instanceof FormData)) {
          headers["Content-Type"] = "application/json";
        }

        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(url, { ...opts, headers });

        let data = null;
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          data = await res.json().catch(() => null);
        } else {
          const text = await res.text().catch(() => "");
          data = text ? { text } : null;
        }

        if (!res.ok) {
          const detail =
            data?.detail ||
            data?.message ||
            data?.text ||
            res.statusText ||
            "Error";
          const err = new Error(detail);
          err.status = res.status;
          err.body = data;
          throw err;
        }
        return data;
      }

      // ===============================
      // Seat layout (UI Map)
      // ===============================
      const layout = (() => {
        const rows = [];
        for (let r = 1; r <= 20; r++) {
          rows.push({
            row: r,
            left: [
              { code: `${r}A`, seatId: null, premium: r <= PREMIUM_ROWS_MAX },
              { code: `${r}B`, seatId: null, premium: r <= PREMIUM_ROWS_MAX },
              { code: `${r}C`, seatId: null, premium: r <= PREMIUM_ROWS_MAX },
            ],
            right: [
              { code: `${r}D`, seatId: null, premium: r <= PREMIUM_ROWS_MAX },
              { code: `${r}E`, seatId: null, premium: r <= PREMIUM_ROWS_MAX },
              { code: `${r}F`, seatId: null, premium: r <= PREMIUM_ROWS_MAX },
            ],
          });
        }

        // ? ???? ??? SeatId ??????? ???? (?????? ??? ???? ???? ?? ???????)
        const known = {
          "1A": 1,
          "1B": 2,
          "1C": 3,
          "2A": 4,
          "2B": 5,
          "2C": 6,
        };

        for (const row of rows) {
          for (const s of [...row.left, ...row.right]) {
            if (known[s.code]) s.seatId = known[s.code];
          }
        }
        return rows;
      })();

      // ===============================
      // State
      // ===============================
      let bookingSummary = null;
      let selectedSeatIds = new Set();
      let selectedSeatCodes = new Map(); // seatId -> code
      let takenSeatCodes = new Set(); // (??? ?????? ??? ???? API ?????? seats taken)

      // ===============================
      // PRICING CALC + STORAGE ?
      // ===============================
      function getSeatPrice(seatId, seatCode) {
        // 1) explicit by ID
        const byId = Number(SEAT_PRICE_BY_ID[seatId]);
        if (Number.isFinite(byId) && byId > 0) return byId;

        // 2) by rule from code
        return seatPriceByRule(seatCode);
      }

      function computeSeatsTotal() {
        let total = 0;
        const details = [];

        for (const seatId of selectedSeatIds) {
          const code =
            selectedSeatCodes.get(seatId) || findSeatCodeById(seatId) || "";
          const price = getSeatPrice(seatId, code);
          total += price;
          details.push({ seatId, code, price });
        }

        // ? ?????? ???? Payment ??????
        sessionStorage.setItem("seatsTotal", String(Number(total.toFixed(2))));
        sessionStorage.setItem("selectedSeats", JSON.stringify(details));

        return { total, details };
      }

      // ===============================
      // UI render
      // ===============================
      function updateHint() {
        if (!bookingSummary) return;

        const { total } = computeSeatsTotal();

        const remaining = Math.max(
          0,
          bookingSummary.expectedPassengers - selectedSeatIds.size,
        );

        $("hint").textContent =
          remaining > 0
            ? `Please select ${remaining} more seat${remaining === 1 ? "" : "s"} • Seats Total: ${moneyJOD(total)}`
            : `Seats selection complete ? • Seats Total: ${moneyJOD(total)}`;

        $("sub").textContent =
          `BookingTempId: ${BOOKING_TEMP_ID} • Cabin: ${bookingSummary.cabinClass} • FlightSchedule: ${bookingSummary.flightScheduleId}`;

        $("selectedCount").textContent = `${selectedSeatIds.size} selected`;

        const btn = $("confirmBtn");
        btn.disabled =
          selectedSeatIds.size !== bookingSummary.expectedPassengers;

        btn.textContent = `Confirm (${selectedSeatIds.size} selected) • ${moneyJOD(total)}`;
      }

      function seatClass(seat) {
        if (!seat.seatId) return "seat blank";
        const isSelected = selectedSeatIds.has(seat.seatId);
        const isTaken = takenSeatCodes.has(seat.code);
        const premium = seat.premium;

        let cls = "seat";
        if (premium) cls += " premium";
        if (isTaken) cls += " taken";
        if (isSelected) cls += " selected";
        return cls;
      }

      function renderSeats() {
        const rowsEl = $("rows");
        rowsEl.innerHTML = "";

        // assign dropdown
        const ddl = $("assignSeatCode");
        ddl.innerHTML = "";
        for (const [seatId, code] of selectedSeatCodes.entries()) {
          const opt = document.createElement("option");
          opt.value = String(seatId);
          opt.textContent = `${code} (SeatId ${seatId})`;
          ddl.appendChild(opt);
        }
        if (!ddl.options.length) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "Select seats first…";
          ddl.appendChild(opt);
        }

        for (const r of layout) {
          const leftNum = document.createElement("div");
          leftNum.className = "rnum";
          leftNum.textContent = r.row;

          const leftBlock = document.createElement("div");
          leftBlock.className = "block";
          r.left.forEach((s) => leftBlock.appendChild(makeSeatEl(s)));

          const aisle = document.createElement("div");
          aisle.className = "aisle";

          const rightBlock = document.createElement("div");
          rightBlock.className = "block";
          r.right.forEach((s) => rightBlock.appendChild(makeSeatEl(s)));

          const rightNum = document.createElement("div");
          rightNum.className = "rnum";
          rightNum.textContent = r.row;

          rowsEl.appendChild(leftNum);
          rowsEl.appendChild(leftBlock);
          rowsEl.appendChild(aisle);
          rowsEl.appendChild(rightBlock);
          rowsEl.appendChild(rightNum);
        }

        updateHint();
      }

      function makeSeatEl(seat) {
        const el = document.createElement("div");
        el.className = seatClass(seat);

        if (seat.seatId) {
          const price = getSeatPrice(seat.seatId, seat.code);
          el.title = `${seat.code} (SeatId ${seat.seatId}) • ${moneyJOD(price)}`;
        } else {
          el.title = seat.code;
        }

        if (!seat.seatId) return el;

        el.addEventListener("click", async () => {
          if (!bookingSummary) return;
          if (takenSeatCodes.has(seat.code)) return;

          const isSelected = selectedSeatIds.has(seat.seatId);

          if (!isSelected) {
            if (selectedSeatIds.size >= bookingSummary.expectedPassengers) {
              toast("You already selected enough seats.", false);
              return;
            }
            await holdSeat(seat.seatId, seat.code);
          } else {
            await unholdSeat(seat.seatId);
          }

          renderSeats();
        });

        return el;
      }

      // ===============================
      // API calls
      // ===============================
      async function loadSummary() {
        const data = await apiFetch(ENDPOINT.summary(BOOKING_TEMP_ID), {
          method: "GET",
        });
        bookingSummary = {
          bookingTempId: data.bookingTempId,
          expectedPassengers: Number(data.expectedPassengers || 0),
          flightScheduleId: Number(data.flightScheduleId || 0),
          cabinClass: data.cabinClass || "",
        };
      }

      async function loadSelectedSeats() {
        const data = await apiFetch(ENDPOINT.seats(BOOKING_TEMP_ID), {
          method: "GET",
        });

        selectedSeatIds = new Set(
          Array.isArray(data.seatIds) ? data.seatIds : [],
        );
        selectedSeatCodes = new Map();

        if (Array.isArray(data.seatIds) && Array.isArray(data.seatCodes)) {
          for (let i = 0; i < data.seatIds.length; i++) {
            selectedSeatCodes.set(data.seatIds[i], data.seatCodes[i]);
          }
        } else {
          // fallback: ???? ????? ????? ?? layout
          for (const id of selectedSeatIds) {
            const c = findSeatCodeById(id);
            if (c) selectedSeatCodes.set(id, c);
          }
        }

        // ? ???? ???????
        computeSeatsTotal();
      }

      async function holdSeat(seatId, seatCode) {
        const payload = {
          flightScheduleId: bookingSummary.flightScheduleId,
          seatIds: [seatId],
        };

        const data = await apiFetch(ENDPOINT.hold(BOOKING_TEMP_ID), {
          method: "POST",
          body: JSON.stringify(payload),
        });

        selectedSeatIds.add(seatId);
        if (seatCode) selectedSeatCodes.set(seatId, seatCode);

        computeSeatsTotal();
        toast(`Seat held ? (expires: ${data.expiresAt || "—"})`);
      }

      async function unholdSeat(seatId) {
        const payload = { seatIds: [seatId] };

        await apiFetch(ENDPOINT.hold(BOOKING_TEMP_ID), {
          method: "DELETE",
          body: JSON.stringify(payload),
        });

        selectedSeatIds.delete(seatId);
        selectedSeatCodes.delete(seatId);

        computeSeatsTotal();
        toast("Seat released ?");
      }

      async function confirmSeats() {
        const payload = { flightScheduleId: bookingSummary.flightScheduleId };

        await apiFetch(ENDPOINT.confirm(BOOKING_TEMP_ID), {
          method: "POST",
          body: JSON.stringify(payload),
        });

        // ? ????? ?? refresh ?? ???? totals
        await loadSelectedSeats();
        await loadPassengersSeats();
        computeSeatsTotal();

        toast("Seats confirmed ?");
      }

      async function loadPassengersSeats() {
        const box = $("passSeats");
        try {
          const data = await apiFetch(
            ENDPOINT.passengersSeats(BOOKING_TEMP_ID),
            {
              method: "GET",
            },
          );

          if (!data?.items?.length) {
            box.textContent = "No assigned seats yet.";
            return;
          }

          box.innerHTML = data.items
            .map(
              (x) =>
                `PassengerID <b>${x.passengerId}</b> (PersonID ${x.personId}) ? Seat <b>${x.seatCode}</b> (SeatId ${x.seatId})`,
            )
            .join("<br/>");
        } catch {
          box.textContent = "—";
        }
      }

      async function assignSeatManual() {
        const passengerId = parseInt($("assignPassengerId").value || "0", 10);
        const seatId = parseInt($("assignSeatCode").value || "0", 10);

        if (!passengerId || !seatId) {
          toast("Enter PassengerId and pick a seat.", false);
          return;
        }

        const payload = {
          flightScheduleId: bookingSummary.flightScheduleId,
          assignments: [{ seatId, passengerId }],
        };

        await apiFetch(ENDPOINT.assign(BOOKING_TEMP_ID), {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        toast("Assigned ?");
        await loadPassengersSeats();
      }

      function findSeatCodeById(seatId) {
        for (const r of layout) {
          for (const s of [...r.left, ...r.right]) {
            if (s.seatId === seatId) return s.code;
          }
        }
        return null;
      }

      // ===============================
      // Init
      // ===============================
      async function init() {
        try {
          $("hint").textContent = "Loading booking summary…";
          await loadSummary();
          await loadSelectedSeats();
          await loadPassengersSeats();
          renderSeats();
        } catch (e) {
          toast(e.message || "Failed to load", false);
          $("hint").textContent = "Failed to load SeatMap.";
        }
      }

      $("confirmBtn").addEventListener("click", async () => {
        try {
          await confirmSeats();

          // ? ??? confirm (???????): ???? ??? Passenger Info ??????
          // ??? ??? ??????? ??? ???????:
          // const bookId = sessionStorage.getItem("bookId") || "";
          // window.location.href = `Doc.html?bookId=${encodeURIComponent(bookId)}`;

          renderSeats();
        } catch (e) {
          toast(e.message || "Confirm failed", false);
        }
      });

      $("assignBtn").addEventListener("click", async () => {
        try {
          await assignSeatManual();
        } catch (e) {
          toast(e.message || "Assign failed", false);
        }
      });

      init();
    