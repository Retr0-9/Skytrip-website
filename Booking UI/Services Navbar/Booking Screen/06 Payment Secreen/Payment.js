/************************************************************
 * ✅ Payment.html - Back-end only (CLEAN)
 * - FE sends ONLY { ticketId }
 * - FE reads status/amount from: GET /api/payments/my/status/{ticketId}
 * - No amount/bookId/currency from URL/sessionStorage
 ************************************************************/

// ✅ خليها ثابتة لو بدك:
const API_BASE = "https://localhost:7216";

const EP_PAYMENT_STATUS = (ticketId) =>
  `${API_BASE}/api/payments/my/status/${encodeURIComponent(ticketId)}`;
const EP_CHECKOUT_SESSION = `${API_BASE}/api/payments/checkout-session`;

const $ = (id) => document.getElementById(id);

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function toast(msg, ok = true) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show " + (ok ? "" : "bad");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => (t.className = "toast"), 3200);
}

function getToken() {
  // دعم لاسمين شائعين
  return (
    localStorage.getItem("auth_token") || localStorage.getItem("token") || ""
  );
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: "Bearer " + token } : {};
}

function setPill(text, bad = false) {
  const p = $("pill");
  p.textContent = text;
  p.className = "pill" + (bad ? " bad" : "");
}

function setPayEnabled(enabled) {
  $("payBtn").disabled = !enabled;
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
  // مرات API يرجع text/plain
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
    ...getAuthHeaders(),
  };

  const hasBody = options.body != null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });
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
    throw err;
  }

  return body;
}

function normalizePayStatus(s) {
  // { ticketID, bookID, isConfirmed, bookingStatus, paymentStatus, amount, currency, bookingReference ...}
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

async function loadPage() {
  setPayEnabled(false);
  setPill("Loading…");
  $("hint").textContent = "Loading payment status…";

  const ticketId = Number(qs("ticketId") || "0") || 0;

  if (!ticketId) {
    setPill("Invalid", true);
    $("hint").textContent =
      "Missing ticketId (example: Payment.html?ticketId=4021)";
    toast("Missing ticketId in URL.", false);
    return;
  }

  $("ticketId").textContent = String(ticketId);

  if (!getToken()) {
    setPill("Unauthorized", true);
    $("hint").textContent = "Missing auth token. Please login.";
    toast("Please login first (token missing).", false);
    return;
  }

  // ✅ مصدر الحقيقة: PaymentStatus endpoint
  let status;
  try {
    const s = await apiFetch(EP_PAYMENT_STATUS(ticketId), {
      method: "GET",
    });
    status = normalizePayStatus(s);
  } catch (e) {
    // 404 = ما في payable/مش owner/أو ما في status
    if (e.status === 404) {
      setPill("Not found", true);
      $("hint").textContent =
        "No payment status found for this ticket (or not your ticket).";
      $("payStatus").textContent = "—";
      toast("Ticket not found / not yours.", false);
      return;
    }

    if (e.status === 401 || e.status === 403) {
      setPill("Unauthorized", true);
      $("hint").textContent = "Unauthorized. Please login again.";
      toast("Unauthorized / Forbidden.", false);
      return;
    }

    setPill("Error", true);
    $("hint").textContent = "Failed to load payment status.";
    toast(e.message || "Failed to load.", false);
    return;
  }

  // املأ UI
  $("bookId").textContent = status.bookId ? String(status.bookId) : "—";
  $("ref").textContent = status.bookingReference || "—";
  $("payStatus").textContent = status.paymentStatus || "—";
  $("currency").textContent = (status.currency || "USD").toUpperCase();
  $("total").textContent =
    status.amount != null
      ? money(status.amount, status.currency || "USD")
      : "—";

  // لو مدفوع/confirmed
  if (isPaid(status.paymentStatus)) {
    console.log("paymentStatus raw =", JSON.stringify(status.paymentStatus));
    console.log("isConfirmed =", status.isConfirmed);
    console.log("bookingStatus =", status.bookingStatus);

    setPill("Paid ✅");
    $("hint").textContent = "Already paid ✅";
    setPayEnabled(false);
    $("payHelp").textContent = "This ticket is already paid and confirmed.";
    toast("This ticket is already paid ✅");
    return;
  }

  // إذا ما في Amount (لأنه لسا ما في Payment record) → اسمحي بالدفع
  if (status.amount == null || Number(status.amount) <= 0) {
    setPill("Ready");
    $("hint").textContent =
      "Amount will be calculated by the server at checkout.";
    $("total").textContent = "Calculated at checkout";
    setPayEnabled(true);
    return;
  }

  setPill("Ready");
  $("hint").textContent = "Ready to pay.";
  setPayEnabled(true);
}

async function createCheckoutAndRedirect() {
  const ticketId = Number(qs("ticketId") || "0") || 0;
  if (!ticketId) throw new Error("Missing ticketId.");
  if (!getToken()) throw new Error("Unauthorized: token missing.");

  // ✅ Back-end only payload
  const payload = { ticketId };

  const res = await apiFetch(EP_CHECKOUT_SESSION, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // ✅ expected: { sessionId, url }
  let url = null;

  if (res && typeof res === "object") {
    url = res.url || res.Url || null;
  } else if (typeof res === "string") {
    if (res.startsWith("http")) url = res;
    else {
      try {
        const j = JSON.parse(res);
        url = j.url || j.Url || null;
      } catch {}
    }
  }

  if (!url) throw new Error("Server did not return checkout URL.");
  window.location.href = url;
}

$("payBtn").addEventListener("click", async () => {
  const btn = $("payBtn");
  btn.disabled = true;
  setPill("Creating session…");
  $("hint").textContent = "Connecting to Stripe…";

  try {
    await createCheckoutAndRedirect();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    setPill("Error", true);
    $("hint").textContent = "Could not start payment.";
    toast(e.message || "Payment error", false);
  }
});

(function init() {
  loadPage().catch((e) => {
    console.error(e);
    setPill("Error", true);
    $("hint").textContent = "Failed to load payment page.";
    toast(e.message || "Failed to load payment page", false);
    setPayEnabled(false);
  });
})();
