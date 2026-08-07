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
  const defenseMvpSection = document.getElementById("defense-mvp-section");
  const defenseMvpWinner = document.getElementById("defense-mvp-winner");
  const defenseMvpBreakdown = document.getElementById("defense-mvp-breakdown");
  const defenseMvpLeaderboard = document.getElementById("defense-mvp-leaderboard");
  const defenseWheelCanvas = document.getElementById("defense-wheel-canvas");
  const defenseWheelSpinBtn = document.getElementById("defense-wheel-spin");
  const defenseWheelResult = document.getElementById("defense-wheel-result");
  const defenseWheelTally = document.getElementById("defense-wheel-tally");
  const attendancePanel = document.getElementById("attendance-panel");
  const teamFiltersEl = document.getElementById("team-filters");
  const warAnalysisPanel = document.getElementById("war-analysis-panel");
  const warAnalysisSub = document.getElementById("war-analysis-sub");
  const warAnalysisFormula = document.getElementById("war-analysis-formula");
  const warAnalysisSummary = document.getElementById("war-analysis-summary");
  const warAnalysisPriorMvps = document.getElementById("war-analysis-prior-mvps");

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

  const DEFENSE_MVP_COMPONENTS = [
    { key: "ccHits", label: "CC hits", weight: 0.3 },
    { key: "trapsTriggered", label: "Traps triggered", weight: 0.3 },
    { key: "timeSurvived", label: "Time survived", weight: 0.3 },
    { key: "allyHp", label: "Ally HP", weight: 0.1 },
  ];

  let currentView = VIEW.DAILY;
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
  let defenseWheelRotation = 0;
  let defenseWheelSpinning = false;
  let defenseWheelAnimId = null;
  let defenseWheelEntries = [];
  let defenseWheelMonthKey = "";
  let defenseWheelNameColors = new Map();

  const DEFENSE_WHEEL_COLORS = ["#2a5080", "#3a6898", "#1e4068", "#4a78a8", "#234868", "#5278a0"];
  const DEFENSE_SIEGE_ENTRY_WEIGHT = 2;

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

  function filterDefenseRows(rows) {
    return filterGuildRows(rows).filter((r) => memberHasTeam(resolveGuildName(r.familyName), "Defense"));
  }

  function getDefenseRoster() {
    return getGuildRoster()
      .filter((name) => memberHasTeam(name, "Defense"))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  /** Defense members present on a single war date. */
  function defensePresentOnDate(data, dateKey) {
    const day = data[dateKey];
    if (!day || !Array.isArray(day.rows)) return [];
    const present = new Set();
    for (const r of day.rows) {
      const canon = resolveGuildName(r.familyName);
      if (canon && memberHasTeam(canon, "Defense")) present.add(canon);
    }
    return Array.from(present).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }

  /**
   * Wheel entries by war day attended (chronological).
   * Node wars = 1 entry; siege (Saturday) = 2 entries.
   * Returns { entries, counts, warsLogged }.
   */
  function buildDefenseWheelEntries(data, dateKeys) {
    const entries = [];
    const counts = new Map();
    const keys = [...dateKeys].sort();

    for (const dk of keys) {
      const weight = isSiegeDate(dk) ? DEFENSE_SIEGE_ENTRY_WEIGHT : 1;
      for (const name of defensePresentOnDate(data, dk)) {
        for (let i = 0; i < weight; i += 1) entries.push(name);
        counts.set(name, (counts.get(name) || 0) + weight);
      }
    }

    return { entries, counts, warsLogged: keys.length };
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

  function getPreviousMonthMvpWinner(data, monthKey, { defense = false } = {}) {
    const prevKey = previousMonthKey(monthKey);
    return getMonthMvpWinner(data, prevKey, { defense });
  }

  function getMvpCooldownMonths() {
    const n = Number(window.GUILD_MVP_COOLDOWN_MONTHS);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
  }

  /** Winners from each of the prior N months who are still on cooldown this month. */
  function getMvpCooldownExclusions(data, monthKey, { defense = false } = {}) {
    const excluded = new Set();
    let cursor = monthKey;
    for (let i = 0; i < getMvpCooldownMonths(); i++) {
      cursor = previousMonthKey(cursor);
      const winner = getMonthMvpWinner(data, cursor, { defense });
      if (!winner) continue;
      excluded.add(String(canonicalFamilyName(winner)).toLowerCase());
    }
    return excluded;
  }

  function getMonthMvpWinner(data, monthKey, { defense = false } = {}) {
    const entry = getMonthMvpWinnerEntry(data, monthKey, { defense });
    return entry ? entry.familyName : null;
  }

  function getMonthMvpWinnerEntry(data, monthKey, { defense = false } = {}) {
    const dates = datesInMonth(data, monthKey);
    if (!dates.length) return null;

    const rows = aggregateByFamily(data, dates);
    const scopedRows = defense ? filterDefenseRows(rows) : filterGuildRows(rows);
    if (!scopedRows.length) return null;

    const ranked = defense ? computeDefenseMvpScores(scopedRows) : computeMvpScores(scopedRows);
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

  function defenseMvpMetricsFromRow(row) {
    return {
      ccHits: Number(row.ccHits) || 0,
      trapsTriggered: Number(row.trapsTriggered) || 0,
      timeSurvived: parseTimeToSeconds(row.timeSurvived),
      allyHp: parseGameNumber(row.allyHp),
    };
  }

  /** Defense MVP: weighted score vs Defense-high for each category. */
  function computeDefenseMvpScores(rows) {
    if (!rows.length) return [];
    const withMetrics = rows.map((row) => ({
      familyName: row.familyName,
      m: defenseMvpMetricsFromRow(row),
    }));
    const max = {
      ccHits: Math.max(...withMetrics.map((x) => x.m.ccHits)),
      trapsTriggered: Math.max(...withMetrics.map((x) => x.m.trapsTriggered)),
      timeSurvived: Math.max(...withMetrics.map((x) => x.m.timeSurvived)),
      allyHp: Math.max(...withMetrics.map((x) => x.m.allyHp)),
    };

    return withMetrics
      .map(({ familyName, m }) => {
        const parts = {
          ccHits: 0.3 * safeRatio(m.ccHits, max.ccHits),
          trapsTriggered: 0.3 * safeRatio(m.trapsTriggered, max.trapsTriggered),
          timeSurvived: 0.3 * safeRatio(m.timeSurvived, max.timeSurvived),
          allyHp: 0.1 * safeRatio(m.allyHp, max.allyHp),
        };
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
  }

  function renderDefenseMvpSection(rows) {
    if (!defenseMvpSection) return;
    const data = getWarData();
    const monthKeys = currentView === VIEW.MONTHLY ? getPeriodDateKeys(data) : [];
    const show = currentView === VIEW.MONTHLY && monthKeys.length > 0;
    defenseMvpSection.hidden = !show;
    if (!show) return;

    const defenseRows = filterDefenseRows(rows);

    if (defenseRows.length > 0) {
      const ranked = computeDefenseMvpScores(defenseRows);
      const monthKey = monthKeys[0] ? monthKeyUTC(monthKeys[0]) : null;
      const cooldown = monthKey
        ? getMvpCooldownExclusions(data, monthKey, { defense: true })
        : new Set();
      const eligible = mvpEligibleEntries(ranked, cooldown);
      const winner = eligible[0];

      defenseMvpWinner.innerHTML = winner
        ? `
        <p class="mvp-winner-label">Defense MVP</p>
        <p class="mvp-winner-name">${formatFamilyNameCell(winner.familyName)}</p>
        <p class="mvp-winner-score">Overall score ${escapeHtml(formatMvpScore(winner.score))}</p>
      `
        : `
        <p class="mvp-winner-label">Defense MVP</p>
        <p class="mvp-winner-score">No eligible Defense MVP this month.</p>
      `;

      defenseMvpBreakdown.innerHTML = DEFENSE_MVP_COMPONENTS.map(
        (c) => `<div>
          <dt>${escapeHtml(c.label)}</dt>
          <dd class="mvp-weight">${escapeHtml(formatMvpWeight(c.weight))}</dd>
        </div>`
      ).join("");

      renderMvpLeaderboard(defenseMvpLeaderboard, eligible, 10);
    } else {
      defenseMvpWinner.innerHTML = `
        <p class="mvp-winner-label">Defense MVP</p>
        <p class="mvp-winner-score">No Defense stats this month.</p>
      `;
      defenseMvpBreakdown.innerHTML = "";
      defenseMvpLeaderboard.innerHTML = "";
    }
  }

  function truncateWheelLabel(name, maxLen = 11) {
    const text = String(name || "");
    return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`;
  }

  function buildDefenseWheelNameColors(entries) {
    const colors = new Map();
    let idx = 0;
    for (const name of entries) {
      if (!colors.has(name)) {
        colors.set(name, DEFENSE_WHEEL_COLORS[idx % DEFENSE_WHEEL_COLORS.length]);
        idx += 1;
      }
    }
    return colors;
  }

  function renderDefenseWheelTally(entries, counts, warsLogged) {
    if (!defenseWheelTally) return;

    if (!entries.length) {
      defenseWheelTally.textContent = "No Defense attendance logged this month yet.";
      return;
    }

    const unique = counts.size;
    const summary = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
      .map(([name, count]) => `${name} ×${count}`)
      .join(", ");

    defenseWheelTally.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"} across ${warsLogged} logged ${warsLogged === 1 ? "war" : "wars"} · ${unique} ${unique === 1 ? "player" : "players"} · ${summary}`;
  }

  function drawDefenseWheel(entries = defenseWheelEntries) {
    if (!defenseWheelCanvas) return;
    const ctx = defenseWheelCanvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    defenseWheelCanvas.width = size * dpr;
    defenseWheelCanvas.height = size * dpr;
    defenseWheelCanvas.style.width = `${size}px`;
    defenseWheelCanvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 8;

    if (!entries.length) {
      ctx.fillStyle = "#9a8f8c";
      ctx.font = "600 14px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No entries yet", cx, cy - 8);
      ctx.font = "500 12px Segoe UI, system-ui, sans-serif";
      ctx.fillText("Attend node wars to add names", cx, cy + 12);
      return;
    }

    const slice = (Math.PI * 2) / entries.length;
    const minLabelSlice = (12 * Math.PI) / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((defenseWheelRotation * Math.PI) / 180);

    entries.forEach((name, i) => {
      const start = i * slice - Math.PI / 2;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = defenseWheelNameColors.get(name) || DEFENSE_WHEEL_COLORS[0];
      ctx.fill();
      ctx.strokeStyle = "rgba(168, 212, 245, 0.35)";
      ctx.lineWidth = entries.length > 40 ? 0.75 : 1.5;
      ctx.stroke();

      if (slice >= minLabelSlice) {
        ctx.save();
        ctx.rotate(start + slice / 2);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f2ece8";
        const fontSize = entries.length > 24 ? 8 : entries.length > 14 ? 9 : 11;
        ctx.font = `700 ${fontSize}px Segoe UI, system-ui, sans-serif`;
        ctx.fillText(truncateWheelLabel(name, entries.length > 20 ? 8 : 11), radius - 10, 0);
        ctx.restore();
      }
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1218";
    ctx.fill();
    ctx.strokeStyle = "rgba(168, 212, 245, 0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#a8d4f5";
    ctx.font = "700 11px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(entries.length), cx, cy);
  }

  function updateDefenseWheel() {
    if (!defenseWheelCanvas || !defenseWheelSpinBtn || currentView !== VIEW.MONTHLY) return;

    const data = getWarData();
    const monthKeys = getPeriodDateKeys(data);
    const monthKey = monthKeys[0] ? monthKeyUTC(monthKeys[0]) : currentMonth || "";

    if (monthKey && monthKey !== defenseWheelMonthKey && !defenseWheelSpinning) {
      defenseWheelMonthKey = monthKey;
      defenseWheelRotation = 0;
      if (defenseWheelResult) {
        defenseWheelResult.hidden = true;
        defenseWheelResult.textContent = "";
      }
    }

    const { entries, counts, warsLogged } = buildDefenseWheelEntries(data, monthKeys);
    defenseWheelEntries = entries;
    defenseWheelNameColors = buildDefenseWheelNameColors(entries);

    drawDefenseWheel(entries);
    renderDefenseWheelTally(entries, counts, warsLogged);

    defenseWheelSpinBtn.disabled = defenseWheelSpinning || entries.length === 0;
    if (entries.length === 0 && defenseWheelResult && !defenseWheelSpinning) {
      defenseWheelResult.hidden = false;
      defenseWheelResult.textContent = "Log Defense attendance this month to enable the spin.";
    }
  }

  function spinDefenseWheel() {
    const entries = defenseWheelEntries;
    if (defenseWheelSpinning || entries.length === 0 || !defenseWheelSpinBtn) return;

    if (defenseWheelAnimId) cancelAnimationFrame(defenseWheelAnimId);

    defenseWheelSpinning = true;
    defenseWheelSpinBtn.disabled = true;
    if (defenseWheelResult) defenseWheelResult.hidden = true;

    const slice = 360 / entries.length;
    const winIndex = Math.floor(Math.random() * entries.length);
    const winner = entries[winIndex];
    const winnerCount = entries.filter((n) => n === winner).length;
    const extraSpins = 5 + Math.floor(Math.random() * 4);
    const targetMod = ((360 - (winIndex + 0.5) * slice) % 360 + 360) % 360;
    const currentMod = ((defenseWheelRotation % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;
    const finalRotation = defenseWheelRotation + extraSpins * 360 + delta;
    const startRotation = defenseWheelRotation;
    const duration = 4500;
    const startTime = performance.now();

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      defenseWheelRotation = startRotation + (finalRotation - startRotation) * easeOutCubic(t);
      drawDefenseWheel(entries);

      if (t < 1) {
        defenseWheelAnimId = requestAnimationFrame(frame);
        return;
      }

      defenseWheelRotation = finalRotation;
      defenseWheelSpinning = false;
      defenseWheelAnimId = null;
      defenseWheelSpinBtn.disabled = false;
      drawDefenseWheel(entries);

      if (defenseWheelResult) {
        defenseWheelResult.hidden = false;
        defenseWheelResult.innerHTML = `Gift card winner: <strong>${escapeHtml(winner)}</strong> · ${winnerCount} ${winnerCount === 1 ? "entry" : "entries"} this month`;
      }
    }

    defenseWheelAnimId = requestAnimationFrame(frame);
  }

  function initDefenseWheel() {
    if (!defenseWheelSpinBtn) return;
    defenseWheelSpinBtn.addEventListener("click", spinDefenseWheel);
    updateDefenseWheel();
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
    if (defenseMvpSection) defenseMvpSection.hidden = true;
    if (warAnalysisPanel) warAnalysisPanel.hidden = true;
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
    const data = getWarData();

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
    renderDefenseMvpSection(guildFiltered);

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
    const weeks = uniqueWeekStarts(data);
    weekSelect.innerHTML = weeks
      .map(({ sunday, dates }) => {
        const label = `${formatWeekRangeLabel(sunday)} (${dates.length} day${dates.length === 1 ? "" : "s"})`;
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
    const weekly = currentView === VIEW.WEEKLY || currentView === VIEW.WEEKLY_ANALYSIS;
    const monthly = currentView === VIEW.MONTHLY || currentView === VIEW.MONTHLY_ANALYSIS;
    const attendance = currentView === VIEW.ATTENDANCE;
    const lifetime = currentView === VIEW.LIFETIME;

    dateField.hidden = !daily;
    weekField.hidden = !weekly && !attendance;
    monthField.hidden = !monthly && !attendance;
    scopeRow.hidden = lifetime || (!daily && !weekly && !monthly && !attendance);

    weekField.classList.toggle("field--scope-inactive", attendance && attendanceScopeMode !== "week");
    monthField.classList.toggle("field--scope-inactive", attendance && attendanceScopeMode !== "month");
  }

  function setView(view) {
    resetSort();
    excludedPlayers.clear();
    currentView = view;
    if (isWarAnalysisView(view)) {
      sortKey = "score";
      sortDir = "desc";
    }
    viewTabs.forEach((btn) => {
      const on = btn.getAttribute("data-view") === view;
      btn.classList.toggle("tab--active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
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
      const w = uniqueWeekStarts(data);
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

    setView(VIEW.DAILY);
  }

  init();
})();
