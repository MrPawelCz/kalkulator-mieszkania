import { calculate, parseAmount, todayISO } from './finance.js';

const byId = id => document.getElementById(id);
const currency = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
const amountFormat = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const rateFormat = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactRate = new Intl.NumberFormat('pl-PL', { notation: 'scientific', maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const percentage = value => value === null ? '—' : `${(Math.abs(value) < 1000 ? rateFormat : compactRate).format(value * 100)}%`;
const put = (id, text) => { byId(id).textContent = text; };
const rentFields = { monthly: 'rent-monthly', annual: 'rent-annual', total: 'rent-total' };
const plainFields = { purchaseDate: 'purchase-date', valuationDate: 'valuation-date', purchase: 'purchase', value: 'property-value', bondRate: 'bond-rate' };
const state = { purchaseDate: '2013-10-30', valuationDate: todayISO(), purchase: 300000, value: 750000, bondRate: 6, rentMode: 'monthly', rent: 2000 };
let currentResult = null;
let announcementTimer;
byId('valuation-date').value = state.valuationDate;

function syncRent(result, activeId) {
  const values = { monthly: result.monthlyRent, annual: result.annualRent, total: result.totalRent };
  for (const [mode, id] of Object.entries(rentFields)) {
    if (id !== activeId) byId(id).value = amountFormat.format(values[mode]);
  }
  const source = { monthly: 'z kwoty miesięcznej', annual: 'z kwoty rocznej', total: 'Twoja kwota łączna' };
  put('rent-source', source[state.rentMode]);
}

function width(id, value, max) {
  byId(id).style.width = `${Math.max(0, value / max * 100)}%`;
  byId(id).style.borderWidth = value === 0 ? '0' : '';
}

function clearResults(message, activeId) {
  currentResult = null;
  byId('results').classList.add('invalid');
  byId('input-error').hidden = false;
  put('input-error', message);
  if (activeId) byId(activeId).setAttribute('aria-invalid', 'true');
  for (const id of ['property-irr', 'bond-irr', 'property-profit', 'property-roi', 'property-final', 'bond-final', 'difference', 'total-rent-result', 'appreciation', 'bond-gross', 'bond-tax', 'bond-profit', 'period-label', 'comparison-dates']) put(id, '—');
  put('rate-difference', 'Popraw dane, aby zobaczyć wynik.');
  put('winner-label', 'Wynik niedostępny');
  put('difference-note', 'Sprawdź podane kwoty i daty.');
  for (const id of ['property-value-bar', 'rent-bar', 'bond-capital-bar', 'bond-profit-bar']) width(id, 0, 1);
  for (const id of ['property-bar', 'bond-bar']) byId(id).setAttribute('aria-label', 'Wynik niedostępny');
  for (const [mode, id] of Object.entries(rentFields)) if (mode !== state.rentMode) byId(id).value = '';
  clearTimeout(announcementTimer);
}

function render(activeId) {
  try {
    const result = calculate(state);
    currentResult = result;
    byId('results').classList.remove('invalid');
    byId('input-error').hidden = true;
    document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    syncRent(result, activeId);
    const moneyValues = { 'property-profit': result.propertyProfit, 'property-final': result.propertyFinal, 'bond-final': result.bondFinal, difference: Math.abs(result.difference), 'total-rent-result': result.totalRent, appreciation: result.appreciation, 'bond-gross': result.bondGrossInterest, 'bond-tax': -result.bondTax, 'bond-profit': result.bondProfit };
    for (const [id, value] of Object.entries(moneyValues)) put(id, currency.format(Object.is(value, -0) ? 0 : value));
    put('property-irr', percentage(result.propertyIRR));
    put('bond-irr', percentage(result.bondIRR));
    put('property-roi', percentage(result.propertyROI));
    put('period-label', `${amountFormat.format(result.years)} lat · ${new Intl.NumberFormat('pl-PL').format(result.days)} dni`);
    put('comparison-dates', `${dateFormat.format(new Date(result.start * 86400000))} — ${dateFormat.format(new Date(result.end * 86400000))} · kapitał ${currency.format(state.purchase)}`);
    const pp = result.propertyIRR === null ? null : (result.propertyIRR - result.bondIRR) * 100;
    put('rate-difference', pp === null ? 'XIRR mieszkania: brak dodatnich wpływów lub wynik poza zakresem.' : Math.abs(pp) < 0.005 ? 'Taka sama roczna stopa zwrotu po zaokrągleniu' : `${pp > 0 ? 'Mieszkanie' : 'Obligacje'}: +${rateFormat.format(Math.abs(pp))} p.p. rocznie`);
    const tie = Math.abs(result.difference) < 0.5;
    put('winner-label', tie ? 'Taki sam wynik po zaokrągleniu' : `Przewaga ${result.difference > 0 ? 'mieszkania' : 'obligacji'}`);
    put('difference-note', tie ? 'Obie inwestycje dają porównywalny zysk.' : result.difference > 0 ? 'O tyle mniej zysku dałyby obligacje w tym okresie.' : 'O tyle więcej zysku dałyby obligacje w tym okresie.');
    byId('advantage').classList.toggle('bonds-win', result.difference < -0.5);
    const max = Math.max(result.propertyFinal, result.bondFinal, 1);
    width('property-value-bar', state.value, max);
    width('rent-bar', result.totalRent, max);
    width('bond-capital-bar', state.purchase, max);
    width('bond-profit-bar', result.bondProfit, max);
    byId('property-bar').setAttribute('aria-label', `Wartość mieszkania ${currency.format(state.value)}, najem netto ${currency.format(result.totalRent)}; łącznie ${currency.format(result.propertyFinal)}.`);
    byId('bond-bar').setAttribute('aria-label', `Kapitał ${currency.format(state.purchase)}, odsetki netto ${currency.format(result.bondProfit)}; łącznie ${currency.format(result.bondFinal)}.`);
    clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => put('result-announcement', `Wyniki zaktualizowane. Mieszkanie ${percentage(result.propertyIRR)} rocznie. Obligacje ${percentage(result.bondIRR)} rocznie. ${byId('winner-label').textContent}: ${currency.format(Math.abs(result.difference))}.`), 600);
    return result;
  } catch (error) {
    clearResults(error.message, activeId);
    return null;
  }
}

for (const [key, id] of Object.entries(plainFields)) {
  byId(id).addEventListener('input', () => {
    state[key] = key.endsWith('Date') ? byId(id).value : parseAmount(byId(id).value);
    render(id);
  });
}
for (const [mode, id] of Object.entries(rentFields)) {
  byId(id).addEventListener('input', () => {
    state.rentMode = mode;
    state.rent = parseAmount(byId(id).value);
    render(id);
  });
}
document.querySelectorAll('input[inputmode=decimal]').forEach(input => {
  input.addEventListener('blur', () => {
    const value = parseAmount(input.value);
    if (Number.isFinite(value)) input.value = amountFormat.format(value);
  });
});
byId('inputs').addEventListener('submit', event => event.preventDefault());
document.querySelector('.method-link').addEventListener('click', () => { byId('methodology').open = true; });
render();

// Optional WebMCP integration uses the exact calculation and state behind the form.
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  const summary = result => ({ ...state, monthlyRent: result.monthlyRent, annualRent: result.annualRent, totalRent: result.totalRent, propertyIRR: result.propertyIRR, bondIRR: result.bondIRR, propertyProfit: result.propertyProfit, bondProfit: result.bondProfit, difference: result.difference, days: result.days });
  const register = tool => {
    try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* The calculator also works without WebMCP. */ }
  };
  register({ name: 'read_investment_comparison', title: 'Odczytaj wynik inwestycji', description: 'Read the current property and bond comparison. IRR values are annual decimal rates; amounts are PLN.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute() { if (!currentResult) throw new Error('Popraw dane w formularzu.'); return summary(currentResult); } });
  register({ name: 'update_investment_comparison', title: 'Przelicz mieszkanie i obligacje', description: 'Update the visible calculator. Provide rent in one selected mode; all three rent fields are synchronized. Amounts are PLN, bondRate is a gross annual percentage (6 means 6%).', inputSchema: { type: 'object', properties: { purchaseDate: { type: 'string', format: 'date' }, valuationDate: { type: 'string', format: 'date' }, purchase: { type: 'number', exclusiveMinimum: 0, maximum: 1e12 }, value: { type: 'number', minimum: 0, maximum: 1e12 }, rent: { type: 'number', minimum: 0, maximum: 1e12 }, rentMode: { type: 'string', enum: ['monthly', 'annual', 'total'] }, bondRate: { type: 'number', minimum: 0, maximum: 100 } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !Object.hasOwn(state, key))) throw new Error('Niepoprawne pola wejściowe.');
    const candidate = { ...state, ...input };
    calculate(candidate); // Validate before changing any visible field or state.
    Object.assign(state, candidate);
    for (const [key, id] of Object.entries(plainFields)) byId(id).value = key.endsWith('Date') ? state[key] : amountFormat.format(state[key]);
    return summary(render());
  } });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
