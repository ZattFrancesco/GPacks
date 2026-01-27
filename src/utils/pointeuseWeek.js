// src/utils/pointeuseWeek.js

function pad2(n) {
  return String(Number(n)).padStart(2, "0");
}

function parseWeekId(weekId) {
  const m = String(weekId || "").trim().match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null;
  if (week < 1 || week > 53) return null;
  return { year, week };
}

// ISO week date algorithm
function getIsoWeekId(date = new Date()) {
  const d = new Date(date);
  // Set to Thursday in current week: ISO week is based on Thursday
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const isoDay = day === 0 ? 7 : day; // 1..7 (Mon..Sun)
  d.setDate(d.getDate() + (4 - isoDay));

  const year = d.getFullYear();

  // Week 1 is the week with Jan 4th
  const yearStart = new Date(year, 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const yearStartDay = yearStart.getDay();
  const yearStartIso = yearStartDay === 0 ? 7 : yearStartDay;
  const firstThursday = new Date(yearStart);
  firstThursday.setDate(firstThursday.getDate() + (4 - yearStartIso));

  const diffMs = d.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  return `${year}-W${pad2(week)}`;
}

function mondayOfIsoWeek(year, week) {
  // Monday of ISO week
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  simple.setHours(0, 0, 0, 0);
  const day = simple.getDay();
  const isoDay = day === 0 ? 7 : day;
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - (isoDay - 1));

  // If week 1 spills into previous year, adjust by adding 7 days
  // Ensure the computed week matches
  const check = getIsoWeekId(monday);
  const parsed = parseWeekId(check);
  if (parsed && (parsed.year !== year || parsed.week !== week)) {
    monday.setDate(monday.getDate() + 7);
  }

  return monday;
}

function addWeeks(weekId, deltaWeeks) {
  const p = parseWeekId(weekId);
  if (!p) return getIsoWeekId(new Date());
  const monday = mondayOfIsoWeek(p.year, p.week);
  monday.setDate(monday.getDate() + Number(deltaWeeks || 0) * 7);
  return getIsoWeekId(monday);
}

module.exports = {
  parseWeekId,
  getIsoWeekId,
  mondayOfIsoWeek,
  addWeeks,
};
