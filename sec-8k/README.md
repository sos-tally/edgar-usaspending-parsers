# sec-8k: SEC 8-K header parser

A US public company files an 8-K when something material happens: results, a new agreement, an officer leaving, a cybersecurity incident. EDGAR publishes, for each filing, a header page that lists which numbered items the filing reports. This module reads the daily index and that header page, so you can sort filings by item without opening the documents.

One file, [`src/sec8k.js`](src/sec8k.js). No dependencies, no network calls.

## Use

```js
import { dailyIndexUrl, parseMasterIndex, parseHeader, buildRecord, passesFilters } from './src/sec8k.js';

const headers = { 'User-Agent': 'Your Name you@example.com' }; // the SEC asks you to declare who you are

const idx = await (await fetch(dailyIndexUrl('2026-11-06'), { headers })).text();
for (const entry of parseMasterIndex(idx)) {          // 8-K and 8-K/A lines only
    const html = await (await fetch(entry.headerUrl, { headers })).text();
    const record = buildRecord(entry, parseHeader(html, entry.folderUrl));
    if (passesFilters(record, { items: ['1.05', '5.02'] })) console.log(record.companyName, record.itemCodes);
    await new Promise((r) => setTimeout(r, 150));     // stay well under 10 requests a second
}
```

`node example.js` shows the same steps offline, on the fixtures in `test/fixtures/`.

## Functions

| Function | Returns |
|---|---|
| `dailyIndexUrl('YYYY-MM-DD')` | the URL of that day's `master.idx` |
| `businessDays(start, end)`, `businessDaysBack(today, n, end?)` | weekday ranges |
| `parseMasterIndex(text, formTypes?)` | one entry per filing, with `headerUrl`, `filingIndexUrl`, `folderUrl` |
| `parseHeader(html, folderUrl)` | the header's fields: items, period of report, company data, addresses, former names, document list |
| `itemCode(description)` | the item number for EDGAR's item text, e.g. `'Other Events'` gives `'8.01'`; `null` if unknown |
| `normalizeItemCode(s)` | `'Item 5.02'`, `'502'` or `'5.2'` as `'5.02'` |
| `buildRecord(entry, header, tickers?)` | one flat record |
| `tickerMap(json)` | a `Map` from CIK to tickers, from the SEC's `company_tickers.json` |
| `indexPrefilter(entry, opts)`, `passesFilters(record, opts)` | filters by amendment, CIK set, name keyword; by `items`, `excludeItems`, `states`, `sicCodes` |
| `ITEMS` | the table of item codes, titles and matching phrases |

## The record

`cik`, `companyName`, `tickers`, `formType`, `filingDate`, `periodOfReport`, `acceptanceDateTime`, `accessionNumber`, `itemCodes`, `items` (code and EDGAR's text), `sic`, `sicCode`, `stateOfIncorporation`, `fiscalYearEnd`, `businessAddress`, `phone`, `secFileNumber`, `formerNames`, `primaryDocumentUrl`, `pressReleaseUrls` (the EX-99 exhibits), `documents`, `filingIndexUrl`, `folderUrl`.

## Limits

- Item codes come from matching EDGAR's item text against the phrases in `ITEMS`. An item text the table does not know gets `code: null` and keeps its `description`.
- With several co-registrants, the company fields are those of the first filer.
- The module reads the header, not the body of the 8-K or its exhibits.

## Test

```sh
node test/test.js
```

---

A hosted version that runs this on a schedule and saves the records as a dataset is on Apify: https://apify.com/nominal_holmium/sec-8k-feed
