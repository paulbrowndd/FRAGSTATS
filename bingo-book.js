/**
 * FRAG Bingo Book — blacklist ledger tab (password-protected).
 */
(function () {
  const SUBMISSION_FORMAT = "frag-bingo-book-submission-v1";
  const PENDING_KEY = "frag-bingo-book-pending-v1";

  const PLATFORMS = ["PlayStation", "Xbox"];
  const STATUSES = ["Active", "Under Review", "Removed"];
  const REASONS = [
    "Scamming / theft",
    "Toxicity / harassment",
    "Node war sabotage",
    "RMT / account trading",
    "Alt of blacklisted player",
    "Abuse of authority",
    "Guild hopping / poaching",
    "Cheating / exploits",
    "Intentional griefing",
    "Ban evasion",
    "Repeated rule violations",
    "False reporting",
    "Other",
  ];

  let panelEl = null;
  let mounted = false;
  let published = [];
  let pending = loadPending();
  let reasonFilter = "all";
  let statusFilter = "all";
  let searchQuery = "";

  function loadPending() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : { adds: [], updates: [] };
    } catch {
      return { adds: [], updates: [] };
    }
  }

  function savePending() {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      /* ignore */
    }
  }

  function loadPublished() {
    const data = window.BINGO_BOOK_DATA;
    published = Array.isArray(data?.entries) ? data.entries.slice() : [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugId(name) {
    const base = String(name || "entry")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `bb-${base || "entry"}-${Date.now().toString(36)}`;
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function statusClass(status) {
    if (status === "Active") return "bb-status bb-status--active";
    if (status === "Under Review") return "bb-status bb-status--review";
    return "bb-status bb-status--removed";
  }

  function mergedEntries() {
    const byId = new Map(published.map((e) => [e.id, { ...e }]));
    for (const update of pending.updates) {
      const row = byId.get(update.id);
      if (row) Object.assign(row, update.changes);
    }
    const adds = pending.adds.map((e) => ({ ...e, _pending: true }));
    return [...byId.values(), ...adds].sort((a, b) =>
      String(b.dateBlacklisted || "").localeCompare(String(a.dateBlacklisted || ""))
    );
  }

  function stats(entries) {
    const active = entries.filter((e) => e.status === "Active").length;
    const review = entries.filter((e) => e.status === "Under Review").length;
    const reasons = entries.reduce((acc, e) => {
      acc[e.reason] = (acc[e.reason] || 0) + 1;
      return acc;
    }, {});
    const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    return {
      total: entries.length,
      active,
      review,
      topReason: topReason ? topReason[0] : "—",
    };
  }

  function filteredEntries(entries) {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (reasonFilter !== "all" && e.reason !== reasonFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        e.familyName,
        e.reportedBy,
        e.notes,
        e.serverRegion,
        e.platform,
        e.reason,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  async function readFilesAsEvidence(fileList) {
    const files = Array.from(fileList || []);
    const out = [];
    for (const file of files) {
      if (file.size > 2_500_000) {
        out.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          tooLarge: true,
          note: "File exceeded 2.5MB and was not embedded. Attach separately or use a link in notes.",
        });
        continue;
      }
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      out.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataBase64: btoa(binary),
      });
    }
    return out;
  }

  function queueAdd(entry) {
    pending.adds.push(entry);
    savePending();
  }

  function queueUpdate(id, changes) {
    const existing = pending.updates.find((u) => u.id === id);
    if (existing) Object.assign(existing.changes, changes);
    else pending.updates.push({ id, changes });
    savePending();
  }

  function buildSubmission(reporter) {
    return {
      format: SUBMISSION_FORMAT,
      generatedAt: new Date().toISOString(),
      reporter: reporter || "",
      adds: pending.adds,
      updates: pending.updates,
    };
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderStats(entries) {
    const s = stats(entries);
    return `
      <div class="bb-statgrid">
        <div class="bb-stat"><b>${s.total}</b><small>Total entries</small></div>
        <div class="bb-stat"><b>${s.active}</b><small>Active blacklist</small></div>
        <div class="bb-stat"><b>${s.review}</b><small>Under review</small></div>
        <div class="bb-stat bb-stat--wide"><b>${escapeHtml(s.topReason)}</b><small>Most common reason</small></div>
      </div>
    `;
  }

  function renderTable(entries) {
    if (!entries.length) {
      return `<p class="bb-empty">No entries match your filters.</p>`;
    }
    const rows = entries
      .map((e) => {
        const pendingTag = e._pending
          ? `<span class="bb-pending-tag">Pending publish</span>`
          : "";
        const actions =
          e._pending || e.status === "Removed"
            ? ""
            : `<div class="bb-row-actions">
                ${
                  e.status === "Under Review"
                    ? `<button type="button" class="bb-btn bb-btn--small" data-action="advance" data-id="${escapeHtml(e.id)}">Advance</button>`
                    : ""
                }
                <button type="button" class="bb-btn bb-btn--small bb-btn--danger" data-action="remove" data-id="${escapeHtml(e.id)}">Remove</button>
              </div>`;
        return `<tr>
          <td>
            <div class="bb-name">${escapeHtml(e.familyName)}</div>
            <div class="bb-sub">${escapeHtml(e.platform)} · ${escapeHtml(e.serverRegion)}</div>
            ${pendingTag}
          </td>
          <td>${escapeHtml(e.reason)}</td>
          <td>${escapeHtml(formatDate(e.dateBlacklisted))}</td>
          <td>${escapeHtml(e.reportedBy)}</td>
          <td><span class="${statusClass(e.status)}">${escapeHtml(e.status)}</span></td>
          <td class="bb-notes">${escapeHtml(e.notes || "—")}</td>
          <td>${actions}</td>
        </tr>`;
      })
      .join("");
    return `
      <div class="bb-table-wrap">
        <table class="bb-table">
          <thead>
            <tr>
              <th>Family / platform</th>
              <th>Reason</th>
              <th>Date</th>
              <th>Reported by</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function render() {
    if (!panelEl) return;
    loadPublished();
    const all = mergedEntries();
    const filtered = filteredEntries(all);
    const pendingCount = pending.adds.length + pending.updates.length;

    panelEl.innerHTML = `
      <div class="bb-head">
        <h2 class="bb-title">The <strong>Bingo Book</strong></h2>
        <p class="bb-sub">FRAG's running ledger of blacklisted players — who, why, and who called it. Guild records · do not group.</p>
      </div>

      ${renderStats(all)}

      <section class="bb-form-panel" aria-label="Add bingo book entry">
        <h3 class="bb-section-title">Add an entry</h3>
        <form id="bb-form" class="bb-form">
          <div class="bb-form-grid">
            <label class="bb-field">
              <span>Family name</span>
              <input name="familyName" required placeholder="e.g. Nouvellecent" />
            </label>
            <label class="bb-field">
              <span>Platform</span>
              <select name="platform" required>
                ${PLATFORMS.map((p) => `<option value="${p}">${p}</option>`).join("")}
              </select>
            </label>
            <label class="bb-field">
              <span>Server / region</span>
              <input name="serverRegion" required placeholder="e.g. NA - Balenos" />
            </label>
            <label class="bb-field">
              <span>Reason</span>
              <select name="reason" required>
                ${REASONS.map((r) => `<option value="${r}">${r}</option>`).join("")}
              </select>
            </label>
            <label class="bb-field">
              <span>Date blacklisted</span>
              <input name="dateBlacklisted" type="date" required />
            </label>
            <label class="bb-field">
              <span>Reported by</span>
              <input name="reportedBy" required placeholder="Your family name" />
            </label>
            <label class="bb-field">
              <span>Status</span>
              <select name="status" required>
                ${STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("")}
              </select>
            </label>
            <label class="bb-field bb-field--wide">
              <span>Evidence / notes</span>
              <textarea name="notes" rows="3" placeholder="Screenshot link, context, witnesses…"></textarea>
            </label>
            <label class="bb-field bb-field--wide">
              <span>Attach evidence — screenshots, clips, or PDFs</span>
              <input name="evidenceFiles" type="file" multiple accept="image/*,video/*,application/pdf" />
            </label>
          </div>
          <div class="bb-form-actions">
            <button type="submit" class="bb-btn bb-btn--gold">Add to draft</button>
            <button type="reset" class="bb-btn">Clear form</button>
          </div>
        </form>
      </section>

      <section class="bb-submit-panel" aria-label="Submission tools">
        <div class="bb-submit-copy">
          <h3 class="bb-section-title">Submit for publishing</h3>
          <p class="bb-help">Draft entries stay on this device until you download a submission file and send it to leadership. After review, entries are published for everyone with access.</p>
          <p class="bb-pending-count">${pendingCount ? `${pendingCount} change(s) waiting to download` : "No pending changes"}</p>
        </div>
        <div class="bb-submit-actions">
          <button type="button" class="bb-btn bb-btn--gold" id="bb-download" ${pendingCount ? "" : "disabled"}>Download submission</button>
          <label class="bb-btn bb-btn--import">
            Import submission
            <input id="bb-import" type="file" accept="application/json,.json" hidden />
          </label>
        </div>
      </section>

      <section class="bb-list-panel" aria-label="Bingo book entries">
        <div class="bb-list-head">
          <h3 class="bb-section-title">Entries <span class="bb-count">${filtered.length}</span></h3>
          <input id="bb-search" class="bb-search" type="search" placeholder="Search by family name, reporter, or notes…" value="${escapeHtml(searchQuery)}" />
        </div>
        <div class="bb-chip-row" role="group" aria-label="Filter by reason">
          <button type="button" class="bb-chip ${reasonFilter === "all" ? "bb-chip--active" : ""}" data-reason="all">All reasons</button>
          ${REASONS.map(
            (r) =>
              `<button type="button" class="bb-chip ${reasonFilter === r ? "bb-chip--active" : ""}" data-reason="${escapeHtml(r)}">${escapeHtml(r)}</button>`
          ).join("")}
        </div>
        <div class="bb-chip-row bb-chip-row--status" role="group" aria-label="Filter by status">
          <button type="button" class="bb-chip ${statusFilter === "all" ? "bb-chip--active" : ""}" data-status="all">All statuses</button>
          ${STATUSES.map(
            (s) =>
              `<button type="button" class="bb-chip ${statusFilter === s ? "bb-chip--active" : ""}" data-status="${escapeHtml(s)}">${escapeHtml(s)}</button>`
          ).join("")}
        </div>
        ${renderTable(filtered)}
      </section>

      <p class="bb-foot">FRAG · Bingo Book · Published ledger + local drafts · Send submission files to leadership for upload.</p>
    `;

    bindEvents();
  }

  function bindEvents() {
    panelEl.querySelector("#bb-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const evidence = await readFilesAsEvidence(fd.getAll("evidenceFiles"));
      const entry = {
        id: slugId(fd.get("familyName")),
        familyName: String(fd.get("familyName") || "").trim(),
        platform: String(fd.get("platform") || "").trim(),
        serverRegion: String(fd.get("serverRegion") || "").trim(),
        reason: String(fd.get("reason") || "").trim(),
        dateBlacklisted: String(fd.get("dateBlacklisted") || "").trim(),
        reportedBy: String(fd.get("reportedBy") || "").trim(),
        status: String(fd.get("status") || "Under Review").trim(),
        notes: String(fd.get("notes") || "").trim(),
        evidence,
        submittedAt: new Date().toISOString(),
      };
      if (!entry.familyName) return;
      queueAdd(entry);
      form.reset();
      render();
    });

    panelEl.querySelector("#bb-download")?.addEventListener("click", () => {
      const reporter =
        pending.adds[pending.adds.length - 1]?.reportedBy ||
        pending.updates[0]?.changes?.reportedBy ||
        "";
      const payload = buildSubmission(reporter);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`frag-bingo-book-submission-${stamp}.json`, payload);
    });

    panelEl.querySelector("#bb-import")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (payload.format !== SUBMISSION_FORMAT) {
          alert("Not a valid FRAG Bingo Book submission file.");
          return;
        }
        pending.adds.push(...(payload.adds || []));
        pending.updates.push(...(payload.updates || []));
        savePending();
        render();
      } catch {
        alert("Could not read submission file.");
      }
      e.target.value = "";
    });

    panelEl.querySelector("#bb-search")?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      render();
    });

    panelEl.querySelectorAll("[data-reason]").forEach((btn) => {
      btn.addEventListener("click", () => {
        reasonFilter = btn.getAttribute("data-reason") || "all";
        render();
      });
    });

    panelEl.querySelectorAll("[data-status]").forEach((btn) => {
      btn.addEventListener("click", () => {
        statusFilter = btn.getAttribute("data-status") || "all";
        render();
      });
    });

    panelEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        if (!id || !action) return;
        if (action === "advance") queueUpdate(id, { status: "Active" });
        if (action === "remove") queueUpdate(id, { status: "Removed" });
        render();
      });
    });
  }

  function mount(panel) {
    panelEl = panel;
    if (!mounted) {
      mounted = true;
    }
    render();
  }

  window.FRAGBingoBook = { mount, render, REASONS, PLATFORMS, STATUSES };
})();
