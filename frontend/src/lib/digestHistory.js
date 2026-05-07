// LocalStorage-backed history of daily Risk Digests.
const KEY = "geas_digest_history_v1";
const SEED_KEY = "geas_digest_seeded_v1";

const isoDate = (d = new Date()) => d.toISOString().slice(0, 10);

export const loadHistory = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveHistory = (h) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* quota or disabled */
  }
};

export const recordTodayDigest = (digest) => {
  if (!digest) return;
  const history = loadHistory();
  history[isoDate()] = {
    date: isoDate(),
    capturedAt: new Date().toISOString(),
    total: digest.total,
    countries: digest.countries,
    topCategory: digest.topCategory,
    topCategoryCount: digest.topCategoryCount,
    topRisk: {
      title: digest.topRisk.title,
      country: digest.topRisk.country,
      risk_score: digest.topRisk.risk_score,
      category: digest.topRisk.category,
      subtype: digest.topRisk.subtype,
    },
    seeded: false,
  };
  saveHistory(history);
};

export const listHistory = () => {
  const h = loadHistory();
  return Object.values(h).sort((a, b) => (a.date < b.date ? 1 : -1));
};

export const ensureSeed = () => {
  if (localStorage.getItem(SEED_KEY)) return;
  const today = new Date();
  const samples = [
    { back: 1, total: 27, countries: 22, topCategory: "weather", topCategoryCount: 12,
      topRisk: { title: "Heatwave alert in Riyadh", country: "Saudi Arabia", risk_score: 0.95, category: "weather", subtype: "heatwave" } },
    { back: 2, total: 19, countries: 16, topCategory: "conflict", topCategoryCount: 8,
      topRisk: { title: "Armed clash reported — Khartoum", country: "Sudan", risk_score: 0.92, category: "conflict", subtype: "conflict" } },
    { back: 3, total: 31, countries: 24, topCategory: "weather", topCategoryCount: 14,
      topRisk: { title: "Flood risk in Mumbai", country: "India", risk_score: 0.93, category: "weather", subtype: "flood" } },
    { back: 5, total: 22, countries: 18, topCategory: "disease", topCategoryCount: 9,
      topRisk: { title: "Mpox outbreak in Kinshasa", country: "DR Congo", risk_score: 0.9, category: "disease", subtype: "outbreak" } },
    { back: 7, total: 16, countries: 13, topCategory: "weather", topCategoryCount: 7,
      topRisk: { title: "Tropical storm near Manila", country: "Philippines", risk_score: 0.88, category: "weather", subtype: "storm" } },
  ];
  const history = loadHistory();
  for (const s of samples) {
    const d = new Date(today);
    d.setDate(d.getDate() - s.back);
    const key = isoDate(d);
    if (!history[key]) {
      history[key] = {
        date: key,
        capturedAt: d.toISOString(),
        total: s.total,
        countries: s.countries,
        topCategory: s.topCategory,
        topCategoryCount: s.topCategoryCount,
        topRisk: s.topRisk,
        seeded: true,
      };
    }
  }
  saveHistory(history);
  localStorage.setItem(SEED_KEY, "1");
};

export const formatPrettyDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
