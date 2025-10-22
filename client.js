import axios from "axios";
import fs from "fs";
import path from "path";
const BASE = "https://mcicons.ccleaf.com";
const API_KEY = "mcicons-apikey-0201osaiudx-24493534";
const CONCURRENCY = 12;
const MAX_RETRIES = 4;
const TIMEOUT_MS = 25000;
let token = null;
let expiresAt = 0;
function now() {
  return new Date().toISOString().split("T")[1].replace("Z", "");
}
function log(msg, type = "info") {
  const p =
    type === "error" ? "[❌ ERROR]" : type === "warn" ? "[⚠️ WARN]" : "[ℹ️]";
  console.log(`${p} [${now()}] ${msg}`);
}
async function fetchToken(force = false) {
  if (!force && token && Date.now() < expiresAt - 60000) return token;
  try {
    const res = await axios.post(
      `${BASE}/api/token`,
      {},
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json",
          origin: BASE,
          referer: `${BASE}/`,
          "user-agent": "nodejs",
          "x-api-key": API_KEY,
        },
        timeout: TIMEOUT_MS,
      },
    );
    token = res.data?.token;
    expiresAt = Date.now() + 15 * 60 * 1000;
    log("fetched new token");
    return token;
  } catch (err) {
    log(`token fetch failed: ${err.message}`, "error");
    await new Promise((r) => setTimeout(r, 2000));
    return fetchToken(true);
  }
}
async function apiGet(url, attempt = 1) {
  const t = await fetchToken();
  try {
    return await axios.get(url, {
      headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
      timeout: TIMEOUT_MS,
    });
  } catch (err) {
    const status = err.response?.status;
    if ([401, 403].includes(status) && attempt <= MAX_RETRIES) {
      log(`auth ${status} - refreshing token (attempt ${attempt})`, "warn");
      await fetchToken(true);
      return apiGet(url, attempt + 1);
    }
    if (attempt <= MAX_RETRIES) {
      log(`request failed ${err.message} - retry ${attempt}`, "warn");
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return apiGet(url, attempt + 1);
    }
    throw err;
  }
}
async function getAllImages() {
  const res = await apiGet(`${BASE}/api/assets/all`);
  if (!Array.isArray(res.data)) throw new Error("unexpected response");
  const [, assets] = res.data;
  const files = assets.files.map((f) => ({
    name: f.file,
    category: f.category,
    subcategory: f.subcategory,
    url: f.subcategory
      ? `${BASE}/assets/${f.category}/${f.subcategory}/${f.file}`
      : `${BASE}/assets/${f.category}/${f.file}`,
  }));
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/assets.json", JSON.stringify(files, null, 2));
  log(`saved data/assets.json (${files.length})`);
  return files;
}
async function streamDownload(url, outPath, attempt = 1) {
  if (fs.existsSync(outPath)) return "exists";
  try {
    const t = await fetchToken();
    const res = await axios.get(url, {
      responseType: "stream",
      headers: { Authorization: `Bearer ${t}` },
      timeout: TIMEOUT_MS,
    });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(outPath);
      res.data.pipe(writer);
      let done = false;
      writer.on("finish", () => {
        if (!done) {
          done = true;
          resolve();
        }
      });
      writer.on("error", (err) => {
        if (!done) {
          done = true;
          reject(err);
        }
      });
    });
    return "ok";
  } catch (err) {
    const status = err.response?.status;
    if ([401, 403].includes(status) && attempt <= MAX_RETRIES) {
      log(
        `download auth ${status} -> refresh token and retry (${attempt})`,
        "warn",
      );
      await fetchToken(true);
      return streamDownload(url, outPath, attempt + 1);
    }
    if (attempt <= MAX_RETRIES) {
      log(`download ${url} failed ${err.message} retry ${attempt}`, "warn");
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return streamDownload(url, outPath, attempt + 1);
    }
    log(`giving up on ${url}: ${err.message}`, "error");
    return "failed";
  }
}
async function worker(id, queue, tot) {
  while (true) {
    const file = queue.shift();
    if (!file) return;
    const { category, subcategory, name, url } = file;
    const dir = subcategory
      ? path.join("assets", category, subcategory)
      : path.join("assets", category);
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, name);
    log(`#${id} downloading ${url}`);
    const start = Date.now();
    const res = await streamDownload(url, outPath);
    const dt = ((Date.now() - start) / 1000).toFixed(2);
    if (res === "ok")
      log(`#${id} done ${category}/${subcategory || ""}/${name} (${dt}s)`);
    else if (res === "exists")
      log(`#${id} skipped exists ${category}/${subcategory || ""}/${name}`);
    else log(`#${id} failed ${category}/${subcategory || ""}/${name}`);
    const remaining = queue.length;
    const done = tot - remaining - 1;
    log(`progress: ${done + 1}/${tot} remaining ${remaining}`);
  }
}
async function downloadAll() {
  const files = await getAllImages();
  const queue = files.slice();
  const tot = queue.length;
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker(i + 1, queue, tot));
  await Promise.all(workers);
  log("all done");
}
downloadAll().catch((err) => {
  log(err.stack || err.message, "error");
  process.exit(1);
});
