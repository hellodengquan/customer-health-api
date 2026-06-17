const { getDb } = require("./index");
const { sanitizeMetrics, calculateScore, getRiskLevel } = require("../services/healthScore");

function isDifferent(a, b) {
  if (a === b) return false;
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return a !== b;
}

function migrateMetrics() {
  const db = getDb();
  console.log("开始迁移 metrics 表脏数据...\n");

  const allMetrics = db.prepare("SELECT * FROM metrics ORDER BY id").all();
  if (allMetrics.length === 0) {
    console.log("metrics 表为空，无需处理。");
    return;
  }

  console.log(`共发现 ${allMetrics.length} 条 metrics 记录。\n`);

  const updateStmt = db.prepare(`
    UPDATE metrics SET
      login_frequency = ?,
      feature_adoption = ?,
      support_ticket_count = ?,
      nps_score = ?,
      usage_time_minutes = ?
    WHERE id = ?
  `);

  const stats = {
    total: allMetrics.length,
    updated: 0,
    unchanged: 0,
    fieldsChanged: {
      login_frequency: 0,
      feature_adoption: 0,
      support_ticket_count: 0,
      nps_score: 0,
      usage_time_minutes: 0,
    },
  };

  const changes = [];

  for (const row of allMetrics) {
    const cleaned = sanitizeMetrics(row);
    const hasDiff =
      isDifferent(row.login_frequency, cleaned.login_frequency) ||
      isDifferent(row.feature_adoption, cleaned.feature_adoption) ||
      isDifferent(row.support_ticket_count, cleaned.support_ticket_count) ||
      isDifferent(row.nps_score, cleaned.nps_score) ||
      isDifferent(row.usage_time_minutes, cleaned.usage_time_minutes);

    if (!hasDiff) {
      stats.unchanged++;
      continue;
    }

    const rowChanges = { id: row.id, customer_id: row.customer_id, before: {}, after: {} };

    if (isDifferent(row.login_frequency, cleaned.login_frequency)) {
      stats.fieldsChanged.login_frequency++;
      rowChanges.before.login_frequency = row.login_frequency;
      rowChanges.after.login_frequency = cleaned.login_frequency;
    }
    if (isDifferent(row.feature_adoption, cleaned.feature_adoption)) {
      stats.fieldsChanged.feature_adoption++;
      rowChanges.before.feature_adoption = row.feature_adoption;
      rowChanges.after.feature_adoption = cleaned.feature_adoption;
    }
    if (isDifferent(row.support_ticket_count, cleaned.support_ticket_count)) {
      stats.fieldsChanged.support_ticket_count++;
      rowChanges.before.support_ticket_count = row.support_ticket_count;
      rowChanges.after.support_ticket_count = cleaned.support_ticket_count;
    }
    if (isDifferent(row.nps_score, cleaned.nps_score)) {
      stats.fieldsChanged.nps_score++;
      rowChanges.before.nps_score = row.nps_score;
      rowChanges.after.nps_score = cleaned.nps_score;
    }
    if (isDifferent(row.usage_time_minutes, cleaned.usage_time_minutes)) {
      stats.fieldsChanged.usage_time_minutes++;
      rowChanges.before.usage_time_minutes = row.usage_time_minutes;
      rowChanges.after.usage_time_minutes = cleaned.usage_time_minutes;
    }

    changes.push(rowChanges);

    updateStmt.run(
      cleaned.login_frequency,
      cleaned.feature_adoption,
      cleaned.support_ticket_count,
      cleaned.nps_score,
      cleaned.usage_time_minutes,
      row.id
    );
    stats.updated++;
  }

  console.log("===== 迁移结果 =====");
  console.log(`总记录数: ${stats.total}`);
  console.log(`已修正: ${stats.updated}`);
  console.log(`无需变更: ${stats.unchanged}`);
  console.log("");
  console.log("各字段修正条数:");
  for (const [field, count] of Object.entries(stats.fieldsChanged)) {
    console.log(`  ${field}: ${count}`);
  }

  if (changes.length > 0) {
    console.log("\n===== 修正详情（前10条）=====");
    const sample = changes.slice(0, 10);
    for (const c of sample) {
      console.log(`\n#${c.id} (客户 ${c.customer_id}):`);
      for (const k of Object.keys(c.before)) {
        console.log(`  ${k}: ${c.before[k]}  →  ${c.after[k]}`);
      }
    }
    if (changes.length > 10) {
      console.log(`\n... 还有 ${changes.length - 10} 条变更未列出`);
    }
  }

  console.log("\n===== 重算健康分 =====");

  const customerMetrics = db.prepare(`
    SELECT c.id AS customer_id, m.login_frequency, m.feature_adoption,
           m.support_ticket_count, m.nps_score, m.usage_time_minutes
    FROM customers c
    INNER JOIN metrics m ON c.id = m.customer_id
    WHERE m.id = (
      SELECT MAX(m2.id) FROM metrics m2 WHERE m2.customer_id = c.id
    )
  `).all();

  const upsert = db.prepare(`
    INSERT INTO health_scores (customer_id, score, risk_level, calculated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(customer_id) DO UPDATE SET
      score = excluded.score,
      risk_level = excluded.risk_level,
      calculated_at = excluded.calculated_at
  `);

  let recalculated = 0;
  const tx = db.transaction(() => {
    for (const row of customerMetrics) {
      const score = calculateScore(row);
      const riskLevel = getRiskLevel(score);
      upsert.run(row.customer_id, score, riskLevel);
      recalculated++;
    }
  });
  tx();

  console.log(`已重算 ${recalculated} 位客户的健康分。`);

  const summary = db.prepare(`
    SELECT risk_level, COUNT(*) AS cnt
    FROM health_scores GROUP BY risk_level
  `).all();

  console.log("\n===== 当前健康分分布 =====");
  for (const s of summary) {
    console.log(`  ${s.risk_level}: ${s.cnt} 位`);
  }

  console.log("\n迁移完成！");
  db.close();
}

if (require.main === module) {
  migrateMetrics();
}

module.exports = { migrateMetrics };
