import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMasterIndex, dailyIndexUrl, businessDays, businessDaysBack, parseFormD, passesFilters, indexPrefilter, decode } from '../src/formd.js';

const here = new URL('./fixtures/', import.meta.url);
const idx = readFileSync(new URL('master.idx', here), 'utf8');
const xml = readFileSync(new URL('primary_doc.xml', here), 'utf8');

// index
const entries = parseMasterIndex(idx);
assert.equal(entries.length, 3);
assert.equal(entries[0].cik, '1999999');
assert.equal(entries[0].filingDate, '2026-11-06');
assert.equal(entries[0].accessionNumber, '0001999999-26-000001');
assert.equal(entries[0].xmlUrl, 'https://www.sec.gov/Archives/edgar/data/1999999/000199999926000001/primary_doc.xml');
assert.equal(entries.filter((e) => indexPrefilter(e, {})).length, 2);
assert.equal(entries.filter((e) => indexPrefilter(e, { includeAmendments: true })).length, 3);
assert.equal(entries.filter((e) => indexPrefilter(e, { keywords: ['bio'] })).length, 1);

// urls & dates
assert.equal(dailyIndexUrl('2026-11-06'), 'https://www.sec.gov/Archives/edgar/daily-index/2026/QTR4/master.20261106.idx');
assert.equal(dailyIndexUrl('2026-03-31'), 'https://www.sec.gov/Archives/edgar/daily-index/2026/QTR1/master.20260331.idx');
assert.deepEqual(businessDays('2026-11-06', '2026-11-09'), ['2026-11-06', '2026-11-09']);
assert.deepEqual(businessDaysBack('2026-11-09', 3), { start: '2026-11-04', end: '2026-11-06' }); // Monday
assert.deepEqual(businessDaysBack('2026-11-11', 1), { start: '2026-11-10', end: '2026-11-10' });
assert.deepEqual(businessDaysBack('2026-11-08', 2), { start: '2026-11-05', end: '2026-11-06' }); // Sunday
assert.deepEqual(businessDaysBack('2026-11-09', 2, '2026-11-09'), { start: '2026-11-06', end: '2026-11-09' });
assert.deepEqual(businessDaysBack('2026-11-09', 0), { start: '2026-11-06', end: '2026-11-06' });
assert.equal(decode('A &amp; B &#38; C &#x26; D'), 'A & B & C & D');

// form D
const r = parseFormD(xml);
assert.equal(r.companyName, 'Acme Robotics & AI, Inc.');
assert.equal(r.address.state, 'CA');
assert.equal(r.address.city, 'San Francisco');
assert.equal(r.industryGroup, 'Other Technology');
assert.equal(r.totalOfferingAmount, 12000000);
assert.equal(r.totalAmountSold, 8500000);
assert.equal(r.totalRemaining, 3500000);
assert.equal(r.offeringAmountIndefinite, false);
assert.equal(r.isAmendment, false);
assert.equal(r.dateOfFirstSale, '2026-10-30');
assert.equal(r.yearOfIncorporation, 2023);
assert.equal(r.incorporatedWithinFiveYears, true);
assert.deepEqual(r.federalExemptions, ['06b']);
assert.deepEqual(r.securitiesTypes, ['Equity', 'Option/Warrant']);
assert.equal(r.totalInvestors, 14);
assert.equal(r.hasNonAccreditedInvestors, false);
assert.equal(r.relatedPersons.length, 2);
assert.equal(r.relatedPersons[0].name, 'Jane Q Doe');
assert.deepEqual(r.relatedPersons[0].relationships, ['Executive Officer', 'Director']);
assert.equal(r.relatedPersons[0].clarification, 'CEO');
assert.equal(r.relatedPersons[1].name, 'John Roe');
assert.equal(r.signer.name, 'Jane Q Doe');
assert.equal(r.signer.title, 'CEO');

// indefinite amount
const r2 = parseFormD(xml.replace('<totalOfferingAmount>12000000', '<totalOfferingAmount>Indefinite'));
assert.equal(r2.totalOfferingAmount, null);
assert.equal(r2.offeringAmountIndefinite, true);

// over five years (no year given)
const r3 = parseFormD(xml.replace(/<yearOfInc>[\s\S]*?<\/yearOfInc>/, '<yearOfInc><overFiveYears>true</overFiveYears></yearOfInc>'));
assert.equal(r3.incorporatedWithinFiveYears, false);
assert.equal(r3.yearOfIncorporation, null);

// filters
const rec = { ...entries[0], ...r };
assert.ok(passesFilters(rec, {}));
assert.ok(passesFilters(rec, { states: ['ca'] }));
assert.ok(!passesFilters(rec, { states: ['NY'] }));
assert.ok(passesFilters(rec, { industries: ['technology'] }));
assert.ok(!passesFilters(rec, { industries: ['biotech'] }));
assert.ok(passesFilters(rec, { minAmountSold: 5_000_000 }));
assert.ok(!passesFilters(rec, { minAmountSold: 10_000_000 }));
assert.ok(!passesFilters({ ...rec, industryGroup: 'Pooled Investment Fund' }, { excludePooledFunds: true }));
assert.ok(!passesFilters({ ...rec, isAmendment: true }, {}));
assert.ok(passesFilters({ ...rec, totalOfferingAmount: null, offeringAmountIndefinite: true }, { minOfferingAmount: 1e9 }));

console.log('all tests passed');
