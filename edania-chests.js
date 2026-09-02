/**
 * Edania II Agris chest tracker (Tachyon Traces, localStorage).
 */
(function () {
  const STORAGE_KEY = "frag-edania-ii-chests-v1";
  const TOTAL = 89;

  let panelEl = null;
  let mounted = false;
  let filter = "all";
  let query = "";
  let data = [];

  function roman(n) {
    const v = [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let s = "";
    for (const [x, c] of v) {
      while (n >= x) {
        s += c;
        n -= x;
      }
    }
    return s;
  }

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function loadData() {
    const saved = loadSaved();
    data = Array.from({ length: TOTAL }, (_, i) => {
      const id = i + 1;
      const entry = saved[id] || {};
      return { id, done: Boolean(entry.done) };
    });
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(data.map((x) => [x.id, x])))
    );
  }

  function cardHTML(x) {
    const label = `Tachyon Trace ${roman(x.id)}`;
    return `<article class="ect-card ${x.done ? "ect-card--done" : ""}" data-id="${x.id}">
      <div class="ect-card-top">
        <input class="ect-check" type="checkbox" ${x.done ? "checked" : ""} aria-label="Mark ${label} as collected">
        <div class="ect-trace">${label}</div>
      </div>
    </article>`;
  }

  function updateStats() {
    const n = data.filter((x) => x.done).length;
    const p = Math.round((n / TOTAL) * 100);
    const found = panelEl?.querySelector("#ect-found");
    const missing = panelEl?.querySelector("#ect-missing");
    const percent = panelEl?.querySelector("#ect-percent");
    const progressText = panelEl?.querySelector("#ect-progress-text");
    const fill = panelEl?.querySelector("#ect-fill");
    const progressHint = panelEl?.querySelector("#ect-progress-hint");

    if (found) found.textContent = String(n);
    if (missing) missing.textContent = String(TOTAL - n);
    if (percent) percent.textContent = `${p}%`;
    if (progressText) progressText.textContent = `${n} / ${TOTAL}`;
    if (fill) fill.style.width = `${p}%`;
    if (progressHint) {
      progressHint.textContent =
        n === TOTAL
          ? "Every chest collected. Legendary work."
          : `${TOTAL - n} chest${TOTAL - n === 1 ? "" : "s"} remaining`;
    }
  }

  function render() {
    if (!panelEl) return;
    const cards = panelEl.querySelector("#ect-cards");
    if (!cards) return;

    const list = data.filter((x) => {
      const t = `${x.id} tachyon trace ${roman(x.id)}`.toLowerCase();
      const state =
        filter === "all" || (filter === "done" ? x.done : !x.done);
      return state && t.includes(query);
    });

    cards.innerHTML = list.length
      ? list.map(cardHTML).join("")
      : '<div class="ect-empty">No chests match that search.</div>';

    updateStats();
  }

  function bindEvents() {
    if (mounted || !panelEl) return;
    mounted = true;

    panelEl.addEventListener("change", (e) => {
      if (!e.target.matches(".ect-check")) return;
      const card = e.target.closest(".ect-card");
      const item = data.find((x) => x.id === Number(card?.dataset.id));
      if (!item) return;
      item.done = e.target.checked;
      persist();
      render();
    });

    panelEl.addEventListener("input", (e) => {
      if (e.target.id !== "ect-search") return;
      query = e.target.value.toLowerCase();
      render();
    });

    panelEl.addEventListener("click", (e) => {
      const filterBtn = e.target.closest(".ect-filter");
      if (filterBtn) {
        filter = filterBtn.getAttribute("data-filter") || "all";
        panelEl.querySelectorAll(".ect-filter").forEach((btn) => {
          btn.classList.toggle("ect-filter--active", btn === filterBtn);
        });
        render();
        return;
      }

      if (e.target.closest("#ect-next")) {
        filter = "missing";
        panelEl.querySelectorAll(".ect-filter").forEach((btn) => {
          btn.classList.toggle(
            "ect-filter--active",
            btn.getAttribute("data-filter") === "missing"
          );
        });
        render();
        const card = panelEl.querySelector(".ect-card");
        if (card) {
          card.classList.add("ect-card--next");
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (e.target.closest("#ect-reset")) {
        if (confirm("Clear all Edania II chest progress on this device?")) {
          localStorage.removeItem(STORAGE_KEY);
          loadData();
          filter = "all";
          query = "";
          const search = panelEl.querySelector("#ect-search");
          if (search) search.value = "";
          panelEl.querySelectorAll(".ect-filter").forEach((btn) => {
            btn.classList.toggle(
              "ect-filter--active",
              btn.getAttribute("data-filter") === "all"
            );
          });
          render();
        }
        return;
      }

      if (e.target.closest("#ect-map-fullscreen")) {
        const frame = panelEl.querySelector("#ect-map-frame");
        if (!frame) return;
        if (frame.requestFullscreen) frame.requestFullscreen();
        else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
      }
    });
  }

  window.FRAGEdaniaChests = {
    mount(el) {
      panelEl = el;
      loadData();
      bindEvents();
    },
    render() {
      render();
    },
  };
})();
