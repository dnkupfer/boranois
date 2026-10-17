import { createApp } from "./app.js";
import { loadCatalogue } from "./catalogue.js";
import { createPhraser } from "./gemini.js";
import { createStore } from "./store/index.js";

const { store, kind } = createStore();
const catalogue = loadCatalogue();
const phraser = createPhraser();
const port = Number(process.env.PORT ?? 8080);

createApp({
  store,
  catalogue,
  phraser,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  // TODO: plug an email provider here for production; until then magic links are logged.
}).listen(port, () => {
  console.log(
    `API on :${port} (store: ${kind}, ai: ${phraser.available ? "gemini" : "off — templates only"}, catalogue ${catalogue.version}: ${catalogue.personas.length} personas, ${catalogue.facts.length} verified facts)`,
  );
});
