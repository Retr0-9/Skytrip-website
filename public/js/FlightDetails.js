
        /************************************************************
         * CONFIG
         ************************************************************/
        const API_BASE_URL =
          sessionStorage.getItem("API_BASE_URL") ||
          "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

        const ENDPOINTS = {
          flightDetails: (id) => `/api/FlightSchedules/${id}`,
          passengerClassById: (id) => `/api/PassengerClass/${id}`,
          clientByPerson: (personId) => `/api/Client/ByPerson/${personId}`,
          createBookingTrip: "/api/BookingTrip",
          getTicketByBooking: (bookId) =>
            `/api/InfoTickets/ByBooking/${bookId}`,
          createTicket: "/api/InfoTickets",
          createTicketFlight: "/api/TicketFlights",
        };

        /************************************************************
         * AUTH + HELPERS
         ************************************************************/
        const $ = (id) => document.getElementById(id);

        function getAuthHeaders() {
          const token = localStorage.getItem("auth_token");
          return token ? { Authorization: "Bearer " + token } : {};
        }

        function qs(name) {
          return new URLSearchParams(window.location.search).get(name);
        }

        function safeJsonParse(v, fallback) {
          try {
            return JSON.parse(v);
          } catch {
            return fallback;
          }
        }

        function showError(msg) {
          const box = $("errorBox");
          box.textContent = msg;
          box.style.display = "block";
          $("statusMsg").textContent = "Failed to load.";
        }

        function showBookError(msg) {
          const p = $("bookErr");
          p.textContent = msg;
          p.style.display = "block";
        }

        function setStatus(msg) {
          $("statusMsg").textContent = msg;
        }

        function extractId(obj, keys) {
          for (const k of keys) {
            const v = obj?.[k];
            if (v != null && Number(v) > 0) return Number(v);
          }
          return null;
        }

        function pick(obj, ...keys) {
          for (const k of keys) {
            const v = obj?.[k];
            if (v !== undefined && v !== null && String(v).trim() !== "")
              return v;
          }
          return null;
        }

        // (???????) mapping ?????? ?????/????? — ????? ??? ?? ?? ?????? ??????
        const CITY_NAME_MAP = {
          AMM: "AMM",
          UK: "UK",
          KSA: "KSA",
          USA: "USA",
        };
        function cityLabel(code) {
          const c = String(code || "").trim();
          return CITY_NAME_MAP[c] || c || "—";
        }

        /************************************************************
         * API GET/POST
         ************************************************************/
        async function apiGet(path) {
          const res = await fetch(API_BASE_URL + path, {
            headers: { Accept: "application/json", ...getAuthHeaders() },
          });

          const ct = (res.headers.get("content-type") || "").toLowerCase();
          const data = ct.includes("application/json")
            ? await res.json().catch(() => null)
            : await res.text().catch(() => null);

          if (!res.ok) {
            const msg =
              data?.detail ||
              data?.message ||
              data?.title ||
              (typeof data === "string" ? data : "") ||
              res.statusText;
            throw new Error(`GET ${path} -> ${res.status} - ${msg}`);
          }
          return data ?? {};
        }

        async function apiPost(path, body) {
          const res = await fetch(API_BASE_URL + path, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify(body),
          });

          const ct = (res.headers.get("content-type") || "").toLowerCase();
          const data = ct.includes("application/json")
            ? await res.json().catch(() => null)
            : await res.text().catch(() => null);

          if (!res.ok) {
            const msg =
              data?.detail ||
              data?.message ||
              data?.title ||
              (typeof data === "string" ? data : "") ||
              res.statusText;
            throw new Error(`POST ${path} -> ${res.status} - ${msg}`);
          }

          return { data: data ?? {}, res };
        }

        /************************************************************
         * FORMATTERS
         ************************************************************/
        function formatTime(t) {
          if (!t) return "--:--";
          const s = String(t);
          const hhmm = s.includes("T") ? s.split("T")[1] : s;
          const [hh, mm] = hhmm.split(":");
          const h = Number(hh);
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = ((h + 11) % 12) + 1;
          return `${String(h12).padStart(2, "0")}:${String(mm).padStart(
            2,
            "0",
          )} ${ampm}`;
        }

        function calcDuration(dep, arr) {
          if (!dep || !arr) return "--";
          const [dh, dm] = String(dep).split(":").map(Number);
          const [ah, am] = String(arr).split(":").map(Number);

          let depMin = dh * 60 + dm;
          let arrMin = ah * 60 + am;
          if (arrMin < depMin) arrMin += 24 * 60;

          const diff = arrMin - depMin;
          const h = Math.floor(diff / 60);
          const m = diff % 60;
          return `${h}h ${String(m).padStart(2, "0")}m`;
        }

        function fmtMoneyJOD(n) {
          const num = Number(n);
          if (Number.isNaN(num)) return "--";
          return num.toFixed(2) + " JOD";
        }

        function fmtDateLike(v) {
          if (!v) return "—";
          const s = String(v);
          return s.includes("T") ? s.split("T")[0] : s;
        }

        /************************************************************
         * READ ITINERARY (supports oneway/round/multi)
         ************************************************************/
        function readSelectedItinerary() {
          const it = safeJsonParse(
            sessionStorage.getItem("selectedItinerary"),
            null,
          );
          if (it && Array.isArray(it.segments)) return it;

          const f = safeJsonParse(
            sessionStorage.getItem("selectedFlight"),
            null,
          );
          if (f) {
            return {
              totalPrice: null,
              segments: [
                {
                  flightScheduleId:
                    f.flightScheduleId ??
                    f.FlightScheduleId ??
                    f.flightScheduleID ??
                    f.FlightScheduleID ??
                    f.id ??
                    f.ID ??
                    Number(qs("id")) ??
                    null,

                  from: pick(
                    f,
                    "from",
                    "From",
                    "departureCity",
                    "DepartureCity",
                  ),
                  to: pick(f, "to", "To", "arrivalCity", "ArrivalCity"),
                  date: pick(f, "date", "Date", "flightDate", "FlightDate"),
                  basePrice: pick(f, "basePrice", "BasePrice"),
                  departureTime: pick(f, "departureTime", "DepartureTime"),
                  arrivalTime: pick(f, "arrivalTime", "ArrivalTime"),
                },
              ],
            };
          }

          const id = Number(qs("id") || "0") || null;
          if (id)
            return { totalPrice: null, segments: [{ flightScheduleId: id }] };

          return null;
        }

        function segId(seg) {
          return (
            seg.flightScheduleId ??
            seg.FlightScheduleId ??
            seg.flightScheduleID ??
            seg.FlightScheduleID ??
            seg.id ??
            seg.ID ??
            null
          );
        }

        /************************************************************
         * Load schedule objects for all segments (fix undefined)
         ************************************************************/
        async function loadSchedulesForSegments(segments) {
          const loaded = [];

          for (const seg of segments) {
            const id = segId(seg);
            if (!id) continue;

            const depCity = pick(
              seg,
              "departureCity",
              "DepartureCity",
              "from",
              "From",
            );
            const arrCity = pick(seg, "arrivalCity", "ArrivalCity", "to", "To");
            const depTime = pick(seg, "departureTime", "DepartureTime");
            const arrTime = pick(seg, "arrivalTime", "ArrivalTime");
            const date = pick(seg, "flightDate", "FlightDate", "date", "Date");
            const base = pick(seg, "basePrice", "BasePrice");

            const hasDetails = depCity || arrCity || depTime || arrTime || base;

            if (hasDetails) {
              loaded.push({
                flightScheduleId: Number(id),
                departureCity: cityLabel(depCity ?? "—"),
                arrivalCity: cityLabel(arrCity ?? "—"),
                departureTime: depTime ?? "—",
                arrivalTime: arrTime ?? "—",
                flightDate: date ?? null,
                basePrice: Number(base) || 0,
              });
              continue;
            }

            const fs = await apiGet(ENDPOINTS.flightDetails(id));

            loaded.push({
              flightScheduleId: Number(id),
              departureCity: cityLabel(
                pick(fs, "departureCity", "DepartureCity") ?? "—",
              ),
              arrivalCity: cityLabel(
                pick(fs, "arrivalCity", "ArrivalCity") ?? "—",
              ),
              departureTime: pick(fs, "departureTime", "DepartureTime") ?? "—",
              arrivalTime: pick(fs, "arrivalTime", "ArrivalTime") ?? "—",
              flightDate: pick(fs, "flightDate", "FlightDate") ?? null,
              basePrice: Number(pick(fs, "basePrice", "BasePrice")) || 0,
            });
          }

          return loaded;
        }

        /************************************************************
         * UI RENDER
         ************************************************************/
        function renderHeader(tripType, schedules) {
          $("airlineName").textContent = "Sky Trip Airlines";
          $("airlineSub").textContent = `Trip Type: ${tripType || "—"}`;

          const n = schedules.length;
          const first = schedules[0];
          const last = schedules[n - 1];

          const route =
            n > 0
              ? `${first.departureCity ?? "—"} ? ${last.arrivalCity ?? "—"}`
              : "—";
          $("flightNo").textContent = `${route} • ${n} segment(s)`;

          if (first) {
            $("depTime").textContent = formatTime(first.departureTime);
            $("depCity").textContent = `${first.departureCity} - Departure`;
            $("arrTime").textContent = formatTime(first.arrivalTime);
            $("arrCity").textContent = `${first.arrivalCity} - Arrival`;
            $("duration").textContent = calcDuration(
              first.departureTime,
              first.arrivalTime,
            );
          }

          $("cabinKg").textContent = "7 kg";
          $("checkedKg").textContent = "23 kg";
        }

        function renderSegmentsList(tripType, schedules) {
          const host = $("segmentsHost");
          host.innerHTML = "";

          schedules.forEach((s, idx) => {
            let label = "Segment";
            const t = String(tripType || "").toLowerCase();
            if (t.includes("round")) label = idx === 0 ? "Outbound" : "Return";
            else if (t.includes("multi")) label = `Leg ${idx + 1}`;

            const date = fmtDateLike(s.flightDate);

            const el = document.createElement("div");
            el.className = "seg";
            el.innerHTML = `
        <div class="seg-top">
          <div>
            <strong>${label}: ${s.departureCity ?? "—"} ? ${s.arrivalCity ?? "—"}</strong>
            <small>
              ${date} • ${String(s.departureTime || "--").slice(0, 5)} ? ${String(
                s.arrivalTime || "--",
              ).slice(0, 5)} • Base: ${fmtMoneyJOD(s.basePrice || 0)}
            </small>
          </div>
          <div class="seg-actions">
            <button class="chip primary" data-act="focus" data-idx="${idx}">Focus</button>
          </div>
        </div>
      `;
            host.appendChild(el);
          });

          host.onclick = (e) => {
            const btn = e.target.closest("button[data-act]");
            if (!btn) return;

            const act = btn.getAttribute("data-act");
            const idx = Number(btn.getAttribute("data-idx"));
            const s = schedules[idx];
            if (!s) return;

            if (act === "seat") {
              window.location.href =
                "SeatMap.html?id=" +
                encodeURIComponent(String(s.flightScheduleId));
            }

            if (act === "focus") {
              $("depTime").textContent = formatTime(s.departureTime);
              $("depCity").textContent = `${s.departureCity} - Departure`;
              $("arrTime").textContent = formatTime(s.arrivalTime);
              $("arrCity").textContent = `${s.arrivalCity} - Arrival`;
              $("duration").textContent = calcDuration(
                s.departureTime,
                s.arrivalTime,
              );
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          };
        }

        /************************************************************
         * Pricing (Base vs PassengerClass Fee)
         ************************************************************/
        async function getPassengerClassFee(passengerClassID) {
          if (!passengerClassID || passengerClassID < 1) return 0;
          const pc = await apiGet(
            ENDPOINTS.passengerClassById(passengerClassID),
          );
          return (
            Number(
              pc?.feesClass ??
                pc?.FeesClass ??
                pc?.feeClass ??
                pc?.FeeClass ??
                pc?.fees ??
                pc?.Fees ??
                0,
            ) || 0
          );
        }

        async function renderPriceForItinerary(itinerary, schedules) {
          const pax =
            Number(sessionStorage.getItem("totalPassengers") || "1") || 1;
          const passengerClassID =
            Number(sessionStorage.getItem("passengerClassID") || "0") || 0;

          const classFeePerPax = await getPassengerClassFee(passengerClassID);

          const basePerPaxSum = schedules.reduce(
            (acc, s) => acc + (Number(s.basePrice) || 0),
            0,
          );

          const baseTotal = basePerPaxSum * pax;
          const classTotal = classFeePerPax * pax;

          // ? total ????? ????? ????? totalPrice ?? API
          const total = baseTotal + classTotal;

          $("baseFare").textContent = fmtMoneyJOD(baseTotal);
          $("taxes").textContent = fmtMoneyJOD(classTotal);
          $("total").textContent = fmtMoneyJOD(total);

          // ? ????? ??? ?????? ???? label ???? ????? HTML
          const className = sessionStorage.getItem("selectedClassName") || "—";
          const taxesRowLabel =
            $("taxes")?.parentElement?.querySelector("span");
          if (taxesRowLabel)
            taxesRowLabel.textContent = `Class Fees (${className})`;

          sessionStorage.setItem("flightTotal", String(total));
          sessionStorage.setItem("currency", "jod");
        }

        /************************************************************
         * ClientID ensure
         ************************************************************/
        async function ensureClientId() {
          const existing = Number(localStorage.getItem("clientID") || "0") || 0;
          if (existing > 0) return existing;

          const personID =
            Number(
              localStorage.getItem("personID") ||
                localStorage.getItem("personId") ||
                localStorage.getItem("PersonID") ||
                "0",
            ) || 0;

          if (!personID)
            throw new Error("PersonID missing. Login again and try.");

          const c = await apiGet(ENDPOINTS.clientByPerson(personID));

          const clientID =
            Number(
              c?.clientId ?? c?.clientID ?? c?.ClientID ?? c?.id ?? c?.ID ?? 0,
            ) || 0;

          if (!clientID) {
            throw new Error(
              "Client not found for this PersonID (api/Client/ByPerson).",
            );
          }

          localStorage.setItem("clientID", String(clientID));

          const docId =
            Number(
              c?.documentationId ??
                c?.documentationID ??
                c?.DocumentationID ??
                0,
            ) || 0;
          if (docId) localStorage.setItem("documentationID", String(docId));

          return clientID;
        }

        /************************************************************
         * BookingTrip -> Ticket -> TicketFlights (ALL segments)
         ************************************************************/
        async function createBookingTrip() {
          const clientID = await ensureClientId();
          const tripTypeID =
            Number(sessionStorage.getItem("tripTypeID") || "1") || 1;

          const body = {
            clientID,
            tripTypeID: tripTypeID,
            tripType: tripTypeID,
            isActive: true,
            bookingDate: new Date().toISOString(),
          };

          const { data } = await apiPost(ENDPOINTS.createBookingTrip, body);

          const bookId = extractId(data, [
            "bookingTripID",
            "BookingTripID",
            "bookId",
            "bookID",
            "BookID",
            "id",
            "ID",
          ]);

          if (!bookId) {
            throw new Error(
              "BookingTrip created but BookingTripID not returned.",
            );
          }

          return bookId;
        }

        async function getOrCreateTicket(bookId) {
          try {
            const existing = await apiGet(ENDPOINTS.getTicketByBooking(bookId));
            if (Array.isArray(existing) && existing.length) {
              const tid = extractId(existing[0], [
                "ticketID",
                "TicketID",
                "ticketId",
                "TicketId",
                "id",
                "ID",
              ]);
              if (tid) return tid;
            } else if (existing && typeof existing === "object") {
              const tid = extractId(existing, [
                "ticketID",
                "TicketID",
                "ticketId",
                "TicketId",
                "id",
                "ID",
              ]);
              if (tid) return tid;
            }
          } catch {}

          const passengerClassID =
            Number(sessionStorage.getItem("passengerClassID") || "0") || 0;
          if (passengerClassID < 1) {
            throw new Error(
              "PassengerClassID missing. Go back and select class.",
            );
          }

          const passengersCount =
            Number(sessionStorage.getItem("totalPassengers") || "1") || 1;

          const body = {
            bookID: Number(bookId),
            passengerClassID,
            passengersCount,
            ticketPrice:
              Number(sessionStorage.getItem("flightTotal") || "0") || 0,
            isActive: true,
            createdAt: new Date().toISOString(),
          };

          const { data, res } = await apiPost(ENDPOINTS.createTicket, body);

          let ticketId = extractId(data, [
            "ticketID",
            "TicketID",
            "ticketId",
            "TicketId",
            "id",
            "ID",
          ]);

          if (!ticketId) {
            const loc =
              res.headers.get("Location") || res.headers.get("location") || "";
            const m = String(loc).match(/\/(\d+)\s*$/);
            if (m) ticketId = Number(m[1]);
          }

          if (!ticketId)
            throw new Error("Ticket created but TicketId not returned.");
          return ticketId;
        }

        // ? ??? ?????: FlightType ???? ???? Outbound / Return / Leg ...
        function computeFlightType(tripType, index) {
          const t = String(tripType || "").toLowerCase();

          if (t.includes("round")) {
            return index === 0 ? "Outbound" : "Return";
          }

          if (t.includes("multi")) {
            return "Leg";
          }

          return "Outbound";
        }

        async function linkTicketToAllFlights(ticketId, tripType, schedules) {
          for (let i = 0; i < schedules.length; i++) {
            const s = schedules[i];
            const flightType = computeFlightType(tripType, i);

            const body = {
              ticketID: Number(ticketId),
              ticketId: Number(ticketId),
              flightScheduleID: Number(s.flightScheduleId),
              flightScheduleId: Number(s.flightScheduleId),
              flightType: flightType,
              FlightType: flightType,
            };

            await apiPost(ENDPOINTS.createTicketFlight, body);
          }
        }

        /************************************************************
         * MAIN LOAD
         ************************************************************/
        let ctx = {
          tripType: sessionStorage.getItem("tripType") || "OneWay",
          itinerary: null,
          schedules: [],
        };

        async function load() {
          setStatus("Loading selection...");
          try {
            const itinerary = readSelectedItinerary();
            if (!itinerary) {
              setStatus("No selection found. Go back and choose a flight.");
              return;
            }

            ctx.itinerary = itinerary;

            setStatus("Loading segments...");
            const schedules = await loadSchedulesForSegments(
              itinerary.segments || [],
            );
            if (!schedules.length) {
              throw new Error(
                "No segments could be loaded (missing flightScheduleId).",
              );
            }

            ctx.schedules = schedules;

            renderHeader(ctx.tripType, schedules);
            renderSegmentsList(ctx.tripType, schedules);
            await renderPriceForItinerary(itinerary, schedules);

            setStatus("Loaded ?");
          } catch (e) {
            console.error(e);
            showError(e.message);
          }
        }

        /************************************************************
         * EVENTS
         ************************************************************/
        $("seatBtn")?.addEventListener("click", () => {
          const first = ctx.schedules?.[0];
          if (!first) return;
          window.location.href =
            "SeatMap.html?id=" +
            encodeURIComponent(String(first.flightScheduleId));
        });

        $("continueBtn")?.addEventListener("click", async () => {
          const btn = $("continueBtn");
          try {
            $("bookErr").style.display = "none";

            if (!ctx.schedules?.length) {
              throw new Error("No segments loaded. Go back and choose again.");
            }

            btn.disabled = true;
            btn.textContent = "Creating booking...";

            const bookId = await createBookingTrip();

            btn.textContent = "Creating ticket...";
            const ticketId = await getOrCreateTicket(bookId);

            btn.textContent = "Linking flights...";
            await linkTicketToAllFlights(ticketId, ctx.tripType, ctx.schedules);

            sessionStorage.setItem("bookId", String(bookId));
            sessionStorage.setItem("ticketId", String(ticketId));

            btn.textContent = "Redirecting...";
            window.location.href = `Doc.html?bookId=${encodeURIComponent(
              bookId,
            )}&ticketId=${encodeURIComponent(ticketId)}`;
          } catch (e) {
            console.error(e);
            showBookError(e.message);
            btn.disabled = false;
            btn.textContent = "Continue to Passenger Info";
          }
        });

        load();
      