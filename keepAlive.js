// keepAlive.js
const express = require("express");
const app = express();

// Root route - returns simple message
app.get("/", (req, res) => {
  res.send("AFK Bot is alive!");
});

// Listen on environment port (Replit/CodeSandbox) or default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KeepAlive server running on port ${PORT}`);
});
