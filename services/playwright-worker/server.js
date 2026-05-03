import express from "express"
import { chromium } from "playwright"

const PORT       = Number(process.env.PORT ?? 8080)
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? ""
const app        = express()
app.use(express.json({ limit: "1mb" }))

let browser = null
async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  }
  return browser
}

app.get("/health", (_req, res) => res.status(200).send("ok"))

app.post("/render", async (req, res) => {
  if (AUTH_TOKEN && req.get("x-worker-token") !== AUTH_TOKEN) {
    return res.status(401).json({ error: "unauthorized" })
  }
  const { url, wait_for = "networkidle", timeout_ms = 25000 } = req.body ?? {}
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "url must be http(s)" })
  }
  const allowedWaits = new Set(["load", "domcontentloaded", "networkidle", "commit"])
  const waitUntil    = allowedWaits.has(wait_for) ? wait_for : "networkidle"
  const timeout      = Math.min(Number(timeout_ms) || 25000, 45000)

  let context, page
  try {
    const b    = await getBrowser()
    context    = await b.newContext({ userAgent: "Mozilla/5.0 (compatible; CareerCopilotBot/1.0)" })
    page       = await context.newPage()
    const resp = await page.goto(url, { waitUntil, timeout })
    const html = await page.content()
    return res.json({ html, status: resp?.status() ?? 200, final_url: page.url() })
  } catch (err) {
    return res.status(502).json({ error: String(err?.message ?? err) })
  } finally {
    try { await page?.close() }    catch {}
    try { await context?.close() } catch {}
  }
})

const server = app.listen(PORT, () => console.log(`playwright-worker on :${PORT}`))

async function shutdown(sig) {
  console.log(`${sig} received — shutting down`)
  server.close()
  try { await browser?.close() } catch {}
  process.exit(0)
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))
