const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

router.post("/", (req, res) => {
  const { name, industry, contract_start_date, contract_end_date } = req.body;
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO customers (name, industry, contract_start_date, contract_end_date) VALUES (?, ?, ?, ?)"
  );
  const result = stmt.run(name, industry || null, contract_start_date || null, contract_end_date || null);
  res.status(201).json({ id: result.lastInsertRowid, name, industry, contract_start_date, contract_end_date });
});

router.get("/", (req, res) => {
  const db = getDb();
  const customers = db.prepare(`
    SELECT c.*, hs.score AS health_score, hs.risk_level
    FROM customers c
    LEFT JOIN health_scores hs ON c.id = hs.customer_id
    ORDER BY c.created_at DESC
  `).all();
  res.json(customers);
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const customer = db.prepare(`
    SELECT c.*, hs.score AS health_score, hs.risk_level, hs.calculated_at
    FROM customers c
    LEFT JOIN health_scores hs ON c.id = hs.customer_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: "customer not found" });
  }
  res.json(customer);
});

router.put("/:id", (req, res) => {
  const { name, industry, contract_start_date, contract_end_date } = req.body;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "customer not found" });
  }
  db.prepare(
    "UPDATE customers SET name = COALESCE(?, name), industry = COALESCE(?, industry), contract_start_date = COALESCE(?, contract_start_date), contract_end_date = COALESCE(?, contract_end_date), updated_at = datetime('now') WHERE id = ?"
  ).run(name, industry, contract_start_date, contract_end_date, req.params.id);
  res.json({ message: "customer updated" });
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const result = db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "customer not found" });
  }
  res.json({ message: "customer deleted" });
});

module.exports = router;
