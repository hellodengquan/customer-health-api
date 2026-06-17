function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeMetrics(metrics) {
  const {
    login_frequency,
    feature_adoption,
    support_ticket_count,
    nps_score,
    usage_time_minutes,
  } = metrics || {};

  const safeNumber = (v, fallback) => {
    if (typeof v === "number" && !Number.isNaN(v) && Number.isFinite(v)) return v;
    return fallback;
  };

  const safeInt = (v, fallback) => {
    const n = safeNumber(v, fallback);
    return Math.max(0, Math.floor(n));
  };

  return {
    login_frequency: clamp(safeNumber(login_frequency, 0), 0, 60),
    feature_adoption: clamp(safeNumber(feature_adoption, 0), 0, 100),
    support_ticket_count: safeInt(support_ticket_count, 0),
    nps_score: nps_score != null ? clamp(safeNumber(nps_score, 0), -100, 100) : null,
    usage_time_minutes: clamp(safeNumber(usage_time_minutes, 0), 0, 3000),
  };
}

function calculateScore(metrics) {
  const cleaned = sanitizeMetrics(metrics);
  const {
    login_frequency,
    feature_adoption,
    support_ticket_count,
    nps_score,
    usage_time_minutes,
  } = cleaned;

  const loginScore = clamp(login_frequency / 30, 0, 1) * 25;

  const adoptionScore = clamp(feature_adoption / 100, 0, 1) * 25;

  const ticketPenalty = clamp(support_ticket_count / 10, 0, 1) * 20;
  const supportScore = 20 - ticketPenalty;

  const npsValue = nps_score != null ? nps_score : 0;
  const npsScore = clamp((npsValue + 100) / 200, 0, 1) * 15;

  const usageScore = clamp(usage_time_minutes / 300, 0, 1) * 15;

  const raw = loginScore + adoptionScore + supportScore + npsScore + usageScore;
  return Math.round(clamp(raw, 0, 100));
}

function getRiskLevel(score) {
  if (score >= 80) return "healthy";
  if (score >= 50) return "at_risk";
  return "high_risk";
}

module.exports = { calculateScore, getRiskLevel, sanitizeMetrics };
