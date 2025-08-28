const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Start test server
  console.log('Navigating to login page...');
  await page.goto('http://localhost:3003/auto-login');
  await page.waitForURL('http://localhost:3003/');
  
  console.log('Navigating to upload page...');
  await page.goto('http://localhost:3003/upload');
  
  console.log('Uploading file...');
  await page.setInputFiles('input[type="file"]', './test-data/sample-video.mp4');
  await page.click('button[type="submit"]');
  
  console.log('Waiting for redirect to media page...');
  await page.waitForURL('http://localhost:3003/media', { timeout: 30000 });
  
  console.log('Looking for uploaded file link...');
  const link = await page.waitForSelector('a[href="/sample-video.mp4"]', { timeout: 30000 });
  
  if (link) {
    console.log('SUCCESS: Found the link!');
  } else {
    console.log('ERROR: Link not found');
  }
  
  await browser.close();
})();
