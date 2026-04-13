const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const filePath = 'file://' + path.resolve(__dirname, 'preview_legacy_formb.html');
    await page.goto(filePath);
    await page.setViewport({ width: 1200, height: 1200 });
    const element = await page.$('#render-area');
    await element.screenshot({ path: path.resolve(__dirname, 'legacy_formb_sample.png') });
    console.log('Direct screenshot generated');
    await browser.close();
})();
