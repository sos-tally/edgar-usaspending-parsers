// Pure helpers for SEC 8-K filings: index parsing, header parsing, item codes, filtering. No network, no deps.
// The EDGAR index and date helpers are the same as in form-d/src/formd.js.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
export function decode(s) {
    if (s == null) return null;
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => ENTITIES[m]);
}

// Daily master index: "CIK|Company Name|Form Type|Date Filed|Filename"
export function parseMasterIndex(idx, formTypes = ['8-K', '8-K/A']) {
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
        const folderUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDashes}/`;
        out.push({
            cik,
            companyName,
            formType,
            filingDate: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
            accessionNumber,
            folderUrl,
            filingIndexUrl: `${folderUrl}${accessionNumber}-index.htm`,
            headerUrl: `${folderUrl}${accessionNumber}-index-headers.html`,
        });
    }
    return out;
}

export function dailyIndexUrl(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const q = Math.floor((Number(m) - 1) / 3) + 1;
    return `https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${q}/master.${y}${m}${d}.idx`;
}

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

// The last `n` business days ending before todayIso (today's index may not be published yet); endIso overrides the end.
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

// 8-K items: code, official title, and a phrase that identifies EDGAR's ITEM INFORMATION text.
export const ITEMS = [
    ['1.01', 'Entry into a Material Definitive Agreement', 'entry into a material definitive agreement'],
    ['1.02', 'Termination of a Material Definitive Agreement', 'termination of a material definitive agreement'],
    ['1.03', 'Bankruptcy or Receivership', 'bankruptcy or receivership'],
    ['1.04', 'Mine Safety - Reporting of Shutdowns and Patterns of Violations', 'mine safety'],
    ['1.05', 'Material Cybersecurity Incidents', 'cybersecurity incident'],
    ['2.01', 'Completion of Acquisition or Disposition of Assets', 'completion of acquisition or disposition'],
    ['2.02', 'Results of Operations and Financial Condition', 'results of operations and financial condition'],
    ['2.03', 'Creation of a Direct Financial Obligation', 'creation of a direct financial obligation'],
    ['2.04', 'Triggering Events That Accelerate or Increase a Direct Financial Obligation', 'triggering events'],
    ['2.05', 'Costs Associated with Exit or Disposal Activities', 'costs associated with exit or disposal'],
    ['2.06', 'Material Impairments', 'material impairment'],
    ['3.01', 'Notice of Delisting or Failure to Satisfy a Continued Listing Rule', 'notice of delisting'],
    ['3.02', 'Unregistered Sales of Equity Securities', 'unregistered sales of equity securities'],
    ['3.03', 'Material Modification to Rights of Security Holders', 'material modification'],
    ['4.01', "Changes in Registrant's Certifying Accountant", 'certifying accountant'],
    ['4.02', 'Non-Reliance on Previously Issued Financial Statements', 'non reliance on previously issued'],
    ['5.01', 'Changes in Control of Registrant', 'changes in control of registrant'],
    ['5.02', 'Departure or Election of Directors or Officers; Compensatory Arrangements', 'departure of directors'],
    ['5.03', 'Amendments to Articles of Incorporation or Bylaws; Change in Fiscal Year', 'amendments to articles of incorporation'],
    ['5.04', "Temporary Suspension of Trading Under Registrant's Employee Benefit Plans", 'temporary suspension of trading'],
    ['5.05', 'Amendments to Code of Ethics, or Waiver of a Provision of the Code of Ethics', 'code of ethics'],
    ['5.06', 'Change in Shell Company Status', 'change in shell company status'],
    ['5.07', 'Submission of Matters to a Vote of Security Holders', 'submission of matters to a vote'],
    ['5.08', 'Shareholder Director Nominations', 'shareholder director nominations'],
    ['5.08', 'Shareholder Director Nominations', 'shareholder nominations'], // EDGAR header text: "Shareholder Nominations Pursuant to Exchange Act Rule 14a-11"
    ['6.01', 'ABS Informational and Computational Material', 'abs informational'],
    ['6.02', 'Change of Servicer or Trustee', 'change of servicer or trustee'],
    ['6.03', 'Change in Credit Enhancement or Other External Support', 'change in credit enhancement'],
    ['6.04', 'Failure to Make a Required Distribution', 'failure to make a required distribution'],
    ['6.05', 'Securities Act Updating Disclosure', 'securities act updating disclosure'],
    ['7.01', 'Regulation FD Disclosure', 'regulation fd disclosure'],
    ['8.01', 'Other Events', 'other events'],
    ['9.01', 'Financial Statements and Exhibits', 'financial statements and exhibits'],
];
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function itemCode(description) {
    const n = norm(description);
    const explicit = n.match(/^item (\d) (\d{2})\b/);
    if (explicit) return `${explicit[1]}.${explicit[2]}`;
    for (const [code, , phrase] of ITEMS) if (n.includes(phrase)) return code;
    return null;
}

// "2.02", "Item 5.02", "502", "5.2" -> "2.02"/"5.02"; null if not an item code.
export function normalizeItemCode(s) {
    const m = String(s ?? '').match(/(\d)\s*\.?\s*(\d{1,2})/);
    if (!m) return null;
    return `${m[1]}.${m[2].padStart(2, '0')}`;
}

// EDGAR's <accession>-index-headers.html: an HTML page wrapping the SGML header, its tags escaped.
// Returns the header fields of the first filer, the 8-K items and the document list.
export function parseHeader(html, folderUrl = '') {
    let t = html.replace(/<(?:br|\/p|\/tr|\/div)\b[^>]*>/gi, '\n'); // keep line breaks
    t = t.replace(/<[^>]+>/g, ''); // drop the page's own HTML tags; escaped SGML tags survive
    t = decode(t).replace(/<(\/?[A-Z][A-Z0-9-]*)>/g, '\n<$1>'); // one SGML tag per line
    const lines = t.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));

    const out = {
        submissionType: null, periodOfReport: null, filedAsOf: null, dateOfChange: null, acceptanceDateTime: null,
        items: [], companyName: null, cik: null, sic: null, sicCode: null, irsNumber: null, stateOfIncorporation: null,
        fiscalYearEnd: null, secFileNumber: null, filmNumber: null, businessAddress: {}, mailAddress: {}, phone: null,
        formerNames: [], documents: [],
    };
    let section = null;
    let filers = 0;
    let doc = null;
    const addr = (k, v, target) => {
        const map = { 'STREET 1': 'street1', 'STREET 2': 'street2', CITY: 'city', STATE: 'state', ZIP: 'zip' };
        if (map[k]) target[map[k]] = v;
    };
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        // SGML document blocks: <DOCUMENT> <TYPE>EX-99.1 <SEQUENCE>2 <FILENAME>x.htm <DESCRIPTION>PRESS RELEASE
        const sg = line.match(/^<([A-Z][A-Z0-9-]*)>\s*(.*)$/);
        if (sg) {
            const [, tag, val] = sg;
            if (tag === 'DOCUMENT') { doc = { type: null, sequence: null, filename: null, description: null }; out.documents.push(doc); }
            else if (doc && tag === 'TYPE') doc.type = val || null;
            else if (doc && tag === 'SEQUENCE') doc.sequence = Number(val) || null;
            else if (doc && tag === 'FILENAME') doc.filename = val || null;
            else if (doc && tag === 'DESCRIPTION') doc.description = val || null;
            else if (tag === 'ACCEPTANCE-DATETIME' && val) out.acceptanceDateTime = val;
            continue;
        }
        if (/^<\//.test(line)) { if (/^<\/DOCUMENT>/.test(line)) doc = null; continue; }
        const kv = line.match(/^([A-Z][A-Z0-9 ,'\-/()]*?):\s*(.*)$/);
        if (!kv) continue;
        const [, key, val] = kv;
        if (val === '') {
            if (key === 'FILER') filers++;
            section = key;
            continue;
        }
        if (key === 'CONFORMED SUBMISSION TYPE') out.submissionType = val;
        else if (key === 'CONFORMED PERIOD OF REPORT') out.periodOfReport = isoDate(val);
        else if (key === 'FILED AS OF DATE') out.filedAsOf = isoDate(val);
        else if (key === 'DATE AS OF CHANGE') out.dateOfChange = isoDate(val);
        else if (key === 'ITEM INFORMATION') out.items.push({ code: itemCode(val), description: val });
        else if (filers > 1) continue; // co-registrants: keep the first filer only
        else if (section === 'BUSINESS ADDRESS') { if (key === 'BUSINESS PHONE') out.phone = val; else addr(key, val, out.businessAddress); }
        else if (section === 'MAIL ADDRESS') addr(key, val, out.mailAddress);
        else if (section === 'FORMER COMPANY') {
            if (key === 'FORMER CONFORMED NAME') out.formerNames.push({ name: val, changed: null });
            else if (key === 'DATE OF NAME CHANGE' && out.formerNames.length) out.formerNames[out.formerNames.length - 1].changed = isoDate(val);
        } else if (key === 'COMPANY CONFORMED NAME') out.companyName = val;
        else if (key === 'CENTRAL INDEX KEY') out.cik = String(Number(val));
        else if (key === 'STANDARD INDUSTRIAL CLASSIFICATION') {
            const m = val.match(/^(.*?)\s*\[(\d+)\]\s*$/);
            out.sic = m ? m[1] : val;
            out.sicCode = m ? m[2] : null;
        } else if (key === 'EIN' || key === 'IRS NUMBER') out.irsNumber = val;
        else if (key === 'STATE OF INCORPORATION') out.stateOfIncorporation = val;
        else if (key === 'FISCAL YEAR END') out.fiscalYearEnd = val;
        else if (key === 'SEC FILE NUMBER') out.secFileNumber = val;
        else if (key === 'FILM NUMBER') out.filmNumber = val;
    }
    for (const d of out.documents) d.url = d.filename ? `${folderUrl}${d.filename}` : null;
    return out;
}

function isoDate(v) {
    const m = String(v).match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : v;
}

// One output record from an index entry and its parsed header.
export function buildRecord(entry, h, tickers = []) {
    const primary = h.documents.find((d) => /^8-K/.test(d.type ?? '')) ?? h.documents[0] ?? null;
    const exhibits99 = h.documents.filter((d) => /^EX-99/.test(d.type ?? ''));
    return {
        cik: entry.cik,
        companyName: h.companyName ?? entry.companyName,
        tickers,
        formType: entry.formType,
        filingDate: entry.filingDate,
        periodOfReport: h.periodOfReport,
        acceptanceDateTime: h.acceptanceDateTime,
        accessionNumber: entry.accessionNumber,
        itemCodes: h.items.map((i) => i.code).filter(Boolean),
        items: h.items,
        sic: h.sic,
        sicCode: h.sicCode,
        stateOfIncorporation: h.stateOfIncorporation,
        fiscalYearEnd: h.fiscalYearEnd,
        businessAddress: h.businessAddress,
        phone: h.phone,
        secFileNumber: h.secFileNumber,
        formerNames: h.formerNames,
        primaryDocumentUrl: primary?.url ?? null,
        pressReleaseUrls: exhibits99.map((d) => d.url).filter(Boolean),
        documents: h.documents.map(({ type, sequence, filename, description, url }) => ({ type, sequence, filename, description, url })),
        filingIndexUrl: entry.filingIndexUrl,
        folderUrl: entry.folderUrl,
    };
}

// SEC's company_tickers.json -> Map(cik string -> [tickers])
export function tickerMap(json) {
    const map = new Map();
    for (const v of Object.values(json ?? {})) {
        if (!v || v.cik_str == null || !v.ticker) continue;
        const k = String(v.cik_str);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(String(v.ticker).toUpperCase());
    }
    return map;
}

// Before fetching the header: form type, CIK/ticker and name keyword filters.
// opts: { includeAmendments, cikSet (Set|null), keywords[] }
export function indexPrefilter(entry, opts = {}) {
    if (!opts.includeAmendments && entry.formType === '8-K/A') return false;
    if (opts.cikSet && !opts.cikSet.has(entry.cik)) return false;
    if (opts.keywords?.length) {
        const n = entry.companyName.toLowerCase();
        if (!opts.keywords.some((x) => n.includes(x.toLowerCase().trim()))) return false;
    }
    return true;
}

// After the header: item codes (any match), states of business address, SIC codes (prefix match).
// opts: { items[], excludeItems[], states[], sicCodes[] }
export function passesFilters(rec, opts = {}) {
    const items = (opts.items ?? []).map(normalizeItemCode).filter(Boolean);
    if (items.length && !rec.itemCodes.some((c) => items.includes(c))) return false;
    const excl = (opts.excludeItems ?? []).map(normalizeItemCode).filter(Boolean);
    if (excl.length && rec.itemCodes.length && rec.itemCodes.every((c) => excl.includes(c))) return false;
    if (opts.states?.length) {
        const s = (rec.businessAddress?.state ?? '').toUpperCase();
        if (!opts.states.map((x) => x.toUpperCase().trim()).includes(s)) return false;
    }
    if (opts.sicCodes?.length) {
        const c = rec.sicCode ?? '';
        if (!opts.sicCodes.some((x) => c && c.startsWith(String(x).trim()))) return false;
    }
    return true;
}
