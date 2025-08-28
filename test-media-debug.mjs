import { chromium } from 'playwright';

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
  try {
    const link = await page.waitForSelector('a[href="/sample-video.mp4"]', { timeout: 10000 });
    console.log('SUCCESS: Found the link!');
  } catch (e) {
    console.log('ERROR: Link not found. Checking what links are present...');
    const links = await page.$$eval('a[href^="/"]', els => els.map(el => el.getAttribute('href')));
    console.log('Found links:', links);
    
    // Also check media cards
    const mediaCards = await page.$$eval('.media-card', els => els.map(el => ({
      href: el.getAttribute('href'),
      text: el.textContent
    })));
    console.log('Media cards:', mediaCards);
  }
  
  await browser.close();
  process.exit(0);
})();
