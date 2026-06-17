const express = require("express");
const { getDb } = require("../db");
const { calculateScore, getRiskLevel, sanitizeMetrics } = require("../services/healthScore");

const router = express.Router();

router.post("/calculate/:customerId", (req, res) => {
  const db = getDb();
  const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(req.params.customerId);
  if (!customer) {
    return res.status(404).json({ error: "customer not found" });
  }

  const latestMetric = db.prepare(
    "SELECT * FROM metrics WHERE customer_id = ? ORDER BY recorded_at DESC LIMIT 1"
  ).get(req.params.customerId);

  if (!latestMetric) {
    return res.status(400).json({ error: "no metrics found for this customer" });
  }

  const cleanedMetrics = sanitizeMetrics(latestMetric);
  const score = calculateScore(latestMetric);
  const riskLevel = getRiskLevel(score);

  db.prepare(`
    INSERT INTO health_scores (customer_id, score, risk_level, calculated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(customer_id) DO UPDATE SET
      score = excluded.score,
      risk_level = excluded.risk_level,
      calculated_at = excluded.calculated_at
  `).run(req.params.customerId, score, riskLevel);

  res.json({
    customer_id: Number(req.params.customerId),
    score,
    risk_level: riskLevel,
    metrics_used: {
      login_frequency: cleanedMetrics.login_frequency,
      feature_adoption: cleanedMetrics.feature_adoption,
      support_ticket_count: cleanedMetrics.support_ticket_count,
      nps_score: cleanedMetrics.nps_score,
      usage_time_minutes: cleanedMetrics.usage_time_minutes,
    },
    raw_metrics: {
      login_frequency: latestMetric.login_frequency,
      feature_adoption: latestMetric.feature_adoption,
      support_ticket_count: latestMetric.support_ticket_count,
      nps_score: latestMetric.nps_score,
      usage_time_minutes: latestMetric.usage_time_minutes,
    },
  });
});

router.post("/calculate-all", (req, res) => {
  const db = getDb();
  const customers = db.prepare(`
    SELECT c.id AS customer_id, m.login_frequency, m.feature_adoption,
           m.support_ticket_count, m.nps_score, m.usage_time_minutes
    FROM customers c
    INNER JOIN metrics m ON c.id = m.customer_id
    WHERE m.id = (
      SELECT MAX(m2.id) FROM metrics m2 WHERE m2.customer_id = c.id
    )
  `).all();

  if (customers.length === 0) {
    return res.json({ message: "no customers with metrics found", results: [] });
  }

  const upsert = db.prepare(`
    INSERT INTO health_scores (customer_id, score, risk_level, calculated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(customer_id) DO UPDATE SET
      score = excluded.score,
      risk_level = excluded.risk_level,
      calculated_at = excluded.calculated_at
  `);

  const results = [];
  const transaction = db.transaction(() => {
    for (const row of customers) {
      const cleaned = sanitizeMetrics(row);
      const score = calculateScore(row);
      const riskLevel = getRiskLevel(score);
      upsert.run(row.customer_id, score, riskLevel);
      results.push({
        customer_id: row.customer_id,
        score,
        risk_level: riskLevel,
        sanitized: cleaned,
      });
    }
  });
  transaction();

  res.json({ calculated: results.length, results });
});

router.get("/high-risk", (req, res) => {
  const db = getDb();
  const highRiskCustomers = db.prepare(`
    SELECT c.id, c.name, c.industry, hs.score AS health_score, hs.risk_level, hs.calculated_at
    FROM customers c
    INNER JOIN health_scores hs ON c.id = hs.customer_id
    WHERE hs.risk_level = 'high_risk'
    ORDER BY hs.score ASC
  `).all();
  res.json(highRiskCustomers);
});

router.get("/at-risk", (req, res) => {
  const db = getDb();
  const atRiskCustomers = db.prepare(`
    SELECT c.id, c.name, c.industry, hs.score AS health_score, hs.risk_level, hs.calculated_at
    FROM customers c
    INNER JOIN health_scores hs ON c.id = hs.customer_id
    WHERE hs.risk_level IN ('at_risk', 'high_risk')
    ORDER BY hs.score ASC
  `).all();
  res.json(atRiskCustomers);
});

module.exports = router;
