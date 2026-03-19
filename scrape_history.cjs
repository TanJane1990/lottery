const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeCWL(name) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let allResults = [];
  try {
    const url = `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=${name}&pageNo=1&pageSize=3000`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const content = await page.evaluate(() => document.body.innerText);
    const data = JSON.parse(content);
    if (data.result) {
      const parsed = data.result.map(item => ({
        issue: item.code,
        date: String(item.date).split(' ')[0],
        reds: item.red ? item.red.split(',').map(Number) : [],
        blues: item.blue ? item.blue.split(',').map(Number) : []
      }));
      allResults = parsed;
    }
  } catch (e) {
    console.error(`Error scraping CWL ${name}:`, e);
  } finally {
    await browser.close();
  }
  return allResults;
}

async function scrapeSporttery(gameNo) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    extraHTTPHeaders: {
        'Referer': 'https://www.sporttery.cn/'
    }
  });
  const page = await context.newPage();
  let allResults = [];
  
  try {
    let pageNo = 1;
    let maxPages = 30; // 3000 records
    while (pageNo <= maxPages) {
      console.log(`Sporttery ${gameNo} page ${pageNo}...`);
      const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${gameNo}&provinceId=0&pageSize=100&isVerify=1&pageNo=${pageNo}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const content = await page.evaluate(() => document.body.innerText);
      
      let data;
      try {
        data = JSON.parse(content);
      } catch(e) {
        console.error("Failed to parse", content.substring(0, 100));
        break;
      }
      
      if (!data.value || !data.value.list || data.value.list.length === 0) break;
      
      const parsed = data.value.list.map(item => {
        const nums = (item.lotteryDrawResult || '').split(' ');
        let reds = [], blues = [];
        if (gameNo === '85') { reds = nums.slice(0, 5).map(Number); blues = nums.slice(5, 7).map(Number); }
        else if (gameNo === '04') { reds = nums.slice(0, 6).map(Number); blues = nums.slice(6, 7).map(Number); }
        return {
          issue: item.lotteryDrawNum,
          date: String(item.lotteryDrawTime).split(' ')[0],
          reds,
          blues
        };
      });
      allResults = allResults.concat(parsed);
      
      if (pageNo >= data.value.pages) break;
      pageNo++;
    }
  } catch (e) {
     console.error(`Error scraping Sporttery ${gameNo}:`, e);
  } finally {
    await browser.close();
  }
  return allResults;
}

(async () => {
  let history = {};
  if (fs.existsSync('./src/assets/data/history.json')) {
     history = JSON.parse(fs.readFileSync('./src/assets/data/history.json'));
  }

  if (!history['DLT'] || history['DLT'].length === 0) {
      console.log('Scraping DLT...');
      history['DLT'] = await scrapeSporttery('85');
      console.log(`DLT records: ${history['DLT']?.length}`);
  }

  if (!history['QXC'] || history['QXC'].length === 0) {
      console.log('Scraping QXC...');
      history['QXC'] = await scrapeSporttery('04');
      console.log(`QXC records: ${history['QXC']?.length}`);
  }

  if (!fs.existsSync('./src/assets/data')) {
    fs.mkdirSync('./src/assets/data', { recursive: true });
  }

  fs.writeFileSync('./src/assets/data/history.json', JSON.stringify(history));
  console.log('Finished downloading all historical data.');
})();
