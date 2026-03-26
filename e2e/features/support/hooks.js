const { Before, After, Status } = require("@cucumber/cucumber");
const { chromium } = require("playwright");
const fs = require("fs");

Before({ timeout: 60000 }, async function () {
  this.browser = await chromium.launch({
    headless: true,
  });
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();
  this.page.setDefaultTimeout(30000); // 30 seconds
  const BASE_URL = process.env.BASE_URL || "http://localhost:4200";
  await this.page.goto(`${BASE_URL}/`, {
    waitUntil: "load",
    timeout: 30000,
  });
  // await this.context.tracing.start({ screenshots: true, snapshots: true });
});

After(async function (scenario) {
  if (this.context) {
    // if (scenario.result.status === Status.FAILED) {
    //   const tracePath = `traces/${scenario.pickle.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.zip`;
    //   fs.mkdirSync("traces", { recursive: true });
    //   await this.context.tracing.stop({ path: tracePath });
    // } else {
    //   await this.context.tracing.stop();
    // }
    if (this.page) await this.page.close();
    await this.context.close();
  }
  if (this.browser) await this.browser.close();
});
