const express = require("express");
const { initTables } = require("./db");
const customersRouter = require("./routes/customers");
const metricsRouter = require("./routes/metrics");
const healthRouter = require("./routes/health");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initTables();

app.use("/api/customers", customersRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/health", healthRouter);

app.get("/api", (req, res) => {
  res.json({
    service: "Customer Health Assessment API",
    version: "1.0.0",
    endpoints: {
      customers: "/api/customers",
      metrics: "/api/metrics",
      health: "/api/health",
    },
  });
});

app.listen(PORT, () => {
  console.log(`Customer Health API running on http://localhost:${PORT}`);
});
