// Runs offline on the test fixtures: node sec-8k/example.js
import { readFileSync } from 'node:fs';
import { parseMasterIndex, parseHeader, buildRecord, passesFilters } from './src/sec8k.js';

const fixtures = new URL('./test/fixtures/', import.meta.url);

// 1. The 8-K and 8-K/A lines of a daily index.
const entries = parseMasterIndex(readFileSync(new URL('master.idx', fixtures), 'utf8'));
console.log(entries.map((e) => `${e.formType} ${e.companyName} -> ${e.headerUrl}`));

// 2. One filing's <accession>-index-headers.html as a record.
const header = parseHeader(readFileSync(new URL('index-headers.html', fixtures), 'utf8'), entries[0].folderUrl);
const record = buildRecord(entries[0], header);
console.log(record.companyName, record.itemCodes, record.periodOfReport);
console.log(record.pressReleaseUrls);

// 3. Filters: keep filings that report item 1.01 or 2.02.
console.log(passesFilters(record, { items: ['1.01', '2.02'] }));
