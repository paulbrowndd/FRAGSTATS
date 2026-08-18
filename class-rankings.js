/**
 * FRAG BDO class tier list (drag-and-drop board, localStorage edits).
 */
(function () {
  const STORAGE_KEY = "frag-v4";
  const LEGACY_STORAGE_KEY = "frag-v3";
  const POOL_TIER = "Unranked";
  const MAX_STARS = 5;
  const MODES = [
    "Uncapped Node War",
    "Uncapped Siege",
    "Capped Siege",
    "Capped Nodewar",
    "Pack 2 Pack",
    "Tower Grind Spots",
  ];
  const TOOL_CREATED_BY = "X";
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

  function normalizeMode(mode) {
    if (mode === "Siege") return "Uncapped Siege";
    return mode;
  }

  function creditHTML() {
    return `<span class="cr-credit">Tool created by <strong>${esc(TOOL_CREATED_BY)}</strong></span>`;
  }

  function applyCredit() {
    const el = document.getElementById("cr-credit");
    if (el) el.innerHTML = creditHTML();
  }

  function migrateItems(list) {
    if (!Array.isArray(list)) return seedData().slice();
    const onlyLegacyD = list.length > 0 && list.every((x) => x.tier === "D");
    return list.map((item) => ({
      ...item,
      difficulty: Math.min(MAX_STARS, Math.max(0, Number(item.difficulty) || 0)),
      tier: onlyLegacyD ? POOL_TIER : item.tier || POOL_TIER,
      mode: normalizeMode(item.mode),
    }));
  }

  function loadItems() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        items = migrateItems(JSON.parse(raw));
        save();
        return;
      }
    } catch {
      /* fall through to seed */
    }
    items = seedData().slice();
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
    for (let i = 1; i <= MAX_STARS; i++) {
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

  function cardHTML(c, options) {
    const opts = options || {};
    const compact = !!opts.compact;
    const draggable = opts.draggable !== false;
    const ph = placeholder(c);
    const img = esc(c.image || ph);
    const dragAttr = draggable ? ' draggable="true"' : "";
    const compactClass = compact ? " cr-card--compact" : "";
    const metaBlock = compact
      ? `<div class="cr-stars">${starHTML(c)}</div>`
      : `<div class="cr-stars">${starHTML(c)}</div>
        <div class="cr-roles">${esc((c.roles || []).join(" • "))}</div>
        <div class="cr-src"><a href="${esc(c.source)}" target="_blank" rel="noopener">Official class page ↗</a></div>`;

    return `<div class="cr-card${compactClass}"${dragAttr} data-id="${esc(c.id)}">
      <img class="cr-thumb" src="${img}" alt="" data-fallback="${esc(ph)}">
      <div>
        <div class="cr-name">${esc(c.class)}</div>
        <div class="cr-spec">${esc(c.spec)}</div>
        ${metaBlock}
      </div>
    </div>`;
  }

  function poolHTML(itemList) {
    const poolItems = itemList.filter((x) => x.tier === POOL_TIER);
    return poolItems.length
      ? poolItems.map((c) => cardHTML(c, { compact: true })).join("")
      : '<div class="cr-empty cr-empty--pool">All specs are ranked</div>';
  }

  function boardHTML(itemList) {
    return TIERS.map(([tier, cls]) => {
      const tierItems = itemList.filter((x) => x.tier === tier);
      return `<section class="cr-tier ${cls}" data-tier="${esc(tier)}">
        <div class="cr-tierhead"><span>${esc(tier)}</span><small>${tierItems.length}</small></div>
        <div class="cr-drop">${tierItems.map((c) => cardHTML(c, { compact: true })).join("") || '<div class="cr-empty">Drag specs here</div>'}</div>
      </section>`;
    }).join("");
  }

  function renderBoard() {
    const board = document.getElementById("cr-board");
    const pool = document.getElementById("cr-pool");
    const poolCount = document.getElementById("cr-pool-count");
    const v = visible();
    if (board) board.innerHTML = boardHTML(v);
    if (pool) pool.innerHTML = poolHTML(v);
    if (poolCount) {
      const n = v.filter((x) => x.tier === POOL_TIER).length;
      poolCount.textContent = n ? `${n} unranked` : "";
    }
  }

  function exportFilterLabel() {
    const q = document.getElementById("cr-search")?.value?.trim();
    const mode = document.getElementById("cr-mode")?.value || "All Modes";
    const spec = document.getElementById("cr-spec-filter")?.value || "All Specs";
    const parts = [];
    if (q) parts.push(`search: "${q}"`);
    if (mode !== "All Modes") parts.push(mode);
    if (spec !== "All Specs") parts.push(spec);
    return parts.length ? parts.join(" · ") : "All classes & specs";
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function downloadRankingPdf() {
    const btn = document.getElementById("cr-download");
    const prevLabel = btn?.textContent || "Download PDF";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generating…";
    }

    try {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
      );
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

      const v = visible();
      const sheet = document.createElement("div");
      sheet.className = "cr-export-sheet";
      const dateLabel = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      sheet.innerHTML = `<div class="cr-export-head">
          <div class="cr-export-title-row">
            <h2 class="cr-export-title">FRAG <strong>Class Rankings</strong></h2>
            ${creditHTML()}
          </div>
          <p class="cr-export-sub">Multi-mode tier list · ${esc(dateLabel)}</p>
          <p class="cr-export-sub cr-export-filters">${esc(exportFilterLabel())}</p>
        </div>
        <section class="cr-pool-section cr-pool-section--export">
          <h3 class="cr-pool-title">All classes</h3>
          <div class="cr-pool cr-pool--export">${poolHTML(v)}</div>
        </section>
        <div class="cr-board cr-board--export">${boardHTML(v)}</div>`;
      document.body.appendChild(sheet);

      const canvas = await window.html2canvas(sheet, {
        scale: 2,
        backgroundColor: "#07090d",
        useCORS: true,
        logging: false,
      });
      sheet.remove();

      const img = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`FRAG-class-rankings-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      alert("Could not generate PDF. Check your connection and try again.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel;
      }
    }
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
      tier: POOL_TIER,
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
    editing.difficulty = Math.max(0, Math.min(MAX_STARS, +document.getElementById("cr-fd").value || 0));
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

  function dropOnTier(id, tier) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    item.tier = tier;
    save();
    renderBoard();
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        items = migrateItems(JSON.parse(reader.result));
        save();
        renderBoard();
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  function populateModeSelects() {
    const filter = document.getElementById("cr-mode");
    const edit = document.getElementById("cr-fm");
    if (filter) {
      filter.innerHTML =
        `<option>All Modes</option>` +
        MODES.map((m) => `<option>${esc(m)}</option>`).join("");
    }
    if (edit) {
      edit.innerHTML =
        `<option value="both">All Modes</option>` +
        MODES.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    }
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
      if (e.target.closest("#cr-download")) {
        downloadRankingPdf();
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
      if (e.target.closest(".cr-tier, .cr-pool")) e.preventDefault();
    });

    panelEl.addEventListener("drop", (e) => {
      const tierEl = e.target.closest(".cr-tier, .cr-pool");
      if (!tierEl) return;
      e.preventDefault();
      dropOnTier(e.dataTransfer.getData("text/plain"), tierEl.getAttribute("data-tier"));
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
      populateModeSelects();
      applyCredit();
      bindEvents();
    },
    render() {
      if (!panelEl) return;
      renderBoard();
    },
  };
})();
