const https = require('https');
const fs = require('fs');

const fetchJSON = (url, headers = {}) => {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject('Parse error on ' + url + ': ' + e.message);
        }
      });
    }).on('error', reject);
  });
};

const fetchCWL = async (name) => {
  let allResults = [];
  let pageNo = 1;
  while (true) {
    console.log(`Fetching CWL ${name} page ${pageNo}...`);
    const url = `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=${name}&pageNo=${pageNo}&pageSize=100`;
    try {
      const data = await fetchJSON(url, { 'Accept': 'application/json, text/javascript, */*; q=0.01', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
      if (!data || !data.result || data.result.length === 0) break;
      
      const parsed = data.result.map(item => ({
        issue: item.code,
        date: String(item.date).split(' ')[0],
        reds: item.red ? item.red.split(',').map(Number) : [],
        blues: item.blue ? item.blue.split(',').map(Number) : []
      }));
      allResults = allResults.concat(parsed);
      
      if (pageNo >= data.pageCount) break;
      pageNo++;
    } catch (e) {
      console.error(e);
      break;
    }
  }
  return allResults;
};

const fetchSporttery = async (gameNo) => {
  let allResults = [];
  let pageNo = 1;
  while (true) {
    console.log(`Fetching Sporttery ${gameNo} page ${pageNo}...`);
    const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${gameNo}&provinceId=0&pageSize=100&isVerify=1&pageNo=${pageNo}`;
    try {
      const data = await fetchJSON(url, { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
      if (!data || !data.value || !data.value.list || data.value.list.length === 0) break;
      
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
    } catch (e) {
      console.error(e);
      break;
    }
  }
  return allResults; // Sort manually if needed, usually they are returned desc
};

(async () => {
  const history = {};
  console.log('Downloading SSQ...');
  history['SSQ'] = await fetchCWL('ssq');
  console.log(`SSQ records: ${history['SSQ'].length}`);
  
  console.log('Downloading QLC...');
  history['QLC'] = await fetchCWL('qlc');
  console.log(`QLC records: ${history['QLC'].length}`);
  
  console.log('Downloading DLT...');
  history['DLT'] = await fetchSporttery('85');
  console.log(`DLT records: ${history['DLT'].length}`);
  
  console.log('Downloading QXC...');
  history['QXC'] = await fetchSporttery('04');
  console.log(`QXC records: ${history['QXC'].length}`);

  // Create src/assets if it doesn't exist
  if (!fs.existsSync('./src/assets')) {
    fs.mkdirSync('./src/assets', { recursive: true });
  }

  // Optimize JSON structure to save space
  const minified = JSON.stringify(history);
  fs.writeFileSync('./src/assets/history.json', minified);
  console.log('Finished downloading all historical data.');
})();
