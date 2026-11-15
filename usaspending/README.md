# usaspending: request builder for USAspending award search

USAspending.gov publishes US federal contracts, grants, loans and other awards through a public API that needs no key. Its award search, `POST /api/v2/search/spending_by_award/`, takes a nested filter object and returns rows keyed by display names such as `"Award Amount"`. This module builds that request from simple options and flattens the rows.

One file, [`src/usa.js`](src/usa.js). No dependencies, no network calls.

## Use

```js
import { API_URL, buildRequest, normalize } from './src/usa.js';

const input = { daysBack: 7, keywords: ['cyber'], states: ['VA'], minAmount: 100000 };
const group = 'contracts';                      // one award group per request

for (let page = 1; ; page++) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequest(input, group, page)),
    });
    const data = await res.json();
    for (const row of data.results) console.log(normalize(row, group));
    if (!data.page_metadata?.hasNext) break;
}
```

`node example.js` prints a request body and a flattened row offline.

## Options (`input`)

| Option | Meaning |
|---|---|
| `daysBack` | days to look back, ending today; default 7 |
| `startDate`, `endDate` | `YYYY-MM-DD`; override `daysBack` |
| `dateType` | `new_awards_only` (default), `action_date`, `last_modified_date`, `date_signed` |
| `awardingAgencies` | top-tier agency names, e.g. `Department of Defense` |
| `keywords`, `recipients` | search text |
| `states` | place of performance, two-letter codes |
| `naicsCodes`, `pscCodes` | contracts and IDVs only |
| `cfdaNumbers` | grants, loans and other assistance only |
| `minAmount`, `maxAmount` | award amount bounds |
| `sortBy`, `sortOrder` | `Award Amount`, `Start Date` or `Last Modified Date`; `asc` or `desc` |

## Award groups

The API rejects a request that mixes award types of different groups, so one request covers one of: `contracts`, `idvs`, `grants`, `loans`, `direct_payments`, `other`. `GROUPS` holds the type codes of each.

## The record

`awardId`, `awardCategory`, `awardType`, `recipientName`, `recipientUei`, `amount`, `description`, `awardingAgency`, `awardingSubAgency`, `startDate`, `endDate`, `baseObligationDate`, `lastModifiedDate`, `naicsCode`, `naicsDescription`, `pscCode`, `pscDescription`, `cfdaNumber`, `placeOfPerformanceState`, `usaspendingId`, `url` (the award's page on usaspending.gov).

## Limits

- `buildRequest(..., { coreOnly: true })` asks for the nine core fields only: a fallback for when the API refuses one of the extra fields.
- The page size is fixed at 100.
- Sub-awards are not requested.

## Test

```sh
node test/test.js
```

---

A hosted version that runs this on a schedule and saves the records as a dataset is on Apify: https://apify.com/nominal_holmium/usaspending-awards-tracker
