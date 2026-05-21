
      /***********************
       * API CONFIG (ضع رابطك هنا)
       ***********************/
      const API_BASE_URL =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net"; // <-- حط رابط الـ API تبعك هنا

      // عدّل المسارات حسب الـ API عندك
      const ENDPOINTS = {
        me: "/api/Profile/me",
        offers: "/api/offers/latest",
        destinations: "/api/destinations/featured",
      };

      // إذا عندك JWT Token مخزن
      // localStorage.setItem("token", "YOUR_TOKEN");
      function getAuthHeaders() {
        const token = localStorage.getItem("auth_token");

        return token ? { Authorization: "Bearer " + token } : {};
      }

      async function fetchJson(url) {
        const res = await fetch(url, {
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            "HTTP " + res.status + " - " + (text || res.statusText),
          );
        }
        return res.json();
      }

      /***********************
       * Tabs: underline transition (hover + active)
       ***********************/
      const tabs = document.getElementById("tabs");
      const indicator = document.getElementById("indicator");
      const tabButtons = [...tabs.querySelectorAll(".tab")];

      function placeIndicator(el) {
        const tabsRect = tabs.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const left = r.left - tabsRect.left;
        const width = r.width;
        indicator.style.width = width + "px";
        indicator.style.transform = "translateX(" + left + "px)";
      }

      // initial
      placeIndicator(tabs.querySelector(".tab.active"));

      tabButtons.forEach((btn) => {
        btn.addEventListener("mouseenter", () => placeIndicator(btn));
        btn.addEventListener("focus", () => placeIndicator(btn));

        btn.addEventListener("click", () => {
          const tab = btn.dataset.tab;

          switch (tab) {
            case "home":
              window.location.href = "/index.html";
              break;
            case "book":
              window.location.href = "/BookingPage.html";
              break;
            case "tickets":
              window.location.href = "/Ticket.html";
              break;
            case "profile":
              window.location.href = "/Profile.html";
              break;
          }
        });
      });

      // لما تطلع الماوس يرجع للـ active
      tabs.addEventListener("mouseleave", () => {
        const active = tabs.querySelector(".tab.active");
        if (active) placeIndicator(active);
      });

      window.addEventListener("resize", () => {
        const active = tabs.querySelector(".tab.active");
        if (active) placeIndicator(active);
      });

      /***********************
       * UI helpers
       ***********************/
      function getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return "Good Morning";
        if (h < 18) return "Good Afternoon";
        return "Good Evening";
      }

      function formatDate(dateStr) {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      function esc(s) {
        return String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function offerBg(theme) {
        switch (String(theme || "").toLowerCase()) {
          case "blue":
            return "var(--o2)";
          case "brown":
            return "var(--o3)";
          case "orange":
          default:
            return "var(--o1)";
        }
      }

      /***********************
       * Render
       ***********************/
      const offersArea = document.getElementById("offersArea");
      const destArea = document.getElementById("destArea");
      const offersChip = document.getElementById("offersChip");
      const destChip = document.getElementById("destChip");
      const miniStatus = document.getElementById("miniStatus");

      function renderOffers() {
        // صورة ثابتة لمنطقة Latest Offers
        offersArea.innerHTML = `
          <div class="dest">
            <img src="Amman.jpg" alt="Latest offers from Amman" loading="lazy" />
          </div>
        `;
      }

      function renderDestinations() {
        // صورة ثابتة لمنطقة Featured Destinations
        destArea.innerHTML = `
          <div class="dest">
            <img src="Amman.jpg" alt="Featured destinations from Amman" loading="lazy" />
          </div>
        `;
      }

      /***********************
       * Load from API (with fallback)
       ***********************/
      async function loadAll() {
        document.getElementById("greet").textContent = getGreeting();

        // User
        try {
          const me = await fetchJson(API_BASE_URL + ENDPOINTS.me);
          const username = me.username || me.userName || me.name || "User";
          document.getElementById("username").textContent = username;
          document.getElementById("helloName").textContent = username;

          const letter = username.trim().charAt(0).toUpperCase() || "U";
          document.getElementById("avatar").textContent = letter;

          miniStatus.textContent = "Connected";
        } catch (e) {
          miniStatus.textContent = "API not connected (check base URL / CORS)";
          console.warn("ME error:", e.message);
        }

        // Offers & Destinations: استخدم صور ثابتة فقط
        renderOffers();
        offersChip.textContent = "Amman";

        renderDestinations();
        destChip.textContent = "Amman";
      }

      loadAll();
    