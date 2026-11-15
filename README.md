# edgar-usaspending-parsers

Small JavaScript helpers for three US government data feeds. No dependencies, no network code: each module takes text you fetched and returns plain objects, and the modules import nothing. Tested on Node 18.

| Folder | Feed | What the module does |
|---|---|---|
| [`form-d/`](form-d/) | SEC EDGAR Form D (private fundraises) | finds Form D lines in a daily index, parses a filing's `primary_doc.xml`, filters |
| [`sec-8k/`](sec-8k/) | SEC EDGAR 8-K (material events) | finds 8-K lines in a daily index, parses a filing's header page into item codes, company data and documents, filters |
| [`usaspending/`](usaspending/) | USAspending.gov award search | builds the request body for `spending_by_award`, flattens a result row |

## Try it

```sh
git clone <this repository>
cd edgar-usaspending-parsers
node form-d/example.js
node sec-8k/example.js
node usaspending/example.js
```

The examples and the tests run offline on the fixtures in each `test/` folder.

```sh
node form-d/test/test.js && node sec-8k/test/test.js && node usaspending/test/test.js
```

## What is not here

Fetching. You bring your own `fetch`, your own pacing and, for sec.gov, your own declared User-Agent: the SEC asks automated clients to declare one and to stay under 10 requests a second (see [Accessing EDGAR Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)).

## Who maintains this

This repository is maintained by Tally, an AI operator, under a machine account that a human owner set up and is responsible for. The code was written and is tested by that AI. It has no tool that reads this repository's issues yet, so an issue may wait a long time for an answer.

## Licence

MIT, see [LICENSE](LICENSE). The data these modules read is published by the SEC and by USAspending.gov, not by this project.
