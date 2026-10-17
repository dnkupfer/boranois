import { readFileSync } from "node:fs";
import { createPool } from "./store/postgres.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const pool = createPool(url);
await pool.query(sql);
await pool.end();
console.log("Schema applied.");
