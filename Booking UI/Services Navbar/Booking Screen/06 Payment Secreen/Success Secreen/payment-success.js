const API_BASE = "https://localhost:7216";

const $ = (id) => document.getElementById(id);

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function getToken() {
  return localStorage.getItem("auth_token") || "";
}

async function apiGet(path) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { headers });
  const text = await res.text().catch(() => "");
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body && (body.detail || body.title || body.message)) ||
      (typeof body === "string" && body) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

function showError(msg) {
  $("errLine").style.display = "block";
  $("errLine").textContent = msg;
}

function clearError() {
  $("errLine").style.display = "none";
  $("errLine").textContent = "";
}

function showButtons(showGoTickets, showRetry) {
  $("goTicketsBtn").style.display = showGoTickets ? "inline-block" : "none";
  $("retryBtn").style.display = showRetry ? "inline-block" : "none";
}

async function pollStatus(ticketId) {
  clearError();
  showButtons(false, false);

  $("payStatus").textContent = "Checking…";
  $("subtitle").textContent = "Your booking is being confirmed…";

  const maxMs = 20000; // 20 seconds
  const intervalMs = 1500; // poll every 1.5s
  const start = Date.now();

  while (Date.now() - start < maxMs) {
    try {
      const s = await apiGet(
        `/api/payments/my/status/${encodeURIComponent(ticketId)}`,
      );

      // fill UI
      $("bookId").textContent = s.bookID ?? s.bookId ?? "—";
      $("payStatus").textContent = s.paymentStatus ?? "—";
      $("ref").textContent = s.bookingReference ?? s.reference ?? "—"; // لو ما رجعها، بتضل —

      // ✅ consider confirmed
      const confirmed =
        s.isConfirmed === true ||
        Number(s.isConfirmed) === 1 ||
        String(s.paymentStatus || "").toLowerCase() === "paid";

      if (confirmed) {
        $("subtitle").textContent =
          "Booking confirmed ✅ Redirecting to your tickets…";
        showButtons(true, false);

        setTimeout(() => {
          window.location.href = "Ticket.html";
        }, 900);

        return;
      }
    } catch (e) {
      // ممكن أول ثواني يرجع NotFound لو توكن ناقص/انتهى
      showError("Couldn’t verify payment yet: " + e.message);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // timeout
  $("subtitle").textContent =
    "Payment received. Confirmation may take a bit longer.";
  $("payStatus").textContent = $("payStatus").textContent || "Pending";
  showButtons(true, true);
}

// Init
(function init() {
  const ticketId = Number(qs("ticketId") || "0");

  $("ticketId").textContent = ticketId ? String(ticketId) : "—";

  if (!ticketId) {
    $("subtitle").textContent = "Missing ticketId in URL.";
    showError(
      "Open this page from the Stripe success redirect (ticketId is required).",
    );
    showButtons(true, false);
    return;
  }

  $("retryBtn").addEventListener("click", (e) => {
    e.preventDefault();
    pollStatus(ticketId);
  });

  pollStatus(ticketId);
})();
