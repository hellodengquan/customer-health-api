const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.post("/:customerId", (req, res) => {
  const { customerId } = req.params;
  const {
    login_frequency,
    feature_adoption,
    support_ticket_count,
    nps_score,
    usage_time_minutes,
  } = req.body;

  const db = getDb();
  const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
  if (!customer) {
    return res.status(404).json({ error: "customer not found" });
  }

  if (login_frequency == null || feature_adoption == null) {
    return res.status(400).json({ error: "login_frequency and feature_adoption are required" });
  }

  const stmt = db.prepare(
    `INSERT INTO metrics (customer_id, login_frequency, feature_adoption, support_ticket_count, nps_score, usage_time_minutes)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    customerId,
    login_frequency,
    feature_adoption,
    support_ticket_count || 0,
    nps_score != null ? nps_score : null,
    usage_time_minutes || 0
  );
  res.status(201).json({
    id: result.lastInsertRowid,
    customer_id: Number(customerId),
    login_frequency,
    feature_adoption,
    support_ticket_count: support_ticket_count || 0,
    nps_score: nps_score != null ? nps_score : null,
    usage_time_minutes: usage_time_minutes || 0,
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
