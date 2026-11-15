// Pure helpers for SEC Form D: index parsing, XML parsing, filtering. No network, no deps.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
export function decode(s) {
    if (s == null) return null;
    return s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
        .trim();
}

// All inner blocks of <tag>…</tag> (namespace prefixes tolerated). Self-closing tags yield ''.
export function blocks(xml, tag) {
    if (!xml) return [];
    const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, 'g');
    const out = [];
    let m;
    while ((m = re.exec(xml)) !== null) out.push(m[1] ?? '');
    return out;
}
export function text(xml, tag) {
    const b = blocks(xml, tag);
    if (!b.length) return null;
    const v = decode(b[0]);
    return v === '' ? null : v;
}
function bool(v) {
    if (v == null) return null;
    const s = String(v).toLowerCase();
    if (s === 'true' || s === 'y' || s === 'yes') return true;
    if (s === 'false' || s === 'n' || s === 'no') return false;
    return null;
}
function num(v) {
    if (v == null) return null;
    const n = Number(String(v).replace(/[,$\s]/g, ''));
    return Number.isFinite(n) ? n : null;
}

// Daily master index: "CIK|Company Name|Form Type|Date Filed|Filename"
export function parseMasterIndex(idx, formTypes = ['D', 'D/A']) {
    const want = new Set(formTypes);
    const out = [];
    for (const line of idx.split(/\r?\n/)) {
        const parts = line.split('|');
        if (parts.length !== 5) continue;
        const [cik, companyName, formType, dateFiled, fileName] = parts.map((p) => p.trim());
        if (!/^\d+$/.test(cik) || !want.has(formType)) continue;
        const acc = fileName.match(/(\d{10}-\d{2}-\d{6})/);
        if (!acc) continue;
        const accessionNumber = acc[1];
        const accNoDashes = accessionNumber.replace(/-/g, '');
        const d = dateFiled.replace(/-/g, '');
        out.push({
            cik,
            companyName,
            formType,
            filingDate: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
            accessionNumber,
            folderUrl: `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDashes}/`,
            xmlUrl: `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDashes}/primary_doc.xml`,
            filingIndexUrl: `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDashes}/${accessionNumber}-index.htm`,
        });
    }
    return out;
}

export function dailyIndexUrl(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const q = Math.floor((Number(m) - 1) / 3) + 1;
    return `https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${q}/master.${y}${m}${d}.idx`;
}

