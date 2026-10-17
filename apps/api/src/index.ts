import { createApp } from "./app.js";
import { createScorer, KeywordScorer } from "./scorer.js";
import { createStore } from "./store/index.js";

const { store, kind } = createStore();
const scorer = createScorer();
const port = Number(process.env.PORT ?? 8080);

const app = createApp({
  store,
  scorer,
  shareThreshold: Number(process.env.SHARE_THRESHOLD ?? 60),
  adminToken: process.env.ADMIN_TOKEN,
});

app.listen(port, () => {
  console.log(`API on :${port} (store: ${kind}, scorer: ${scorer instanceof KeywordScorer ? "keywords" : "gemini"})`);
});
