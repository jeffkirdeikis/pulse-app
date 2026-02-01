const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });
  
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click on Classes section
  await page.evaluate(() => {
    const items = document.querySelectorAll('button, div, span, a');
    for (const item of items) {
      if (item.textContent.trim() === 'Classes') {
        item.click();
        break;
      }
    }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Take screenshot of classes list
  await page.screenshot({ path: '/tmp/classes-list.png', fullPage: false });
  console.log('Screenshot saved to /tmp/classes-list.png');
  await browser.close();
})();
