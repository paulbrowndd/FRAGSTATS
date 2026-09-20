/**
 * Ask FRAG — rule-based officer reports (no external AI).
 * Runs entirely in-browser against NODE_WAR_DATA + guild roster.
 */
(function () {
  const TEAM_ALIASES = {
    ball: "Ball",
    support: "Support",
    defense: "Defense",
    flex: "Flex",
    "d-flex": "D-Flex",
    dflex: "D-Flex",
    sailor: "Sailor",
    shai: "Shai",
    shotcaller: "Shotcaller",
    "flag placer": "Flag Placer",
    flag: "Flag Placer",
  };

  const STAT_ALIASES = {
    kills: "enemyKills",
    kill: "enemyKills",
    "enemy kills": "enemyKills",
    deaths: "deaths",
    death: "deaths",
    fort: "totalDamageToFort",
    "fort damage": "totalDamageToFort",
    "damage to fort": "totalDamageToFort",
    damage: "damageDealt",
    "damage dealt": "damageDealt",
    cc: "ccHits",
    "cc hits": "ccHits",
    healing: "healing",
    healed: "healing",
    "hp healed": "healing",
    "damage taken": "damageTaken",
    taken: "damageTaken",
    survived: "timeSurvived",
    "time survived": "timeSurvived",
  };

  const STAT_LABELS = {
    enemyKills: "kills",
    deaths: "deaths",
    totalDamageToFort: "fort damage",
    damageDealt: "damage dealt",
    ccHits: "CC hits",
    healing: "healing",
    damageTaken: "damage taken",
    timeSurvived: "time survived",
  };

  let panelEl = null;
  let history = [];

  function getData() {
    return window.NODE_WAR_DATA && typeof window.NODE_WAR_DATA === "object"
      ? window.NODE_WAR_DATA
      : {};
  }

  function getRoster() {
    return Array.isArray(window.GUILD_ROSTER) ? window.GUILD_ROSTER : [];
  }

  function getAliases() {
    return window.GUILD_NAME_ALIASES && typeof window.GUILD_NAME_ALIASES === "object"
      ? window.GUILD_NAME_ALIASES
      : {};
  }

  function getTeamsMap() {
    return window.GUILD_MEMBER_TEAMS && typeof window.GUILD_MEMBER_TEAMS === "object"
      ? window.GUILD_MEMBER_TEAMS
      : {};
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseISOUTC(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function toIsoUTC(date) {
    return date.toISOString().slice(0, 10);
  }

  function sundayOfWeekUTC(iso) {
    const dt = parseISOUTC(iso);
    const day = dt.getUTCDay();
    dt.setUTCDate(dt.getUTCDate() - day);
    return toIsoUTC(dt);
  }

  function saturdayOfWeekUTC(sundayIso) {
    const dt = parseISOUTC(sundayIso);
    dt.setUTCDate(dt.getUTCDate() + 6);
    return toIsoUTC(dt);
  }

  function monthKeyUTC(iso) {
    return String(iso).slice(0, 7);
  }

  function isSiegeDate(iso) {
    return parseISOUTC(iso).getUTCDay() === 6;
  }

  function sortedDateKeys(data) {
    return Object.keys(data).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  }

  function formatShortDate(iso) {
    const dt = parseISOUTC(iso);
    return dt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function parseGameNumber(s) {
    if (s == null) return 0;
    const t = String(s).trim().toUpperCase().replace(/,/g, "");
    if (!t || t === "-") return 0;
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
      return (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "M";
    }
    if (abs >= 1e3) {
      const v = n / 1e3;
      return (v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "K";
    }
    return String(Math.round(n));
  }

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

  function resolveGuildName(raw) {
    if (!raw) return null;
    const roster = getRoster();
    const idx = new Map(roster.map((n) => [n.toLowerCase(), n]));
    const aliases = getAliases();
    const alias = aliases[raw] || aliases[String(raw).toLowerCase()];
    for (const c of alias ? [alias, raw] : [raw]) {
      const hit = idx.get(String(c).toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  function memberTeams(name) {
    const raw = getTeamsMap()[name];
    if (!raw) return [];
    return String(raw)
      .split(/\s*[,/]\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function uniqueWeekStarts(data) {
    const set = new Map();
    for (const d of sortedDateKeys(data)) {
      const sun = sundayOfWeekUTC(d);
      if (!set.has(sun)) set.set(sun, []);
      set.get(sun).push(d);
    }
    return Array.from(set.entries())
      .map(([sunday, dates]) => ({ sunday, dates }))
      .sort((a, b) => b.sunday.localeCompare(a.sunday));
  }

  function uniqueMonths(data) {
    const set = new Map();
    for (const d of sortedDateKeys(data)) {
      const mk = monthKeyUTC(d);
      if (!set.has(mk)) set.set(mk, []);
      set.get(mk).push(d);
    }
    return Array.from(set.entries())
      .map(([month, dates]) => ({ month, dates }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  function datesInWeek(data, sundayIso) {
    const sat = saturdayOfWeekUTC(sundayIso);
    return sortedDateKeys(data).filter((d) => d >= sundayIso && d <= sat);
  }

  function datesInMonth(data, monthKey) {
    return sortedDateKeys(data).filter((d) => monthKeyUTC(d) === monthKey);
  }

  function resolvePeriod(data, period) {
    const keys = sortedDateKeys(data);
    if (!keys.length) return { dateKeys: [], label: "no data", kind: period };

    if (period === "today" || period === "daily") {
      const dk = keys[keys.length - 1];
      return { dateKeys: [dk], label: formatShortDate(dk), kind: "daily" };
    }
    if (period === "lifetime" || period === "all") {
      return {
        dateKeys: keys,
        label: `all logged wars (${formatShortDate(keys[0])} – ${formatShortDate(keys[keys.length - 1])})`,
        kind: "lifetime",
      };
    }
    if (period === "last_week") {
      const weeks = uniqueWeekStarts(data);
      const week = weeks[1] || weeks[0];
      if (!week) return { dateKeys: [], label: "no week", kind: "week" };
      return {
        dateKeys: week.dates,
        label: `last week ${formatShortDate(week.sunday)} – ${formatShortDate(saturdayOfWeekUTC(week.sunday))}`,
        kind: "week",
        sunday: week.sunday,
      };
    }
    if (period === "last_month") {
      const months = uniqueMonths(data);
      const month = months[1] || months[0];
      if (!month) return { dateKeys: [], label: "no month", kind: "month" };
      return {
        dateKeys: month.dates,
        label: `last month (${formatMonthLabel(month.month)})`,
        kind: "month",
        month: month.month,
      };
    }
    if (period === "month" || period === "this_month") {
      const months = uniqueMonths(data);
      const month = months[0];
      if (!month) return { dateKeys: [], label: "no month", kind: "month" };
      return {
        dateKeys: month.dates,
        label: formatMonthLabel(month.month),
        kind: "month",
        month: month.month,
      };
    }
    // default: this week
    const weeks = uniqueWeekStarts(data);
    const week = weeks[0];
    if (!week) return { dateKeys: [], label: "no week", kind: "week" };
    return {
      dateKeys: week.dates,
      label: `this week ${formatShortDate(week.sunday)} – ${formatShortDate(saturdayOfWeekUTC(week.sunday))}`,
      kind: "week",
      sunday: week.sunday,
    };
  }

  function detectPeriod(q) {
    if (/\b(last\s+week|previous\s+week)\b/.test(q)) return "last_week";
    if (/\b(last\s+month|previous\s+month)\b/.test(q)) return "last_month";
    if (/\b(this\s+month|monthly)\b/.test(q)) return "month";
    if (/\b(today|yesterday|daily|this\s+day|latest\s+war)\b/.test(q)) return "today";
    if (/\b(lifetime|all\s+time|all\s+wars|ever)\b/.test(q)) return "lifetime";
    if (/\b(this\s+week|weekly|sun.?sat)\b/.test(q)) return "week";
    return "week";
  }

  function detectTeam(q) {
    for (const [alias, team] of Object.entries(TEAM_ALIASES)) {
      if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
        return team;
      }
    }
    return null;
  }

  function detectStat(q) {
    const entries = Object.entries(STAT_ALIASES).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, key] of entries) {
      if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
        return key;
      }
    }
    return null;
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

  function buildAttendance(data, dateKeys) {
    const nodeWarDates = dateKeys.filter((d) => !isSiegeDate(d));
    const siegeDates = dateKeys.filter((d) => isSiegeDate(d));
    const rows = getRoster().map((name) => ({
      familyName: name,
      team: getTeamsMap()[name] || "—",
      teams: memberTeams(name),
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

  function aggregateCombat(data, dateKeys) {
    const map = new Map();
    for (const name of getRoster()) {
      map.set(name, {
        familyName: name,
        team: getTeamsMap()[name] || "—",
        teams: memberTeams(name),
        enemyKills: 0,
        deaths: 0,
        damageDealt: 0,
        damageTaken: 0,
        ccHits: 0,
        healing: 0,
        totalDamageToFort: 0,
        timeSurvived: 0,
        wars: 0,
      });
    }
    for (const dk of dateKeys) {
      const day = data[dk];
      if (!day || !Array.isArray(day.rows)) continue;
      for (const r of day.rows) {
        const canon = resolveGuildName(r.familyName);
        if (!canon || !map.has(canon)) continue;
        const row = map.get(canon);
        row.wars += 1;
        row.enemyKills += Number(r.enemyKills) || 0;
        row.deaths += Number(r.deaths) || 0;
        row.damageDealt += parseGameNumber(r.damageDealt);
        row.damageTaken += parseGameNumber(r.damageTaken);
        row.ccHits += Number(r.ccHits) || 0;
        row.healing += parseGameNumber(r.hpHealed) + parseGameNumber(r.allyHp);
        row.totalDamageToFort += parseGameNumber(r.totalDamageToFort);
        row.timeSurvived += parseTimeToSeconds(r.timeSurvived);
      }
    }
    return Array.from(map.values());
  }

  function filterTeam(rows, team) {
    if (!team) return rows;
    return rows.filter((r) => (r.teams || memberTeams(r.familyName)).includes(team));
  }

  function outcomeSummary(data, dateKeys) {
    let wins = 0;
    let losses = 0;
    let unknown = 0;
    const days = [];
    for (const dk of dateKeys) {
      const o = data[dk]?.outcome;
      if (o === "victory") {
        wins += 1;
        days.push({ date: dk, outcome: "Victory" });
      } else if (o === "defeat") {
        losses += 1;
        days.push({ date: dk, outcome: "Defeat" });
      } else {
        unknown += 1;
        days.push({ date: dk, outcome: "Unknown" });
      }
    }
    return { wins, losses, unknown, days };
  }

  function helpText() {
    return {
      title: "What I can answer",
      lines: [
        "Attendance: under/over/exactly N node wars · missed siege · zero wars · perfect attendance",
        "Combat: top/bottom N kills, deaths, fort damage, CC, healing, damage dealt/taken",
        "Roster: filter by team (Ball, Support, Defense, Flex, …)",
        "Period: this week · last week · this month · last month · today · lifetime",
        "Outcomes: wins/losses this week or month",
        "Examples: “who has under 3 node wars this week”, “top 10 fort damage Ball last week”, “missed siege this month”",
      ],
    };
  }

  function parseQuery(raw) {
    const q = String(raw || "").trim().toLowerCase().replace(/[’']/g, "'");
    if (!q) return { type: "help" };
    if (/^(help|examples|\?|what can you|commands)\b/.test(q)) return { type: "help" };

    const period = detectPeriod(q);
    const team = detectTeam(q);
    const nMatch = q.match(/\b(?:under|below|less than|fewer than|<)\s+(\d+)\b/)
      || q.match(/\b(?:over|above|more than|at least|>=)\s+(\d+)\b/)
      || q.match(/\b(?:exactly|equal to|=)\s+(\d+)\b/)
      || q.match(/\b(?:top|bottom)\s+(\d+)\b/);
    const n = nMatch ? Number(nMatch[1]) : null;

    if (/\b(win|wins|losses|record|results|scoreboard)\b/.test(q) && !/\bkills?\b/.test(q)) {
      return { type: "outcomes", period, team };
    }

    if (/\b(missed?\s+siege|no\s+siege|0\s+siege|zero\s+siege)\b/.test(q)) {
      return { type: "attendance_filter", period, team, field: "siege", op: "eq", value: 0 };
    }
    if (/\b(missed?\s+node\s*wars?|no\s+node\s*wars?|zero\s+node\s*wars?|0\s+node\s*wars?)\b/.test(q)) {
      return { type: "attendance_filter", period, team, field: "nodeWars", op: "eq", value: 0 };
    }
    if (/\b(zero\s+wars?|no\s+wars?|absent|didn't\s+play|did\s+not\s+play)\b/.test(q)) {
      return { type: "attendance_filter", period, team, field: "total", op: "eq", value: 0 };
    }
    if (/\b(perfect\s+attendance|attended\s+every|full\s+attendance|every\s+war)\b/.test(q)) {
      return { type: "perfect_attendance", period, team };
    }
    if (/\b(who\s+(was\s+)?absent|missing\s+players|who\s+missed)\b/.test(q) && !/\bsiege\b/.test(q)) {
      return { type: "absent", period, team };
    }

    if (/\bnode\s*wars?\b/.test(q) || /\bnw\b/.test(q) || /\battendance\b/.test(q)) {
      if (/\b(under|below|less than|fewer than|<)\b/.test(q) && n != null) {
        return { type: "attendance_filter", period, team, field: "nodeWars", op: "lt", value: n };
      }
      if (/\b(over|above|more than|at least|>=)\b/.test(q) && n != null) {
        return { type: "attendance_filter", period, team, field: "nodeWars", op: "gte", value: n };
      }
      if (/\b(exactly|equal to|=)\b/.test(q) && n != null) {
        return { type: "attendance_filter", period, team, field: "nodeWars", op: "eq", value: n };
      }
      return { type: "attendance_list", period, team };
    }

    if (/\bsiege\b/.test(q) && !/\bticket/.test(q)) {
      if (/\b(under|below|less than|fewer than|<)\b/.test(q) && n != null) {
        return { type: "attendance_filter", period, team, field: "siege", op: "lt", value: n };
      }
      if (/\b(over|above|more than|at least|>=)\b/.test(q) && n != null) {
        return { type: "attendance_filter", period, team, field: "siege", op: "gte", value: n };
      }
      return { type: "attendance_list", period, team, focus: "siege" };
    }

    const stat = detectStat(q);
    if (stat || /\b(top|bottom|lowest|highest|most|least)\b/.test(q)) {
      const key = stat || "enemyKills";
      const bottom = /\b(bottom|lowest|least|fewest)\b/.test(q);
      const limit = n != null ? n : 10;
      return { type: "combat_rank", period, team, key, bottom, limit };
    }

    if (/\b(report|summary|overview)\b/.test(q)) {
      return { type: "summary", period, team };
    }

    return { type: "unknown", period, team, q };
  }

  function applyOp(value, op, target) {
    if (op === "lt") return value < target;
    if (op === "gte") return value >= target;
    return value === target;
  }

  function opLabel(op, value) {
    if (op === "lt") return `under ${value}`;
    if (op === "gte") return `at least ${value}`;
    return `exactly ${value}`;
  }

  function runQuery(raw) {
    const parsed = parseQuery(raw);
    const data = getData();

    if (parsed.type === "help") return helpText();
    if (parsed.type === "unknown") {
      return {
        title: "I didn’t catch that",
        lines: [
          `Tried to read: “${raw}”`,
          "Try: under 3 node wars this week · missed siege last week · top 10 fort damage Ball this month · wins this week",
          "Type help for the full list.",
        ],
      };
    }

    const period = resolvePeriod(data, parsed.period);
    if (!period.dateKeys.length) {
      return { title: "No war data", lines: ["Nothing logged for that period yet."] };
    }

    const teamNote = parsed.team ? ` · ${parsed.team}` : "";

    if (parsed.type === "outcomes") {
      const { wins, losses, unknown, days } = outcomeSummary(data, period.dateKeys);
      return {
        title: `Results · ${period.label}${teamNote}`,
        lines: [
          `${wins} win${wins === 1 ? "" : "s"} · ${losses} loss${losses === 1 ? "" : "es"}${unknown ? ` · ${unknown} unknown` : ""}`,
          ...days.map((d) => `${formatShortDate(d.date)} — ${d.outcome}`),
        ],
        names: [],
      };
    }

    if (parsed.type === "summary") {
      const { rows, nodeWarDates, siegeDates } = buildAttendance(data, period.dateKeys);
      let list = filterTeam(rows, parsed.team);
      const played = list.filter((r) => r.nodeWars + r.siege > 0);
      const under3 = list.filter((r) => r.nodeWars < 3);
      const missedSiege = list.filter((r) => siegeDates.length && r.siege === 0);
      const outcomes = outcomeSummary(data, period.dateKeys);
      return {
        title: `Summary · ${period.label}${teamNote}`,
        lines: [
          `${period.dateKeys.length} wars logged (${nodeWarDates.length} node · ${siegeDates.length} siege)`,
          `Record: ${outcomes.wins}W – ${outcomes.losses}L`,
          `${played.length}/${list.length} roster members appeared`,
          `${under3.length} with under 3 node wars`,
          siegeDates.length ? `${missedSiege.length} missed siege` : "No siege in this period",
        ],
      };
    }

    if (parsed.type === "perfect_attendance") {
      const { rows, nodeWarDates, siegeDates } = buildAttendance(data, period.dateKeys);
      let list = filterTeam(rows, parsed.team);
      const needNW = nodeWarDates.length;
      const needSG = siegeDates.length;
      const hits = list.filter((r) => r.nodeWars >= needNW && r.siege >= needSG);
      return {
        title: `Perfect attendance · ${period.label}${teamNote}`,
        lines: [
          `Needed ${needNW} node war${needNW === 1 ? "" : "s"}${needSG ? ` + ${needSG} siege` : ""}`,
          hits.length ? hits.map((r) => r.familyName).join(", ") : "Nobody hit perfect attendance.",
          `${hits.length} player${hits.length === 1 ? "" : "s"}`,
        ],
        names: hits.map((r) => r.familyName),
      };
    }

    if (parsed.type === "absent") {
      const { rows } = buildAttendance(data, period.dateKeys);
      let list = filterTeam(rows, parsed.team).filter((r) => r.nodeWars + r.siege === 0);
      return {
        title: `Absent · ${period.label}${teamNote}`,
        lines: [
          list.length ? list.map((r) => r.familyName).join(", ") : "Nobody was fully absent.",
          `${list.length} player${list.length === 1 ? "" : "s"}`,
        ],
        names: list.map((r) => r.familyName),
      };
    }

    if (parsed.type === "attendance_filter" || parsed.type === "attendance_list") {
      const { rows, nodeWarDates, siegeDates } = buildAttendance(data, period.dateKeys);
      let list = filterTeam(rows, parsed.team);

      if (parsed.type === "attendance_filter") {
        list = list.filter((r) => {
          const value =
            parsed.field === "total" ? r.nodeWars + r.siege : Number(r[parsed.field]) || 0;
          return applyOp(value, parsed.op, parsed.value);
        });
        const fieldLabel =
          parsed.field === "nodeWars" ? "node wars" : parsed.field === "siege" ? "siege" : "wars";
        const detail = list
          .sort((a, b) => a.familyName.localeCompare(b.familyName))
          .map((r) => `${r.familyName} (${r.nodeWars} NW · ${r.siege} siege)`);
        return {
          title: `${opLabel(parsed.op, parsed.value)} ${fieldLabel} · ${period.label}${teamNote}`,
          lines: [
            `${nodeWarDates.length} node wars · ${siegeDates.length} sieges in period`,
            detail.length ? detail.join("\n") : "No matching players.",
            `${list.length} player${list.length === 1 ? "" : "s"}`,
          ],
          names: list.map((r) => r.familyName),
        };
      }

      list = list
        .slice()
        .sort((a, b) => b.nodeWars - a.nodeWars || b.siege - a.siege || a.familyName.localeCompare(b.familyName));
      return {
        title: `Attendance · ${period.label}${teamNote}`,
        lines: [
          `${nodeWarDates.length} node wars · ${siegeDates.length} sieges`,
          ...list.map((r) => `${r.familyName}: ${r.nodeWars} NW · ${r.siege} siege`),
        ],
        names: list.map((r) => r.familyName),
      };
    }

    if (parsed.type === "combat_rank") {
      let list = filterTeam(aggregateCombat(data, period.dateKeys), parsed.team).filter((r) => r.wars > 0);
      list.sort((a, b) => {
        const av = a[parsed.key] || 0;
        const bv = b[parsed.key] || 0;
        return parsed.bottom ? av - bv || a.familyName.localeCompare(b.familyName) : bv - av || a.familyName.localeCompare(b.familyName);
      });
      const sliced = list.slice(0, parsed.limit);
      const label = STAT_LABELS[parsed.key] || parsed.key;
      const fmt = (v) =>
        parsed.key === "timeSurvived"
          ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`
          : parsed.key === "enemyKills" || parsed.key === "deaths" || parsed.key === "ccHits"
            ? String(v)
            : formatGameNumber(v);
      return {
        title: `${parsed.bottom ? "Bottom" : "Top"} ${parsed.limit} ${label} · ${period.label}${teamNote}`,
        lines: sliced.length
          ? sliced.map((r, i) => `${i + 1}. ${r.familyName} — ${fmt(r[parsed.key])} (${r.wars} wars)`)
          : ["No combat rows for that period."],
        names: sliced.map((r) => r.familyName),
      };
    }

    return helpText();
  }

  function renderResult(result) {
    const lines = (result.lines || []).map((line) => {
      if (line.includes("\n")) {
        return `<pre class="ask-pre">${escapeHtml(line)}</pre>`;
      }
      return `<p class="ask-line">${escapeHtml(line)}</p>`;
    });
    return `
      <article class="ask-result">
        <h3 class="ask-result-title">${escapeHtml(result.title || "Result")}</h3>
        <div class="ask-result-body">${lines.join("")}</div>
        ${
          result.names && result.names.length
            ? `<button type="button" class="ask-btn ask-btn--copy" data-copy="${escapeHtml(result.names.join(", "))}">Copy names</button>`
            : ""
        }
      </article>
    `;
  }

  function pushHistory(question, result) {
    history.unshift({ question, result });
    history = history.slice(0, 8);
  }

  function render() {
    if (!panelEl) return;
    const chips = [
      ["Under 3 NW this week", "who has under 3 node wars this week"],
      ["Missed siege this week", "missed siege this week"],
      ["Zero wars this week", "who has zero wars this week"],
      ["Top 10 kills", "top 10 kills this week"],
      ["Top fort damage", "top 10 fort damage this week"],
      ["Ball under 3 NW", "Ball under 3 node wars this week"],
      ["Wins this week", "wins and losses this week"],
      ["Summary this week", "summary this week"],
      ["Help", "help"],
    ];

    panelEl.innerHTML = `
      <div class="ask-head">
        <h2 class="ask-title">Ask <strong>FRAG</strong></h2>
        <p class="ask-sub">Officer reports from your logged wars — type a question or tap a shortcut. No AI cloud; runs on this page only.</p>
      </div>
      <form id="ask-form" class="ask-form">
        <label class="ask-label" for="ask-input">Question</label>
        <div class="ask-row">
          <input id="ask-input" class="ask-input" type="text" placeholder="e.g. who has under 3 node wars this week" autocomplete="off" />
          <button type="submit" class="ask-btn ask-btn--gold">Ask</button>
        </div>
      </form>
      <div class="ask-chips" role="group" aria-label="Shortcuts">
        ${chips
          .map(
            ([label, q]) =>
              `<button type="button" class="ask-chip" data-q="${escapeHtml(q)}">${escapeHtml(label)}</button>`
          )
          .join("")}
      </div>
      <div id="ask-output" class="ask-output">
        ${history.length ? history.map((h) => `
          <div class="ask-turn">
            <p class="ask-q">You: ${escapeHtml(h.question)}</p>
            ${renderResult(h.result)}
          </div>
        `).join("") : renderResult(helpText())}
      </div>
    `;

    panelEl.querySelector("#ask-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = panelEl.querySelector("#ask-input");
      const q = input?.value || "";
      if (!String(q).trim()) return;
      const result = runQuery(q);
      pushHistory(q.trim(), result);
      if (input) input.value = "";
      render();
      panelEl.querySelector("#ask-input")?.focus();
    });

    panelEl.querySelectorAll("[data-q]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = btn.getAttribute("data-q") || "";
        const result = runQuery(q);
        pushHistory(q, result);
        render();
      });
    });

    panelEl.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy") || "";
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = "Copy names";
          }, 1200);
        } catch {
          btn.textContent = "Copy failed";
        }
      });
    });
  }

  function mount(panel) {
    panelEl = panel;
    render();
  }

  window.FRAGAsk = { mount, render, runQuery };
})();
