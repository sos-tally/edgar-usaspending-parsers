import assert from 'node:assert/strict';
import { buildRequest, buildFilters, normalize, fieldsFor, isoDaysAgo, GROUPS } from '../src/usa.js';

const now = new Date('2026-11-09T12:00:00Z');

// defaults
let f = buildFilters({}, 'contracts', now);
assert.deepEqual(f.time_period, [{ start_date: '2026-11-03', end_date: '2026-11-09', date_type: 'new_awards_only' }]);
assert.deepEqual(f.award_type_codes, ['A', 'B', 'C', 'D']);
assert.equal(f.agencies, undefined);

// full filters on contracts
f = buildFilters({ daysBack: 1, awardingAgencies: ['Department of Defense', ' '], keywords: ['cyber'], recipients: ['Acme'], states: ['va'], naicsCodes: ['541512'], pscCodes: ['D310'], cfdaNumbers: ['93.837'], minAmount: 1000, dateType: 'new_awards_only' }, 'contracts', now);
assert.deepEqual(f.time_period, [{ start_date: '2026-11-09', end_date: '2026-11-09', date_type: 'new_awards_only' }]);
assert.deepEqual(f.agencies, [{ type: 'awarding', tier: 'toptier', name: 'Department of Defense' }]);
assert.deepEqual(f.place_of_performance_locations, [{ country: 'USA', state: 'VA' }]);
assert.deepEqual(f.naics_codes, { require: ['541512'] });
assert.deepEqual(f.psc_codes, ['D310']);
assert.equal(f.program_numbers, undefined, 'CFDA not applied to contracts');
assert.deepEqual(f.award_amounts, [{ lower_bound: 1000 }]);

// grants: CFDA yes, NAICS no
f = buildFilters({ naicsCodes: ['541512'], cfdaNumbers: ['93.837'], startDate: '2026-01-01', endDate: '2026-02-01', dateType: 'action_date' }, 'grants', now);
assert.equal(f.naics_codes, undefined);
assert.deepEqual(f.program_numbers, ['93.837']);
assert.deepEqual(f.time_period, [{ start_date: '2026-01-01', end_date: '2026-02-01' }]);

// request
const r = buildRequest({ sortBy: 'Bogus', sortOrder: 'asc' }, 'grants', 2, { now });
assert.equal(r.sort, 'Last Modified Date');
assert.equal(r.order, 'asc');
assert.equal(r.page, 2);
assert.equal(r.limit, 100);
assert.ok(r.fields.includes('CFDA Number'));
assert.ok(!r.fields.includes('NAICS'));
assert.deepEqual(buildRequest({ sortBy: 'Last Modified Date' }, 'contracts', 1, { coreOnly: true, now }).sort, 'Start Date');
assert.equal(fieldsFor('contracts', true).length, 9);
assert.equal(isoDaysAgo(9, now), '2026-10-31');
assert.ok(Object.keys(GROUPS).length === 6);

// normalize
const row = {
    'Award ID': 'W91QF425P0001', 'Recipient Name': 'ACME CORP', 'Award Amount': 125000.5, Description: 'IT SERVICES',
    'Awarding Agency': 'Department of Defense', 'Awarding Sub Agency': 'Department of the Army', 'Start Date': '2026-11-05', 'End Date': '2027-11-04',
    'Contract Award Type': 'PURCHASE ORDER', 'Recipient UEI': 'ABC123', NAICS: { code: '541512', description: 'COMPUTER SYSTEMS DESIGN' }, PSC: { code: 'D310', description: 'IT SUPPORT' },
    generated_internal_id: 'CONT_AWD_W91QF425P0001_9700_-NONE-_-NONE-',
};
const n = normalize(row, 'contracts');
assert.equal(n.amount, 125000.5);
assert.equal(n.naicsCode, '541512');
assert.equal(n.pscDescription, 'IT SUPPORT');
assert.equal(n.awardType, 'PURCHASE ORDER');
assert.equal(n.url, 'https://www.usaspending.gov/award/CONT_AWD_W91QF425P0001_9700_-NONE-_-NONE-');
const g = normalize({ 'Award ID': 'X', 'Award Amount': null, NAICS: '541512', 'Award Type': 'PROJECT GRANT (B)' }, 'grants');
assert.equal(g.amount, null);
assert.equal(g.naicsCode, '541512');
assert.equal(g.naicsDescription, null);
assert.equal(g.url, null);
assert.equal(g.awardType, 'PROJECT GRANT (B)');

console.log('usaspending-awards: all tests passed');
