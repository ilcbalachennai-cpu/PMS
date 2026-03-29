import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        if (!fs.existsSync('build')) {
            fs.mkdirSync('build');
        }

        const sourcePath = 'D:/ILCBala/ILCBala_Payroll/BPP_Master/App_Template/BPP_Logo.jpg';
        const imageBuffer = fs.readFileSync(sourcePath);
        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:image/jpeg;base64,${base64Image}`;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setViewport({ width: 512, height: 512 });

        await page.setContent(`
            <html>
            <body style="margin: 0; padding: 0; background-color: white; display: flex; justify-content: center; align-items: center; width: 512px; height: 512px;">
                <img src="${dataUri}" style="width: 512px; height: 512px; object-fit: contain;" />
            </body>
            </html>
        `);

        // Wait for image to load
        await new Promise(r => setTimeout(r, 2000));

        const screenshot = await page.screenshot({ encoding: 'base64' });
        fs.writeFileSync('bpplogo_fixed.txt', `data:image/png;base64,${screenshot}`);

        await browser.close();
        console.log("Successfully rendered and saved fixed logo to bpplogo_fixed.txt");
    } catch (e) {
        console.error("Error converting icon:", e);
    }
})();
