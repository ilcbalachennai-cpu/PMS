import puppeteer from 'puppeteer';
import fs from 'fs';



(async () => {
    try {
        if (!fs.existsSync('build')) {
            fs.mkdirSync('build');
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({ width: 512, height: 512 });

        // Read the actual BPP logo from public folder
        const logoData = fs.readFileSync('public/logo.png', { encoding: 'base64' });
        const logoUrl = `data:image/png;base64,${logoData}`;

        await page.setContent(`
            <html style="background: transparent;">
            <body style="margin: 0; padding: 0; background-color: transparent;">
                <div style="width: 512px; height: 512px; border-radius: 50%; overflow: hidden; background: #000040; display: flex; align-items: center; justify-content: center; border: 20px solid #FF9933; box-sizing: border-box;">
                    <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain; transform: scale(2.8);" />
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
