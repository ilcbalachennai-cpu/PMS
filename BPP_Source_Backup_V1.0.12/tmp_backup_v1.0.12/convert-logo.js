import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        if (!fs.existsSync('build')) {
            fs.mkdirSync('build');
        }

        const sourcePath = 'D:/ILCBala/ILCBala_Payroll/BPP_Master/App_Template/BPP_Logo2.jpg';
        const imageBuffer = fs.readFileSync(sourcePath);
        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:image/jpeg;base64,${base64Image}`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setViewport({ width: 256, height: 256 });

        await page.setContent(`
            <html>
            <body style="margin: 0; padding: 0; background-color: transparent; display: flex; justify-content: center; align-items: center; width: 256px; height: 256px;">
                <img src="${dataUri}" style="width: 256px; height: 256px; object-fit: contain;" />
            </body>
            </html>
        `);

        // Wait for image to load
        await page.waitForNetworkIdle();

        await page.screenshot({ path: 'build/icon.png', omitBackground: true });
        await browser.close();
        console.log("Successfully converted BPP_Logo.jpg to build/icon.png");
    } catch (e) {
        console.error("Error converting icon:", e);
    }
})();
