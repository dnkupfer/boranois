import { createApp } from "./app.js";
import { loadCatalogue } from "./catalogue.js";
import { createPhraser } from "./gemini.js";
import { createStore } from "./store/index.js";

const { store, kind } = createStore();
const catalogue = loadCatalogue();
const phraser = createPhraser();
const port = Number(process.env.PORT ?? 8080);

createApp({ store, catalogue, phraser, adminToken: process.env.ADMIN_TOKEN }).listen(port, () => {
  console.log(
    `API on :${port} (store: ${kind}, ai: ${phraser.available ? "gemini" : "off — templates only"}, catalogue ${catalogue.version}: ${catalogue.personas.length} personas, ${catalogue.facts.length} verified facts)`,
  );
});
