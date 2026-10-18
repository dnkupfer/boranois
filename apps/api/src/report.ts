// Prints the usage summary.   npm run analytics -w @boranois/api [days]
import { renderSummary, summarize } from "./analytics.js";
import { createStore } from "./store/index.js";

const days = Number(process.argv[2] ?? 30);
const { store } = createStore();
console.log(renderSummary(summarize(await store.listEvents(days), days)));
process.exit(0);
