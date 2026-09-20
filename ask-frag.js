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
    cannons: "Cannons",
    cannon: "Cannons",
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
    dps: "damageDealt",
    cc: "ccHits",
    "cc hits": "ccHits",
    healing: "healing",
    healed: "healing",
    "hp healed": "healing",
    "ally hp": "allyHp",
    "ally healing": "allyHp",
    "damage taken": "damageTaken",
    tank: "damageTaken",
    taken: "damageTaken",
    survived: "timeSurvived",
    "time survived": "timeSurvived",
    survival: "timeSurvived",
    streak: "maxKillStreak",
    "kill streak": "maxKillStreak",
    "max kill streak": "maxKillStreak",
    cannon: "cannonHits",
    cannons: "cannonHits",
    "cannon hits": "cannonHits",
    traps: "trapsTriggered",
    trap: "trapsTriggered",
    kd: "kd",
    "k/d": "kd",
    "k d": "kd",
    "kill death": "kd",
    "kill/death": "kd",
    ratio: "kd",
  };

  const STAT_LABELS = {
    enemyKills: "kills",
    deaths: "deaths",
    totalDamageToFort: "fort damage",
    damageDealt: "damage dealt",
    ccHits: "CC hits",
    healing: "healing",
    allyHp: "ally HP",
    damageTaken: "damage taken",
    timeSurvived: "time survived",
    maxKillStreak: "max kill streak",
    cannonHits: "cannon hits",
    trapsTriggered: "traps",
    kd: "K/D",
  };

  const MVP_COMPONENTS = [
    { key: "enemyKills", weight: 0.2 },
    { key: "damageDealt", weight: 0.15 },
    { key: "ccHits", weight: 0.15 },
    { key: "totalDamageToFort", weight: 0.2 },
    { key: "healing", weight: 0.1 },
    { key: "timeSurvived", weight: 0.1 },
    { key: "damageTaken", weight: 0.05 },
    { key: "deaths", weight: 0.05 },
  ];

  const HEALER_MVP_COMPONENTS = [
    { key: "allyHp", weight: 0.75 },
    { key: "ccHits", weight: 0.25 },
  ];

  const QUERY_STOP =
    /\b(who|what|which|how|many|has|have|had|did|does|was|were|is|are|the|a|an|for|of|in|on|to|from|with|vs|versus|compare|against|show|list|tell|me|please|stats?|stat|report|summary|overview|attendance|record|results?|wins?|losses?|top|bottom|best|worst|most|least|highest|lowest|under|over|above|below|exactly|at|least|more|than|fewer|less|this|last|week|month|today|yesterday|daily|weekly|monthly|lifetime|all|time|wars?|node|nw|siege|tickets?|mvp|healer|team|roster|players?|members?|guild|frag|perfect|missed?|absent|zero|every|full|played|appeared|help|examples|commands)\b/gi;

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

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    return String(iso).slice(0, 10).slice(0, 7);
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

  function formatTimeFromSeconds(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function formatKd(kills, deaths) {
    if (!deaths) return kills > 0 ? kills.toFixed(2) : "0.00";
    return (kills / deaths).toFixed(2);
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

  function resolvePeriod(data, period) {
    const keys = sortedDateKeys(data);
    if (!keys.length) return { dateKeys: [], label: "no data", kind: period };

    if (period === "today" || period === "daily") {
      const dk = keys[keys.length - 1];
      return { dateKeys: [dk], label: formatShortDate(dk), kind: "daily", sunday: sundayOfWeekUTC(dk) };
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
    if (/\b(today|yesterday|daily|this\s+day|latest\s+war|last\s+war)\b/.test(q)) return "today";
    if (/\b(lifetime|all\s+time|all\s+wars|ever|career)\b/.test(q)) return "lifetime";
    if (/\b(this\s+week|weekly|sun.?sat)\b/.test(q)) return "week";
    return "week";
  }

  function detectTeam(q) {
    for (const [alias, team] of Object.entries(TEAM_ALIASES)) {
      // "cannon hits" is a combat stat — only treat Cannons as a team when asked explicitly.
      if (
        (alias === "cannon" || alias === "cannons") &&
        !/\b(on\s+cannons|cannons\s+(team|roster)|who\s+is\s+on\s+cannons|cannons\s+list)\b/.test(q)
      ) {
        continue;
      }
      if (new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(q)) return team;
    }
    return null;
  }

  function detectStat(q) {
    const entries = Object.entries(STAT_ALIASES).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, key] of entries) {
      if (new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(q)) return key;
    }
    return null;
  }

  function findPlayersInQuery(q) {
    const roster = getRoster()
      .slice()
      .sort((a, b) => b.length - a.length);
    const aliases = getAliases();
    const found = [];
    const positions = [];

    const candidates = [];
    for (const name of roster) {
      candidates.push({ needle: name.toLowerCase(), canon: name });
    }
    for (const [alias, target] of Object.entries(aliases)) {
      const canon = resolveGuildName(target) || resolveGuildName(alias);
      if (canon) candidates.push({ needle: String(alias).toLowerCase(), canon });
    }
    candidates.sort((a, b) => b.needle.length - a.needle.length);

    const hay = ` ${q} `;
    const usedSpans = [];
    for (const { needle, canon } of candidates) {
      if (found.includes(canon)) continue;
      if (needle.length < 3) continue;
      const re = new RegExp(`(?:^|[^a-z0-9_])(${escapeRegExp(needle)})(?:[^a-z0-9_]|$)`, "i");
      const m = re.exec(hay);
      if (!m) continue;
      const start = m.index + m[0].indexOf(m[1]);
      const end = start + m[1].length;
      if (usedSpans.some((s) => start < s.end && end > s.start)) continue;
      usedSpans.push({ start, end });
      found.push(canon);
      positions.push(start);
    }
    // Preserve left-to-right order in the question (for A vs B).
    return found
      .map((name, i) => ({ name, pos: positions[i] }))
      .sort((a, b) => a.pos - b.pos)
      .map((x) => x.name);
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
      dates: [],
    }));
    const byName = new Map(rows.map((r) => [r.familyName, r]));
    for (const dk of nodeWarDates) {
      for (const name of presentCanonicalOnDate(data, dk)) {
        const row = byName.get(name);
        if (row) {
          row.nodeWars += 1;
          row.dates.push(dk);
        }
      }
    }
    for (const dk of siegeDates) {
      for (const name of presentCanonicalOnDate(data, dk)) {
        const row = byName.get(name);
        if (row) {
          row.siege += 1;
          row.dates.push(dk);
        }
      }
    }
    return { rows, nodeWarDates, siegeDates };
  }

  function emptyCombatRow(name) {
    return {
      familyName: name,
      team: getTeamsMap()[name] || "—",
      teams: memberTeams(name),
      enemyKills: 0,
      deaths: 0,
      damageDealt: 0,
      damageTaken: 0,
      ccHits: 0,
      healing: 0,
      allyHp: 0,
      hpHealed: 0,
      totalDamageToFort: 0,
      timeSurvived: 0,
      maxKillStreak: 0,
      cannonHits: 0,
      trapsTriggered: 0,
      wars: 0,
      kd: 0,
    };
  }

  function aggregateCombat(data, dateKeys) {
    const map = new Map();
    for (const name of getRoster()) map.set(name, emptyCombatRow(name));
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
        row.hpHealed += parseGameNumber(r.hpHealed);
        row.allyHp += parseGameNumber(r.allyHp);
        row.healing = row.hpHealed + row.allyHp;
        row.totalDamageToFort += parseGameNumber(r.totalDamageToFort);
        row.timeSurvived += parseTimeToSeconds(r.timeSurvived);
        row.maxKillStreak = Math.max(row.maxKillStreak, Number(r.maxKillStreak) || 0);
        row.cannonHits += Number(r.cannonHits) || 0;
        row.trapsTriggered += Number(r.trapsTriggered) || 0;
      }
    }
    for (const row of map.values()) {
      row.kd = row.deaths > 0 ? row.enemyKills / row.deaths : row.enemyKills;
    }
    return Array.from(map.values());
  }

  function filterTeam(rows, team) {
    if (!team) return rows;
    return rows.filter((r) => (r.teams || memberTeams(r.familyName)).includes(team));
  }

  function safeRatio(value, highest) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (!Number.isFinite(highest) || highest <= 0) return 0;
    return value / highest;
  }

  function computeMvpScores(rows) {
    if (!rows.length) return [];
    const max = {};
    for (const c of MVP_COMPONENTS) {
      max[c.key] = Math.max(...rows.map((r) => Number(r[c.key]) || 0));
    }
    return rows
      .map((r) => {
        let score = 0;
        for (const c of MVP_COMPONENTS) {
          const v = Number(r[c.key]) || 0;
          if (c.key === "deaths") {
            score += c.weight * Math.max(0, max.deaths > 0 ? 1 - v / max.deaths : 1);
          } else {
            score += c.weight * Math.min(1, safeRatio(v, max[c.key]));
          }
        }
        return { familyName: r.familyName, score, row: r };
      })
      .sort((a, b) => b.score - a.score || a.familyName.localeCompare(b.familyName));
  }

  function computeHealerMvpScores(rows) {
    if (!rows.length) return [];
    const max = {};
    for (const c of HEALER_MVP_COMPONENTS) {
      max[c.key] = Math.max(...rows.map((r) => Number(r[c.key]) || 0));
    }
    return rows
      .map((r) => {
        let score = 0;
        for (const c of HEALER_MVP_COMPONENTS) {
          score += c.weight * Math.min(1, safeRatio(Number(r[c.key]) || 0, max[c.key]));
        }
        return { familyName: r.familyName, score, row: r };
      })
      .sort((a, b) => b.score - a.score || a.familyName.localeCompare(b.familyName));
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

  function siegeTicketsForWeek(sundayIso) {
    const fortWins = window.SIEGE_FORT_WINS || {};
    const castles = window.SIEGE_CASTLE_HOLDERS || {};
    const sat = saturdayOfWeekUTC(sundayIso);
    const ticketGuilds = new Map();
    for (const [date, guilds] of Object.entries(fortWins)) {
      if (date < sundayIso || date > sat) continue;
      for (const g of guilds || []) {
        if (!ticketGuilds.has(g)) ticketGuilds.set(g, { name: g, source: "fort", dates: [] });
        ticketGuilds.get(g).dates.push(date);
      }
    }
    const castleList = castles[sundayIso] || [];
    for (const g of castleList) {
      if (!ticketGuilds.has(g)) ticketGuilds.set(g, { name: g, source: "castle", dates: [sundayIso] });
      else ticketGuilds.get(g).source = "castle+fort";
    }
    const ours = new Set(window.SIEGE_OUR_ALLIANCE || []);
    const tickets = Array.from(ticketGuilds.values()).sort((a, b) => a.name.localeCompare(b.name));
    return {
      tickets,
      ours: tickets.filter((t) => ours.has(t.name)),
      count: tickets.length,
    };
  }

  function formatStatValue(key, row) {
    if (key === "kd") return formatKd(row.enemyKills, row.deaths);
    if (key === "timeSurvived") return formatTimeFromSeconds(row.timeSurvived);
    if (
      key === "enemyKills" ||
      key === "deaths" ||
      key === "ccHits" ||
      key === "maxKillStreak" ||
      key === "cannonHits" ||
      key === "trapsTriggered"
    ) {
      return String(row[key] || 0);
    }
    return formatGameNumber(row[key] || 0);
  }

  function playerCardLines(row, att, periodLabel) {
    const team = row.team && row.team !== "—" ? row.team : "unassigned";
    return [
      `${row.familyName} · ${team} · ${periodLabel}`,
      `Attendance: ${att.nodeWars} NW · ${att.siege} siege (${att.nodeWars + att.siege} total)`,
      `Combat: ${row.enemyKills} kills · ${row.deaths} deaths · K/D ${formatKd(row.enemyKills, row.deaths)}`,
      `Damage ${formatGameNumber(row.damageDealt)} · taken ${formatGameNumber(row.damageTaken)} · fort ${formatGameNumber(row.totalDamageToFort)}`,
      `CC ${row.ccHits} · healing ${formatGameNumber(row.healing)} (ally HP ${formatGameNumber(row.allyHp)})`,
      `Survived ${formatTimeFromSeconds(row.timeSurvived)} · streak ${row.maxKillStreak} · cannons ${row.cannonHits} · traps ${row.trapsTriggered}`,
      `Appeared in ${row.wars} logged war${row.wars === 1 ? "" : "s"}`,
    ];
  }

  function helpText() {
    return {
      title: "What I can answer",
      lines: [
        "Attendance: under/over/exactly N node wars · missed siege · zero wars · perfect attendance · who played",
        "Combat: top/bottom N for kills, deaths, K/D, fort, damage, CC, healing, ally HP, cannons, traps, streak",
        "MVP: mvp leaderboard · healer mvp · past mvp winners · mvp cooldown",
        "Player: “stats for Name” · “how did Name do this week” · “what team is Name on” · “Name vs Other”",
        "Teams: “who is on Ball” · “Support roster”",
        "Period: this/last week · this/last month · today/latest war · lifetime",
        "Other: wins/losses · summary · war calendar · how many wars · siege tickets",
        "Tip: add a team name or period to any question. Type help anytime.",
      ],
    };
  }

  function parseQuery(raw) {
    const q = String(raw || "").trim().toLowerCase().replace(/[’']/g, "'");
    if (!q) return { type: "help" };
    if (/^(help|examples|\?|what can you|commands)\b/.test(q)) return { type: "help" };

    const period = detectPeriod(q);
    const team = detectTeam(q);
    const players = findPlayersInQuery(q);
    const nMatch =
      q.match(/\b(?:under|below|less than|fewer than|<)\s+(\d+)\b/) ||
      q.match(/\b(?:over|above|more than|at least|>=?)\s+(\d+)\b/) ||
      q.match(/\b(?:exactly|equal to|=)\s+(\d+)\b/) ||
      q.match(/\b(?:top|bottom)\s+(\d+)\b/);
    const n = nMatch ? Number(nMatch[1]) : null;
    const avg = /\b(per\s+war|average|avg|averaged)\b/.test(q);

    if (/\b(siege\s+tickets?|ticket\s+list|who\s+has\s+tickets?)\b/.test(q)) {
      return { type: "siege_tickets", period };
    }

    if (/\b(war\s+calendar|logged\s+wars?|which\s+wars?|war\s+dates?|how\s+many\s+wars?)\b/.test(q)) {
      return { type: "war_calendar", period };
    }

    if (/\b(past\s+mvp|mvp\s+winners?|previous\s+mvp|mvp\s+history|who\s+won\s+mvp)\b/.test(q)) {
      return { type: "mvp_history" };
    }
    if (/\b(mvp\s+cooldown|on\s+cooldown|mvp\s+excluded)\b/.test(q)) {
      return { type: "mvp_cooldown", period };
    }
    if (/\bhealer\s*mvp\b/.test(q) || /\b(healer|support)\s+(leaderboard|rank|score|mvp)\b/.test(q)) {
      const limit = n != null ? n : 10;
      return { type: "healer_mvp", period, team, limit };
    }
    if (/\bmvp\b/.test(q) || /\b(overall\s+score|analysis\s+score)\b/.test(q)) {
      const limit = n != null ? n : 10;
      return { type: "mvp", period, team, limit };
    }

    if (/\b(win|wins|losses|record|results|scoreboard)\b/.test(q) && !/\bkills?\b/.test(q)) {
      return { type: "outcomes", period, team };
    }

    if (players.length >= 2 && /\b(vs|versus|compare|against)\b/.test(q)) {
      return { type: "compare", period, players: players.slice(0, 2) };
    }

    if (players.length === 1) {
      if (/\b(team|role|assignment)\b/.test(q) || /\bwhat\s+team\b/.test(q)) {
        return { type: "player_team", player: players[0] };
      }
      return { type: "player", period, player: players[0] };
    }

    if (
      (/\b(who\s+is\s+on|who's\s+on|roster|members?\s+of|list)\b/.test(q) && team) ||
      (/\b(team\s+roster|on\s+team)\b/.test(q) && team) ||
      (/^(ball|support|defense|flex|d-flex|sailor|shai|shotcaller|cannons)\s*(roster|team|list)?$/.test(q) && team)
    ) {
      return { type: "team_roster", team };
    }

    if (/\b(who\s+played|who\s+attended|who\s+showed|attendance\s+list|appeared)\b/.test(q)) {
      return { type: "who_played", period, team };
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

    if (/\b(how\s+many\s+(on\s+)?roster|roster\s+size|guild\s+size)\b/.test(q)) {
      return { type: "roster_count" };
    }

    if (/\bnode\s*wars?\b/.test(q) || /\bnw\b/.test(q) || /\battendance\b/.test(q)) {
      if (/\b(under|below|less than|fewer than|<)\b/.test(q) && n != null) {
        return { type: "attendance_filter", period, team, field: "nodeWars", op: "lt", value: n };
      }
      if (/\b(over|above|more than|at least|>=?)\b/.test(q) && n != null) {
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
      if (/\b(over|above|more than|at least|>=?)\b/.test(q) && n != null) {
        return { type: "attendance_filter", period, team, field: "siege", op: "gte", value: n };
      }
      return { type: "attendance_list", period, team, focus: "siege" };
    }

    const stat = detectStat(q);
    if (stat || /\b(top|bottom|lowest|highest|most|least|best|worst)\b/.test(q)) {
      let key = stat || "enemyKills";
      if (/\b(best|highest|most)\s+kd\b/.test(q) || /\bk\/?d\b/.test(q)) key = "kd";
      const bottom =
        /\b(bottom|lowest|least|fewest|worst)\b/.test(q) &&
        !/\b(least\s+deaths|fewest\s+deaths|lowest\s+deaths)\b/.test(q);
      // "fewest deaths" is a good thing → bottom of deaths ranking
      const forceBottomDeaths = /\b(fewest|least|lowest)\s+deaths\b/.test(q);
      const limit = n != null ? n : 10;
      return {
        type: "combat_rank",
        period,
        team,
        key: forceBottomDeaths ? "deaths" : key,
        bottom: forceBottomDeaths ? true : bottom,
        limit,
        avg,
      };
    }

    if (/\b(report|summary|overview|digest)\b/.test(q)) {
      return { type: "summary", period, team };
    }

    // leftover tokens after stripping stop words → try as player name fragment
    const leftover = q.replace(QUERY_STOP, " ").replace(/[^a-z0-9_\s]/gi, " ").replace(/\s+/g, " ").trim();
    if (leftover.length >= 3) {
      const fuzzy = findPlayersInQuery(leftover);
      if (fuzzy.length === 1) return { type: "player", period, player: fuzzy[0] };
      if (fuzzy.length >= 2 && leftover.includes(" ")) {
        return { type: "compare", period, players: fuzzy.slice(0, 2) };
      }
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
    if (parsed.type === "roster_count") {
      return {
        title: "Guild roster",
        lines: [`${getRoster().length} members on the FRAG roster`],
      };
    }
    if (parsed.type === "mvp_history") {
      const winners = window.GUILD_MVP_WINNERS || {};
      const healer = window.GUILD_HEALER_MVP_WINNERS || {};
      const months = Object.keys(winners).sort().reverse();
      const lines = months.length
        ? months.map((m) => `${formatMonthLabel(m)} — ${winners[m]}`)
        : ["No recorded combat MVP winners yet."];
      const hMonths = Object.keys(healer).sort().reverse();
      if (hMonths.length) {
        lines.push("Healer MVP:");
        for (const m of hMonths) lines.push(`${formatMonthLabel(m)} — ${healer[m]}`);
      }
      return { title: "Past MVP winners", lines, names: months.map((m) => winners[m]) };
    }
    if (parsed.type === "player_team") {
      const teams = memberTeams(parsed.player);
      return {
        title: parsed.player,
        lines: [
          teams.length
            ? `${parsed.player} is on: ${teams.join(", ")}`
            : `${parsed.player} has no team assignment yet.`,
        ],
        names: [parsed.player],
      };
    }
    if (parsed.type === "team_roster") {
      const names = getRoster().filter((n) => memberTeams(n).includes(parsed.team));
      return {
        title: `${parsed.team} roster`,
        lines: [
          names.length ? names.join(", ") : `Nobody assigned to ${parsed.team}.`,
          `${names.length} player${names.length === 1 ? "" : "s"}`,
        ],
        names,
      };
    }
    if (parsed.type === "unknown") {
      return {
        title: "I didn’t catch that",
        lines: [
          `Tried to read: “${raw}”`,
          "Try: under 3 node wars this week · mvp this month · stats for Name · Name vs Other · top 10 K/D · siege tickets · who is on Ball",
          "Type help for the full list.",
        ],
      };
    }

    const period = resolvePeriod(data, parsed.period || "week");
    if (!period.dateKeys.length && parsed.type !== "siege_tickets" && parsed.type !== "mvp_cooldown") {
      return { title: "No war data", lines: ["Nothing logged for that period yet."] };
    }

    const teamNote = parsed.team ? ` · ${parsed.team}` : "";

    if (parsed.type === "mvp_cooldown") {
      const month =
        period.month ||
        (period.dateKeys[0] ? monthKeyUTC(period.dateKeys[period.dateKeys.length - 1]) : null) ||
        uniqueMonths(data)[0]?.month;
      const cooldown = Number(window.GUILD_MVP_COOLDOWN_MONTHS) || 3;
      const winners = window.GUILD_MVP_WINNERS || {};
      const cleared = new Set((window.GUILD_MVP_COOLDOWN_CLEARED || []).map((n) => String(n).toLowerCase()));
      const blocked = [];
      if (month) {
        const [y, m] = month.split("-").map(Number);
        for (let i = 1; i <= cooldown; i++) {
          const dt = new Date(Date.UTC(y, m - 1 - i, 1));
          const mk = dt.toISOString().slice(0, 7);
          const name = winners[mk];
          if (name && !cleared.has(String(name).toLowerCase())) {
            blocked.push(`${name} (won ${formatMonthLabel(mk)})`);
          }
        }
      }
      return {
        title: `MVP cooldown · ${month ? formatMonthLabel(month) : "current"}`,
        lines: [
          `${cooldown}-month combat MVP cooldown`,
          blocked.length ? blocked.join("\n") : "Nobody currently blocked by cooldown.",
          (window.GUILD_MVP_COOLDOWN_CLEARED || []).length
            ? `Cleared early: ${(window.GUILD_MVP_COOLDOWN_CLEARED || []).join(", ")}`
            : null,
        ].filter(Boolean),
        names: blocked.map((s) => s.split(" (")[0]),
      };
    }

    if (parsed.type === "siege_tickets") {
      const sunday =
        period.sunday ||
        (period.dateKeys[0] ? sundayOfWeekUTC(period.dateKeys[0]) : uniqueWeekStarts(data)[0]?.sunday);
      if (!sunday) return { title: "Siege tickets", lines: ["No week available."] };
      const { tickets, ours, count } = siegeTicketsForWeek(sunday);
      return {
        title: `Siege tickets · ${formatShortDate(sunday)} – ${formatShortDate(saturdayOfWeekUTC(sunday))}`,
        lines: [
          `${count} ticket${count === 1 ? "" : "s"} · ${ours.length} our alliance`,
          tickets.length
            ? tickets
                .map((t) => {
                  const mark = ours.some((o) => o.name === t.name) ? " ★" : "";
                  return `${t.name}${mark} (${t.source})`;
                })
                .join("\n")
            : "No tickets logged for that week yet.",
        ],
      };
    }

    if (parsed.type === "war_calendar") {
      const outcomes = outcomeSummary(data, period.dateKeys);
      return {
        title: `War calendar · ${period.label}`,
        lines: [
          `${period.dateKeys.length} war${period.dateKeys.length === 1 ? "" : "s"} logged`,
          ...outcomes.days.map(
            (d) =>
              `${formatShortDate(d.date)} · ${isSiegeDate(d.date) ? "Siege" : "Node"} · ${d.outcome}`
          ),
        ],
      };
    }

    if (parsed.type === "outcomes") {
      const { wins, losses, unknown, days } = outcomeSummary(data, period.dateKeys);
      return {
        title: `Results · ${period.label}${teamNote}`,
        lines: [
          `${wins} win${wins === 1 ? "" : "s"} · ${losses} loss${losses === 1 ? "" : "es"}${unknown ? ` · ${unknown} unknown` : ""}`,
          ...days.map((d) => `${formatShortDate(d.date)} — ${d.outcome}`),
        ],
      };
    }

    if (parsed.type === "summary") {
      const { rows, nodeWarDates, siegeDates } = buildAttendance(data, period.dateKeys);
      const list = filterTeam(rows, parsed.team);
      const played = list.filter((r) => r.nodeWars + r.siege > 0);
      const under3 = list.filter((r) => r.nodeWars < 3);
      const missedSiege = list.filter((r) => siegeDates.length && r.siege === 0);
      const outcomes = outcomeSummary(data, period.dateKeys);
      const combat = filterTeam(aggregateCombat(data, period.dateKeys), parsed.team).filter((r) => r.wars > 0);
      const topKill = combat.slice().sort((a, b) => b.enemyKills - a.enemyKills)[0];
      const topFort = combat.slice().sort((a, b) => b.totalDamageToFort - a.totalDamageToFort)[0];
      return {
        title: `Summary · ${period.label}${teamNote}`,
        lines: [
          `${period.dateKeys.length} wars logged (${nodeWarDates.length} node · ${siegeDates.length} siege)`,
          `Record: ${outcomes.wins}W – ${outcomes.losses}L`,
          `${played.length}/${list.length} roster members appeared`,
          `${under3.length} with under 3 node wars`,
          siegeDates.length ? `${missedSiege.length} missed siege` : "No siege in this period",
          topKill ? `Top kills: ${topKill.familyName} (${topKill.enemyKills})` : null,
          topFort ? `Top fort: ${topFort.familyName} (${formatGameNumber(topFort.totalDamageToFort)})` : null,
        ].filter(Boolean),
      };
    }

    if (parsed.type === "player") {
      const combat = aggregateCombat(data, period.dateKeys);
      const attMap = new Map(buildAttendance(data, period.dateKeys).rows.map((r) => [r.familyName, r]));
      const row = combat.find((r) => r.familyName === parsed.player) || emptyCombatRow(parsed.player);
      const att = attMap.get(parsed.player) || { nodeWars: 0, siege: 0 };
      return {
        title: `${parsed.player} · ${period.label}`,
        lines: playerCardLines(row, att, period.label),
        names: [parsed.player],
      };
    }

    if (parsed.type === "compare") {
      const combat = aggregateCombat(data, period.dateKeys);
      const attMap = new Map(buildAttendance(data, period.dateKeys).rows.map((r) => [r.familyName, r]));
      const [a, b] = parsed.players;
      const ra = combat.find((r) => r.familyName === a) || emptyCombatRow(a);
      const rb = combat.find((r) => r.familyName === b) || emptyCombatRow(b);
      const aa = attMap.get(a) || { nodeWars: 0, siege: 0 };
      const ab = attMap.get(b) || { nodeWars: 0, siege: 0 };
      const line = (label, va, vb) => `${label}: ${va}  vs  ${vb}`;
      return {
        title: `${a} vs ${b} · ${period.label}`,
        lines: [
          line("Attendance", `${aa.nodeWars}NW/${aa.siege}S`, `${ab.nodeWars}NW/${ab.siege}S`),
          line("Kills", ra.enemyKills, rb.enemyKills),
          line("Deaths", ra.deaths, rb.deaths),
          line("K/D", formatKd(ra.enemyKills, ra.deaths), formatKd(rb.enemyKills, rb.deaths)),
          line("Fort", formatGameNumber(ra.totalDamageToFort), formatGameNumber(rb.totalDamageToFort)),
          line("Damage", formatGameNumber(ra.damageDealt), formatGameNumber(rb.damageDealt)),
          line("CC", ra.ccHits, rb.ccHits),
          line("Healing", formatGameNumber(ra.healing), formatGameNumber(rb.healing)),
        ],
        names: [a, b],
      };
    }

    if (parsed.type === "mvp" || parsed.type === "healer_mvp") {
      let list = filterTeam(aggregateCombat(data, period.dateKeys), parsed.team).filter((r) => r.wars > 0);
      const ranked =
        parsed.type === "healer_mvp" ? computeHealerMvpScores(list) : computeMvpScores(list);
      const sliced = ranked.slice(0, parsed.limit);
      const label = parsed.type === "healer_mvp" ? "Healer MVP" : "MVP score";
      return {
        title: `${label} · top ${parsed.limit} · ${period.label}${teamNote}`,
        lines: sliced.length
          ? sliced.map(
              (e, i) =>
                `${i + 1}. ${e.familyName} — ${(e.score * 100).toFixed(1)}% (${e.row.wars} wars)`
            )
          : ["No combat rows for that period."],
        names: sliced.map((e) => e.familyName),
      };
    }

    if (parsed.type === "who_played") {
      const { rows } = buildAttendance(data, period.dateKeys);
      const list = filterTeam(rows, parsed.team)
        .filter((r) => r.nodeWars + r.siege > 0)
        .sort((a, b) => a.familyName.localeCompare(b.familyName));
      return {
        title: `Who played · ${period.label}${teamNote}`,
        lines: [
          list.length
            ? list.map((r) => `${r.familyName} (${r.nodeWars} NW · ${r.siege} S)`).join("\n")
            : "Nobody from the roster appeared.",
          `${list.length} player${list.length === 1 ? "" : "s"}`,
        ],
        names: list.map((r) => r.familyName),
      };
    }

    if (parsed.type === "perfect_attendance") {
      const { rows, nodeWarDates, siegeDates } = buildAttendance(data, period.dateKeys);
      const list = filterTeam(rows, parsed.team);
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
      const list = filterTeam(rows, parsed.team).filter((r) => r.nodeWars + r.siege === 0);
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
        .sort(
          (a, b) =>
            b.nodeWars - a.nodeWars || b.siege - a.siege || a.familyName.localeCompare(b.familyName)
        );
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
      const valueOf = (r) => {
        const raw = Number(r[parsed.key]) || 0;
        if (parsed.avg && parsed.key !== "kd" && parsed.key !== "maxKillStreak" && r.wars > 0) {
          return raw / r.wars;
        }
        return raw;
      };
      list.sort((a, b) => {
        const av = valueOf(a);
        const bv = valueOf(b);
        return parsed.bottom
          ? av - bv || a.familyName.localeCompare(b.familyName)
          : bv - av || a.familyName.localeCompare(b.familyName);
      });
      const sliced = list.slice(0, parsed.limit);
      const label = STAT_LABELS[parsed.key] || parsed.key;
      const avgNote = parsed.avg ? " (avg/war)" : "";
      return {
        title: `${parsed.bottom ? "Bottom" : "Top"} ${parsed.limit} ${label}${avgNote} · ${period.label}${teamNote}`,
        lines: sliced.length
          ? sliced.map((r, i) => {
              const shown =
                parsed.avg && parsed.key !== "kd" && parsed.key !== "maxKillStreak"
                  ? parsed.key === "timeSurvived"
                    ? formatTimeFromSeconds(Math.round(valueOf(r)))
                    : parsed.key === "enemyKills" ||
                        parsed.key === "deaths" ||
                        parsed.key === "ccHits" ||
                        parsed.key === "cannonHits" ||
                        parsed.key === "trapsTriggered"
                      ? valueOf(r).toFixed(1)
                      : formatGameNumber(valueOf(r))
                  : formatStatValue(parsed.key, r);
              return `${i + 1}. ${r.familyName} — ${shown} (${r.wars} wars)`;
            })
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
      ["Under 3 NW", "who has under 3 node wars this week"],
      ["Missed siege", "missed siege this week"],
      ["MVP this month", "mvp leaderboard this month"],
      ["Healer MVP", "healer mvp this month"],
      ["Top K/D", "top 10 k/d this week"],
      ["Top fort", "top 10 fort damage this week"],
      ["Who played", "who played this week"],
      ["Ball roster", "who is on Ball"],
      ["Wins", "wins and losses this week"],
      ["Siege tickets", "siege tickets this week"],
      ["War calendar", "war calendar this week"],
      ["Summary", "summary this week"],
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
          <input id="ask-input" class="ask-input" type="text" placeholder="e.g. stats for Name · mvp this month · Name vs Other" autocomplete="off" />
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
        ${
          history.length
            ? history
                .map(
                  (h) => `
          <div class="ask-turn">
            <p class="ask-q">You: ${escapeHtml(h.question)}</p>
            ${renderResult(h.result)}
          </div>
        `
                )
                .join("")
            : renderResult(helpText())
        }
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
