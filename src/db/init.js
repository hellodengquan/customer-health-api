const { initTables, getDb } = require("./index");

initTables();
console.log("Database initialized successfully.");
const db = getDb();
db.close();
