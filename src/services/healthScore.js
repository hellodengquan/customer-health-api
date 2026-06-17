function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateScore(metrics) {
  const {
    login_frequency = 0,
    feature_adoption = 0,
    support_ticket_count = 0,
    nps_score = null,
    usage_time_minutes = 0,
  } = metrics;

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

module.exports = { calculateScore, getRiskLevel };
