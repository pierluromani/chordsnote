const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Sample data to inject
const sampleData = {
  "catalogs":[
    {
      "id":"band-1",
      "name":"The Rolling Stones Cover Band",
      "color":0,
      "description":"Suoniamo i classici degli Stones dagli anni 60 ad oggi",
      "kind":"band",
      "members":[
        {"id":"m1","name":"Pierlu","color":0,"role":"owner"},
        {"id":"m2","name":"Giulia","color":1,"role":"editor"},
        {"id":"m3","name":"Marco","color":2,"role":"viewer"}
      ],
      "createdAt":Date.now()-1000*60*60*24*30,
      "updatedAt":Date.now()-1000*60*60*24*5
    },
    {
      "id":"band-2",
      "name":"Jazz quartet Milano",
      "color":2,
      "description":"Repertorio jazz tradizionale e bebop",
      "kind":"band",
      "members":[
        {"id":"m4","name":"Alex","color":0,"role":"owner"},
        {"id":"m5","name":"Sara","color":1,"role":"editor"}
      ],
      "createdAt":Date.now()-1000*60*60*24*15,
      "updatedAt":Date.now()-1000*60*60*24*2
    },
    {
      "id":"personal-1",
      "name":"Il mio repertorio",
      "color":3,
      "description":"Canzoni che suono da solo o con amici",
      "kind":"personal",
      "members":[],
      "createdAt":Date.now()-1000*60*60*24*60,
      "updatedAt":Date.now()-1000*60*60*24*7
    }
  ],
  "songs":[
    {
      "id":"song-1",
      "title":"(I Can't Get No) Satisfaction",
      "artist":"The Rolling Stones",
      "key":"E",
      "catalogId":"band-1",
      "favorite":true,
      "draft":false,
      "sections":[
        {
          "id":"s1",
          "kind":"verse",
          "lines":[
            {"id":"l1","text":"I can't get no satisfaction","chords":[{"id":"c1","pos":0,"chord":"E"},{"id":"c2","pos":8,"chord":"B"}]},
            {"id":"l2","text":"I can't get no girl reaction","chords":[{"id":"c3","pos":0,"chord":"E"},{"id":"c4","pos":6,"chord":"A"}]}
          ]
        },
        {
          "id":"s2",
          "kind":"chorus",
          "lines":[
            {"id":"l3","text":"Cause I try and I try and I try and I try","chords":[{"id":"c5","pos":0,"chord":"E"},{"id":"c6","pos":4,"chord":"B"},{"id":"c7","pos":8,"chord":"A"}]},
            {"id":"l4","text":"I can get no, no, no, no, no, no","chords":[{"id":"c8","pos":0,"chord":"E"},{"id":"c9","pos":6,"chord":"B"}]}
          ]
        }
      ],
      "createdAt":Date.now()-1000*60*60*24*20,
      "updatedAt":Date.now()-1000*60*60*24*10
    },
    {
      "id":"song-2",
      "title":"Jumpin' Jack Flash",
      "artist":"The Rolling Stones",
      "key":"G",
      "catalogId":"band-1",
      "favorite":false,
      "draft":false,
      "sections":[
        {
          "id":"s3",
          "kind":"verse",
          "lines":[
            {"id":"l5","text":"I was born in a cross-fire hurricane","chords":[{"id":"c10","pos":0,"chord":"G"},{"id":"c11","pos":6,"chord":"C"}]},
            {"id":"l6","text":"And I howled at my ma in the driving rain","chords":[{"id":"c12","pos":0,"chord":"D"},{"id":"c13","pos":8,"chord":"G"}]}
          ]
        }
      ],
      "createdAt":Date.now()-1000*60*60*24*18,
      "updatedAt":Date.now()-1000*60*60*24*8
    },
    {
      "id":"song-3",
      "title":"Yesterday",
      "artist":"The Beatles",
      "key":"F",
      "catalogId":"personal-1",
      "favorite":true,
      "draft":false,
      "sections":[
        {
          "id":"s4",
          "kind":"verse",
          "lines":[
            {"id":"l7","text":"Yesterday, all my troubles seemed so far away","chords":[{"id":"c14","pos":0,"chord":"F"},{"id":"c15","pos":10,"chord":"Em"}]},
            {"id":"l8","text":"Now it looks as though they're here to stay","chords":[{"id":"c16","pos":0,"chord":"F"},{"id":"c17","pos":8,"chord":"Dm"}]}
          ]
        }
      ],
      "createdAt":Date.now()-1000*60*60*24*10,
      "updatedAt":Date.now()-1000*60*60*24*5
    }
  ],
  "setlists":[
    {
      "id":"setlist-1",
      "name":"Serata al Blu Note",
      "catalogId":"band-1",
      "items":[
        {"id":"item1","type":"song","songId":"song-1"},
        {"id":"item2","type":"song","songId":"song-2"}
      ],
      "createdAt":Date.now()-1000*60*60*24*3,
      "updatedAt":Date.now()-1000*60*60*24*1
    }
  ],
  "settings":{"fontScale":1,"showChords":true,"keepAwake":false,"notation":"anglo","userName":"Pierlu Romano"},
  "hydrated":true,
  "ownerUid":"user-123"
};

(async () => {
  console.log('Starting Expo web server...');
  const { spawn } = require('child_process');
  const expo = spawn('npx', ['expo', 'start', '--web', '--port', '8090'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, EXPO_DEV_TOOLS_INLINE: false }
  });

  let serverReady = false;
  expo.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(str);
    if (str.includes('DevTools running at') || str.includes('webpack compiled')) {
      serverReady = true;
    }
  });

  expo.stderr.on('data', (data) => {
    const str = data.toString();
    console.error(str);
  });

  // Wait for server to be ready
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (serverReady) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
    setTimeout(() => {
      clearInterval(interval);
      resolve(); // resolve anyway after timeout
    }, 15000);
  });

  console.log('Expo web server should be ready at http://localhost:8090');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1290, height: 2796 }); // iPhone 17 portrait

  // Go to homepage and inject data
  await page.goto('http://localhost:8090');
  await page.evaluate((data) => {
    // Override localStorage before the app runs
    localStorage.setItem('chordsnote-v1', JSON.stringify(data));
    console.log('Sample data injected into localStorage');
  }, sampleData);
  await page.reload({ waitUntil: 'networkidle0' });

  // Wait for app to load (look for some element that indicates home screen)
  await page.waitForSelector('.hero, .screen', { timeout: 10000 });

  // Take screenshots of each screen
  const screens = [
    { route: '/', name: 'home' },
    { route: `/band/${sampleData.catalogs[0].id}`, name: 'band-detail' },
    { route: `/song/${sampleData.songs[0].id}/index`, name: 'song-detail' },
    { route: '/profile', name: 'profile' }
  ];

  const screensDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screensDir)) {
    fs.mkdirSync(screensDir);
  }

  for (const { route, name } of screens) {
    try {
      console.log(`Navigating to ${route}`);
      await page.goto(`http://localhost:8090${route}`, { waitUntil: 'networkidle0' });
      // Wait for specific content to ensure screen loaded
      await page.waitForTimeout(2000); // additional wait for animations
      const screenshotPath = path.join(screensDir, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);
    } catch (err) {
      console.error(`Failed to screenshot ${route}:`, err);
    }
  }

  await browser.close();
  expo.kill();
  console.log('Done.');
})();