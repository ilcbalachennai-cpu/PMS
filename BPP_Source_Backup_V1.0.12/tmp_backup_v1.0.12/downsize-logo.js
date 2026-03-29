import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        const sourcePath = 'C:/Users/user/.gemini/antigravity/brain/83635a99-c2df-4d15-9da0-db82f0029d46/bpp_logo_professional_1772548357138.png';
        const imageBuffer = fs.readFileSync(sourcePath);
        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:image/png;base64,${base64Image}`;

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
        await new Promise(r => setTimeout(r, 1000));

        // Save as JPG to keep it small (base64 of JPG is smaller than PNG)
        const screenshot = await page.screenshot({
            type: 'jpeg',
            quality: 90
        });

        fs.writeFileSync('bpplogo_pro_small.txt', `data:image/jpeg;base64,${screenshot.toString('base64')}`);

        await browser.close();
        console.log("Successfully downsized pro logo and saved to bpplogo_pro_small.txt");
    } catch (e) {
        console.error("Error downsizing logo:", e);
    }
})();