// Weekdays from start to end inclusive (EDGAR publishes no index on weekends).
export function businessDays(start, end) {
    const out = [];
    const d = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    while (d <= e) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

// Default range: the last `n` business days that end before `todayIso` (today's index may not be published yet).
// endIso, if given, is the last day instead (inclusive). Returns { start, end } as YYYY-MM-DD.
export function businessDaysBack(todayIso, n, endIso) {
    const d = new Date(`${endIso || todayIso}T00:00:00Z`);
    if (!endIso) d.setUTCDate(d.getUTCDate() - 1);
    const isBiz = (x) => x.getUTCDay() !== 0 && x.getUTCDay() !== 6;
    while (!isBiz(d)) d.setUTCDate(d.getUTCDate() - 1);
    const end = d.toISOString().slice(0, 10);
    let left = Math.max(1, Math.floor(Number(n) || 1)) - 1;
    while (left > 0) {
        d.setUTCDate(d.getUTCDate() - 1);
        if (isBiz(d)) left--;
    }
    return { start: d.toISOString().slice(0, 10), end };
}

function personName(block) {
    const n = blocks(block, 'relatedPersonName')[0] ?? block;
    return [text(n, 'firstName'), text(n, 'middleName'), text(n, 'lastName')].filter(Boolean).join(' ') || null;
}

export function parseFormD(xml) {
    const issuer = blocks(xml, 'primaryIssuer')[0] ?? '';
    const addr = blocks(issuer, 'issuerAddress')[0] ?? '';
    const off = blocks(xml, 'offeringData')[0] ?? '';
    const ind = blocks(off, 'industryGroup')[0] ?? '';
    const tof = blocks(off, 'typeOfFiling')[0] ?? '';
    const first = blocks(tof, 'dateOfFirstSale')[0] ?? '';
    const amounts = blocks(off, 'offeringSalesAmounts')[0] ?? '';
    const inv = blocks(off, 'investors')[0] ?? '';
    const sec = blocks(off, 'typesOfSecuritiesOffered')[0] ?? '';
    const yoi = blocks(issuer, 'yearOfInc')[0] ?? '';
    const sig = blocks(off, 'signature')[0] ?? '';
    const fees = blocks(off, 'salesCommissionsFindersFees')[0] ?? '';

    const offeringRaw = text(amounts, 'totalOfferingAmount');
    const remainingRaw = text(amounts, 'totalRemaining');

    const securitiesTypes = [];
    const secMap = {
        isEquityType: 'Equity', isDebtType: 'Debt', isOptionToAcquireType: 'Option/Warrant',
        isSecurityToBeAcquiredType: 'Security to be acquired', isPooledInvestmentFundType: 'Pooled fund interest',
        isTenantInCommonType: 'Tenant-in-common', isMineralPropertyType: 'Mineral property', isOtherType: 'Other',
    };
    for (const [tag, label] of Object.entries(secMap)) if (bool(text(sec, tag))) securitiesTypes.push(label);
    const otherDesc = text(sec, 'descriptionOfOtherType');
    if (otherDesc) securitiesTypes.push(`Other: ${otherDesc}`);

    const relatedPersons = blocks(xml, 'relatedPersonInfo').map((p) => {
        const pa = blocks(p, 'relatedPersonAddress')[0] ?? '';
        return {
            name: personName(p),
            relationships: blocks(p, 'relationship').map(decode).filter(Boolean),
            clarification: text(p, 'relationshipClarification'),
            city: text(pa, 'city'),
            state: text(pa, 'stateOrCountry'),
        };
    });

    const exemptions = blocks(blocks(off, 'federalExemptionsExclusions')[0] ?? '', 'item').map(decode).filter(Boolean);

    return {
        testOrLive: text(xml, 'testOrLive'),
        submissionType: text(xml, 'submissionType'),
        cik: text(issuer, 'cik'),
        companyName: text(issuer, 'entityName'),
        entityType: text(issuer, 'entityType') ?? text(issuer, 'entityTypeOtherDesc'),
        jurisdictionOfIncorporation: text(issuer, 'jurisdictionOfInc'),
        yearOfIncorporation: num(text(yoi, 'value')),
        incorporatedWithinFiveYears: bool(text(yoi, 'withinFiveYears')) ?? (bool(text(yoi, 'overFiveYears')) ? false : null),
        address: {
            street1: text(addr, 'street1'),
            street2: text(addr, 'street2'),
            city: text(addr, 'city'),
            state: text(addr, 'stateOrCountry'),
            stateDescription: text(addr, 'stateOrCountryDescription'),
            zip: text(addr, 'zipCode'),
        },
        phone: text(issuer, 'issuerPhoneNumber'),
        industryGroup: text(ind, 'industryGroupType'),
        investmentFundType: text(ind, 'investmentFundType'),
        revenueRange: text(off, 'revenueRange') ?? text(off, 'aggregateNetAssetValueRange'),
        federalExemptions: exemptions,
        isAmendment: bool(text(tof, 'isAmendment')),
        dateOfFirstSale: text(first, 'value'),
        firstSaleYetToOccur: bool(text(first, 'yetToOccur')),
        moreThanOneYear: bool(text(off, 'moreThanOneYear')),
        securitiesTypes,
        isBusinessCombination: bool(text(off, 'isBusinessCombinationTransaction')),
        minimumInvestment: num(text(off, 'minimumInvestmentAccepted')),
        totalOfferingAmount: num(offeringRaw),
        offeringAmountIndefinite: offeringRaw != null && /indefinite/i.test(offeringRaw),
        totalAmountSold: num(text(amounts, 'totalAmountSold')),
        totalRemaining: num(remainingRaw),
        hasNonAccreditedInvestors: bool(text(inv, 'hasNonAccreditedInvestors')),
        totalInvestors: num(text(inv, 'totalNumberAlreadyInvested')),
        salesCommissions: num(text(blocks(fees, 'salesCommissions')[0] ?? '', 'dollarAmount')),
        findersFees: num(text(blocks(fees, 'findersFees')[0] ?? '', 'dollarAmount')),
        relatedPersons,
        signer: {
            name: text(sig, 'nameOfSigner') ?? text(sig, 'signatureName'),
            title: text(sig, 'signatureTitle'),
            date: text(sig, 'signatureDate'),
        },
    };
}

// opts: { includeAmendments, excludePooledFunds, minAmountSold, minOfferingAmount, states[], industries[], keywords[] }
export function passesFilters(rec, opts = {}) {
    if (!opts.includeAmendments && (rec.isAmendment || rec.formType === 'D/A')) return false;
    if (opts.excludePooledFunds && /pooled investment fund/i.test(rec.industryGroup ?? '')) return false;
    if (opts.minAmountSold && !(rec.totalAmountSold >= opts.minAmountSold)) return false;
    if (opts.minOfferingAmount && !(rec.offeringAmountIndefinite || rec.totalOfferingAmount >= opts.minOfferingAmount)) return false;
    if (opts.states?.length) {
        const s = (rec.address?.state ?? '').toUpperCase();
        if (!opts.states.map((x) => x.toUpperCase().trim()).includes(s)) return false;
    }
    if (opts.industries?.length) {
        const g = (rec.industryGroup ?? '').toLowerCase();
        if (!opts.industries.some((x) => g.includes(x.toLowerCase().trim()))) return false;
    }
    if (opts.keywords?.length) {
        const n = (rec.companyName ?? '').toLowerCase();
        if (!opts.keywords.some((x) => n.includes(x.toLowerCase().trim()))) return false;
    }
    return true;
}

// Index-level prefilter (before fetching the XML) to save requests.
export function indexPrefilter(entry, opts = {}) {
    if (!opts.includeAmendments && entry.formType === 'D/A') return false;
    if (opts.keywords?.length) {
        const n = entry.companyName.toLowerCase();
        if (!opts.keywords.some((x) => n.includes(x.toLowerCase().trim()))) return false;
    }
    return true;
}
