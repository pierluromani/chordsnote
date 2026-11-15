import { chromium } from 'playwright';

const BASE = 'http://localhost:8099/';
const stamp = process.env.STAMP || Date.now();
const A = { email: `owner${stamp}@chordsnote.test`, pass: 'prova123', name: 'Anna Owner' };
const B = { email: `editor${stamp}@chordsnote.test`, pass: 'prova123', name: 'Bruno Editor' };

const BAND = `Quartetto ${stamp}`;
const log = (...a) => console.log('•', ...a);
const errors = [];

/* expo-router keeps the previous screen mounted behind the current one, so a
   text match usually resolves to a stale hidden copy first. Always take the
   visible one. */
const vis = (page, sel) => page.locator(sel).locator('visible=true');
const waitText = (page, text, timeout = 30000) =>
  vis(page, `text=${text}`).first().waitFor({ state: 'visible', timeout });
const clickText = async (page, text, timeout = 20000) => {
  const target = vis(page, `text=${text}`).first();
  await target.waitFor({ state: 'visible', timeout });
  await target.click();
};
const clickLabel = async (page, label, timeout = 20000) => {
  const target = page.locator(`[aria-label="${label}"]`).locator('visible=true').first();
  await target.waitFor({ state: 'visible', timeout });
  await target.click();
};
const gone = async (page, sel, timeout = 45000) => {
  const target = sel.startsWith('[') ? sel : `text=${sel}`;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await vis(page, target).count()) === 0) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`"${sel}" è ancora visibile dopo ${timeout}ms`);
};

async function newPage(browser, tag) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`);
  });
  await page.goto(BASE);
  await waitText(page, 'Cataloghi');
  return page;
}

async function signUp(page, who) {
  await page.getByRole('tab', { name: 'Profilo' }).click();
  await clickLabel(page, 'Accedi o registrati');
  await waitText(page, 'Bentornato');
  await clickText(page, 'Non hai un account? Registrati');
  await page.getByLabel('Nome').fill(who.name);
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.pass);
  await clickText(page, 'Crea account');
  await waitText(page, 'Sincronizza ora');
  log(`${who.name}: account creato`);
}

const run = async () => {
  const browser = await chromium.launch();
  const a = await newPage(browser, 'A');
  const b = await newPage(browser, 'B');

  await signUp(a, A);
  await signUp(b, B);

  /* --- A crea la band e invita B come editor --- */
  await clickText(a, 'Gestisci');
  await waitText(a, 'Le tue band');
  await clickText(a, 'Crea una band').catch(() => clickText(a, 'Crea una nuova band'));
  await a.getByLabel('Nome della band').fill(BAND);
  await clickText(a, 'Crea la band');
  await waitText(a, 'Gestione band');
  log('A: band creata');

  await waitText(a, 'Invita nella band');
  if (await vis(a, 'text=Questa band vive soltanto su questo dispositivo').count()) {
    throw new Error('A: la band non è stata rivendicata dall’account');
  }
  await a.getByLabel('Email di chi vuoi invitare').fill(B.email);
  await clickText(a, 'Invia invito');
  await waitText(a, 'Invito inviato a');
  log('A: invito inviato a B');
  await waitText(a, 'Invito non ancora accettato', 20000);
  log('A: invito elencato fra quelli in attesa');

  /* --- B lo riceve e accetta --- */
  await clickText(b, 'Gestisci');
  await waitText(b, 'Le tue band');
  await waitText(b, 'Un invito per te');
  log('B: invito ricevuto');
  if (!(await vis(b, 'text=ti invita come editor').count())) {
    throw new Error('B: il ruolo dell’invito non è mostrato');
  }
  await clickText(b, 'Entra nella band');
  await waitText(b, BAND);
  await gone(b, 'Un invito per te');
  log('B: entrato nella band');

  /* --- A vede B nella formazione --- */
  await waitText(a, B.email);
  log('A: B compare nella formazione');

  /* --- A aggiunge un brano al repertorio della band --- */
  await clickLabel(a, 'Apri il catalogo della band');
  await clickLabel(a, 'Nuovo brano');
  await clickText(a, 'Brano vuoto');
  await a.getByPlaceholder('Titolo del brano').fill('Notte in città');
  await clickText(a, 'Salva');
  await waitText(a, 'Notte in città');
  log('A: brano creato nel repertorio della band');

  /* --- B lo vede arrivare --- */
  await clickText(b, BAND);
  await waitText(b, 'La band');
  await clickLabel(b, 'Apri il catalogo della band');
  await waitText(b, 'Notte in città', 45000);
  log('B: il brano è arrivato dal repertorio condiviso');

  if (!(await vis(b, '[aria-label="Nuovo brano"]').count())) {
    throw new Error('B è editor ma non può aggiungere brani');
  }
  log('B: come editor ha gli strumenti di scrittura');

  /* --- B, da editor, scrive: A lo riceve --- */
  await clickLabel(b, 'Nuovo brano');
  await clickText(b, 'Brano vuoto');
  await b.getByPlaceholder('Titolo del brano').fill('Ritorno di Bruno');
  await clickText(b, 'Salva');
  await waitText(b, 'Ritorno di Bruno');
  await waitText(a, 'Ritorno di Bruno', 45000);
  log('A: il brano scritto dall’editor è arrivato');

  /* --- A declassa B a sola lettura --- */
  await clickLabel(a, 'Indietro');
  await waitText(a, 'Gestione band');
  await clickLabel(a, `Gestisci ${B.name}`);
  await clickText(a, 'Togli i permessi di modifica');
  await a.waitForTimeout(2500);
  log('A: B declassato a sola lettura');

  /* --- B perde gli strumenti di scrittura, ma continua a leggere --- */
  await gone(b, '[aria-label="Nuovo brano"]', 45000);
  await waitText(b, 'Notte in città');
  log('B: il catalogo è diventato di sola lettura senza perdere i brani');

  await browser.close();
  return true;
};

run()
  .then(() => {
    if (errors.length) {
      console.log('\nErrori JS raccolti:');
      for (const e of [...new Set(errors)]) console.log('  ', e);
    }
    console.log('\nTUTTO OK');
  })
  .catch((e) => {
    console.log('\nFALLITO:', e.message);
    if (errors.length) {
      console.log('Errori JS raccolti:');
      for (const e2 of [...new Set(errors)]) console.log('  ', e2);
    }
    process.exit(1);
  });
