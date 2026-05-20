
      const box = document.getElementById("flightBox");
      const s = sessionStorage.getItem("selectedFlight");
      box.textContent = s
        ? JSON.stringify(JSON.parse(s), null, 2)
        : "No selectedFlight found.";

      document
        .getElementById("backBtn")
        .addEventListener("click", () => history.back());
    