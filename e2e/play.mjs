import { chromium } from "playwright";

const SHOTS = process.env.SHOTS;
const URL = process.env.URL ?? "http://localhost:5199";
const browser = await chromium.launch();
const names = ["Ани", "Борис", "Вили", "Гого"];
const pages = [];
for (const name of names) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", name, e.message));
  page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", name, m.text()));
  await page.goto(URL);
  await page.fill("input[autocomplete=nickname]", name);
  pages.push(page);
}
await pages[0].getByRole("button", { name: "Нова маса" }).click();
await pages[0].waitForSelector(".room-code");
const code = (await pages[0].textContent(".room-code")).trim();
for (const p of pages.slice(1)) {
  await p.fill("input.code", code);
  await p.getByRole("button", { name: "Влез", exact: true }).click();
  await p.waitForSelector(".room-code");
}
for (const [i, p] of pages.entries()) await p.locator(".lobby-seat").nth([3, 1, 0, 2][i]).click();
await pages[0].getByRole("button", { name: "Започни играта" }).click();
await pages[0].waitForSelector(".bidding");

const shot = (i, name) => pages[i].screenshot({ path: `${SHOTS}/${name}.png` });
let shots = new Set();
let rounds = 0;
const deadline = Date.now() + 90_000;
while (Date.now() < deadline) {
  let acted = false;
  for (const [i, p] of pages.entries()) {
    // Bidding: first bid takes hearts if available, everyone else passes.
    const hearts = p.locator(".bid:not(:disabled)", { hasText: "купа" });
    if (!shots.has("bid") && (await hearts.count()) > 0 && i === 1) {
      await shot(1, "04-bidding-mine");
      shots.add("bid");
    }
    if (await hearts.count() > 0 && !shots.has("took")) {
      await hearts.first().click();
      shots.add("took");
      acted = true;
      continue;
    }
    const pass = p.locator(".bid:not(:disabled)", { hasText: "Пас" });
    if ((await pass.count()) > 0) { await pass.first().click(); acted = true; continue; }
    const playable = p.locator(".hand.active button.card:not(:disabled)");
    if ((await playable.count()) > 0) {
      if (!shots.has("play")) { await shot(i, "05-playing-mine"); shots.add("play"); }
      await playable.first().click();
      acted = true;
      if (!shots.has("trick") && (await pages[0].locator(".played").count()) >= 2) { await shot(0, "06-trick"); shots.add("trick"); }
      continue;
    }
    const next = p.getByRole("button", { name: "Следваща ръка" });
    if ((await next.count()) > 0) {
      if (!shots.has("round")) { await shot(i, "07-round-end"); shots.add("round"); }
      await next.click(); rounds++; acted = true;
    }
    if ((await p.locator(".modal h2.win, .modal h2.lose").count()) > 0) {
      await shot(i, "08-game-over");
      console.log("game over after rounds", rounds);
      await browser.close();
      process.exit(0);
    }
  }
  if (!acted) await pages[0].waitForTimeout(150);
}
console.log("timeout; rounds", rounds);
await shot(0, "99-timeout");
await browser.close();
