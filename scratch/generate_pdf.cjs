const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePDF() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    const htmlPath = path.resolve(__dirname, '../docs/user_manual.html');
    const pdfPath = path.resolve(__dirname, '../docs/user_manual.pdf');
    
    console.log(`Reading HTML from: ${htmlPath}`);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 60000 });
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
        }
    });
    
    await browser.close();
    console.log(`PDF successfully generated at: ${pdfPath}`);
}

generatePDF().catch(err => {
    console.error('Error generating PDF:', err);
    process.exit(1);
});
