// Pure logic for the USAspending awards tracker: request building and result normalising.
// API: POST https://api.usaspending.gov/api/v2/search/spending_by_award/ (official, keyless, public-domain data).

export const API_URL = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';

// One award-type group per request (the API rejects mixed groups).
export const GROUPS = {
    contracts: ['A', 'B', 'C', 'D'],
    idvs: ['IDV_A', 'IDV_B', 'IDV_B_A', 'IDV_B_B', 'IDV_B_C', 'IDV_C', 'IDV_D', 'IDV_E'],
    grants: ['02', '03', '04', '05'],
    loans: ['07', '08'],
    direct_payments: ['06', '10'],
    other: ['09', '11', '-1'],
};

export const CORE_FIELDS = [
    'Award ID', 'Recipient Name', 'Award Amount', 'Description',
    'Awarding Agency', 'Awarding Sub Agency', 'Start Date', 'End Date', 'generated_internal_id',
];

const EXTRA_FIELDS = {
    contracts: ['Contract Award Type', 'Recipient UEI', 'NAICS', 'PSC', 'Place of Performance State Code', 'Last Modified Date', 'Base Obligation Date'],
    idvs: ['Contract Award Type', 'Recipient UEI', 'NAICS', 'PSC', 'Last Modified Date', 'Base Obligation Date'],
    grants: ['Award Type', 'Recipient UEI', 'CFDA Number', 'Place of Performance State Code', 'Last Modified Date', 'Base Obligation Date'],
    loans: ['Award Type', 'Recipient UEI', 'CFDA Number', 'Last Modified Date'],
    direct_payments: ['Award Type', 'Recipient UEI', 'CFDA Number', 'Last Modified Date'],
    other: ['Award Type', 'Recipient UEI', 'Last Modified Date'],
};

export const SORTS = ['Award Amount', 'Start Date', 'Last Modified Date'];
export const DATE_TYPES = ['action_date', 'last_modified_date', 'date_signed', 'new_awards_only'];

export function fieldsFor(group, coreOnly = false) {
    if (coreOnly) return [...CORE_FIELDS];
    return [...CORE_FIELDS, ...(EXTRA_FIELDS[group] || [])];
}

export function isoDaysAgo(n, now = new Date()) {
    const d = new Date(now.getTime());
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

const clean = (a) => (Array.isArray(a) ? a.map((s) => String(s).trim()).filter(Boolean) : []);

export function buildFilters(input, group, now = new Date()) {
    const daysBack = Math.max(1, Number(input.daysBack ?? 7));
    const end = input.endDate || isoDaysAgo(0, now);
    const start = input.startDate || isoDaysAgo(daysBack - 1, now);
    const tp = { start_date: start, end_date: end };
    const dt = DATE_TYPES.includes(input.dateType) ? input.dateType : 'new_awards_only';
    if (dt !== 'action_date') tp.date_type = dt;
    const filters = { time_period: [tp], award_type_codes: GROUPS[group] };
    const agencies = clean(input.awardingAgencies).map((name) => ({ type: 'awarding', tier: 'toptier', name }));
    if (agencies.length) filters.agencies = agencies;
    const kw = clean(input.keywords);
    if (kw.length) filters.keywords = kw;
    const rec = clean(input.recipients);
    if (rec.length) filters.recipient_search_text = rec;
    const states = clean(input.states).map((s) => s.toUpperCase());
    if (states.length) filters.place_of_performance_locations = states.map((state) => ({ country: 'USA', state }));
    const naics = clean(input.naicsCodes);
    if (naics.length && (group === 'contracts' || group === 'idvs')) filters.naics_codes = { require: naics };
    const psc = clean(input.pscCodes);
    if (psc.length && (group === 'contracts' || group === 'idvs')) filters.psc_codes = psc;
    const cfda = clean(input.cfdaNumbers);
    if (cfda.length && group !== 'contracts' && group !== 'idvs') filters.program_numbers = cfda;
    const lo = Number(input.minAmount) || 0;
    const hi = Number(input.maxAmount) || 0;
    if (lo > 0 || hi > 0) {
        const b = {};
        if (lo > 0) b.lower_bound = lo;
        if (hi > 0) b.upper_bound = hi;
        filters.award_amounts = [b];
    }
    return filters;
}

export function buildRequest(input, group, page, { coreOnly = false, now = new Date() } = {}) {
    let sort = SORTS.includes(input.sortBy) ? input.sortBy : 'Last Modified Date';
    const fields = fieldsFor(group, coreOnly);
    if (!fields.includes(sort)) sort = 'Start Date';
    return {
        filters: buildFilters(input, group, now),
        fields,
        page,
        limit: 100,
        sort,
        order: input.sortOrder === 'asc' ? 'asc' : 'desc',
        subawards: false,
    };
}

const codeOf = (v) => (v && typeof v === 'object' ? v.code ?? null : v ?? null);
const descOf = (v) => (v && typeof v === 'object' ? v.description ?? null : null);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export function normalize(row, group) {
    const id = row.generated_internal_id ?? null;
    return {
        awardId: row['Award ID'] ?? null,
        awardCategory: group,
        awardType: row['Contract Award Type'] ?? row['Award Type'] ?? null,
        recipientName: row['Recipient Name'] ?? null,
        recipientUei: row['Recipient UEI'] ?? null,
        amount: num(row['Award Amount']),
        description: row.Description ?? null,
        awardingAgency: row['Awarding Agency'] ?? null,
        awardingSubAgency: row['Awarding Sub Agency'] ?? null,
        startDate: row['Start Date'] ?? null,
        endDate: row['End Date'] ?? null,
        baseObligationDate: row['Base Obligation Date'] ?? null,
        lastModifiedDate: row['Last Modified Date'] ?? null,
        naicsCode: codeOf(row.NAICS),
        naicsDescription: descOf(row.NAICS),
        pscCode: codeOf(row.PSC),
        pscDescription: descOf(row.PSC),
        cfdaNumber: row['CFDA Number'] ?? null,
        placeOfPerformanceState: row['Place of Performance State Code'] ?? null,
        usaspendingId: id,
        url: id ? `https://www.usaspending.gov/award/${encodeURIComponent(id)}` : null,
    };
}
