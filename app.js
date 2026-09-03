(function () {
  const COLS = [
    { key: "familyName", label: "Family name", type: "text" },
    { key: "enemyKills", label: "Enemy kills", type: "num" },
    { key: "deaths", label: "Deaths", type: "num" },
    { key: "maxKillStreak", label: "Max kill streak", type: "num" },
    { key: "damageDealt", label: "Damage dealt", type: "str" },
    { key: "damageTaken", label: "Damage taken", type: "str" },
    { key: "ccHits", label: "CC hits", type: "num" },
    { key: "hpHealed", label: "HP healed", type: "str" },
    { key: "allyHp", label: "Ally HP", type: "str" },
    { key: "totalDamageToFort", label: "Total damage to fort", type: "str" },
    { key: "cannonHits", label: "Cannon hits", type: "num" },
    { key: "objectsDestroyedCannon", label: "Objects destroyed (cannon)", type: "num" },
    { key: "maxCannonHitDistance", label: "Max cannon hit distance", type: "num" },
    { key: "trapsTriggered", label: "Traps triggered", type: "num" },
    { key: "timeDead", label: "Time dead", type: "str" },
    { key: "timeSurvived", label: "Time survived", type: "str" },
  ];

  /** Node war / siege counts shown before combat stats on aggregated views. */
  const ATTENDANCE_STAT_COLS = [
    { key: "nodeWar", label: "Node war", type: "num" },
    { key: "siege", label: "Siege", type: "num" },
  ];

  const VIEW = {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    WEEKLY_ANALYSIS: "weekly-analysis",
    MONTHLY_ANALYSIS: "monthly-analysis",
    LIFETIME: "lifetime",
    ATTENDANCE: "attendance",
    SIEGE_TICKETS: "siege-tickets",
    CLASS_RANKINGS: "class-rankings",
    EDANIA_CHESTS: "edania-chests",
  };

  const ATTENDANCE_COLS = [
    { key: "familyName", label: "Family name", type: "text" },
    { key: "team", label: "Team", type: "text" },
    { key: "nodeWars", label: "Node wars", type: "num" },
    { key: "siege", label: "Siege", type: "num" },
  ];

  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");
  const tfoot = document.getElementById("tfoot");
  const search = document.getElementById("search");
  const countEl = document.getElementById("count");
  const metaEl = document.getElementById("header-meta");
  const viewTabs = document.querySelectorAll("[data-view]");
  const dateSelect = document.getElementById("date-select");
  const weekSelect = document.getElementById("week-select");
  const monthSelect = document.getElementById("month-select");
  const scopeRow = document.getElementById("scope-row");
  const dateField = document.getElementById("date-field");
  const weekField = document.getElementById("week-field");
  const monthField = document.getElementById("month-field");
  const mvpSection = document.getElementById("mvp-section");
  const mvpWinner = document.getElementById("mvp-winner");
  const mvpBreakdown = document.getElementById("mvp-breakdown");
  const mvpLeaderboard = document.getElementById("mvp-leaderboard");
  const healerMvpWinner = document.getElementById("healer-mvp-winner");
  const healerMvpBreakdown = document.getElementById("healer-mvp-breakdown");
  const healerMvpLeaderboard = document.getElementById("healer-mvp-leaderboard");
  const attendancePanel = document.getElementById("attendance-panel");
  const teamFiltersEl = document.getElementById("team-filters");
  const warAnalysisPanel = document.getElementById("war-analysis-panel");
  const warAnalysisSub = document.getElementById("war-analysis-sub");
  const warAnalysisFormula = document.getElementById("war-analysis-formula");
  const warAnalysisSummary = document.getElementById("war-analysis-summary");
  const warAnalysisPriorMvps = document.getElementById("war-analysis-prior-mvps");
  const siegeTicketsPanel = document.getElementById("siege-tickets-panel");
  const classRankingsPanel = document.getElementById("class-rankings-panel");
  const edaniaChestsPanel = document.getElementById("edania-chests-panel");
  const statsTablePanel = document.getElementById("stats-table-panel");
  const toolbarPanel = document.getElementById("toolbar-panel");
  const siteAuthLockBtn = document.getElementById("site-auth-lock");

  function canAccessView(view = currentView) {
    if (view === VIEW.EDANIA_CHESTS) return true;
    return window.FRAGSiteAuth ? window.FRAGSiteAuth.isUnlocked() : true;
  }

  function updateAuthChrome() {
    const unlocked = window.FRAGSiteAuth ? window.FRAGSiteAuth.isUnlocked() : true;
    if (siteAuthLockBtn) siteAuthLockBtn.hidden = !unlocked;
    viewTabs.forEach((btn) => {
      const view = btn.getAttribute("data-view");
      const locked = view !== VIEW.EDANIA_CHESTS && !unlocked;
      btn.classList.toggle("tab--locked", locked);
      btn.setAttribute("aria-disabled", locked ? "true" : "false");
      if (locked) btn.title = "Password required";
      else btn.removeAttribute("title");
    });
  }

  function updateTabStates() {
    viewTabs.forEach((btn) => {
      const view = btn.getAttribute("data-view");
      const on = view === currentView;
      const pending = pendingProtectedView && view === pendingProtectedView;
      btn.classList.toggle("tab--active", on);
      btn.classList.toggle("tab--pending", pending && !on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        btn.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
      }
    });
    updateAuthChrome();
  }

  function clearProtectedContent() {
    hideStatsPanels();
    if (statsTablePanel) statsTablePanel.hidden = true;
    if (toolbarPanel) toolbarPanel.hidden = true;
    if (siegeTicketsPanel) siegeTicketsPanel.hidden = true;
    if (classRankingsPanel) classRankingsPanel.hidden = true;
    if (edaniaChestsPanel) edaniaChestsPanel.hidden = true;
    if (mvpSection) mvpSection.hidden = true;
    if (warAnalysisPanel) warAnalysisPanel.hidden = true;
    if (attendancePanel) attendancePanel.hidden = true;
    metaEl.textContent = "Members only";
    countEl.textContent = "";
  }

  function handleAuthGateResult(result) {
    const pending = pendingProtectedView;
    pendingProtectedView = null;
    updateTabStates();
    if (result === "back" || result === "locked") {
      setView(VIEW.EDANIA_CHESTS);
      return;
    }
    if (window.FRAGSiteAuth?.isUnlocked()) {
      const next = pending && canAccessView(pending) ? pending : currentView;
      if (canAccessView(next)) setView(next);
      else setView(VIEW.EDANIA_CHESTS);
    }
  }

  const MVP_COMPONENTS = [
    { key: "enemyKills", label: "Enemy kills", weight: 0.2 },
    { key: "damageDealt", label: "Damage dealt", weight: 0.15 },
    { key: "ccHits", label: "CC hits", weight: 0.15 },
    { key: "totalDamageToFort", label: "Fort damage", weight: 0.2 },
    { key: "healing", label: "HP healed + ally HP", weight: 0.1 },
    { key: "timeSurvived", label: "Time survived", weight: 0.1 },
    { key: "damageTaken", label: "Damage taken", weight: 0.05 },
    { key: "deaths", label: "Low deaths", weight: 0.05 },
  ];

  const ANALYSIS_LABEL_OVERRIDES = {
    deaths: "Deaths",
  };

  /** Raw stat column for each MVP category on analysis tabs. */
  const ANALYSIS_METRIC_COLS = {
    enemyKills: { key: "enemyKills", type: "num" },
    damageDealt: { key: "damageDealt", type: "str" },
    ccHits: { key: "ccHits", type: "num" },
    totalDamageToFort: { key: "totalDamageToFort", type: "str" },
    healing: { key: "healing", type: "str" },
    timeSurvived: { key: "timeSurvived", type: "str" },
    damageTaken: { key: "damageTaken", type: "str" },
    deaths: { key: "deaths", type: "num" },
  };

  const HEALER_MVP_COMPONENTS = [
    { key: "allyHp", label: "Ally HP", weight: 0.75 },
    { key: "ccHits", label: "CC hits", weight: 0.25 },
  ];

  let currentView = VIEW.DAILY;
  let pendingProtectedView = null;
  let currentDate = "";
  let currentWeekSunday = "";
  let currentMonth = "";
  /** Attendance tab: "week" or "month" — only one scope applies at a time. */
  let attendanceScopeMode = "week";
  let sortKey = null;
  let sortDir = "asc";
  /** Empty = all teams; otherwise show rows matching any selected team. */
  let selectedTeamFilters = new Set();
  /** Canonical player names excluded from average calculations (still shown in table). */
  let excludedPlayers = new Set();
  /** Last rendered visible rows — used for check-all. */
  let lastVisibleRows = [];

  const TEAM_FILTER_ORDER = [
    "Shotcaller",
    "Flex",
    "D-Flex",
    "Flag Placer",
    "Cannons",
    "Support",
    "Shai",
    "Ball",
    "Defense",
    "Sailor",
  ];

  let rosterIndex = null;

  function buildAnalysisCols() {
    const analysisOrder = [
      "enemyKills",
      "deaths",
      "damageDealt",
      "ccHits",
      "totalDamageToFort",
      "healing",
      "timeSurvived",
      "damageTaken",
    ];
    const mvpByKey = new Map(
      MVP_COMPONENTS.map((c) => {
        const stat = ANALYSIS_METRIC_COLS[c.key];
        return [
          c.key,
          {
            key: stat.key,
            label: ANALYSIS_LABEL_OVERRIDES[c.key] || c.label,
            type: stat.type,
          },
        ];
      })
    );
    return [
      { key: "familyName", label: "Family name", type: "text" },
      { key: "score", label: "Overall score", type: "pct" },
      { key: "attendance", label: "Attendance", type: "num" },
      ...analysisOrder.map((key) => mvpByKey.get(key)),
    ];
  }

  function isWarAnalysisView(view = currentView) {
    return view === VIEW.WEEKLY_ANALYSIS || view === VIEW.MONTHLY_ANALYSIS;
  }

  function totalWarAttendance(row) {
    return (Number(row.nodeWar) || 0) + (Number(row.siege) || 0);
  }

  function rankedToAnalysisRows(ranked, rawRows) {
    const byName = new Map(rawRows.map((r) => [r.familyName, r]));
    return ranked.map((entry) => {
      const row = byName.get(entry.familyName) || {};
      const m = mvpMetricsFromRow(row);
      return {
        familyName: entry.familyName,
        score: entry.score,
        attendance: totalWarAttendance(row),
        enemyKills: Number(row.enemyKills) || 0,
        damageDealt: row.damageDealt ?? "0",
        ccHits: Number(row.ccHits) || 0,
        totalDamageToFort: row.totalDamageToFort ?? "0",
        healing: formatGameNumber(m.healing),
        timeSurvived: row.timeSurvived ?? "0",
        damageTaken: row.damageTaken ?? "0",
        deaths: Number(row.deaths) || 0,
      };
    });
  }

  function splitHighLowPerformers(ranked) {
    if (!ranked.length) return { high: [], low: [], medianScore: 0 };
    const splitIdx = Math.ceil(ranked.length / 2);
    const high = ranked.slice(0, splitIdx);
    const low = ranked.slice(splitIdx);
    const medianScore =
      low.length && high.length
        ? (high[high.length - 1].score + low[0].score) / 2
        : high[0]?.score || 0;
    return { high, low, medianScore };
  }

  function getGuildRoster() {
    return Array.isArray(window.GUILD_ROSTER) ? window.GUILD_ROSTER : [];
  }

  function getGuildAliases() {
    return window.GUILD_NAME_ALIASES && typeof window.GUILD_NAME_ALIASES === "object"
      ? window.GUILD_NAME_ALIASES
      : {};
  }

  function getMemberTeam(name) {
    const teams = window.GUILD_MEMBER_TEAMS;
    return teams && typeof teams === "object" ? teams[name] || null : null;
  }

  function getMemberTeams(name) {
    const team = getMemberTeam(name);
    if (!team) return [];
    return String(team)
      .split(/\s*[,/]\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function memberHasTeam(name, team) {
    return getMemberTeams(name).includes(team);
  }

  function getKnownTeamsFromRoster() {
    const teams = new Set();
    for (const name of getGuildRoster()) {
      const assigned = getMemberTeams(name);
      if (assigned.length) {
        for (const team of assigned) teams.add(team);
      } else {
        teams.add("Unassigned");
      }
    }
    const extra = [...teams]
      .filter((team) => !TEAM_FILTER_ORDER.includes(team))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return [...TEAM_FILTER_ORDER.filter((team) => teams.has(team)), ...extra];
  }

  function rowMatchesTeamFilter(familyName) {
    if (!selectedTeamFilters.size) return true;
    const canon = resolveGuildName(familyName) || familyName;
    const teams = getMemberTeams(canon);
    const assigned = teams.length ? teams : ["Unassigned"];
    return assigned.some((team) => selectedTeamFilters.has(team));
  }

  function applyTeamFilter(rows) {
    if (!selectedTeamFilters.size) return rows;
    return rows.filter((r) => rowMatchesTeamFilter(r.familyName));
  }

  function formatPlayerCountText(filteredCount, totalCount, unit) {
    let text =
      filteredCount === totalCount
        ? `${totalCount} ${unit}`
        : `${filteredCount} of ${totalCount} ${unit}`;
    if (selectedTeamFilters.size) {
      const teams = [...selectedTeamFilters]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .join(", ");
      text += ` · ${teams}`;
    }
    return text;
  }

  function renderTeamFilters() {
    if (!teamFiltersEl) return;
    const teams = getKnownTeamsFromRoster();
    const chips = teams
      .map((team) => {
        const checked = selectedTeamFilters.has(team);
        const teamClass = teamCssClass(team);
        return `<label class="team-filter team-filter--${teamClass}${checked ? " team-filter--active" : ""}">
          <input type="checkbox" class="team-filter-input" value="${escapeHtml(team)}"${checked ? " checked" : ""} />
          <span>${escapeHtml(team)}</span>
        </label>`;
      })
      .join("");
    const clearBtn = selectedTeamFilters.size
      ? `<button type="button" class="team-filter-clear" id="team-filter-clear">Clear</button>`
      : "";
    teamFiltersEl.innerHTML = `<span class="team-filters-label">Teams</span>${chips}${clearBtn}`;
  }

  function teamCssClass(team) {
    return String(team || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function formatTeamBadges(teams) {
    return teams
      .map((team) => {
        const teamClass = `player-team player-team--${teamCssClass(team)}`;
        return `<span class="${teamClass}">${escapeHtml(team)}</span>`;
      })
      .join("");
  }

  function formatFamilyNameCell(warName) {
    const name = String(warName || "");
    const canon = resolveGuildName(name) || name;
    const teams = getMemberTeams(canon);
    if (!teams.length) return escapeHtml(name);
    return `<span class="player-name">${escapeHtml(name)}</span>${formatTeamBadges(teams)}`;
  }

  function playerInclusionKey(rowOrName) {
    const name =
      typeof rowOrName === "string" ? rowOrName : rowOrName && rowOrName.familyName;
    const raw = String(name || "").trim();
    return resolveGuildName(raw) || raw;
  }

  function isPlayerIncluded(rowOrName) {
    const key = playerInclusionKey(rowOrName);
    return key ? !excludedPlayers.has(key) : true;
  }

  function rowsForAverages(rows) {
    return rows.filter((r) => isPlayerIncluded(r));
  }

  function formatFamilyNameCellWithInclude(warName) {
    const key = playerInclusionKey(warName);
    const included = isPlayerIncluded(warName);
    const inner = formatFamilyNameCell(warName);
    return `<label class="player-include-label${included ? "" : " player-include-label--off"}">
      <input type="checkbox" class="player-include-input" data-player-key="${escapeHtml(key)}"${
        included ? " checked" : ""
      } aria-label="Include in averages" />
      <span class="player-include-content">${inner}</span>
    </label>`;
  }

  function familyNameHeaderHtml(label) {
    return `<th class="th-sortable th--text th--name" scope="col">
      <div class="th-name-wrap">
        <label class="player-include-all" title="Include all visible players in averages">
          <input type="checkbox" id="player-include-all" class="player-include-input player-include-all-input" aria-label="Include all in averages" />
          <span class="visually-hidden">Include all in averages</span>
        </label>
        <button type="button" class="th-sort-btn" data-sort-key="familyName" aria-label="Sort by ${escapeHtml(label)}">
          <span class="th-sort-label">${escapeHtml(label)}</span>
          <span class="sort-ind" aria-hidden="true"></span>
        </button>
      </div>
    </th>`;
  }

  function updateCheckAllState(visibleRows) {
    const allInput = document.getElementById("player-include-all");
    if (!allInput) return;
    const keys = visibleRows.map((r) => playerInclusionKey(r)).filter(Boolean);
    if (!keys.length) {
      allInput.checked = true;
      allInput.indeterminate = false;
      return;
    }
    const includedCount = keys.filter((k) => !excludedPlayers.has(k)).length;
    allInput.checked = includedCount === keys.length;
    allInput.indeterminate = includedCount > 0 && includedCount < keys.length;
  }

  function rowInclusionClass(row) {
    return isPlayerIncluded(row) ? "" : " row--excluded-from-avg";
  }

  function buildRosterIndex() {
    const map = new Map();
    for (const name of getGuildRoster()) {
      map.set(name.toLowerCase(), name);
    }
    return map;
  }

  function rosterIndexMap() {
    if (!rosterIndex) rosterIndex = buildRosterIndex();
    return rosterIndex;
  }

  /** Canonical roster name if this war row is a guild member; otherwise null. */
  function resolveGuildName(warName) {
    const raw = String(warName || "").trim();
    if (!raw) return null;
    const idx = rosterIndexMap();
    const aliases = getGuildAliases();
    const alias = aliases[raw] || aliases[raw.toLowerCase()];
    const candidates = alias ? [alias, raw] : [raw];
    for (const c of candidates) {
      const hit = idx.get(c.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  function isGuildMember(warName) {
    return resolveGuildName(warName) !== null;
  }

  function filterGuildRows(rows) {
    return rows.filter((r) => isGuildMember(r.familyName));
  }

  function getPeriodDateKeys(data) {
    const keys = sortedDateKeys(data);
    if (!keys.length) return [];

    if (currentView === VIEW.DAILY) {
      const dk = currentDate && data[currentDate] ? currentDate : keys[keys.length - 1];
      return [dk];
    }
    if (currentView === VIEW.WEEKLY || currentView === VIEW.WEEKLY_ANALYSIS || currentView === VIEW.ATTENDANCE) {
      if (currentView === VIEW.ATTENDANCE && attendanceScopeMode === "month") {
        const months = uniqueMonths(data);
        const mk =
          currentMonth && months.some((m) => m.month === currentMonth)
            ? currentMonth
            : months[0]?.month;
        return mk ? datesInMonth(data, mk) : [];
      }
      const weeks = uniqueWeekStarts(data);
      const sun =
        currentWeekSunday && weeks.some((w) => w.sunday === currentWeekSunday)
          ? currentWeekSunday
          : weeks[0]?.sunday;
      return sun ? datesInWeek(data, sun) : [];
    }
    if (currentView === VIEW.MONTHLY || currentView === VIEW.MONTHLY_ANALYSIS) {
      const months = uniqueMonths(data);
      const mk =
        currentMonth && months.some((m) => m.month === currentMonth)
          ? currentMonth
          : months[0]?.month;
      return mk ? datesInMonth(data, mk) : [];
    }
    return keys;
  }

  function presentGuildCanonicalSet(data, dateKeys) {
    const present = new Set();
    for (const dk of dateKeys) {
      const day = data[dk];
      if (!day || !Array.isArray(day.rows)) continue;
      for (const r of day.rows) {
        const canon = resolveGuildName(r.familyName);
        if (canon) present.add(canon);
      }
    }
    return present;
  }

  function missingGuildMembers(data, dateKeys) {
    const present = presentGuildCanonicalSet(data, dateKeys);
    return getGuildRoster()
      .filter((name) => !present.has(name))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  function renderAttendancePanel(data, dateKeys) {
    if (!attendancePanel || !getGuildRoster().length) {
      if (attendancePanel) attendancePanel.hidden = true;
      return;
    }

    if (isWarAnalysisView()) {
      attendancePanel.hidden = true;
      return;
    }

    const rosterSize = getGuildRoster().length;
    const present = presentGuildCanonicalSet(data, dateKeys);
    const missing = missingGuildMembers(data, dateKeys);
    const wars = dateKeys.length;

    let periodLabel = "this period";
    if (currentView === VIEW.DAILY && dateKeys[0]) {
      periodLabel = formatShortDate(dateKeys[0]);
    } else if (currentView === VIEW.WEEKLY && dateKeys[0]) {
      periodLabel = `Sun–Sat week ${formatWeekRangeLabel(sundayOfWeekUTC(dateKeys[0]))}`;
    } else if (currentView === VIEW.MONTHLY && dateKeys[0]) {
      periodLabel = formatMonthLabel(monthKeyUTC(dateKeys[0]));
    } else if (currentView === VIEW.LIFETIME) {
      periodLabel = "all logged wars";
    }

    const warNote =
      wars === 1 ? "1 war" : wars > 1 ? `${wars} wars` : "no wars logged";

    const teamOrder = TEAM_FILTER_ORDER;
    const teamStats = new Map();
    for (const name of getGuildRoster()) {
      const teams = getMemberTeams(name);
      const assignedTeams = teams.length ? teams : ["Unassigned"];
      for (const team of assignedTeams) {
        if (!teamStats.has(team)) teamStats.set(team, { roster: 0, present: 0, missing: [] });
        const stat = teamStats.get(team);
        stat.roster += 1;
        if (present.has(name)) stat.present += 1;
        else stat.missing.push(name);
      }
    }

    const extraTeams = [...teamStats.keys()]
      .filter((team) => !teamOrder.includes(team))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const orderedTeams = [...teamOrder.filter((team) => teamStats.has(team)), ...extraTeams];

    const teamSummary = orderedTeams
      .map((team) => {
        const stat = teamStats.get(team);
        return `<span class="attendance-team-stat"><strong>${escapeHtml(team)}</strong> ${stat.present}/${stat.roster}</span>`;
      })
      .join("");

    const missingByTeam = orderedTeams
      .filter((team) => teamStats.get(team)?.missing.length)
      .map((team) => {
        const names = teamStats
          .get(team)
          .missing.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
          .map((n) => escapeHtml(n))
          .join(", ");
        return `<p class="attendance-missing-team"><strong>${escapeHtml(team)}</strong> (${teamStats.get(team).missing.length}): ${names}</p>`;
      })
      .join("");

    attendancePanel.hidden = false;
    attendancePanel.innerHTML = `
      <p class="attendance-summary">
        <strong>${present.size}</strong> of <strong>${rosterSize}</strong> guild members in ${escapeHtml(periodLabel)}
        (${escapeHtml(warNote)}).
      </p>
      ${teamSummary ? `<p class="attendance-teams">${teamSummary}</p>` : ""}
      ${
        missing.length
          ? `<details class="attendance-missing">
              <summary>Absent (${missing.length})</summary>
              <div class="attendance-missing-list">${missingByTeam || `<p>${missing.map((n) => escapeHtml(n)).join(", ")}</p>`}</div>
            </details>`
          : `<p class="attendance-all">Full guild attendance for ${escapeHtml(periodLabel)}.</p>`
      }
    `;
  }

  function dayOfWeekUTC(iso) {
    return parseISOUTC(iso).getUTCDay();
  }

  function isSiegeDate(iso) {
    return dayOfWeekUTC(iso) === 6;
  }

  function classifyWeekWarDates(data, sundayIso) {
    const weekDates = datesInWeek(data, sundayIso);
    const nodeWarDates = weekDates.filter((d) => !isSiegeDate(d));
    const siegeDates = weekDates.filter((d) => isSiegeDate(d));
    return { weekDates, nodeWarDates, siegeDates };
  }

  function presentCanonicalOnDate(data, dateKey) {
    const day = data[dateKey];
    if (!day || !Array.isArray(day.rows)) return new Set();
    const present = new Set();
    for (const r of day.rows) {
      const canon = resolveGuildName(r.familyName);
      if (canon) present.add(canon);
    }
    return present;
  }

  function buildPeriodAttendanceRows(data, dateKeys) {
    const nodeWarDates = dateKeys.filter((d) => !isSiegeDate(d));
    const siegeDates = dateKeys.filter((d) => isSiegeDate(d));
    const rows = getGuildRoster().map((name) => ({
      familyName: name,
      team: getMemberTeam(name) || "—",
      nodeWars: 0,
      siege: 0,
    }));

    const byName = new Map(rows.map((r) => [r.familyName, r]));

    for (const dk of nodeWarDates) {
      for (const name of presentCanonicalOnDate(data, dk)) {
        const row = byName.get(name);
        if (row) row.nodeWars += 1;
      }
    }

    for (const dk of siegeDates) {
      for (const name of presentCanonicalOnDate(data, dk)) {
        const row = byName.get(name);
        if (row) row.siege += 1;
      }
    }

    return { rows, nodeWarDates, siegeDates };
  }

  function buildWeeklyAttendanceRows(data, sundayIso) {
    const { nodeWarDates, siegeDates } = classifyWeekWarDates(data, sundayIso);
    const { rows } = buildPeriodAttendanceRows(data, datesInWeek(data, sundayIso));
    return { rows, nodeWarDates, siegeDates };
  }

  function monthlyAttendanceByCanonical(data, dateKeys) {
    const nodeWarDates = dateKeys.filter((d) => !isSiegeDate(d));
    const siegeDates = dateKeys.filter((d) => isSiegeDate(d));
    const counts = new Map();

    const bump = (name, field) => {
      const canon = resolveGuildName(name);
      if (!canon) return;
      if (!counts.has(canon)) counts.set(canon, { nodeWar: 0, siege: 0 });
      counts.get(canon)[field] += 1;
    };

    for (const dk of nodeWarDates) {
      for (const name of presentCanonicalOnDate(data, dk)) bump(name, "nodeWar");
    }
    for (const dk of siegeDates) {
      for (const name of presentCanonicalOnDate(data, dk)) bump(name, "siege");
    }
    return counts;
  }

  function attachMonthlyAttendance(rows, attendanceByCanon) {
    return rows.map((row) => {
      const canon = canonicalFamilyName(row.familyName);
      const att = attendanceByCanon.get(canon) || { nodeWar: 0, siege: 0 };
      return { ...row, nodeWar: att.nodeWar, siege: att.siege };
    });
  }

  function formatWeekAttendanceMeta(sundayIso, nodeWarDates, siegeDates) {
    const siegeNote =
      siegeDates.length === 0
        ? "no siege logged"
        : siegeDates.length === 1
          ? `siege ${formatShortDate(siegeDates[0])}`
          : `${siegeDates.length} sieges logged`;
    return `Sun–Sat week ${formatWeekRangeLabel(sundayIso)} · ${nodeWarDates.length} node war${
      nodeWarDates.length === 1 ? "" : "s"
    } · ${siegeNote}`;
  }

  function formatMonthAttendanceMeta(monthKey, nodeWarDates, siegeDates) {
    const siegeNote =
      siegeDates.length === 0
        ? "no siege logged"
        : siegeDates.length === 1
          ? `siege ${formatShortDate(siegeDates[0])}`
          : `${siegeDates.length} sieges logged`;
    return `${formatMonthLabel(monthKey)} · ${nodeWarDates.length} node war${
      nodeWarDates.length === 1 ? "" : "s"
    } · ${siegeNote}`;
  }

  function colsWithAttendanceStats() {
    const [familyCol, ...rest] = COLS;
    return [familyCol, ...ATTENDANCE_STAT_COLS, ...rest];
  }

  function getActiveCols() {
    if (currentView === VIEW.ATTENDANCE) return ATTENDANCE_COLS;
    if (isWarAnalysisView()) return buildAnalysisCols();
    if (
      currentView === VIEW.WEEKLY ||
      currentView === VIEW.MONTHLY ||
      currentView === VIEW.LIFETIME
    ) {
      return colsWithAttendanceStats();
    }
    return COLS;
  }

  function getWarData() {
    return window.NODE_WAR_DATA && typeof window.NODE_WAR_DATA === "object"
      ? window.NODE_WAR_DATA
      : {};
  }

  function getSiegeFortWins() {
    return window.SIEGE_FORT_WINS && typeof window.SIEGE_FORT_WINS === "object"
      ? window.SIEGE_FORT_WINS
      : {};
  }

  function getSiegeCastleHolders() {
    return window.SIEGE_CASTLE_HOLDERS && typeof window.SIEGE_CASTLE_HOLDERS === "object"
      ? window.SIEGE_CASTLE_HOLDERS
      : {};
  }

  function getSiegeOurAllianceGuilds() {
    const list = window.SIEGE_OUR_ALLIANCE;
    return Array.isArray(list)
      ? list.map(normalizeSiegeGuildName).filter(Boolean)
      : [];
  }

  function getSiegeEliteAllianceLabel() {
    const label = window.SIEGE_ELITE_ALLIANCE_LABEL;
    return typeof label === "string" && label.trim() ? label.trim() : "Elite Alliance";
  }

  function getSiegeNeutralGuilds() {
    const list = window.SIEGE_NEUTRAL_GUILDS;
    return Array.isArray(list)
      ? list.map(normalizeSiegeGuildName).filter(Boolean)
      : [];
  }

  function getSiegeNeutralAllianceLabel() {
    const label = window.SIEGE_NEUTRAL_ALLIANCE_LABEL;
    return typeof label === "string" && label.trim() ? label.trim() : "Neutral";
  }

  function isSiegeOurAllianceGuild(name) {
    const key = normalizeSiegeGuildName(name).toLowerCase();
    return getSiegeOurAllianceGuilds().some((g) => g.toLowerCase() === key);
  }

  function isSiegeNeutralGuild(name) {
    const key = normalizeSiegeGuildName(name).toLowerCase();
    return getSiegeNeutralGuilds().some((g) => g.toLowerCase() === key);
  }

  function splitTicketsByAlliance(tickets) {
    const ours = [];
    const elite = [];
    const neutral = [];
    for (const t of tickets) {
      if (isSiegeOurAllianceGuild(t.name)) ours.push(t);
      else if (isSiegeNeutralGuild(t.name)) neutral.push(t);
      else elite.push(t);
    }
    return { ours, elite, neutral };
  }

  function siegeWinnerAllianceClass(g) {
    if (isSiegeOurAllianceGuild(g)) return " siege-winner--ours";
    if (isSiegeNeutralGuild(g)) return " siege-winner--neutral";
    return " siege-winner--elite";
  }

  function renderSiegeTicketItem(t) {
    const fragMark = t.name.toUpperCase() === "FRAG" ? " siege-ticket--frag" : "";
    const castleMark = t.source === "castle" ? " siege-ticket--castle" : "";
    const meta =
      t.source === "castle"
        ? "castle holder"
        : `earned ${formatShortDate(t.firstDate)}`;
    return `<li class="siege-ticket${fragMark}${castleMark}">
      <span class="siege-ticket-guild">${escapeHtml(t.name)}</span>
      <span class="siege-ticket-meta">${escapeHtml(meta)}</span>
    </li>`;
  }

  function renderAllianceTicketBlock(label, tickets, modifierClass) {
    const count = tickets.length;
    const listHtml = count
      ? `<ul class="siege-ticket-list">${tickets.map(renderSiegeTicketItem).join("")}</ul>`
      : `<p class="siege-empty siege-empty--sub">None this week</p>`;
    return `<section class="siege-alliance ${modifierClass}" aria-label="${escapeHtml(label)}">
      <h4 class="siege-alliance-title">${escapeHtml(label)} <span class="siege-alliance-count">${count}</span></h4>
      ${listHtml}
    </section>`;
  }

  function renderSiegeWinnerTag(g, day) {
    const isNew = day.newTickets.some((n) => n.toLowerCase() === g.toLowerCase());
    const isRepeat = day.alreadyHadTicket.some((n) => n.toLowerCase() === g.toLowerCase());
    let cls = "siege-winner";
    if (isNew) cls += " siege-winner--new";
    else if (isRepeat) cls += " siege-winner--repeat";
    const note = isNew
      ? ' <em class="siege-winner-note">+ticket</em>'
      : isRepeat
        ? ' <em class="siege-winner-note">already had ticket</em>'
        : "";
    const allianceMark = siegeWinnerAllianceClass(g);
    return `<span class="${cls}${allianceMark}">${escapeHtml(g)}${note}</span>`;
  }

  function renderSiegeDayAllianceGroup(label, winners, day) {
    if (!winners.length) return "";
    return `<div class="siege-day-group">
      <span class="siege-day-group-label">${escapeHtml(label)}</span>
      <div class="siege-day-winners">${winners.map((g) => renderSiegeWinnerTag(g, day)).join("")}</div>
    </div>`;
  }

  function normalizeSiegeGuildName(name) {
    return String(name || "").trim();
  }

  function siegeFortWinDates() {
    return Object.keys(getSiegeFortWins())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  }

  /** Sun–Sat weeks from node war dates plus any fort-win dates. */
  function uniqueWeekStartsAll(data) {
    const set = new Map();
    for (const d of sortedDateKeys(data)) {
      const sun = sundayOfWeekUTC(d);
      if (!set.has(sun)) set.set(sun, new Set());
      set.get(sun).add(d);
    }
    for (const d of siegeFortWinDates()) {
      const sun = sundayOfWeekUTC(d);
      if (!set.has(sun)) set.set(sun, new Set());
      set.get(sun).add(d);
    }
    return Array.from(set.entries())
      .map(([sunday, dateSet]) => ({ sunday, dates: Array.from(dateSet).sort() }))
      .sort((a, b) => b.sunday.localeCompare(a.sunday));
  }

  function computeWeekSiegeTickets(sundayIso) {
    const wins = getSiegeFortWins();
    const castleHolders = getSiegeCastleHolders();
    const saturday = saturdayOfWeekUTC(sundayIso);
    const ticketByKey = new Map();
    const dailyLog = [];

    const castleGuilds = castleHolders[sundayIso];
    if (Array.isArray(castleGuilds)) {
      for (const raw of castleGuilds) {
        const name = normalizeSiegeGuildName(raw);
        if (!name) continue;
        const key = name.toLowerCase();
        if (!ticketByKey.has(key)) {
          ticketByKey.set(key, { name, firstDate: sundayIso, source: "castle" });
        }
      }
    }

    const dates = siegeFortWinDates().filter((d) => d >= sundayIso && d <= saturday);

    for (const date of dates) {
      const rawGuilds = wins[date];
      if (!Array.isArray(rawGuilds)) continue;

      const winners = [];
      const newTickets = [];
      const alreadyHadTicket = [];

      for (const raw of rawGuilds) {
        const name = normalizeSiegeGuildName(raw);
        if (!name) continue;
        winners.push(name);
        const key = name.toLowerCase();
        if (!ticketByKey.has(key)) {
          ticketByKey.set(key, { name, firstDate: date, source: "fort" });
          newTickets.push(name);
        } else {
          alreadyHadTicket.push(name);
        }
      }

      if (winners.length) {
        dailyLog.push({ date, winners, newTickets, alreadyHadTicket });
      }
    }

    const tickets = Array.from(ticketByKey.values()).sort(
      (a, b) =>
        (a.source === "castle" ? 0 : 1) - (b.source === "castle" ? 0 : 1) ||
        a.firstDate.localeCompare(b.firstDate) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    return { tickets, dailyLog, ticketCount: tickets.length };
  }

  function sortedDateKeys(data) {
    return Object.keys(data).filter((k) => data[k] && Array.isArray(data[k].rows)).sort();
  }

  function parseISOUTC(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /** Sunday (UTC) of the Sunday–Saturday week containing `iso` (ISO YYYY-MM-DD). */
  function sundayOfWeekUTC(iso) {
    const dt = parseISOUTC(iso);
    const dow = dt.getUTCDay();
    dt.setUTCDate(dt.getUTCDate() - dow);
    return dt.toISOString().slice(0, 10);
  }

  /** Saturday (UTC) of the Sunday–Saturday week that starts on `sundayIso`. */
  function saturdayOfWeekUTC(sundayIso) {
    return addDaysUTC(sundayIso, 6);
  }

  /** Whether `iso` falls in the Sun–Sat week starting on `sundayIso` (inclusive). */
  function isDateInWeekUTC(iso, sundayIso) {
    return iso >= sundayIso && iso <= saturdayOfWeekUTC(sundayIso);
  }

  function addDaysUTC(iso, n) {
    const dt = parseISOUTC(iso);
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function formatShortDate(iso) {
    const dt = parseISOUTC(iso);
    return dt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function formatWeekdayShortUTC(iso) {
    return parseISOUTC(iso).toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: "UTC",
    });
  }

  function formatWeekRangeLabel(sundayIso) {
    const saturday = saturdayOfWeekUTC(sundayIso);
    return `${formatWeekdayShortUTC(sundayIso)}, ${formatShortDate(sundayIso)} – ${formatWeekdayShortUTC(saturday)}, ${formatShortDate(saturday)}`;
  }

  /** Calendar month key `YYYY-MM` (UTC) for an ISO date. */
  function monthKeyUTC(iso) {
    const dt = parseISOUTC(iso);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function previousMonthKey(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 2, 1));
    const py = dt.getUTCFullYear();
    const pm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    return `${py}-${pm}`;
  }

  /** Prior calendar month's MVP winner, or null if that month has no logged wars. */
  function getRecordedMvpWinner(monthKey) {
    const map = window.GUILD_MVP_WINNERS;
    if (!map || typeof map !== "object") return null;
    const raw = map[monthKey];
    if (!raw) return null;
    return resolveGuildName(raw) || raw;
  }

  function getRecordedHealerMvpWinner(monthKey) {
    const map = window.GUILD_HEALER_MVP_WINNERS;
    if (!map || typeof map !== "object") return null;
    const raw = map[monthKey];
    if (!raw) return null;
    return resolveGuildName(raw) || raw;
  }

  function getHealerMvpStartMonth() {
    const raw = window.GUILD_HEALER_MVP_START_MONTH;
    return typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw) ? raw : "2026-08";
  }

  function isHealerMvpMonth(monthKey) {
    return Boolean(monthKey) && monthKey >= getHealerMvpStartMonth();
  }

  function getHealerMvpCooldownMonths() {
    const n = Number(window.GUILD_HEALER_MVP_COOLDOWN_MONTHS);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }

  /** Prior Healer MVP winners still on cooldown this month. */
  function getHealerMvpCooldownExclusions(data, monthKey) {
    const excluded = new Set();
    let cursor = monthKey;
    for (let i = 0; i < getHealerMvpCooldownMonths(); i++) {
      cursor = previousMonthKey(cursor);
      if (!isHealerMvpMonth(cursor)) continue;
      const winner = getMonthHealerMvpWinner(data, cursor);
      if (!winner) continue;
      excluded.add(String(canonicalFamilyName(winner)).toLowerCase());
    }
    return excluded;
  }

  function getMvpCooldownMonths() {
    const n = Number(window.GUILD_MVP_COOLDOWN_MONTHS);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
  }

  /** Winners from each of the prior N months who are still on cooldown this month. */
  function getMvpCooldownExclusions(data, monthKey) {
    const excluded = new Set();
    let cursor = monthKey;
    for (let i = 0; i < getMvpCooldownMonths(); i++) {
      cursor = previousMonthKey(cursor);
      const winner = getMonthMvpWinner(data, cursor);
      if (!winner) continue;
      excluded.add(String(canonicalFamilyName(winner)).toLowerCase());
    }
    return excluded;
  }

  function getMonthMvpWinner(data, monthKey) {
    const entry = getMonthMvpWinnerEntry(data, monthKey);
    return entry ? entry.familyName : null;
  }

  function getMonthMvpWinnerEntry(data, monthKey) {
    const dates = datesInMonth(data, monthKey);
    if (!dates.length) return null;

    const rows = filterGuildRows(aggregateByFamily(data, dates));
    if (!rows.length) return null;

    const ranked = computeMvpScores(rows);
    let familyName = getRecordedMvpWinner(monthKey);
    if (!familyName) {
      const winner = ranked[0];
      familyName = winner ? resolveGuildName(winner.familyName) || winner.familyName : null;
    }
    if (!familyName) return null;

    const entry = ranked.find(
      (e) => canonicalFamilyName(e.familyName) === canonicalFamilyName(familyName)
    );
    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      familyName,
      score: entry?.score ?? 0,
    };
  }

  function getMonthHealerMvpWinner(data, monthKey) {
    const entry = getMonthHealerMvpWinnerEntry(data, monthKey);
    return entry ? entry.familyName : null;
  }

  function getMonthHealerMvpWinnerEntry(data, monthKey) {
    if (!isHealerMvpMonth(monthKey)) return null;

    const dates = datesInMonth(data, monthKey);
    if (!dates.length) return null;

    const rows = filterGuildRows(aggregateByFamily(data, dates));
    if (!rows.length) return null;

    const ranked = computeHealerMvpScores(rows);
    let familyName = getRecordedHealerMvpWinner(monthKey);
    if (!familyName) {
      const winner = ranked[0];
      familyName = winner ? resolveGuildName(winner.familyName) || winner.familyName : null;
    }
    if (!familyName) return null;

    const entry = ranked.find(
      (e) => canonicalFamilyName(e.familyName) === canonicalFamilyName(familyName)
    );
    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      familyName,
      score: entry?.score ?? 0,
    };
  }

  /** Recent MVP winners before the analysis month (newest first). */
  function getPriorMonthMvpWinners(data, monthKey, maxMonths = 12) {
    if (!monthKey) return [];
    const winners = [];
    let cursor = monthKey;
    for (let i = 0; i < maxMonths; i++) {
      const prevKey = previousMonthKey(cursor);
      const entry = getMonthMvpWinnerEntry(data, prevKey);
      if (!entry) break;
      winners.push(entry);
      cursor = prevKey;
    }
    return winners;
  }

  function getAnalysisContextMonthKey(data) {
    const keys = getPeriodDateKeys(data);
    return keys[0] ? monthKeyUTC(keys[0]) : null;
  }

  function parseGameNumber(s) {
    if (s == null) return 0;
    const t = String(s).trim().toUpperCase().replace(/,/g, "");
    if (t === "" || t === "-") return 0;
    let m = t.match(/^([\d.]+)\s*M$/);
    if (m) return parseFloat(m[1]) * 1e6;
    m = t.match(/^([\d.]+)\s*K$/);
    if (m) return parseFloat(m[1]) * 1e3;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }

  function formatGameNumber(n) {
    if (!Number.isFinite(n) || n === 0) return "0";
    const abs = Math.abs(n);
    if (abs >= 1e6) {
      const v = n / 1e6;
      const s = v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "");
      return s + "M";
    }
    if (abs >= 1e3) {
      const v = n / 1e3;
      const s = v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "");
      return s + "K";
    }
    return String(Math.round(n));
  }

  /** Treat values as minutes:seconds (node war UI). */
  function parseTimeToSeconds(s) {
    const parts = String(s || "")
      .trim()
      .split(":")
      .map((x) => parseInt(x, 10));
    if (parts.some((n) => !Number.isFinite(n))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function formatTimeFromSeconds(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function valueForAverage(row, colDef) {
    if (colDef.type === "pct") return Number(row[colDef.key]) || 0;
    if (colDef.key === "timeDead" || colDef.key === "timeSurvived") {
      return parseTimeToSeconds(row[colDef.key]);
    }
    if (colDef.type === "num") return Number(row[colDef.key]) || 0;
    return parseGameNumber(row[colDef.key]);
  }

  function formatAvgNumber(mean) {
    if (!Number.isFinite(mean)) return "0";
    const rounded = Math.round(mean * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
    return rounded.toFixed(1);
  }

  function shouldShowColumnAverage(colDef) {
    return colDef.key !== "familyName" && colDef.key !== "team";
  }

  function formatAverageForCol(mean, colDef) {
    if (colDef.type === "pct") return formatMvpScore(mean);
    if (colDef.type === "num") return formatAvgNumber(mean);
    if (colDef.key === "timeDead" || colDef.key === "timeSurvived") {
      return formatTimeFromSeconds(Math.round(mean));
    }
    return formatGameNumber(mean);
  }

  function computeColumnAverages(rows, cols = getActiveCols()) {
    const n = rows.length;
    const avgs = new Map();
    if (!n) return avgs;
    for (const c of cols) {
      if (!shouldShowColumnAverage(c)) continue;
      let sum = 0;
      for (const r of rows) sum += valueForAverage(r, c);
      avgs.set(c.key, formatAverageForCol(sum / n, c));
    }
    return avgs;
  }

  function formatDisplayValue(v, colDef) {
    if (colDef.type === "pct") return formatMvpScore(Number(v) || 0);
    return String(v ?? "");
  }

  function statValueWithAvg(v, colDef, avgByCol) {
    if (!shouldShowColumnAverage(colDef)) {
      return escapeHtml(formatDisplayValue(v, colDef));
    }
    const avg = avgByCol.get(colDef.key);
    const display = escapeHtml(formatDisplayValue(v, colDef));
    if (!avg) return display;
    return `${display} <span class="stat-avg">(AVG ${escapeHtml(avg)})</span>`;
  }

  /** Averages over the given rows (same list shown in the table, after search). */
  function computeAverageRow(rows) {
    const n = rows.length;
    if (!n) return null;
    const avgs = computeColumnAverages(rows);
    const out = { familyName: `Average (${n})` };
    for (const c of getActiveCols()) {
      if (c.key === "familyName") continue;
      out[c.key] = avgs.get(c.key) ?? "";
    }
    return out;
  }

  function emptyAccumulator() {
    return {
      enemyKills: 0,
      deaths: 0,
      maxKillStreak: 0,
      damageDealt: 0,
      damageTaken: 0,
      ccHits: 0,
      hpHealed: 0,
      allyHp: 0,
      totalDamageToFort: 0,
      cannonHits: 0,
      objectsDestroyedCannon: 0,
      maxCannonHitDistance: 0,
      trapsTriggered: 0,
      timeDeadSec: 0,
      timeSurvivedSec: 0,
    };
  }

  function mergeRowInto(acc, r) {
    acc.enemyKills += Number(r.enemyKills) || 0;
    acc.deaths += Number(r.deaths) || 0;
    acc.maxKillStreak = Math.max(acc.maxKillStreak, Number(r.maxKillStreak) || 0);
    acc.damageDealt += parseGameNumber(r.damageDealt);
    acc.damageTaken += parseGameNumber(r.damageTaken);
    acc.ccHits += Number(r.ccHits) || 0;
    acc.hpHealed += parseGameNumber(r.hpHealed);
    acc.allyHp += parseGameNumber(r.allyHp);
    acc.totalDamageToFort += parseGameNumber(r.totalDamageToFort);
    acc.cannonHits += Number(r.cannonHits) || 0;
    acc.objectsDestroyedCannon += Number(r.objectsDestroyedCannon) || 0;
    acc.maxCannonHitDistance = Math.max(
      acc.maxCannonHitDistance,
      Number(r.maxCannonHitDistance) || 0
    );
    acc.trapsTriggered += Number(r.trapsTriggered) || 0;
    acc.timeDeadSec += parseTimeToSeconds(r.timeDead);
    acc.timeSurvivedSec += parseTimeToSeconds(r.timeSurvived);
  }

  function accToDisplayRow(familyName, acc) {
    return {
      familyName,
      enemyKills: acc.enemyKills,
      deaths: acc.deaths,
      maxKillStreak: acc.maxKillStreak,
      damageDealt: formatGameNumber(acc.damageDealt),
      damageTaken: formatGameNumber(acc.damageTaken),
      ccHits: acc.ccHits,
      hpHealed: formatGameNumber(acc.hpHealed),
      allyHp: formatGameNumber(acc.allyHp),
      totalDamageToFort: formatGameNumber(acc.totalDamageToFort),
      cannonHits: acc.cannonHits,
      objectsDestroyedCannon: acc.objectsDestroyedCannon,
      maxCannonHitDistance: acc.maxCannonHitDistance,
      trapsTriggered: acc.trapsTriggered,
      timeDead: formatTimeFromSeconds(acc.timeDeadSec),
      timeSurvived: formatTimeFromSeconds(acc.timeSurvivedSec),
    };
  }

  function safeRatio(value, highest) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (!Number.isFinite(highest) || highest <= 0) return 0;
    return value / highest;
  }

  function mvpMetricsFromRow(row) {
    return {
      enemyKills: Number(row.enemyKills) || 0,
      damageDealt: parseGameNumber(row.damageDealt),
      ccHits: Number(row.ccHits) || 0,
      totalDamageToFort: parseGameNumber(row.totalDamageToFort),
      healing: parseGameNumber(row.hpHealed) + parseGameNumber(row.allyHp),
      timeSurvived: parseTimeToSeconds(row.timeSurvived),
      damageTaken: parseGameNumber(row.damageTaken),
      deaths: Number(row.deaths) || 0,
    };
  }

  /** MVP-weighted score vs guild-high for each category. */
  function computeMvpScores(rows, { maxRows = null } = {}) {
    if (!rows.length) return [];
    const maxSource = maxRows && maxRows.length ? maxRows : rows;
    const withMetrics = rows.map((row) => ({
      familyName: row.familyName,
      m: mvpMetricsFromRow(row),
    }));
    const maxMetrics = maxSource.map((row) => mvpMetricsFromRow(row));
    const max = {};
    for (const c of MVP_COMPONENTS) {
      if (c.key === "deaths") {
        max.deaths = Math.max(...maxMetrics.map((m) => m.deaths));
      } else if (c.key === "healing") {
        max.healing = Math.max(...maxMetrics.map((m) => m.healing));
      } else {
        max[c.key] = Math.max(...maxMetrics.map((m) => m[c.key]));
      }
    }

    return withMetrics
      .map(({ familyName, m }) => {
        const parts = {};
        for (const c of MVP_COMPONENTS) {
          if (c.key === "deaths") {
            parts.deaths =
              c.weight *
              Math.max(0, max.deaths > 0 ? 1 - m.deaths / max.deaths : 1);
          } else if (c.key === "healing") {
            parts.healing = c.weight * Math.min(1, safeRatio(m.healing, max.healing));
          } else {
            parts[c.key] = c.weight * Math.min(1, safeRatio(m[c.key], max[c.key]));
          }
        }
        const score = Object.values(parts).reduce((sum, v) => sum + v, 0);
        return { familyName, score, parts };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.familyName.localeCompare(b.familyName, undefined, { sensitivity: "base" })
      );
  }

  function healerMvpMetricsFromRow(row) {
    return {
      allyHp: parseGameNumber(row.allyHp),
      ccHits: Number(row.ccHits) || 0,
    };
  }

  /** Healer MVP: weighted score vs guild-high for support categories. */
  function computeHealerMvpScores(rows) {
    if (!rows.length) return [];
    const withMetrics = rows.map((row) => ({
      familyName: row.familyName,
      m: healerMvpMetricsFromRow(row),
    }));
    const max = {};
    for (const c of HEALER_MVP_COMPONENTS) {
      max[c.key] = Math.max(...withMetrics.map((x) => x.m[c.key]));
    }

    return withMetrics
      .map(({ familyName, m }) => {
        const parts = {};
        for (const c of HEALER_MVP_COMPONENTS) {
          parts[c.key] = c.weight * Math.min(1, safeRatio(m[c.key], max[c.key]));
        }
        const score = Object.values(parts).reduce((sum, v) => sum + v, 0);
        return { familyName, score, parts };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.familyName.localeCompare(b.familyName, undefined, { sensitivity: "base" })
      );
  }

  function formatMvpScore(score) {
    return `${(score * 100).toFixed(1)}%`;
  }

  function formatMvpWeight(weight) {
    const pct = weight * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
  }

  function canonicalFamilyName(familyName) {
    return resolveGuildName(familyName) || familyName;
  }

  function getMvpExcludedSet() {
    const fromGuild = window.GUILD_MVP_EXCLUDED || [];
    return new Set(fromGuild.map((n) => String(n).toLowerCase()));
  }

  function isMvpExcluded(familyName) {
    const canon = canonicalFamilyName(familyName);
    return getMvpExcludedSet().has(String(canon).toLowerCase());
  }

  /** Optional manual MVP exclusions from guild config. */
  function filterMvpPermanentlyExcludedRows(rows) {
    return rows.filter((r) => !isMvpExcluded(r.familyName));
  }

  function filterMvpEligibleRows(rows) {
    return filterMvpPermanentlyExcludedRows(rows);
  }

  /** Drop recent MVP winners on cooldown; used on Monthly MVP page only. */
  function mvpEligibleEntries(ranked, excludeNames = null) {
    let list = ranked.slice();
    if (!excludeNames) return list;
    const excludeSet =
      excludeNames instanceof Set
        ? excludeNames
        : new Set([String(canonicalFamilyName(excludeNames)).toLowerCase()]);
    if (!excludeSet.size) return list;
    return list.filter(
      (entry) => !excludeSet.has(String(canonicalFamilyName(entry.familyName)).toLowerCase())
    );
  }

  function renderMvpLeaderboard(leaderboardEl, ranked, topN = 10, excludeNames = null) {
    const list = excludeNames ? mvpEligibleEntries(ranked, excludeNames) : ranked;
    leaderboardEl.innerHTML = list.slice(0, topN)
      .map((entry, i) => {
        const first = i === 0 ? " mvp-rank-item--first" : "";
        return `<li class="mvp-rank-item${first}">
          <span class="mvp-rank-num">${i + 1}</span>
          <span class="mvp-rank-name">${formatFamilyNameCell(entry.familyName)}</span>
          <span class="mvp-rank-score">${escapeHtml(formatMvpScore(entry.score))}</span>
        </li>`;
      })
      .join("");
  }

  function renderMvpSection(rows) {
    if (!mvpSection) return;
    const data = getWarData();
    const guildRows = filterGuildRows(rows);
    const show = currentView === VIEW.MONTHLY && guildRows.length > 0;
    mvpSection.hidden = !show;
    if (!show) return;

    const monthKeys = getPeriodDateKeys(data);
    const monthKey = monthKeys[0] ? monthKeyUTC(monthKeys[0]) : null;

    const ranked = computeMvpScores(guildRows);
    const cooldown = monthKey ? getMvpCooldownExclusions(data, monthKey) : new Set();
    const eligible = mvpEligibleEntries(ranked, cooldown);

    const recorded = monthKey ? getRecordedMvpWinner(monthKey) : null;
    let winner = null;
    if (recorded) {
      winner =
        ranked.find(
          (entry) =>
            canonicalFamilyName(entry.familyName) === canonicalFamilyName(recorded)
        ) || null;
    } else {
      winner = eligible[0] || null;
    }

    mvpWinner.innerHTML = winner
      ? `
      <p class="mvp-winner-label">MVP</p>
      <p class="mvp-winner-name">${formatFamilyNameCell(winner.familyName)}</p>
      <p class="mvp-winner-score">Overall score ${escapeHtml(formatMvpScore(winner.score))}</p>
    `
      : `
      <p class="mvp-winner-label">MVP</p>
      <p class="mvp-winner-score">No eligible MVP this month.</p>
    `;

    mvpBreakdown.innerHTML = MVP_COMPONENTS.map(
      (c) => `<div>
        <dt>${escapeHtml(c.label)}</dt>
        <dd class="mvp-weight">${escapeHtml(formatMvpWeight(c.weight))}</dd>
      </div>`
    ).join("");

    renderMvpLeaderboard(mvpLeaderboard, eligible, 10);

    if (!isHealerMvpMonth(monthKey)) {
      healerMvpWinner.innerHTML = `
        <p class="mvp-winner-label">Healer MVP</p>
        <p class="mvp-winner-score">Starts ${escapeHtml(formatMonthLabel(getHealerMvpStartMonth()))}</p>
      `;
      healerMvpBreakdown.innerHTML = HEALER_MVP_COMPONENTS.map(
        (c) => `<div>
          <dt>${escapeHtml(c.label)}</dt>
          <dd class="mvp-weight">${escapeHtml(formatMvpWeight(c.weight))}</dd>
        </div>`
      ).join("");
      healerMvpLeaderboard.innerHTML = "";
      return;
    }

    const healerRanked = computeHealerMvpScores(guildRows);
    const healerCooldown = monthKey ? getHealerMvpCooldownExclusions(data, monthKey) : new Set();
    const healerEligible = mvpEligibleEntries(healerRanked, healerCooldown);
    const healerRecorded = monthKey ? getRecordedHealerMvpWinner(monthKey) : null;
    let healerWinner = null;
    if (healerRecorded) {
      healerWinner =
        healerRanked.find(
          (entry) =>
            canonicalFamilyName(entry.familyName) === canonicalFamilyName(healerRecorded)
        ) || null;
    } else {
      healerWinner = healerEligible[0] || null;
    }

    healerMvpWinner.innerHTML = healerWinner
      ? `
      <p class="mvp-winner-label">Healer MVP</p>
      <p class="mvp-winner-name">${formatFamilyNameCell(healerWinner.familyName)}</p>
      <p class="mvp-winner-score">Overall score ${escapeHtml(formatMvpScore(healerWinner.score))}</p>
    `
      : `
      <p class="mvp-winner-label">Healer MVP</p>
      <p class="mvp-winner-score">No eligible Healer MVP this month.</p>
    `;

    healerMvpBreakdown.innerHTML = HEALER_MVP_COMPONENTS.map(
      (c) => `<div>
        <dt>${escapeHtml(c.label)}</dt>
        <dd class="mvp-weight">${escapeHtml(formatMvpWeight(c.weight))}</dd>
      </div>`
    ).join("");

    renderMvpLeaderboard(healerMvpLeaderboard, healerEligible, 10);
  }

  function aggregateByFamily(data, dateKeys) {
    const map = new Map();
    for (const dk of dateKeys) {
      const entry = data[dk];
      if (!entry || !Array.isArray(entry.rows)) continue;
      for (const r of entry.rows) {
        const name = r.familyName;
        if (!map.has(name)) map.set(name, emptyAccumulator());
        mergeRowInto(map.get(name), r);
      }
    }
    return Array.from(map.entries())
      .map(([name, acc]) => accToDisplayRow(name, acc))
      .sort((a, b) => a.familyName.localeCompare(b.familyName, undefined, { sensitivity: "base" }));
  }

  function datesInWeek(data, sundayIso) {
    return sortedDateKeys(data).filter((d) => isDateInWeekUTC(d, sundayIso));
  }

  function uniqueWeekStarts(data) {
    const keys = sortedDateKeys(data);
    const set = new Map();
    for (const d of keys) {
      const sun = sundayOfWeekUTC(d);
      if (!set.has(sun)) set.set(sun, []);
      set.get(sun).push(d);
    }
    return Array.from(set.entries())
      .map(([sunday, dates]) => ({ sunday, dates }))
      .sort((a, b) => b.sunday.localeCompare(a.sunday));
  }

  function datesInMonth(data, monthKey) {
    return sortedDateKeys(data).filter((d) => monthKeyUTC(d) === monthKey);
  }

  function uniqueMonths(data) {
    const keys = sortedDateKeys(data);
    const set = new Map();
    for (const d of keys) {
      const mk = monthKeyUTC(d);
      if (!set.has(mk)) set.set(mk, []);
      set.get(mk).push(d);
    }
    return Array.from(set.entries())
      .map(([month, dates]) => ({ month, dates }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  function resetSort() {
    sortKey = null;
    sortDir = "asc";
  }

  function colDefByKey(key) {
    return getActiveCols().find((c) => c.key === key);
  }

  function cellSortValue(row, colDef) {
    const v = row[colDef.key];
    switch (colDef.key) {
      case "familyName":
      case "team":
        return String(v || "").toLowerCase();
      case "timeDead":
      case "timeSurvived":
        return parseTimeToSeconds(v);
      default:
        if (colDef.type === "num") return Number(v) || 0;
        if (colDef.type === "pct") return Number(v) || 0;
        if (colDef.type === "str") return parseGameNumber(v);
        return String(v || "");
    }
  }

  function compareSortValues(va, vb) {
    if (typeof va === "number" && typeof vb === "number") {
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    }
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
  }

  function sortRowsInPlace(rows) {
    if (!sortKey) return rows;
    const col = colDefByKey(sortKey);
    if (!col) return rows;
    const nameCol = colDefByKey("familyName");
    const mult = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = cellSortValue(a, col);
      const vb = cellSortValue(b, col);
      let cmp = compareSortValues(va, vb);
      if (cmp !== 0) return mult * cmp;
      return compareSortValues(cellSortValue(a, nameCol), cellSortValue(b, nameCol));
    });
  }

  function applyHeaderSortIndicators() {
    thead.querySelectorAll(".th-sort-btn").forEach((btn) => {
      const key = btn.getAttribute("data-sort-key");
      const th = btn.closest("th");
      const ind = btn.querySelector(".sort-ind");
      if (!th || !ind) return;
      th.removeAttribute("aria-sort");
      ind.textContent = "";
      if (sortKey === key) {
        th.setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
        ind.textContent = sortDir === "asc" ? "▲" : "▼";
      }
    });
  }

  function renderHead() {
    const cols = getActiveCols();
    thead.innerHTML = cols
      .map((c) => {
        if (c.key === "familyName") {
          return familyNameHeaderHtml(c.label);
        }
        const align = c.type === "text" ? "th--text" : "th--num";
        const num = c.type === "text" ? "" : c.type;
        return `<th class="th-sortable ${align}${num ? " " + num : ""}" scope="col">
        <button type="button" class="th-sort-btn" data-sort-key="${escapeHtml(c.key)}" aria-label="Sort by ${escapeHtml(c.label)}">
          <span class="th-sort-label">${escapeHtml(c.label)}</span>
          <span class="sort-ind" aria-hidden="true"></span>
        </button>
      </th>`;
      })
      .join("");
  }

  function getRowsForView() {
    const data = getWarData();
    const keys = sortedDateKeys(data);
    if (!keys.length) return { rows: [], meta: "No data in NODE_WAR_DATA" };

    if (currentView === VIEW.DAILY) {
      const dk = currentDate && data[currentDate] ? currentDate : keys[keys.length - 1];
      const day = data[dk];
      const rows = (day.rows || []).slice();
      return {
        rows,
        meta: `${formatShortDate(dk)} · Node war result`,
      };
    }

    if (currentView === VIEW.WEEKLY) {
      const weeks = uniqueWeekStarts(data);
      const sun =
        currentWeekSunday && weeks.some((w) => w.sunday === currentWeekSunday)
          ? currentWeekSunday
          : weeks[0].sunday;
      const inWeek = datesInWeek(data, sun);
      const attendance = monthlyAttendanceByCanonical(data, inWeek);
      const rows = attachMonthlyAttendance(aggregateByFamily(data, inWeek), attendance);
      const meta = `Sun–Sat week ${formatWeekRangeLabel(sun)} · ${inWeek.length} war${
        inWeek.length === 1 ? "" : "s"
      } logged`;
      return { rows, meta };
    }

    if (currentView === VIEW.WEEKLY_ANALYSIS) {
      const weeks = uniqueWeekStarts(data);
      const sun =
        currentWeekSunday && weeks.some((w) => w.sunday === currentWeekSunday)
          ? currentWeekSunday
          : weeks[0].sunday;
      const inWeek = datesInWeek(data, sun);
      const attendance = monthlyAttendanceByCanonical(data, inWeek);
      const rows = attachMonthlyAttendance(aggregateByFamily(data, inWeek), attendance);
      const meta = `Weekly analysis · Sun–Sat ${formatWeekRangeLabel(sun)} · ${inWeek.length} war${
        inWeek.length === 1 ? "" : "s"
      }`;
      return { rows, meta };
    }

    if (currentView === VIEW.MONTHLY) {
      const months = uniqueMonths(data);
      const mk =
        currentMonth && months.some((m) => m.month === currentMonth)
          ? currentMonth
          : months[0].month;
      const inMonth = datesInMonth(data, mk);
      const attendance = monthlyAttendanceByCanonical(data, inMonth);
      const rows = attachMonthlyAttendance(aggregateByFamily(data, inMonth), attendance);
      const meta = `${formatMonthLabel(mk)} · ${inMonth.length} war${
        inMonth.length === 1 ? "" : "s"
      } logged`;
      return { rows, meta };
    }

    if (currentView === VIEW.MONTHLY_ANALYSIS) {
      const months = uniqueMonths(data);
      const mk =
        currentMonth && months.some((m) => m.month === currentMonth)
          ? currentMonth
          : months[0].month;
      const inMonth = datesInMonth(data, mk);
      const attendance = monthlyAttendanceByCanonical(data, inMonth);
      const rows = attachMonthlyAttendance(aggregateByFamily(data, inMonth), attendance);
      const meta = `Monthly analysis · ${formatMonthLabel(mk)} · ${inMonth.length} war${
        inMonth.length === 1 ? "" : "s"
      }`;
      return { rows, meta };
    }

    const attendance = monthlyAttendanceByCanonical(data, keys);
    const rows = attachMonthlyAttendance(aggregateByFamily(data, keys), attendance);
    return {
      rows,
      meta: `Lifetime · ${keys.length} day${keys.length === 1 ? "" : "s"} recorded`,
    };
  }

  function hideStatsPanels() {
    if (attendancePanel) attendancePanel.hidden = true;
    if (mvpSection) mvpSection.hidden = true;
    if (warAnalysisPanel) warAnalysisPanel.hidden = true;
  }

  function setMainViewChrome(view) {
    const standalone =
      view === VIEW.SIEGE_TICKETS ||
      view === VIEW.CLASS_RANKINGS ||
      view === VIEW.EDANIA_CHESTS;
    if (statsTablePanel) statsTablePanel.hidden = standalone;
    if (toolbarPanel) toolbarPanel.hidden = standalone;
    if (siegeTicketsPanel) siegeTicketsPanel.hidden = view !== VIEW.SIEGE_TICKETS;
    if (classRankingsPanel) classRankingsPanel.hidden = view !== VIEW.CLASS_RANKINGS;
    if (edaniaChestsPanel) edaniaChestsPanel.hidden = view !== VIEW.EDANIA_CHESTS;
  }

  function renderClassRankingsTabBody() {
    hideStatsPanels();
    setMainViewChrome(VIEW.CLASS_RANKINGS);
    metaEl.textContent = "FRAG Class Rankings · Multi-mode tier list";
    countEl.textContent = "";
    if (window.FRAGClassRankings) window.FRAGClassRankings.render();
  }

  function renderEdaniaChestsTabBody() {
    hideStatsPanels();
    setMainViewChrome(VIEW.EDANIA_CHESTS);
    metaEl.textContent = "Edania II Agris chest tracker · Tachyon Traces & Legacy";
    countEl.textContent = "";
    if (window.FRAGEdaniaChests) window.FRAGEdaniaChests.render();
  }

  function renderSiegeTicketsTabBody() {
    hideStatsPanels();
    setMainViewChrome(VIEW.SIEGE_TICKETS);

    const data = getWarData();
    const weeks = uniqueWeekStartsAll(data);
    const sun =
      currentWeekSunday && weeks.some((w) => w.sunday === currentWeekSunday)
        ? currentWeekSunday
        : weeks[0]?.sunday;

    if (!sun || !siegeTicketsPanel) {
      metaEl.textContent = "Weekly siege tickets";
      countEl.textContent = "";
      if (siegeTicketsPanel) {
        siegeTicketsPanel.innerHTML =
          '<p class="siege-empty">No weeks available yet. Add fort wins in siege-tickets.js.</p>';
      }
      return;
    }

    currentWeekSunday = sun;
    if (weekSelect.value !== sun) weekSelect.value = sun;

    const { tickets, dailyLog, ticketCount } = computeWeekSiegeTickets(sun);
    const { ours, elite, neutral } = splitTicketsByAlliance(tickets);
    const ourLabel = "Our Alliance";
    const eliteLabel = getSiegeEliteAllianceLabel();
    const neutralLabel = getSiegeNeutralAllianceLabel();
    const weekLabel = formatWeekRangeLabel(sun);
    metaEl.textContent = `Weekly siege tickets · Sun–Sat ${weekLabel}`;

    const ticketListHtml =
      tickets.length > 0
        ? `<div class="siege-alliance-grid">
            ${renderAllianceTicketBlock(ourLabel, ours, "siege-alliance--ours")}
            ${renderAllianceTicketBlock(eliteLabel, elite, "siege-alliance--elite")}
            ${renderAllianceTicketBlock(neutralLabel, neutral, "siege-alliance--neutral")}
          </div>`
        : `<p class="siege-empty">No siege tickets yet this week. Report fort winners to add them.</p>`;

    const dailyHtml = dailyLog.length
      ? `<ol class="siege-daily-log">${dailyLog
          .map((day) => {
            const ourWinners = day.winners.filter((g) => isSiegeOurAllianceGuild(g));
            const neutralWinners = day.winners.filter((g) => isSiegeNeutralGuild(g));
            const eliteWinners = day.winners.filter(
              (g) => !isSiegeOurAllianceGuild(g) && !isSiegeNeutralGuild(g)
            );
            return `<li class="siege-day">
              <span class="siege-day-date">${escapeHtml(formatShortDate(day.date))}</span>
              ${renderSiegeDayAllianceGroup(ourLabel, ourWinners, day)}
              ${renderSiegeDayAllianceGroup(eliteLabel, eliteWinners, day)}
              ${renderSiegeDayAllianceGroup(neutralLabel, neutralWinners, day)}
            </li>`;
          })
          .join("")}</ol>`
        : `<p class="siege-empty siege-empty--sub">No fort wins logged for this week.</p>`;

    siegeTicketsPanel.innerHTML = `
      <div class="siege-head">
        <h2 class="siege-title">Siege tickets this week</h2>
        <p class="siege-sub">${escapeHtml(String(ticketCount))} guild${ticketCount === 1 ? "" : "s"} with a ticket · ${escapeHtml(String(ours.length))} Our Alliance · ${escapeHtml(String(elite.length))} ${escapeHtml(eliteLabel)}${neutral.length ? ` · ${escapeHtml(String(neutral.length))} ${escapeHtml(neutralLabel)}` : ""} · first fort win only counts once per week</p>
      </div>
      <section class="siege-block" aria-label="Ticket holders">
        <h3 class="siege-block-title">Ticket holders</h3>
        ${ticketListHtml}
      </section>
      <section class="siege-block" aria-label="Daily fort wins">
        <h3 class="siege-block-title">Daily fort wins</h3>
        ${dailyHtml}
      </section>
    `;

    countEl.textContent = ticketCount
      ? `${ours.length} ours · ${elite.length} elite${neutral.length ? ` · ${neutral.length} neutral` : ""}`
      : "";
  }

  function renderWarAnalysisPanel(ranked, meta, data) {
    if (!warAnalysisPanel) return;
    const show = isWarAnalysisView() && ranked.length > 0;
    warAnalysisPanel.hidden = !show;
    if (!show) return;

    const heading = document.getElementById("war-analysis-heading");
    if (heading) {
      heading.textContent =
        currentView === VIEW.WEEKLY_ANALYSIS ? "Weekly war analysis" : "Monthly war analysis";
    }

    const periodLabel =
      currentView === VIEW.WEEKLY_ANALYSIS ? "weekly" : "monthly";
    if (warAnalysisSub) {
      warAnalysisSub.textContent = `${meta}. MVP-weighted scores from ${periodLabel} totals. Top half = high performers; bottom half = low performers. Recent MVP winners on cooldown are included here; they are excluded only on the Monthly MVP tab.`;
    }

    if (warAnalysisFormula) {
      warAnalysisFormula.innerHTML = MVP_COMPONENTS.map(
        (c) => `<div>
          <dt>${escapeHtml(c.label)}</dt>
          <dd class="mvp-weight">${escapeHtml(formatMvpWeight(c.weight))}</dd>
        </div>`
      ).join("");
    }

    const { high, low, medianScore } = splitHighLowPerformers(ranked);
    if (warAnalysisSummary) {
      warAnalysisSummary.innerHTML = `<strong>${high.length}</strong> high performers · <strong>${low.length}</strong> low performers · split near <strong>${escapeHtml(formatMvpScore(medianScore))}</strong>`;
    }

    if (warAnalysisPriorMvps) {
      const monthKey = getAnalysisContextMonthKey(data);
      const priorWinners = getPriorMonthMvpWinners(data, monthKey);
      warAnalysisPriorMvps.innerHTML = priorWinners.length
        ? `<strong>Prior month MVPs:</strong> ${priorWinners
            .map(
              (w) =>
                `${escapeHtml(w.label)} — ${formatFamilyNameCell(w.familyName)} (${escapeHtml(formatMvpScore(w.score))})`
            )
            .join(" · ")}`
        : "";
      warAnalysisPriorMvps.hidden = !priorWinners.length;
    }
  }

  function renderAnalysisTableRow(r, tierClass, avgByCol) {
    const cols = getActiveCols();
    const tds = cols
      .map((c) => {
        const v = r[c.key];
        const cls = c.type === "text" ? "" : c.type;
        if (c.key === "familyName") {
          return `<td class="${cls}">${formatFamilyNameCellWithInclude(v)}</td>`;
        }
        if (c.type === "pct") {
          return `<td class="pct">${statValueWithAvg(v, c, avgByCol)}</td>`;
        }
        if (c.key === "attendance") {
          const n = Number(v) || 0;
          const mark = n > 0 ? " attendance-cell--present" : " attendance-cell--zero";
          return `<td class="${cls}${mark}">${statValueWithAvg(n, c, avgByCol)}</td>`;
        }
        return `<td class="${cls}">${statValueWithAvg(v, c, avgByCol)}</td>`;
      })
      .join("");
    return `<tr class="${tierClass}${rowInclusionClass(r)}">${tds}</tr>`;
  }

  function renderGroupedAnalysisRows(filtered, ranked, avgByCol) {
    const cols = getActiveCols().length;
    const { high, low } = splitHighLowPerformers(ranked);
    const highNames = new Set(high.map((e) => e.familyName));
    const lowNames = new Set(low.map((e) => e.familyName));
    const rankOrder = new Map(ranked.map((e, i) => [e.familyName, i]));
    const byRank = (a, b) =>
      (rankOrder.get(a.familyName) ?? 999) - (rankOrder.get(b.familyName) ?? 999);

    const sortGroup = (rows) => {
      if (!sortKey || sortKey === "score") {
        return [...rows].sort(byRank);
      }
      return sortRowsInPlace([...rows]);
    };

    const highRows = sortGroup(filtered.filter((r) => highNames.has(r.familyName)));
    const lowRows = sortGroup(filtered.filter((r) => lowNames.has(r.familyName)));
    let html = "";

    if (highRows.length) {
      html += `<tr class="analysis-group-header"><td colspan="${cols}">High performers (top half)</td></tr>`;
      html += highRows.map((r) => renderAnalysisTableRow(r, "row--high-performer", avgByCol)).join("");
    }
    if (lowRows.length) {
      html += `<tr class="analysis-group-header analysis-group-header--low"><td colspan="${cols}">Low performers (bottom half)</td></tr>`;
      html += lowRows.map((r) => renderAnalysisTableRow(r, "row--low-performer", avgByCol)).join("");
    }
    return html;
  }

  function renderAttendanceTabBody(data) {
    hideStatsPanels();
    renderHead();

    const dateKeys = getPeriodDateKeys(data);
    if (!dateKeys.length) {
      metaEl.textContent = "No war data logged";
      tbody.innerHTML = `<tr><td colspan="${ATTENDANCE_COLS.length}" class="empty">No attendance data.</td></tr>`;
      tfoot.innerHTML = "";
      countEl.textContent = "0 players";
      applyHeaderSortIndicators();
      return;
    }

    const { rows, nodeWarDates, siegeDates } = buildPeriodAttendanceRows(data, dateKeys);
    if (attendanceScopeMode === "month") {
      const mk =
        currentMonth && uniqueMonths(data).some((m) => m.month === currentMonth)
          ? currentMonth
          : monthKeyUTC(dateKeys[0]);
      metaEl.textContent = formatMonthAttendanceMeta(mk, nodeWarDates, siegeDates);
    } else {
      const sun =
        currentWeekSunday && uniqueWeekStarts(data).some((w) => w.sunday === currentWeekSunday)
          ? currentWeekSunday
          : sundayOfWeekUTC(dateKeys[0]);
      metaEl.textContent = formatWeekAttendanceMeta(sun, nodeWarDates, siegeDates);
    }

    const q = (search.value || "").trim().toLowerCase();
    const teamFiltered = applyTeamFilter(rows);
    const total = teamFiltered.length;
    let filtered = q
      ? teamFiltered.filter((r) => {
          const name = String(r.familyName).toLowerCase();
          const team = String(r.team || "").toLowerCase();
          return name.includes(q) || team.includes(q);
        })
      : teamFiltered.slice();
    filtered = sortRowsInPlace(filtered);

    countEl.textContent = formatPlayerCountText(filtered.length, total, "roster members");

    if (!filtered.length) {
      lastVisibleRows = [];
      const emptyMsg =
        q || selectedTeamFilters.size
          ? "No matching players for the current filters."
          : "No matching family names.";
      tbody.innerHTML = `<tr><td colspan="${ATTENDANCE_COLS.length}" class="empty">${escapeHtml(emptyMsg)}</td></tr>`;
      tfoot.innerHTML = "";
      applyHeaderSortIndicators();
      updateCheckAllState([]);
      return;
    }

    const avgRows = rowsForAverages(filtered);
    const avgByCol = computeColumnAverages(avgRows, ATTENDANCE_COLS);
    lastVisibleRows = filtered;

    const includedCount = avgRows.length;
    if (includedCount < filtered.length) {
      countEl.textContent = `${formatPlayerCountText(filtered.length, total, "roster members")} · ${includedCount} in averages`;
    }

    tbody.innerHTML = filtered
      .map((r) => {
        const tds = ATTENDANCE_COLS.map((c) => {
          const v = r[c.key];
          const cls = c.type === "text" ? "" : c.type;
          if (c.key === "familyName") {
            return `<td class="${cls}">${formatFamilyNameCellWithInclude(v)}</td>`;
          }
          if (c.key === "team" && v && v !== "—") {
            return `<td class="${cls}">${formatTeamBadges(getMemberTeams(r.familyName))}</td>`;
          }
          if (c.key === "team") {
            return `<td class="${cls}">${escapeHtml(String(v ?? ""))}</td>`;
          }
          const mark =
            (c.key === "siege" || c.key === "nodeWars") && Number(v) > 0
              ? " attendance-cell--present"
              : Number(v) === 0 && (c.key === "siege" || c.key === "nodeWars")
                ? " attendance-cell--zero"
                : "";
          return `<td class="${cls}${mark}">${statValueWithAvg(v, c, avgByCol)}</td>`;
        }).join("");
        return `<tr class="${rowInclusionClass(r).trim()}">${tds}</tr>`;
      })
      .join("");

    const avgN = avgRows.length;
    const totalNode = avgRows.reduce((sum, r) => sum + r.nodeWars, 0);
    const totalSiege = avgRows.reduce((sum, r) => sum + r.siege, 0);
    tfoot.innerHTML = `<tr>
      <td>Averages (${avgN})</td>
      <td></td>
      <td class="num">${avgN ? escapeHtml(formatAvgNumber(totalNode / avgN)) : "—"}</td>
      <td class="num">${avgN ? escapeHtml(formatAvgNumber(totalSiege / avgN)) : "—"}</td>
    </tr>`;

    applyHeaderSortIndicators();
    updateCheckAllState(filtered);
  }

  function renderWarAnalysisBody() {
    hideStatsPanels();
    if (attendancePanel) attendancePanel.hidden = true;
    renderHead();

    const data = getWarData();
    const { rows, meta } = getRowsForView();
    metaEl.textContent = meta;

    const guildFiltered = filterGuildRows(rows);
    const teamFiltered = applyTeamFilter(guildFiltered);
    const ranked = computeMvpScores(teamFiltered);
    renderWarAnalysisPanel(ranked, meta, data);

    const analysisRows = rankedToAnalysisRows(ranked, teamFiltered);
    const q = (search.value || "").trim().toLowerCase();
    const total = analysisRows.length;
    const filtered = q
      ? analysisRows.filter((r) =>
          String(r.familyName).toLowerCase().includes(q)
        )
      : analysisRows.slice();

    countEl.textContent = formatPlayerCountText(filtered.length, total, "players");

    const colCount = getActiveCols().length;
    if (!filtered.length) {
      lastVisibleRows = [];
      const emptyMsg = total
        ? q || selectedTeamFilters.size
          ? "No matching players for the current filters."
          : "No matching family names."
        : "No war data for this period.";
      tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty">${escapeHtml(emptyMsg)}</td></tr>`;
      tfoot.innerHTML = "";
      applyHeaderSortIndicators();
      updateCheckAllState([]);
      return;
    }

    const avgRows = rowsForAverages(filtered);
    const avgByCol = computeColumnAverages(avgRows);
    lastVisibleRows = filtered;

    const includedCount = avgRows.length;
    if (includedCount < filtered.length) {
      countEl.textContent = `${formatPlayerCountText(filtered.length, total, "players")} · ${includedCount} in averages`;
    }
    tbody.innerHTML = renderGroupedAnalysisRows(filtered, ranked, avgByCol);

    const avgRow = computeAverageRow(avgRows);
    tfoot.innerHTML = avgRow
      ? `<tr>${getActiveCols()
          .map((c) => {
            const v = avgRow[c.key];
            const cls =
              c.type === "text" ? "" : c.type === "pct" ? "pct" : c.type;
            if (c.key === "familyName") {
              return `<td class="${cls}">${escapeHtml(String(v))}</td>`;
            }
            return `<td class="${cls}">${escapeHtml(String(v))}</td>`;
          })
          .join("")}</tr>`
      : "";

    applyHeaderSortIndicators();
    updateCheckAllState(filtered);
  }

  function renderBody() {
    if (!canAccessView(currentView)) {
      clearProtectedContent();
      return;
    }

    const data = getWarData();

    if (currentView === VIEW.SIEGE_TICKETS) {
      renderSiegeTicketsTabBody();
      return;
    }

    if (currentView === VIEW.CLASS_RANKINGS) {
      renderClassRankingsTabBody();
      return;
    }

    if (currentView === VIEW.EDANIA_CHESTS) {
      renderEdaniaChestsTabBody();
      return;
    }

    setMainViewChrome(currentView);

    if (currentView === VIEW.ATTENDANCE) {
      renderAttendanceTabBody(data);
      return;
    }

    if (isWarAnalysisView()) {
      renderWarAnalysisBody();
      return;
    }

    renderHead();
    const periodKeys = getPeriodDateKeys(data);
    const { rows, meta } = getRowsForView();
    metaEl.textContent = meta;
    renderAttendancePanel(data, periodKeys);

    const guildFiltered = filterGuildRows(rows);
    renderMvpSection(guildFiltered);

    const teamFiltered = applyTeamFilter(guildFiltered);
    const q = (search.value || "").trim().toLowerCase();
    const total = teamFiltered.length;
    let filtered = q
      ? teamFiltered.filter((r) => {
          const name = String(r.familyName).toLowerCase();
          const team = getMemberTeams(resolveGuildName(r.familyName) || r.familyName)
            .join(" ")
            .toLowerCase();
          return name.includes(q) || team.includes(q);
        })
      : teamFiltered.slice();
    filtered = sortRowsInPlace(filtered);

    countEl.textContent = formatPlayerCountText(filtered.length, total, "players");

    if (!filtered.length) {
      lastVisibleRows = [];
      const emptyMsg =
        q || selectedTeamFilters.size
          ? "No matching players for the current filters."
          : "No matching family names.";
      tbody.innerHTML = `<tr><td colspan="${getActiveCols().length}" class="empty">${escapeHtml(emptyMsg)}</td></tr>`;
      tfoot.innerHTML = "";
      applyHeaderSortIndicators();
      updateCheckAllState([]);
      return;
    }

    const avgRows = rowsForAverages(filtered);
    const avgByCol = computeColumnAverages(avgRows);
    lastVisibleRows = filtered;

    const includedCount = avgRows.length;
    if (includedCount < filtered.length) {
      countEl.textContent = `${formatPlayerCountText(filtered.length, total, "players")} · ${includedCount} in averages`;
    }

    tbody.innerHTML = filtered
      .map((r) => {
        const cols = getActiveCols();
        const tds = cols.map((c) => {
          const v = r[c.key];
          const cls = c.type === "text" ? "" : c.type;
          if (c.key === "familyName") {
            return `<td class="${cls}">${formatFamilyNameCellWithInclude(v)}</td>`;
          }
          if (
            (c.key === "nodeWar" || c.key === "siege") &&
            currentView !== VIEW.DAILY &&
            currentView !== VIEW.ATTENDANCE
          ) {
            const n = Number(v) || 0;
            const mark = n > 0 ? " attendance-cell--present" : " attendance-cell--zero";
            return `<td class="${cls}${mark}">${statValueWithAvg(n, c, avgByCol)}</td>`;
          }
          if (c.type === "pct") {
            return `<td class="pct">${statValueWithAvg(v, c, avgByCol)}</td>`;
          }
          return `<td class="${cls}">${statValueWithAvg(v, c, avgByCol)}</td>`;
        }).join("");
        return `<tr class="${rowInclusionClass(r).trim()}">${tds}</tr>`;
      })
      .join("");

    const avgRow = computeAverageRow(avgRows);
    tfoot.innerHTML = avgRow
      ? `<tr>${getActiveCols().map((c) => {
          const v = avgRow[c.key];
          const cls = c.type === "text" ? "" : c.type;
          return `<td class="${cls}">${escapeHtml(String(v))}</td>`;
        }).join("")}</tr>`
      : "";

    applyHeaderSortIndicators();
    updateCheckAllState(filtered);
  }

  function populateDateSelect() {
    const data = getWarData();
    const keys = sortedDateKeys(data);
    dateSelect.innerHTML = keys
      .map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(formatShortDate(k))}</option>`)
      .join("");
    if (keys.length) {
      currentDate = keys.includes(currentDate) ? currentDate : keys[keys.length - 1];
      dateSelect.value = currentDate;
    }
  }

  function populateWeekSelect() {
    const data = getWarData();
    const weeks = uniqueWeekStartsAll(data);
    weekSelect.innerHTML = weeks
      .map(({ sunday, dates }) => {
        const fortDays = dates.filter((d) => Array.isArray(getSiegeFortWins()[d])).length;
        const dayPart =
          fortDays > 0
            ? `${dates.length} day${dates.length === 1 ? "" : "s"} · ${fortDays} fort win day${fortDays === 1 ? "" : "s"}`
            : `${dates.length} day${dates.length === 1 ? "" : "s"}`;
        const label = `${formatWeekRangeLabel(sunday)} (${dayPart})`;
        return `<option value="${escapeHtml(sunday)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    if (weeks.length) {
      const sundays = weeks.map((w) => w.sunday);
      currentWeekSunday = sundays.includes(currentWeekSunday)
        ? currentWeekSunday
        : sundays[0];
      weekSelect.value = currentWeekSunday;
    }
  }

  function populateMonthSelect() {
    const data = getWarData();
    const months = uniqueMonths(data);
    monthSelect.innerHTML = months
      .map(({ month, dates }) => {
        const label = `${formatMonthLabel(month)} (${dates.length} day${dates.length === 1 ? "" : "s"})`;
        return `<option value="${escapeHtml(month)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    if (months.length) {
      const monthKeys = months.map((m) => m.month);
      currentMonth = monthKeys.includes(currentMonth) ? currentMonth : monthKeys[0];
      monthSelect.value = currentMonth;
    }
  }

  function updateScopeVisibility() {
    const daily = currentView === VIEW.DAILY;
    const weekly =
      currentView === VIEW.WEEKLY ||
      currentView === VIEW.WEEKLY_ANALYSIS ||
      currentView === VIEW.SIEGE_TICKETS;
    const monthly = currentView === VIEW.MONTHLY || currentView === VIEW.MONTHLY_ANALYSIS;
    const attendance = currentView === VIEW.ATTENDANCE;
    const lifetime = currentView === VIEW.LIFETIME;
    const classRankings = currentView === VIEW.CLASS_RANKINGS;
    const edaniaChests = currentView === VIEW.EDANIA_CHESTS;

    dateField.hidden = !daily;
    weekField.hidden = !weekly && !attendance;
    monthField.hidden = !monthly && !attendance;
    scopeRow.hidden =
      lifetime || classRankings || edaniaChests || (!daily && !weekly && !monthly && !attendance);

    weekField.classList.toggle("field--scope-inactive", attendance && attendanceScopeMode !== "week");
    monthField.classList.toggle("field--scope-inactive", attendance && attendanceScopeMode !== "month");
  }

  function setView(view) {
    if (!canAccessView(view)) {
      pendingProtectedView = view;
      window.FRAGSiteAuth?.showGate();
      updateTabStates();
      return;
    }

    pendingProtectedView = null;
    window.FRAGSiteAuth?.hideGate();
    resetSort();
    excludedPlayers.clear();
    currentView = view;
    if (isWarAnalysisView(view)) {
      sortKey = "score";
      sortDir = "desc";
    }
    updateTabStates();
    updateScopeVisibility();
    renderBody();
  }

  function init() {
    renderHead();
    populateDateSelect();
    populateWeekSelect();
    populateMonthSelect();
    updateScopeVisibility();
    renderTeamFilters();

    const data = getWarData();
    const keys = sortedDateKeys(data);
    if (keys.length) {
      currentDate = keys[keys.length - 1];
      dateSelect.value = currentDate;
      const w = uniqueWeekStartsAll(data);
      if (w.length) {
        currentWeekSunday = sundayOfWeekUTC(currentDate);
        if (!w.some((x) => x.sunday === currentWeekSunday)) currentWeekSunday = w[0].sunday;
        weekSelect.value = currentWeekSunday;
      }
      const mo = uniqueMonths(data);
      if (mo.length) {
        currentMonth = monthKeyUTC(currentDate);
        if (!mo.some((x) => x.month === currentMonth)) currentMonth = mo[0].month;
        monthSelect.value = currentMonth;
      }
    }

    viewTabs.forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.getAttribute("data-view")));
    });

    dateSelect.addEventListener("change", function () {
      currentDate = this.value;
      excludedPlayers.clear();
      renderBody();
    });

    weekSelect.addEventListener("change", function () {
      currentWeekSunday = this.value;
      if (currentView === VIEW.ATTENDANCE) attendanceScopeMode = "week";
      excludedPlayers.clear();
      updateScopeVisibility();
      renderBody();
    });

    monthSelect.addEventListener("change", function () {
      currentMonth = this.value;
      if (currentView === VIEW.ATTENDANCE) attendanceScopeMode = "month";
      excludedPlayers.clear();
      updateScopeVisibility();
      renderBody();
    });

    search.addEventListener("input", renderBody);

    if (teamFiltersEl) {
      teamFiltersEl.addEventListener("change", (e) => {
        const input = e.target.closest(".team-filter-input");
        if (input) {
          const team = input.value;
          if (input.checked) selectedTeamFilters.add(team);
          else selectedTeamFilters.delete(team);
          renderTeamFilters();
          renderBody();
          return;
        }
        if (e.target.id === "team-filter-clear") {
          selectedTeamFilters.clear();
          renderTeamFilters();
          renderBody();
        }
      });
    }

    const tableEl = thead.closest("table");
    tableEl.addEventListener("change", (e) => {
      const input = e.target.closest(".player-include-input");
      if (!input) return;
      if (input.classList.contains("player-include-all-input")) {
        const keys = lastVisibleRows.map((r) => playerInclusionKey(r)).filter(Boolean);
        if (input.checked) {
          for (const k of keys) excludedPlayers.delete(k);
        } else {
          for (const k of keys) excludedPlayers.add(k);
        }
        renderBody();
        return;
      }
      const key = input.dataset.playerKey;
      if (!key) return;
      if (input.checked) excludedPlayers.delete(key);
      else excludedPlayers.add(key);
      renderBody();
    });

    tableEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".th-sort-btn");
      if (!btn || !thead.contains(btn)) return;
      const key = btn.getAttribute("data-sort-key");
      if (!key) return;
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        // Name: A→Z first; stats: high→low first (then click again to flip).
        sortDir = key === "familyName" ? "asc" : "desc";
      }
      renderBody();
    });

    setView(canAccessView(VIEW.DAILY) ? VIEW.DAILY : VIEW.EDANIA_CHESTS);

    if (window.FRAGSiteAuth) {
      window.FRAGSiteAuth.mount();
      window.FRAGSiteAuth.setOnUnlock(handleAuthGateResult);
      updateAuthChrome();
    }

    if (classRankingsPanel && window.FRAGClassRankings) {
      window.FRAGClassRankings.mount(classRankingsPanel);
    }

    if (edaniaChestsPanel && window.FRAGEdaniaChests) {
      window.FRAGEdaniaChests.mount(edaniaChestsPanel);
    }
  }

  init();
})();
