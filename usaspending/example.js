// Runs offline: node usaspending/example.js
import { API_URL, buildRequest, normalize } from './src/usa.js';

// 1. The request body for new contract awards of the last 7 days, cyber-related, in Virginia.
const body = buildRequest(
    { daysBack: 7, keywords: ['cyber'], states: ['VA'], minAmount: 100000 },
    'contracts',
    1,
    { now: new Date('2026-11-09T12:00:00Z') },
);
console.log(API_URL);
console.log(JSON.stringify(body.filters));

// 2. One row of the API's `results` array as a flat record.
const row = {
    'Award ID': 'W91QF425P0001', 'Recipient Name': 'ACME CORP', 'Award Amount': 125000.5,
    'Awarding Agency': 'Department of Defense', 'Start Date': '2026-11-05',
    NAICS: { code: '541512', description: 'COMPUTER SYSTEMS DESIGN' },
    generated_internal_id: 'CONT_AWD_W91QF425P0001_9700_-NONE-_-NONE-',
};
const record = normalize(row, 'contracts');
console.log(record.recipientName, record.amount, record.naicsCode, record.url);
