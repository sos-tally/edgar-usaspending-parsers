// Runs offline on the test fixtures: node form-d/example.js
import { readFileSync } from 'node:fs';
import { parseMasterIndex, dailyIndexUrl, parseFormD, passesFilters } from './src/formd.js';

const fixtures = new URL('./test/fixtures/', import.meta.url);

// 1. Where a day's index lives (you fetch it yourself, with your own User-Agent).
console.log(dailyIndexUrl('2026-11-06'));

// 2. The Form D and D/A lines of that index.
const entries = parseMasterIndex(readFileSync(new URL('master.idx', fixtures), 'utf8'));
console.log(entries.map((e) => `${e.formType} ${e.companyName} -> ${e.xmlUrl}`));

// 3. One filing's primary_doc.xml as a flat record.
const filing = parseFormD(readFileSync(new URL('primary_doc.xml', fixtures), 'utf8'));
const record = { ...entries[0], ...filing };
console.log(record.companyName, record.industryGroup, record.totalAmountSold, record.address.state);

// 4. Filters.
console.log(passesFilters(record, { excludePooledFunds: true, minAmountSold: 1000000, states: ['CA'] }));
