/**
 * Edania II Agris chest tracker (Tachyon Traces + Legacy, localStorage).
 */
(function () {
  const STORAGE_KEY = "frag-edania-ii-chests-v1";
  const MAP_STORE = "bdo_tachyon_done";
  const TRACE_PREFIX = "흔적-";
  const LEGACY_PREFIX = "유산-";
  const TRACE_TOTAL = 89;
  const LEGACY_MISSING = new Set([15, 30, 45, 60, 75]);
  const LEGACY_TOTAL = TRACE_TOTAL - LEGACY_MISSING.size;

  let panelEl = null;
  let mounted = false;
  let filter = "all";
  let query = "";
  let data = [];

  function hasLegacy(id) {
    return id >= 1 && id <= TRACE_TOTAL && !LEGACY_MISSING.has(id);
  }

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

  function isCardDone(item) {
    if (!item.trace) return false;
    if (hasLegacy(item.id) && !item.legacy) return false;
    return true;
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
    data = Array.from({ length: TRACE_TOTAL }, (_, i) => {
      const id = i + 1;
      const entry = saved[id] || {};
      return {
        id,
        trace: Boolean(entry.trace ?? entry.done),
        legacy: Boolean(entry.legacy),
      };
    });
    mergeMapChestsOnLoad();
  }

  function mergeMapChestsOnLoad() {
    try {
      const done = JSON.parse(localStorage.getItem(MAP_STORE) || "[]");
      let changed = false;
      for (const key of done) {
        const text = String(key);
        let item = null;
        if (text.startsWith(TRACE_PREFIX)) {
          const num = Number(text.slice(TRACE_PREFIX.length));
          if (!Number.isFinite(num) || num < 1 || num > TRACE_TOTAL) continue;
          item = data.find((x) => x.id === num);
          if (item && !item.trace) {
            item.trace = true;
            changed = true;
          }
        } else if (text.startsWith(LEGACY_PREFIX)) {
          const num = Number(text.slice(LEGACY_PREFIX.length));
          if (!Number.isFinite(num) || num < 1 || num > TRACE_TOTAL) continue;
          if (!hasLegacy(num)) continue;
          item = data.find((x) => x.id === num);
          if (item && !item.legacy) {
            item.legacy = true;
            changed = true;
          }
        }
      }
      if (changed) persist();
    } catch {
      /* ignore */
    }
  }

  function syncMapKey(prefix, num, done) {
    try {
      const doneList = JSON.parse(localStorage.getItem(MAP_STORE) || "[]");
      const key = `${prefix}${num}`;
      const set = new Set(doneList);
      if (done) set.add(key);
      else set.delete(key);
      localStorage.setItem(MAP_STORE, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }

  function syncMapTrace(num, done) {
    syncMapKey(TRACE_PREFIX, num, done);
    const frame = panelEl?.querySelector("#ect-map-frame");
    frame?.contentWindow?.postMessage({ type: "frag-trace-set", num, done: !!done }, "*");
  }

  function syncMapLegacy(num, done) {
    syncMapKey(LEGACY_PREFIX, num, done);
    const frame = panelEl?.querySelector("#ect-map-frame");
    frame?.contentWindow?.postMessage({ type: "frag-relic-set", num, done: !!done }, "*");
  }

  function clearMapChestDone() {
    try {
      const done = JSON.parse(localStorage.getItem(MAP_STORE) || "[]");
      const filtered = done.filter((key) => {
        const text = String(key);
        return !text.startsWith(TRACE_PREFIX) && !text.startsWith(LEGACY_PREFIX);
      });
      localStorage.setItem(MAP_STORE, JSON.stringify(filtered));
      const frame = panelEl?.querySelector("#ect-map-frame");
      frame?.contentWindow?.postMessage({ type: "frag-trace-reset" }, "*");
      frame?.contentWindow?.postMessage({ type: "frag-relic-reset" }, "*");
    } catch {
      /* ignore */
    }
  }

  function applyTraceDone(num, done) {
    const item = data.find((x) => x.id === num);
    if (!item || item.trace === done) return;
    item.trace = done;
    persist();
    render();
  }

  function applyLegacyDone(num, done) {
    const item = data.find((x) => x.id === num);
    if (!item || !hasLegacy(num) || item.legacy === done) return;
    item.legacy = done;
    persist();
    render();
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        Object.fromEntries(
          data.map((x) => [
            x.id,
            { id: x.id, trace: x.trace, legacy: x.legacy },
          ])
        )
      )
    );
  }

  function cardHTML(x) {
    const rom = roman(x.id);
    const traceLabel = `Tachyon Trace ${rom}`;
    const legacyLabel = `Tachyon Legacy ${rom}`;
    const legacyRow = hasLegacy(x.id)
      ? `<label class="ect-row">
          <input class="ect-check ect-check--legacy" type="checkbox" data-kind="legacy" ${x.legacy ? "checked" : ""} aria-label="Mark ${legacyLabel} as collected">
          <span class="ect-label ect-label--legacy">${legacyLabel}</span>
        </label>`
      : "";
    return `<article class="ect-card ${isCardDone(x) ? "ect-card--done" : ""}" data-id="${x.id}">
      <label class="ect-row">
        <input class="ect-check ect-check--trace" type="checkbox" data-kind="trace" ${x.trace ? "checked" : ""} aria-label="Mark ${traceLabel} as collected">
        <span class="ect-label ect-label--trace">${traceLabel}</span>
      </label>
      ${legacyRow}
    </article>`;
  }

  function updateStats() {
    const traceFound = data.filter((x) => x.trace).length;
    const legacyFound = data.filter((x) => hasLegacy(x.id) && x.legacy).length;
    const tracePct = Math.round((traceFound / TRACE_TOTAL) * 100);
    const legacyPct = Math.round((legacyFound / LEGACY_TOTAL) * 100);

    const traceFoundEl = panelEl?.querySelector("#ect-trace-found");
    const traceMissingEl = panelEl?.querySelector("#ect-trace-missing");
    const tracePercentEl = panelEl?.querySelector("#ect-trace-percent");
    const traceProgressEl = panelEl?.querySelector("#ect-trace-progress");
    const traceFill = panelEl?.querySelector("#ect-trace-fill");

    const legacyFoundEl = panelEl?.querySelector("#ect-legacy-found");
    const legacyMissingEl = panelEl?.querySelector("#ect-legacy-missing");
    const legacyPercentEl = panelEl?.querySelector("#ect-legacy-percent");
    const legacyProgressEl = panelEl?.querySelector("#ect-legacy-progress");
    const legacyFill = panelEl?.querySelector("#ect-legacy-fill");

    if (traceFoundEl) traceFoundEl.textContent = String(traceFound);
    if (traceMissingEl) traceMissingEl.textContent = String(TRACE_TOTAL - traceFound);
    if (tracePercentEl) tracePercentEl.textContent = `${tracePct}%`;
    if (traceProgressEl) traceProgressEl.textContent = `${traceFound} / ${TRACE_TOTAL}`;
    if (traceFill) traceFill.style.width = `${tracePct}%`;

    if (legacyFoundEl) legacyFoundEl.textContent = String(legacyFound);
    if (legacyMissingEl) legacyMissingEl.textContent = String(LEGACY_TOTAL - legacyFound);
    if (legacyPercentEl) legacyPercentEl.textContent = `${legacyPct}%`;
    if (legacyProgressEl) legacyProgressEl.textContent = `${legacyFound} / ${LEGACY_TOTAL}`;
    if (legacyFill) legacyFill.style.width = `${legacyPct}%`;
  }

  function notifyMapResize() {
    const frame = panelEl?.querySelector("#ect-map-frame");
    frame?.contentWindow?.postMessage({ type: "frag-map-resize" }, "*");
  }

  function render() {
    if (!panelEl) return;
    const cards = panelEl.querySelector("#ect-cards");
    if (!cards) return;

    const list = data.filter((x) => {
      const t =
        `${x.id} tachyon trace legacy ${roman(x.id)}`.toLowerCase();
      const state =
        filter === "all" ||
        (filter === "done" ? isCardDone(x) : !isCardDone(x));
      return state && t.includes(query);
    });

    cards.innerHTML = list.length
      ? list.map(cardHTML).join("")
      : '<div class="ect-empty">No chests match that search.</div>';

    updateStats();
    notifyMapResize();
  }

  function bindEvents() {
    if (mounted || !panelEl) return;
    mounted = true;

    panelEl.addEventListener("change", (e) => {
      if (!e.target.matches(".ect-check")) return;
      const card = e.target.closest(".ect-card");
      const item = data.find((x) => x.id === Number(card?.dataset.id));
      if (!item) return;
      const kind = e.target.getAttribute("data-kind");
      const checked = e.target.checked;
      if (kind === "legacy") {
        if (!hasLegacy(item.id)) return;
        item.legacy = checked;
        persist();
        syncMapLegacy(item.id, checked);
      } else {
        item.trace = checked;
        persist();
        syncMapTrace(item.id, checked);
      }
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
          clearMapChestDone();
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
      window.addEventListener("message", (e) => {
        const msg = e.data;
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "frag-trace-done") {
          const num = Number(msg.num);
          if (!Number.isFinite(num)) return;
          applyTraceDone(num, !!msg.done);
        } else if (msg.type === "frag-relic-done") {
          const num = Number(msg.num);
          if (!Number.isFinite(num)) return;
          applyLegacyDone(num, !!msg.done);
        } else if (msg.type === "frag-trace-reset") {
          data.forEach((item) => {
            item.trace = false;
          });
          persist();
          render();
        } else if (msg.type === "frag-relic-reset") {
          data.forEach((item) => {
            item.legacy = false;
          });
          persist();
          render();
        }
      });
    },
    render() {
      render();
    },
  };
})();
