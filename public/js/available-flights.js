
      function safeJsonParse(v, fallback) {
        try {
          return JSON.parse(v);
        } catch {
          return fallback;
        }
      }

      const endpointUsed = sessionStorage.getItem("endpointUsed") || "";
      const payload = safeJsonParse(
        sessionStorage.getItem("searchPayload") || "null",
        null,
      );
      const rawResults = safeJsonParse(
        sessionStorage.getItem("searchResults") || "null",
        null,
      );

      const paxCount =
        Number(sessionStorage.getItem("totalPassengers") || "1") || 1;
      const classFee =
        Number(sessionStorage.getItem("selectedClassFee") || "0") || 0;
      const className = sessionStorage.getItem("selectedClassName") || "—";

      const listEl = document.getElementById("list");
      const emptyEl = document.getElementById("empty");
      const subtitleEl = document.getElementById("subtitle");
      const pillInfo = document.getElementById("pillInfo");
      const summaryEl = document.getElementById("summary");

      function inferTripTypeFromEndpoint(ep) {
        const s = String(ep || "").toLowerCase();
        if (s.includes("/multicity")) return "MultiCity";
        if (s.includes("/roundtrip")) return "RoundTrip";
        if (s.includes("/oneway")) return "OneWay";
        return "Unknown";
      }

      function fmtDateLike(v) {
        if (!v) return "—";
        const s = String(v);
        return s.includes("T") ? s.split("T")[0] : s;
      }

      function fmtTimeLike(v) {
        if (!v) return "—";
        const s = String(v);
        if (s.includes("T")) return (s.split("T")[1] || "").slice(0, 5) || s;
        return s.slice(0, 5);
      }

      function money(v) {
        const n = Number(v);
        if (Number.isNaN(n)) return "—";
        return n.toFixed(2);
      }

      function normalizeResults(r) {
        const base = r?.data ?? r?.result ?? r;

        // ✅ expected: { tripType, itineraries }
        const itArr = base?.itineraries ?? base?.Itineraries ?? null;
        const tt = base?.tripType ?? base?.TripType ?? null;

        if (Array.isArray(itArr)) {
          return {
            tripType: tt || inferTripTypeFromEndpoint(endpointUsed),
            itineraries: itArr,
          };
        }

        // if stored itineraries only
        if (
          Array.isArray(base) &&
          (base.length === 0 ||
            (base[0] && (base[0].segments || base[0].Segments)))
        ) {
          return {
            tripType: inferTripTypeFromEndpoint(endpointUsed),
            itineraries: base.map((x) => ({
              totalPrice: x.totalPrice ?? x.TotalPrice ?? 0,
              segments: x.segments ?? x.Segments ?? [],
            })),
          };
        }

        // fallback
        return {
          tripType: inferTripTypeFromEndpoint(endpointUsed),
          itineraries: [],
        };
      }

      function computeTotal(it) {
        if (it.totalPrice != null) return Number(it.totalPrice) || 0;
        const segs = Array.isArray(it.segments) ? it.segments : [];
        const baseSum = segs.reduce(
          (sum, s) => sum + (Number(s.basePrice) || 0),
          0,
        );
        return (baseSum + classFee * segs.length) * paxCount;
      }

      function itineraryTemplate(it, index) {
        const segs = (it.segments ?? it.Segments ?? []).map((s) => ({
          flightScheduleId: s.flightScheduleId ?? s.FlightScheduleId ?? null,
          from: s.from ?? s.From ?? "—",
          to: s.to ?? s.To ?? "—",
          date: s.date ?? s.flightDate ?? s.FlightDate ?? "",
          basePrice: s.basePrice ?? s.BasePrice ?? 0,
          departureTime: s.departureTime ?? s.DepartureTime ?? "",
          arrivalTime: s.arrivalTime ?? s.ArrivalTime ?? "",
        }));

        const total = computeTotal({ ...it, segments: segs });
        const start = segs[0];
        const end = segs[segs.length - 1];
        const route = start && end ? `${start.from} → ${end.to}` : "—";

        const segmentsHtml = segs
          .map(
            (s) => `
          <div class="m">
            <b>${s.from} → ${s.to}</b>
            <small>${fmtDateLike(s.date)} • ${fmtTimeLike(s.departureTime)} → ${fmtTimeLike(s.arrivalTime)} • Base: ${money(s.basePrice)}</small>
          </div>
        `,
          )
          .join("");

        return `
          <div class="flight">
            <div class="f-top">
              <div>
                <div class="route"><span class="dot"></span><span>${route}</span></div>
                <div class="sub">${segs.length} segment(s)</div>
              </div>

              <div class="price">
                <strong>${money(total)}</strong>
                <span>Total itinerary price</span>
              </div>
            </div>

            <div class="meta">${segmentsHtml}</div>

            <div class="actions">
              <button class="btn" data-act="details" data-i="${index}">Details</button>
              <button class="btn primary" data-act="select" data-i="${index}">Select</button>
            </div>
          </div>
        `;
      }

      function buildSummary(tripType, count) {
        const rows = [
          ["Trip Type", tripType],
          ["Passengers", String(paxCount)],
          ["Class", `${className} (+${money(classFee)}) / pax`],
          ["Endpoint", endpointUsed || "—"],
          ["Payload", payload ? "Stored in sessionStorage" : "—"],
        ];

        summaryEl.innerHTML = rows
          .map(
            ([k, v]) =>
              `<div class="row"><span>${k}</span><span>${v}</span></div>`,
          )
          .join("");
        pillInfo.textContent = `${count} option(s) • ${paxCount} pax • ${className}`;
        subtitleEl.textContent = `Trip: ${tripType} • Using: ${endpointUsed || "—"}`;
      }

      function showDetails(obj) {
        const pretty = JSON.stringify(obj, null, 2);
        alert(
          pretty.length > 1200
            ? pretty.slice(0, 1200) + "\n...\n(Truncated)"
            : pretty,
        );
      }

      function onSelectItinerary(it) {
        const segs = it.segments ?? it.Segments ?? [];
        const ids = segs
          .map((s) => s.flightScheduleId ?? s.FlightScheduleId ?? null)
          .filter((x) => x != null);

        sessionStorage.setItem("selectedItinerary", JSON.stringify(it));
        sessionStorage.setItem(
          "selectedFlightScheduleIds",
          JSON.stringify(ids),
        );

        window.location.assign("FlightDetails.html");
      }

      function render() {
        const normalized = normalizeResults(rawResults);
        const tripType = normalized.tripType || "Unknown";
        const itineraries = normalized.itineraries || [];

        buildSummary(tripType, itineraries.length);

        if (!itineraries.length) {
          listEl.innerHTML = "";
          emptyEl.style.display = "block";
          return;
        }

        emptyEl.style.display = "none";
        listEl.innerHTML = itineraries
          .map((it, i) => itineraryTemplate(it, i))
          .join("");

        listEl.addEventListener("click", (e) => {
          const btn = e.target.closest("button[data-act]");
          if (!btn) return;
          const i = Number(btn.getAttribute("data-i"));
          const it = itineraries[i];
          if (!it) return;
          const act = btn.getAttribute("data-act");
          if (act === "details") showDetails(it);
          if (act === "select") onSelectItinerary(it);
        });
      }

      render();

      document
        .getElementById("backBtn")
        .addEventListener("click", () => history.back());
      document.getElementById("clearBtn").addEventListener("click", () => {
        sessionStorage.removeItem("searchResults");
        sessionStorage.removeItem("searchPayload");
        sessionStorage.removeItem("endpointUsed");
        sessionStorage.removeItem("selectedItinerary");
        sessionStorage.removeItem("selectedFlightScheduleIds");
        location.reload();
      });
    