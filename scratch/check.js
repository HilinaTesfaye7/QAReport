const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Capture all console logs
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    } else {
      console.log('BROWSER LOG:', msg.text());
    }
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 1000));
  
  // Login
  await page.type('input[type="text"]', 'sarah.lead.a');
  await page.type('input[type="password"]', 'Temp123!');
  await page.click('button[type="submit"]');
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Click on Dashboard link
  // The sidebar has a link containing text "Dashboard"
  const elements = await page.$x('//a[contains(., "Dashboard")]');
  if (elements.length > 0) {
    await elements[0].click();
  } else {
    console.log("Could not find Dashboard link");
  }
  
  await new Promise(r => setTimeout(r, 2000));
  console.log("Finished script.");
  await browser.close();
})();
