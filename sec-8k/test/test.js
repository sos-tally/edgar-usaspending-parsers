import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    parseMasterIndex, dailyIndexUrl, businessDaysBack, parseHeader, buildRecord, itemCode, normalizeItemCode,
    tickerMap, indexPrefilter, passesFilters,
} from '../src/sec8k.js';

const here = new URL('./fixtures/', import.meta.url);
const idx = readFileSync(new URL('master.idx', here), 'utf8');
const html = readFileSync(new URL('index-headers.html', here), 'utf8');

// index
const entries = parseMasterIndex(idx);
assert.equal(entries.length, 3);
assert.equal(entries[0].cik, '1017655');
assert.equal(entries[0].accessionNumber, '0001437749-26-035344');
assert.equal(entries[0].headerUrl, 'https://www.sec.gov/Archives/edgar/data/1017655/000143774926035344/0001437749-26-035344-index-headers.html');
assert.equal(entries[0].filingDate, '2026-11-06');
assert.equal(entries.filter((e) => indexPrefilter(e, {})).length, 2);
assert.equal(entries.filter((e) => indexPrefilter(e, { includeAmendments: true })).length, 3);
assert.equal(entries.filter((e) => indexPrefilter(e, { cikSet: new Set(['1017655']) })).length, 1);
assert.equal(entries.filter((e) => indexPrefilter(e, { keywords: ['protagenic'] })).length, 1);
assert.equal(dailyIndexUrl('2026-11-06'), 'https://www.sec.gov/Archives/edgar/daily-index/2026/QTR4/master.20261106.idx');
assert.deepEqual(businessDaysBack('2026-11-10', 1), { start: '2026-11-09', end: '2026-11-09' });

// item codes
assert.equal(itemCode('Entry into a Material Definitive Agreement'), '1.01');
assert.equal(itemCode('Financial Statements and Exhibits'), '9.01');
assert.equal(itemCode('Results of Operations and Financial Condition'), '2.02');
assert.equal(itemCode('Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers: Compensatory Arrangements of Certain Officers'), '5.02');
assert.equal(itemCode('Non-Reliance on Previously Issued Financial Statements or a Related Audit Report'), '4.02');
assert.equal(itemCode('Regulation FD Disclosure'), '7.01');
assert.equal(itemCode('Item 8.01 Other Events'), '8.01');
assert.equal(itemCode('Shareholder Nominations Pursuant to Exchange Act Rule 14a-11'), '5.08');
assert.equal(itemCode('Shareholder Director Nominations'), '5.08');
assert.equal(itemCode('Something unknown'), null);
assert.equal(normalizeItemCode('Item 5.02'), '5.02');
assert.equal(normalizeItemCode('502'), '5.02');
assert.equal(normalizeItemCode('2.2'), '2.02');
assert.equal(normalizeItemCode('x'), null);

// header
const h = parseHeader(html, entries[0].folderUrl);
assert.equal(h.submissionType, '8-K');
assert.equal(h.periodOfReport, '2026-10-31');
assert.equal(h.filedAsOf, '2026-11-06');
assert.equal(h.acceptanceDateTime, '20261106161502');
assert.deepEqual(h.items.map((i) => i.code), ['1.01', '9.01']);
assert.equal(h.companyName, 'PAID INC');
assert.equal(h.cik, '1017655');
assert.equal(h.sic, 'SERVICES-BUSINESS SERVICES, NEC');
assert.equal(h.sicCode, '7389');
assert.equal(h.stateOfIncorporation, 'DE');
assert.equal(h.irsNumber, '731479833');
assert.equal(h.secFileNumber, '000-28720');
assert.deepEqual(h.businessAddress, { street1: '200 FRIBERG PARKWAY', street2: 'SUITE 4004', city: 'WESTBOROUGH', state: 'MA', zip: '01581' });
assert.equal(h.phone, '617-861-6050');
assert.equal(h.mailAddress.city, 'WESTBOROUGH');
assert.deepEqual(h.formerNames, [{ name: 'SALES ONLINE DIRECT INC', changed: '1999-05-25' }, { name: 'ROSE INTERNATIONAL LTD', changed: '1996-06-27' }]);
assert.equal(h.documents.length, 3);
assert.equal(h.documents[0].type, '8-K');
assert.equal(h.documents[0].url, 'https://www.sec.gov/Archives/edgar/data/1017655/000143774926035344/payd20261105_8k.htm');

// header as plain text (no HTML wrapper, no SIC code)
const plain = parseHeader('ITEM INFORMATION: Other Events\nFILER:\nCOMPANY DATA:\nCOMPANY CONFORMED NAME: X CORP\nSTANDARD INDUSTRIAL CLASSIFICATION: SERVICES-BUSINESS SERVICES, NEC\nBUSINESS ADDRESS:\nSTATE: NY\n');
assert.equal(plain.companyName, 'X CORP');
assert.equal(plain.sicCode, null);
assert.equal(plain.businessAddress.state, 'NY');
assert.deepEqual(plain.items.map((i) => i.code), ['8.01']);

// record
const tm = tickerMap({ 0: { cik_str: 1017655, ticker: 'payd', title: 'PAID INC' }, 1: { cik_str: 320193, ticker: 'AAPL' } });
assert.deepEqual(tm.get('1017655'), ['PAYD']);
const rec = buildRecord(entries[0], h, tm.get('1017655'));
assert.deepEqual(rec.itemCodes, ['1.01', '9.01']);
assert.deepEqual(rec.tickers, ['PAYD']);
assert.equal(rec.primaryDocumentUrl, 'https://www.sec.gov/Archives/edgar/data/1017655/000143774926035344/payd20261105_8k.htm');
assert.deepEqual(rec.pressReleaseUrls, ['https://www.sec.gov/Archives/edgar/data/1017655/000143774926035344/ex_99-1.htm']);

// filters
assert.ok(passesFilters(rec, {}));
assert.ok(passesFilters(rec, { items: ['1.01'] }));
assert.ok(passesFilters(rec, { items: ['Item 1.01', '5.02'] }));
assert.ok(!passesFilters(rec, { items: ['5.02'] }));
assert.ok(passesFilters(rec, { excludeItems: ['9.01'] })); // 1.01 remains
assert.ok(!passesFilters(rec, { excludeItems: ['9.01', '1.01'] }));
assert.ok(passesFilters(rec, { states: ['ma'] }));
assert.ok(!passesFilters(rec, { states: ['NY'] }));
assert.ok(passesFilters(rec, { sicCodes: ['73'] }));
assert.ok(!passesFilters(rec, { sicCodes: ['28'] }));

console.log('all tests passed');
