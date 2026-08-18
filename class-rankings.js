/**
 * FRAG BDO class tier list (drag-and-drop board, localStorage edits).
 */
(function () {
  const STORAGE_KEY = "frag-v3";
  const TIERS = [
    ["S+", "splus"],
    ["S", "s"],
    ["A", "a"],
    ["B", "b"],
    ["C", "c"],
    ["D", "d"],
    ["HOT GARBAGE", "trash"],
  ];
  const STATS = ["damage", "utility", "mobility", "survivability", "cc"];

  let items = [];
  let editing = null;
  let mounted = false;
  let panelEl = null;

  function seedData() {
    return Array.isArray(window.FRAG_CLASS_RANKINGS_SEED)
      ? window.FRAG_CLASS_RANKINGS_SEED
      : [];
  }

  function loadItems() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      items = Array.isArray(saved) ? saved : seedData().slice();
    } catch {
      items = seedData().slice();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function esc(x) {
    return String(x ?? "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]
    );
  }

  function placeholder(c) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#252d38"/><text x="60" y="48" text-anchor="middle" fill="#d8ad55" font-size="11">${esc(c.class)}</text><text x="60" y="67" text-anchor="middle" fill="#b2bdca" font-size="9">${esc(c.spec)}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function starHTML(c) {
    let out = "";
    for (let i = 1; i <= 10; i++) {
      out += `<span data-rate="${c.id}" data-n="${i}">${i <= c.difficulty ? "★" : "☆"}</span>`;
    }
    return out;
  }

  function visible() {
    const q = (document.getElementById("cr-search")?.value || "").toLowerCase();
    const mode = document.getElementById("cr-mode")?.value || "All Modes";
    const spec = document.getElementById("cr-spec-filter")?.value || "All Specs";
    return items.filter(
      (x) =>
        (!q || `${x.class} ${x.spec}`.toLowerCase().includes(q)) &&
        (mode === "All Modes" || x.mode === "both" || x.mode === mode) &&
        (spec === "All Specs" || x.spec === spec)
    );
  }

  function cardHTML(c) {
    const ph = placeholder(c);
    const img = esc(c.image || ph);
    return `<div class="cr-card" draggable="true" data-id="${esc(c.id)}">
      <img class="cr-thumb" src="${img}" alt="" data-fallback="${esc(ph)}">
      <div>
        <div class="cr-name">${esc(c.class)}</div>
        <div class="cr-spec">${esc(c.spec)}</div>
        <div class="cr-stars">${starHTML(c)}</div>
        <div class="cr-roles">${esc((c.roles || []).join(" • "))}</div>
        <div class="cr-src"><a href="${esc(c.source)}" target="_blank" rel="noopener">Official class page ↗</a></div>
      </div>
    </div>`;
  }

  function renderBoard() {
    const board = document.getElementById("cr-board");
    if (!board) return;
    const v = visible();
    board.innerHTML = TIERS.map(([tier, cls]) => {
      const tierItems = v.filter((x) => x.tier === tier);
      return `<section class="cr-tier ${cls}" data-tier="${esc(tier)}">
        <div class="cr-tierhead"><span>${esc(tier)}</span><small>${tierItems.length}</small></div>
        <div class="cr-drop">${tierItems.map(cardHTML).join("") || '<div class="cr-empty">Drag specs here</div>'}</div>
      </section>`;
    }).join("");
  }

  function fillModal() {
    if (!editing) return;
    document.getElementById("cr-fc").value = editing.class;
    document.getElementById("cr-fs").value = editing.spec;
    document.getElementById("cr-fi").value = editing.image || "";
    document.getElementById("cr-fm").value = editing.mode || "both";
    document.getElementById("cr-fd").value = editing.difficulty || 0;
    document.getElementById("cr-fr").value = (editing.roles || []).join(", ");
    document.getElementById("cr-fn").value = editing.notes || "";
    document.getElementById("cr-scores").innerHTML = STATS.map(
      (s) =>
        `<label>${s}<input id="cr-score-${s}" type="number" min="0" max="10" value="${editing.scores?.[s] || 0}"></label>`
    ).join("");
  }

  function openModal() {
    document.getElementById("cr-modal")?.classList.add("open");
    fillModal();
  }

  function closeModal() {
    document.getElementById("cr-modal")?.classList.remove("open");
    editing = null;
  }

  function edit(id) {
    editing = items.find((x) => x.id === id);
    if (!editing) return;
    openModal();
  }

  function addSpec() {
    editing = {
      id: "custom-" + Date.now(),
      class: "New Class",
      spec: "Succession",
      tier: "D",
      difficulty: 0,
      mode: "both",
      image: "",
      source: "https://blackdesert.pearlabyss.com/Console/en-US/Game/Classes",
      roles: [],
      notes: "",
      scores: { damage: 0, utility: 0, mobility: 0, survivability: 0, cc: 0 },
    };
    openModal();
  }

  function saveEdit() {
    if (!editing) return;
    editing.class = document.getElementById("cr-fc").value.trim() || "Unnamed";
    editing.spec = document.getElementById("cr-fs").value;
    editing.image = document.getElementById("cr-fi").value.trim();
    editing.mode = document.getElementById("cr-fm").value;
    editing.difficulty = Math.max(0, Math.min(10, +document.getElementById("cr-fd").value || 0));
    editing.roles = document
      .getElementById("cr-fr")
      .value.split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    editing.notes = document.getElementById("cr-fn").value;
    editing.scores = {};
    STATS.forEach((s) => {
      editing.scores[s] = Math.max(0, Math.min(10, +document.getElementById("cr-score-" + s).value || 0));
    });
    if (!items.some((x) => x.id === editing.id)) items.push(editing);
    save();
    closeModal();
    renderBoard();
  }

  function rate(id, n) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    item.difficulty = n;
    save();
    renderBoard();
  }

  function exportData() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(items, null, 2)], { type: "application/json" })
    );
    a.download = "FRAG-class-rankings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        items = JSON.parse(reader.result);
        save();
        renderBoard();
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    if (mounted || !panelEl) return;
    mounted = true;

    panelEl.addEventListener("input", (e) => {
      if (e.target.matches("#cr-search, #cr-mode, #cr-spec-filter")) renderBoard();
    });

    panelEl.addEventListener("click", (e) => {
      const rateEl = e.target.closest("[data-rate]");
      if (rateEl) {
        e.stopPropagation();
        rate(rateEl.getAttribute("data-rate"), +rateEl.getAttribute("data-n"));
        return;
      }
      const card = e.target.closest(".cr-card");
      if (card && !e.target.closest("a")) {
        edit(card.getAttribute("data-id"));
        return;
      }
      if (e.target.closest("#cr-add")) {
        addSpec();
        return;
      }
      if (e.target.closest("#cr-export")) {
        exportData();
        return;
      }
      if (e.target.closest("#cr-import-btn")) {
        document.getElementById("cr-import")?.click();
        return;
      }
      if (e.target.closest("#cr-save")) {
        saveEdit();
        return;
      }
      if (e.target.closest("#cr-cancel") || e.target.closest("#cr-modal-backdrop")) {
        closeModal();
      }
    });

    panelEl.addEventListener("change", (e) => {
      if (e.target.id === "cr-import") importData(e.target.files[0]);
    });

    panelEl.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".cr-card");
      if (!card) return;
      e.dataTransfer.setData("text/plain", card.getAttribute("data-id"));
    });

    panelEl.addEventListener("dragover", (e) => {
      if (e.target.closest(".cr-tier")) e.preventDefault();
    });

    panelEl.addEventListener("drop", (e) => {
      const tierEl = e.target.closest(".cr-tier");
      if (!tierEl) return;
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const item = items.find((x) => x.id === id);
      if (item) {
        item.tier = tierEl.getAttribute("data-tier");
        save();
        renderBoard();
      }
    });

    panelEl.addEventListener(
      "error",
      (e) => {
        if (e.target.matches(".cr-thumb")) {
          e.target.src = e.target.getAttribute("data-fallback") || "";
        }
      },
      true
    );
  }

  window.FRAGClassRankings = {
    mount(el) {
      panelEl = el;
      loadItems();
      bindEvents();
    },
    render() {
      if (!panelEl) return;
      renderBoard();
    },
  };
})();
