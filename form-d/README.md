# form-d: SEC Form D parser

A company that raises money privately in the US under Regulation D files a Form D with the SEC. Each filing is an XML document on EDGAR. This module turns EDGAR's daily index and a filing's XML into plain records.

One file, [`src/formd.js`](src/formd.js). No dependencies, no network calls.

## Use

```js
import { dailyIndexUrl, parseMasterIndex, parseFormD, passesFilters } from './src/formd.js';

const headers = { 'User-Agent': 'Your Name you@example.com' }; // the SEC asks you to declare who you are

const idx = await (await fetch(dailyIndexUrl('2026-11-06'), { headers })).text();
for (const entry of parseMasterIndex(idx)) {          // Form D and D/A lines only
    const xml = await (await fetch(entry.xmlUrl, { headers })).text();
    const record = { ...entry, ...parseFormD(xml) };
    if (passesFilters(record, { excludePooledFunds: true, minAmountSold: 1_000_000 })) console.log(record);
    await new Promise((r) => setTimeout(r, 150));     // stay well under 10 requests a second
}
```

`node example.js` shows the same steps offline, on the fixtures in `test/fixtures/`.

## Functions

| Function | Returns |
|---|---|
| `dailyIndexUrl('YYYY-MM-DD')` | the URL of that day's `master.idx` |
| `businessDays(start, end)` | the weekdays in a range (EDGAR publishes no index on weekends) |
| `businessDaysBack(today, n, end?)` | `{ start, end }` for the last `n` weekdays before today |
| `parseMasterIndex(text, formTypes?)` | one entry per filing: `cik`, `companyName`, `formType`, `filingDate`, `accessionNumber`, `xmlUrl`, `filingIndexUrl`, `folderUrl` |
| `parseFormD(xml)` | the filing as a record (below) |
| `indexPrefilter(entry, opts)` | `true` if the entry is worth fetching (amendments, name keywords) |
| `passesFilters(record, opts)` | `true` if the record passes `includeAmendments`, `excludePooledFunds`, `minAmountSold`, `minOfferingAmount`, `states`, `industries`, `keywords` |

## The record

`testOrLive`, `submissionType`, `companyName`, `cik`, `entityType`, `jurisdictionOfIncorporation`, `yearOfIncorporation`, `incorporatedWithinFiveYears`, `address` (street1, street2, city, state, stateDescription, zip), `phone`, `industryGroup`, `investmentFundType`, `revenueRange`, `federalExemptions`, `isAmendment`, `dateOfFirstSale`, `firstSaleYetToOccur`, `moreThanOneYear`, `securitiesTypes`, `isBusinessCombination`, `minimumInvestment`, `totalOfferingAmount`, `offeringAmountIndefinite`, `totalAmountSold`, `totalRemaining`, `totalInvestors`, `hasNonAccreditedInvestors`, `salesCommissions`, `findersFees`, `relatedPersons` (name, relationships, clarification, city, state), `signer` (name, title, date).

A value the filing leaves out is `null`; a list it leaves out is empty. An offering of "Indefinite" size has `totalOfferingAmount: null` and `offeringAmountIndefinite: true`.

## Limits

- The XML is read with regular expressions, not an XML parser. It handles the Form D documents I tested it on; it is not a general XML reader.
- Not every weekday has an index (a US federal holiday, for example). Treat a failed fetch of a day's index as a day to skip, not as an error.
- `businessDaysBack` ends the day before today, because the current day's index may not be published yet. I have not checked at what hour the SEC publishes it.

## Test

```sh
node test/test.js
```

---

A hosted version that runs this on a schedule and saves the records as a dataset is on Apify: https://apify.com/nominal_holmium/form-d-tracker
