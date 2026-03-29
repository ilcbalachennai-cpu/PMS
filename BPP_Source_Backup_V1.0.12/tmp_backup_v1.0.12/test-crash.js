import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log('BROWSER CONSOLE:', msg.type().toUpperCase(), msg.text());
    });

    page.on('pageerror', err => {
        console.log('PAGE EXCEPTION:', err.toString());
    });

    await page.evaluateOnNewDocument(() => {
        window.addEventListener('unhandledrejection', event => {
            console.error('Unhandled Rejection:', event.reason);
        });
        window.addEventListener('error', event => {
            console.error('Global Error:', event.message, event.error);
        });
    });

    try {
        console.log("Navigating to app...");
        await page.goto('http://localhost:3001');
        await page.waitForSelector('button');

        console.log("Navigating to Arrear Salary tab...");
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('button'));
            const arrearTab = tabs.find(b => b.textContent && b.textContent.includes('Arrear Salary'));
            if (arrearTab) arrearTab.click();
        });

        await new Promise(r => setTimeout(r, 1000));

        let isDraftGenerated = false;
        const hasModal = await page.evaluate(() => {
            return !!document.querySelector('.fixed.inset-0');
        });

        if (hasModal) {
            console.log("Saving Draft...");
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const saveDraft = buttons.find(b => b.textContent && b.textContent.includes('SAVE DRAFT'));
                if (saveDraft) saveDraft.click();
            });
            await new Promise(r => setTimeout(r, 1000));
            isDraftGenerated = true;
        }

        page.on('dialog', async dialog => {
            console.log("Dialog message:", dialog.message());
            await dialog.accept();
        });

        console.log("Clicking Confirm & Finalize...");
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const finalize = buttons.find(b => b.textContent && b.textContent.includes('CONFIRM & FINALIZE'));
            if (finalize) finalize.click();
        });

        await new Promise(r => setTimeout(r, 1000));

        console.log("Confirming in modal...");
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('.fixed.inset-0 button'));
            const confirmResult = buttons.find(b => b.textContent && b.textContent.includes('Finalize App'));
            if (confirmResult) confirmResult.click();
        });

        await new Promise(r => setTimeout(r, 3000)); // wait extra to see if screen goes blank

        console.log("Checking if app is blank...");
        const isBlank = await page.evaluate(() => document.body.innerText.trim().length === 0);
        console.log("Is app blank?", isBlank);

        console.log("Done checking.");
    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await browser.close();
    }
})();
