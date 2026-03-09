import puppeteer from 'puppeteer';
import fs from 'fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="200" fill="#800000"/><ellipse cx="200" cy="200" rx="195" ry="120" fill="#FFD700"/><text x="200" y="185" font-family="serif" font-weight="bold" font-size="80" fill="#800000" text-anchor="middle">ILCbala</text><text x="200" y="240" font-family="sans-serif" font-weight="bold" font-style="italic" font-size="22" fill="#800000" text-anchor="middle">Decoding Indian Labour Laws</text></svg>`;

(async () => {
    try {
        if (!fs.existsSync('build')) {
            fs.mkdirSync('build');
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({ width: 256, height: 256 });

        await page.setContent(`
            <html>
            <body style="margin: 0; padding: 0; background-color: transparent;">
                <div style="width: 256px; height: 256px;">
                    ${svg.replace('viewBox="0 0 400 400"', 'viewBox="0 0 400 400" width="256" height="256"')}
                </div>
            </body>
            </html>
        `);

        await page.screenshot({ path: 'build/icon.png', omitBackground: true });
        await browser.close();
        console.log("Successfully generated build/icon.png");
    } catch (e) {
        console.error("Error generating icon:", e);
    }
})();
