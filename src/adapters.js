// Keyless, read-only journal search. Each open link is tied to an article-level source.
const baseAdapters = (() => {
  "use strict";
  const size = 20;
  const epmcCursors = new Map();
  const journalTypes = ["article", "review", "data-paper", "software-paper"];
  const asArray = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === "string" ? value.trim() : "";
  const plain = value => text(value).replace(/<\/?[\w:-]+(?:\s[^<>]*)?>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  function url(value) {
    try {
      const parsed = new URL(value);
      return /^(http|https):$/.test(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : "";
    } catch { return ""; }
  }
  function normalizeDoi(value) {
    let identifier = text(value).replace(/^doi:\s*/i, "");
    if (/^https?:\/\/(?:dx\.)?doi\.org\//i.test(identifier)) {
      try { identifier = decodeURIComponent(new URL(identifier).pathname.slice(1)); }
      catch { return ""; }
    }
    return /^10\.\d{4,9}\/\S+$/i.test(identifier) ? identifier.toLowerCase() : "";
  }
  function doiUrl(doi) {
    return doi ? "https://doi.org/" + doi.split("/").map(encodeURIComponent).join("/") : "";
  }
  function issn(value) {
    const found = text(value).match(/^(?:issn\s*:?\s*)?(\d{4})-?(\d{3}[\dX])$/i);
    return found ? (found[1] + "-" + found[2]).toUpperCase() : "";
  }
  function record(source, fields) {
    const doi = normalizeDoi(fields.doi);
    const openUrl = url(fields.openUrl);
    const authorList = asArray(fields.authorList).map(plain).filter(Boolean);
    return {
      title: plain(fields.title), doi, journal: plain(fields.journal), year: /^\d{4}$/.test(String(fields.year)) ? Number(fields.year) : null,
      authors: plain(fields.authors) || authorList.join("; "), authorList, openUrl, accessSource: openUrl ? text(fields.accessSource) : "",
      issns: [...new Set(asArray(fields.issns).map(issn).filter(Boolean))], keywords:asArray(fields.keywords).map(plain).filter(Boolean), source,
      publisherUrl: url(fields.publisherUrl) || doiUrl(doi), recordUrl: url(fields.recordUrl)
    };
  }
  async function get(base, params, signal) {
    const target = new URL(base);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") target.searchParams.set(key, String(value));
    }
    const response = await atlasFetch(target,signal);
    if (!response.ok) {
      throw new Error(response.status === 429 ? "Rate limit reached. Try again later." : "Provider returned HTTP " + response.status + ".");
    }
    return response.json();
  }
  function pageResults(items, rawCount, page, total, cap = 10000) {
    const seen = page * size;
    return {items: items.filter(item => item.title), more: rawCount >= size && seen < total && seen + size <= cap};
  }
  function joinNames(names) { return names.map(text).filter(Boolean).join(", "); }
  function quoteTerm(value) { return '"' + value.replace(/["\\]/g, char => "\\" + char) + '"'; }
  function publishedLocation(location) {
    if (!location || location.is_oa !== true || location.version === "submittedVersion") return false;
    return location.source?.type === "journal" || location.version === "publishedVersion" || location.version === "acceptedVersion";
  }
  function preprintUrl(value) {
    const href = url(value);
    if (!href) return true;
    const host = new URL(href).hostname;
    return /(?:^|\.)(?:arxiv\.org|biorxiv\.org|medrxiv\.org|researchsquare\.com|ssrn\.com|preprints\.org|eartharxiv\.org|egusphere\.net)$/.test(host);
  }
  function currentOpenPublisherLicence(licence) {
    if (licence["content-version"] !== "vor" || !url(licence.URL)) return false;
    const granted = new URL(licence.URL);
    const effective = Date.parse(licence.start?.["date-time"] || "");
    return granted.hostname === "creativecommons.org"
      && /^\/(?:licenses\/by(?:-(?:nc|nd|sa))*\/\d\.\d|publicdomain\/(?:zero|mark)\/1\.0)\/?$/i.test(granted.pathname)
      && Number.isFinite(effective) && effective <= Date.now();
  }
  async function crossref(query, page, signal) {
    const serial = issn(query);
    const exact = normalizeDoi(query);
    const data = await get("https://api.crossref.org/works", {
      "query.bibliographic": serial || exact ? undefined : query,
      filter: "type:journal-article" + (serial ? ",issn:" + serial : "") + (exact ? ",doi:" + exact : ""),
      rows: size, offset: (page - 1) * size,
      select: "DOI,title,author,container-title,published,issued,ISSN,URL,license,type"
    }, signal);
    const rows = data.message.items;
    const items = rows.filter(row => row.type === "journal-article").map(row => record("Crossref", {
      title: row.title?.[0], doi: row.DOI, journal: row["container-title"]?.[0],
      year: (row.published || row.issued)?.["date-parts"]?.[0]?.[0], issns: row.ISSN,
      authors: joinNames(asArray(row.author).map(a => a.name || [a.given, a.family].filter(Boolean).join(" "))),
      authorList: asArray(row.author).map(a => a.name || [a.family, a.given].filter(Boolean).join(", ")),
      publisherUrl: row.URL,
      openUrl: asArray(row.license).some(currentOpenPublisherLicence) ? doiUrl(normalizeDoi(row.DOI)) : "",
      accessSource: "Crossref · publisher-deposited open licence for the published version",
      recordUrl: row.DOI ? "https://api.crossref.org/works/" + encodeURIComponent(row.DOI) : ""
      // Crossref full-text URL and licence fields may refer to machine mining or future rights.
    }));
    return pageResults(items, rows.length, page, data.message["total-results"]);
  }
  async function openalex(query, page, signal) {
    const serial = issn(query);
    const exact = normalizeDoi(query);
    const result = await get("https://api.openalex.org/works", {
      search: serial || exact ? undefined : query,
      filter: "type:" + journalTypes.join("|") + ",primary_location.source.type:journal"
        + (serial ? ",primary_location.source.issn:" + serial : "") + (exact ? ",doi:" + (exact.includes(",") ? quoteTerm(exact) : exact) : ""),
      page, per_page: size,
      select: "id,doi,title,type,publication_year,authorships,primary_location,best_oa_location,locations,keywords"
    }, signal);
    const rows = result.results;
    const items = rows.filter(row => journalTypes.includes(row.type) && row.primary_location?.source?.type === "journal").map(row => {
      const primary = row.primary_location;
      const candidate = [row.best_oa_location, primary, ...asArray(row.locations)].filter(publishedLocation).map(loc => {
        const href = [loc.landing_page_url, loc.pdf_url].find(link => !preprintUrl(link));
        return href ? {href, loc} : null;
      }).find(Boolean);
      const version = candidate?.loc.version;
      const evidence = version === "acceptedVersion" ? "accepted manuscript" : version === "publishedVersion" ? "published version" : "publisher copy";
      return record("OpenAlex", {title: row.title, doi: row.doi, journal: primary.source.display_name,
        keywords:asArray(row.keywords).map(k=>k.display_name), year: row.publication_year, authors: joinNames(asArray(row.authorships).map(a => a.author?.display_name)),
        authorList: asArray(row.authorships).map(a => a.author?.display_name),
        issns: [primary.source.issn_l, ...asArray(primary.source.issn)], openUrl: candidate?.href,
        accessSource: "OpenAlex · " + evidence, publisherUrl: primary.landing_page_url, recordUrl: row.id});
    });
    return pageResults(items, rows.length, page, result.meta.count);
  }
  async function europePmc(query, page, signal) {
    const serial = issn(query);
    const exact = normalizeDoi(query);
    const terms = serial ? "ISSN:" + serial : exact ? "DOI:" + quoteTerm(exact) : "(" + query + ")";
    const search = terms + ' AND (PUB_TYPE:"Journal Article" OR PUB_TYPE:"Review") NOT SRC:PPR';
    let cursors = epmcCursors.get(search);
    if (page === 1 || !cursors) {
      if (epmcCursors.size >= 50) epmcCursors.delete(epmcCursors.keys().next().value);
      cursors = new Map([[1, "*"]]);
      epmcCursors.set(search, cursors);
    }
    const cursor = cursors.get(page);
    if (!cursor) throw new Error("Repeat the search to resume Europe PMC paging.");
    const result = await get("https://www.ebi.ac.uk/europepmc/webservices/rest/search", {
      query: search, format: "json", resultType: "core", pageSize: size, cursorMark: cursor
    }, signal);
    const rows = result.resultList.result || [];
    const items = rows.filter(row => row.source !== "PPR" && (row.journalInfo?.journal?.title || row.journalTitle)
        && !(asArray(row.pubTypeList?.pubType).some(t => /^preprint$/i.test(t)))).map(row => {
      const journal = row.journalInfo?.journal || {};
      const links = asArray(row.fullTextUrlList?.fullTextUrl);
      const free = links.filter(link => ["OA", "F", "U"].includes(link.availabilityCode) && !preprintUrl(link.url));
      const article = free.find(link => /^html$/i.test(link.documentStyle)) || free[0];
      const publisher = links.find(link => /^publisher$/i.test(text(link.site)) && /^html$/i.test(text(link.documentStyle)));
      return record("Europe PMC", {title: row.title, doi: row.doi, journal: journal.title || row.journalTitle, year: row.pubYear || text(row.firstPublicationDate).slice(0,4),
        keywords:asArray(row.keywordList?.keyword),authors: row.authorString, issns: [journal.issn, journal.essn], openUrl: article?.url,
        authorList: asArray(row.authorList?.author).map(a => a.collectiveName || [a.lastName, a.firstName || a.initials].filter(Boolean).join(", ") || a.fullName),
        accessSource: article?.availabilityCode === "OA" ? "Europe PMC · open access" : "Europe PMC · free to read",
        publisherUrl: publisher?.url, recordUrl: row.id && row.source ? "https://europepmc.org/article/" + encodeURIComponent(row.source) + "/" + encodeURIComponent(row.id) : ""});
    });
    const more = Boolean(rows.length && result.nextCursorMark && result.nextCursorMark !== cursor && page * size < Number(result.hitCount));
    if (more) cursors.set(page + 1, result.nextCursorMark);
    return {items: items.filter(item => item.title), more};
  }
  async function doaj(query, page, signal) {
    const serial = issn(query);
    const exact = normalizeDoi(query);
    // DOAJ documents article searches against its canonical index.issn.exact and index.doi.exact fields.
    const term = serial ? "index.issn.exact:" + quoteTerm(serial) : exact ? "index.doi.exact:" + quoteTerm(exact) : query;
    const result = await get("https://doaj.org/api/search/articles/" + encodeURIComponent(term), {page, pageSize: size}, signal);
    const rows = result.results;
    const items = rows.filter(row => row.bibjson?.journal?.title).map(row => {
      const data = row.bibjson;
      const identifiers = asArray(data.identifier);
      const links = asArray(data.link).filter(link => link.type === "fulltext" && !preprintUrl(link.url));
      const full = links.find(link => /^html$/i.test(text(link.content_type))) || links[0];
      const doi = identifiers.find(entry => entry.type === "doi")?.id;
      return record("DOAJ", {title: data.title, doi, journal: data.journal.title, year: data.year,
        keywords:asArray(data.keywords),authors: joinNames(asArray(data.author).map(a => a.name)),
        authorList: asArray(data.author).map(a => a.name),
        issns: [...asArray(data.journal.issns), ...identifiers.filter(entry => /^(?:e|p)?issn$/i.test(entry.type)).map(entry => entry.id)],
        openUrl: full?.url, accessSource: "DOAJ · article full text", publisherUrl: doiUrl(normalizeDoi(doi)),
        recordUrl: row.id ? "https://doaj.org/article/" + encodeURIComponent(row.id) : ""});
    });
    return pageResults(items, rows.length, page, result.total, 1000);
  }
  async function openaire(query, page, signal) {
    if (issn(query)) throw new Error("OpenAIRE has no documented journal ISSN filter. Use keywords here.");
    const exact = normalizeDoi(query);
    const result = await get("https://api.openaire.eu/graph/v4/research-products", {
      search: exact ? undefined : query,
      filter: "type:publication,instance_type:Article" + (exact ? ",ids.doi:" + exact : ""), page, page_size: size
    }, signal);
    const rows = result.results;
    const items = rows.filter(row => row.container?.name && !row.container.conferencePlace && !row.container.conferenceDate).map(row => {
      const instances = asArray(row.instances).filter(instance => /^article$/i.test(text(instance.type)));
      const openInstance = instances.map(instance => {
        const rights = instance.accessRight || {};
        if (rights.code !== "c_abf2" && !/^(?:open|open access)$/i.test(text(rights.label))) return null;
        const href = asArray(instance.urls).find(link => !preprintUrl(link));
        return href ? {href, instance} : null;
      }).find(Boolean);
      const dois = asArray(row.pids).filter(id => id.scheme === "doi").map(id => normalizeDoi(id.value)).filter(Boolean);
      const doi = exact && dois.includes(exact) ? exact : dois[0];
      return record("OpenAIRE", {title: row.mainTitle, doi, journal: row.container.name, year: text(row.publicationDate).slice(0,4),
        authors: joinNames(asArray(row.authors).map(a => a.fullName)), issns: [row.container.issnPrinted, row.container.issnOnline, row.container.issnLinking],
        authorList: asArray(row.authors).map(a => [a.surname, a.name].filter(Boolean).join(", ") || a.fullName),
        openUrl: openInstance?.href, accessSource: "OpenAIRE Graph · open article location",
        recordUrl: row.id ? "https://explore.openaire.eu/search/result?id=" + encodeURIComponent(row.id) : ""});
    });
    return pageResults(items, rows.length, page, result.header.numFound);
  }
  function withIdentifiers(search) {
    return async (query, page = 1, signal) => {
      const doi = normalizeDoi(query);
      if (doi && page > 1) return {items: [], more: false};
      const result = await search(query, page, signal);
      if (doi) return {items: result.items.filter(item => item.doi === doi), more: false};
      const serial = issn(query);
      if (serial) result.items = result.items.filter(item => item.issns.includes(serial));
      return result;
    };
  }
  return Object.fromEntries(Object.entries({"Crossref": crossref, "OpenAlex": openalex, "Europe PMC": europePmc, "DOAJ": doaj, "OpenAIRE": openaire})
    .map(([name, search]) => [name, withIdentifiers(search)]));
})();
