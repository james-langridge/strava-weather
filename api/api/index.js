const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Express on Vercel"));
app.get("/api/health", (req, res) => res.json({ status: "healthy", timestamp: new Date().toISOString() }));

app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;