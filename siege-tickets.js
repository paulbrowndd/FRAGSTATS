/**
 * Daily fort wins → weekly siege tickets (max 1 ticket per guild per Sun–Sat week).
 * Add or edit dates when fort winners are reported:
 *   "YYYY-MM-DD": ["GuildName", ...]
 *
 * Castle holders get an automatic ticket for the Sun–Sat week (no fort win needed):
 *   "YYYY-MM-DD" (week's Sunday): ["GuildName", ...]
 */
window.SIEGE_OUR_ALLIANCE = ["FRAG", "Omen", "Prime", "Arsha"];
window.SIEGE_ELITE_ALLIANCE_LABEL = "Elite Alliance";
window.SIEGE_NEUTRAL_ALLIANCE_LABEL = "Neutral";
window.SIEGE_NEUTRAL_GUILDS = ["BlackBanner"];

window.SIEGE_CASTLE_HOLDERS = {
  "2026-08-16": ["Prime"],
};

window.SIEGE_FORT_WINS = {
  "2026-08-15": [
    "Arsha",
    "Omen",
    "Prime",
    "FRAG",
    "Envy",
    "Kama",
    "Elite",
    "Conflict",
    "Desac",
    "Mayhem",
  ],
  "2026-08-16": ["Arsha", "Kama", "Elite", "Envy", "Conflict"],
  "2026-08-17": ["FRAG", "Omen", "Elite", "Desac", "Mayhem"],
  "2026-08-18": ["Conflict", "Kama", "TacoScuad", "Mayhem", "BlackBanner"],
};
