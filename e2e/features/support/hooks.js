const { Before, After, Status } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const fs = require('fs');

Before(async function () {
    this.browser = await chromium.launch({
        headless: true
    });
    this.context = await this.browser.newContext({
        baseURL: 'http://localhost:4200'
    });
    this.page = await this.context.newPage();
    await this.context.tracing.start({ screenshots: true, snapshots: true });
});

After(async function (scenario) {
    if (this.context) {
        if (scenario.result.status === Status.FAILED) {
            const tracePath = `traces/${scenario.pickle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
            fs.mkdirSync('traces', { recursive: true });
            await this.context.tracing.stop({ path: tracePath });
        } else {
            await this.context.tracing.stop();
        }
        if (this.page) await this.page.close();
        await this.context.close();
    }
    if (this.browser) await this.browser.close();
});