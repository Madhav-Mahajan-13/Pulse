import express from "express";

import nodepulse from "../dist/index.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(nodepulse());

app.get("/fast", (_request, response) => {
  response.json({ ok: true });
});

app.get("/slow/:id", (_request, response) => {
  const delayMs = 80 + Math.floor(Math.random() * 220);
  setTimeout(() => response.json({ delayMs }), delayMs);
});

app.get("/error", (_request, response) => {
  response.status(503).json({ error: "Synthetic example failure" });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Example API: http://127.0.0.1:${port}/fast`);
  console.log(`Dashboard: http://127.0.0.1:${port}/nodepulse`);
});
