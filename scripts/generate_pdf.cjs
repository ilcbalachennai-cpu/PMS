const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePDF() {
  console.log('🚀 Starting PDF generation using Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Path to the local html file
    const htmlPath = path.resolve(__dirname, '../docs/user_manual.html');
    const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}`;
    console.log(`Loading User Manual from: ${fileUrl}`);
    
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0' // Wait until all images and fonts are loaded
    });
    
    // Define target output path
    const pdfPath = path.resolve(__dirname, '../docs/user_manual.pdf');
    
    console.log('Generating PDF print layout...');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true, // Crucial for showing styles, backgrounds, and highlight-boxes
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });
    
    console.log(`✅ Success! User Manual PDF saved successfully at: ${pdfPath}`);
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
  } finally {
    await browser.close();
  }
}

generatePDF();
