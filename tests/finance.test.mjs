import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, parseAmount, parseDate, rentalSchedule, xirr } from '../finance.js';
const base = { purchaseDate: '2013-10-30', valuationDate: '2026-09-13', purchase: 300000, value: 750000, rent: 2000, rentMode: 'monthly', bondRate: 6 };
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test('XIRR matches the published Microsoft irregular cash-flow example', () => {
  const amounts = [-10000, 2750, 4250, 3250, 2750];
  const dates = ['2008-01-01', '2008-03-01', '2008-10-30', '2009-02-15', '2009-04-01'];
  close(xirr(amounts.map((amount, i) => ({ amount, date: parseDate(dates[i]) }))), 0.373362535, 1e-8);
});
test('Single-year appreciation equals 10%; a one-year loss equals -50%', () => {
  const input = { ...base, purchaseDate: '2025-01-01', valuationDate: '2026-01-01', purchase: 10000, rent: 0 };
  close(calculate({ ...input, value: 11000 }).propertyIRR, .1);
  close(calculate({ ...input, value: 5000 }).propertyIRR, -.5);
  assert.equal(calculate({ ...input, value: 0 }).propertyIRR, null);
});
test('Bond tax is charged on the final accumulated interest, not each year', () => {
  const r = calculate({ ...base, purchaseDate: '2021-01-01', valuationDate: '2023-01-01', purchase: 10000, bondRate: 6 });
  close(r.bondGrossInterest, 1236);
  close(r.bondTax, 234.84);
  close(r.bondFinal, 11001.16);
  close(r.bondIRR, Math.sqrt(1.100116) - 1);
});
test('Partial rental months and February use original purchase-day anniversaries', () => {
  const schedule = rentalSchedule(parseDate('2024-01-31'), parseDate('2024-03-15'));
  close(schedule.months, 1 + 15 / 31);
  assert.equal(schedule.periods[0].date, parseDate('2024-02-29'));
  assert.equal(schedule.periods[1].date, parseDate('2024-03-15'));
  assert.equal(rentalSchedule(parseDate('2024-01-31'), parseDate('2024-03-31')).months, 2);
});
test('All three rent modes produce equivalent results; total remains fixed after date changes', () => {
  const monthly = calculate(base);
  const annual = calculate({ ...base, rentMode: 'annual', rent: 24000 });
  const total = calculate({ ...base, rentMode: 'total', rent: monthly.totalRent });
  for (const result of [annual, total]) {
    close(result.propertyIRR, monthly.propertyIRR);
    close(result.totalRent, monthly.totalRent);
    close(result.monthlyRent, 2000);
  }
  const changed = calculate({ ...base, valuationDate: '2026-10-30', rentMode: 'total', rent: 312000 });
  close(changed.monthlyRent, 2000);
  close(changed.totalRent, 312000);
});
test('Default cash flows have near-zero NPV at computed XIRR and comparison balances', () => {
  const r = calculate(base);
  close(r.totalRent, 308903.2258064516);
  close(r.flows.reduce((npv, f) => npv + f.amount / (1 + r.propertyIRR) ** ((f.date - r.start) / 365), 0), 0, 1e-6);
  close(r.propertyProfit - r.bondProfit, r.difference);
  close(r.propertyFinal, r.appreciation + base.purchase + r.totalRent);
  close(r.bondFinal, base.purchase + r.bondGrossInterest - r.bondTax);
});
test('No-return case and bond-winning case work without bias', () => {
  const zero = calculate({ ...base, value: base.purchase, rent: 0, bondRate: 0 });
  close(zero.propertyIRR, 0); close(zero.difference, 0); close(zero.bondIRR, 0);
  assert.ok(calculate({ ...base, value: 100000, rent: 0 }).difference < 0);
});
test('Reject impossible dates, zero purchase price and non-finite amounts', () => {
  for (const change of [{ purchase: 0 }, { value: NaN }, { rent: -1 }, { bondRate: 101 }, { purchaseDate: '2025-02-30' }, { valuationDate: base.purchaseDate }, { valuationDate: '2010-01-01' }, { rentMode: 'unknown' }]) assert.throws(() => calculate({ ...base, ...change }));
});
test('Polish amounts accept spaces, commas, and pasted dot-separated thousands', () => {
  for (const text of ['300 000', '300.000', '300000', '300\u00a0000']) assert.equal(parseAmount(text), 300000);
  for (const text of ['2 000,50', '2.000,50', '2000.50']) assert.equal(parseAmount(text), 2000.5);
  for (const text of ['', 'NaN', '2abc', '6%', '1,2,3', 'Infinity']) assert.ok(Number.isNaN(parseAmount(text)));
});
