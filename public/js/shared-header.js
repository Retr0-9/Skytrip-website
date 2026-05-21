(function () {
  const tabs = document.getElementById("tabs");
  const indicator = document.getElementById("indicator");
  if (!tabs || !indicator) return;

  const tabButtons = [...tabs.querySelectorAll(".hTab")];

  function placeIndicator(el) {
    const tabsRect = tabs.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    indicator.style.width = r.width + "px";
    indicator.style.transform =
      "translateX(" + (r.left - tabsRect.left) + "px)";
  }

  function getActiveTab() {
    return tabs.querySelector(".hTab.active") || tabButtons[0];
  }

  // initial
  placeIndicator(getActiveTab());

  tabButtons.forEach((btn) => {
    btn.addEventListener("mouseenter", () => placeIndicator(btn));
    btn.addEventListener("focus", () => placeIndicator(btn));

    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switch (tab) {
        case "home":
          location.href = "/index.html";
          break;
        case "book":
          location.href = "/BookingPage.html";
          break;
        case "tickets":
          location.href = "/Ticket.html";
          break;
        case "profile":
          location.href = "/Profile.html";
          break;
      }
    });
  });

  tabs.addEventListener("mouseleave", () => placeIndicator(getActiveTab()));
  window.addEventListener("resize", () => placeIndicator(getActiveTab()));

  // Optional: fill user pill from localStorage if exists
  const nameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");
  if (nameEl && avatarEl) {
    const stored =
      localStorage.getItem("username") ||
      localStorage.getItem("email") ||
      "User";
    nameEl.textContent = stored;
    const letter = String(stored).trim().charAt(0).toUpperCase() || "U";
    avatarEl.textContent = letter;
  }
})();
