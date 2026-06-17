const express = require("express");
const { getDb } = require("../db");
const { validateMetrics } = require("../services/validate");

const router = express.Router();

router.post("/:customerId", (req, res) => {
  const { customerId } = req.params;

  const db = getDb();
  const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
  if (!customer) {
    return res.status(404).json({ error: "customer not found" });
  }

  const { errors, data } = validateMetrics(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ error: "invalid metrics", details: errors });
  }

  const stmt = db.prepare(
    `INSERT INTO metrics (customer_id, login_frequency, feature_adoption, support_ticket_count, nps_score, usage_time_minutes)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    customerId,
    data.login_frequency,
    data.feature_adoption,
    data.support_ticket_count,
    data.nps_score,
    data.usage_time_minutes
  );
  res.status(201).json({
    id: result.lastInsertRowid,
    customer_id: Number(customerId),
    ...data,
  });
});

router.get("/:customerId", (req, res) => {
  const db = getDb();
  const metrics = db.prepare(
    "SELECT * FROM metrics WHERE customer_id = ? ORDER BY recorded_at DESC"
  ).all(req.params.customerId);
  res.json(metrics);
});

module.exports = router;
