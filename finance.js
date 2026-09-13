const DAY = 86_400_000;
export const TAX = 0.19;

export function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Wpisz pełną, poprawną datę.');
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 2100 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error('Wpisz poprawną datę z lat 1900–2100.');
  }
  return date.getTime() / DAY;
}

export function parseAmount(value) {
  let text = String(value).trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!text) return NaN;
  // Accept Polish decimal commas, pasted spaces, and dot-separated thousands.
  if (text.includes(',')) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) return NaN;
    text = text.replaceAll('.', '').replace(',', '.');
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(text)) {
    text = text.replaceAll('.', '');
  } else if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return NaN;
  return Number(text);
}

// Every anniversary is derived from the original day; February does not move later payments.
function monthAnniversary(startDay, count) {
  const start = new Date(startDay * DAY);
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + count, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)) / DAY;
}

export function rentalSchedule(start, end) {
  const days = end - start;
  if (days <= 0) throw new Error('Data wyceny musi być późniejsza niż data zakupu.');
  if (days > 36525) throw new Error('Maksymalny okres obliczeń wynosi 100 lat.');
  const periods = [];
  let previous = start;
  for (let month = 1; previous < end; month++) {
    const next = monthAnniversary(start, month);
    const date = Math.min(next, end);
    periods.push({ date, weight: (date - previous) / (next - previous) });
    previous = next;
  }
  return { periods, months: periods.reduce((sum, p) => sum + p.weight, 0), days, years: days / 365 };
}

export function xirr(flows) {
  if (!flows.some(f => f.amount < 0) || !flows.some(f => f.amount > 0)) return null;
  const start = flows[0].date;
  // Solve in log(1 + rate), using scaled terms to avoid overflow near -100%.
  const terms = flows.filter(f => f.amount !== 0).map(f => ({
    sign: Math.sign(f.amount), log: Math.log(Math.abs(f.amount)), years: (f.date - start) / 365,
  }));
  const npvSign = logRate => {
    const exponents = terms.map(t => t.log - t.years * logRate);
    const max = Math.max(...exponents);
    return terms.reduce((sum, term, i) => sum + term.sign * Math.exp(exponents[i] - max), 0);
  };
  let low = -1;
  let high = 1;
  while (npvSign(low) < 0 && low > -1024) low *= 2;
  while (npvSign(high) > 0 && high < 16384) high *= 2;
  if (npvSign(low) < 0 || npvSign(high) > 0) return null;
  for (let i = 0; i < 150; i++) {
    const mid = (low + high) / 2;
    if (npvSign(mid) > 0) low = mid;
    else high = mid;
  }
  const result = Math.expm1((low + high) / 2);
  return Number.isFinite(result) ? result : null;
}

export function calculate(input) {
  const start = parseDate(input.purchaseDate);
  const end = parseDate(input.valuationDate);
  const schedule = rentalSchedule(start, end);
  for (const [key, label] of [['purchase', 'Koszt zakupu'], ['value', 'Wartość mieszkania'], ['rent', 'Dochód z najmu']]) {
    if (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > 1e12) throw new Error(`${label}: wpisz kwotę od 0 do 1 biliona zł.`);
  }
  if (input.purchase === 0) throw new Error('Koszt zakupu musi być większy od zera.');
  if (!Number.isFinite(input.bondRate) || input.bondRate < 0 || input.bondRate > 100) throw new Error('Oprocentowanie obligacji musi mieścić się w zakresie 0–100%.');
  if (!['monthly', 'annual', 'total'].includes(input.rentMode)) throw new Error('Niepoprawny sposób podania najmu.');
  const monthlyRent = input.rentMode === 'total' ? input.rent / schedule.months : input.rentMode === 'annual' ? input.rent / 12 : input.rent;
  const totalRent = input.rentMode === 'total' ? input.rent : monthlyRent * schedule.months;
  const flows = [{ date: start, amount: -input.purchase }, ...schedule.periods.map(p => ({ date: p.date, amount: p.weight * monthlyRent }))];
  flows[flows.length - 1].amount += input.value;
  const propertyFinal = input.value + totalRent;
  const propertyProfit = propertyFinal - input.purchase;
  const grossInterest = input.purchase * Math.expm1(Math.log1p(input.bondRate / 100) * schedule.years);
  const bondTax = grossInterest * TAX;
  const bondProfit = grossInterest - bondTax;
  const bondFinal = input.purchase + bondProfit;
  return {
    ...schedule, start, end, monthlyRent, annualRent: monthlyRent * 12, totalRent,
    appreciation: input.value - input.purchase, propertyFinal, propertyProfit,
    propertyROI: propertyProfit / input.purchase, propertyIRR: xirr(flows),
    bondGrossInterest: grossInterest, bondTax, bondProfit, bondFinal,
    bondIRR: Math.expm1(Math.log1p(bondProfit / input.purchase) / schedule.years),
    difference: propertyFinal - bondFinal, flows,
  };
}
