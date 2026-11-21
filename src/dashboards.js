// Live, keyless aggregation against the OpenAlex works index (no stored corpus; see README).
// Pure query/parsing helpers are exported alongside the async fetchers so scripts/check.cjs
// can exercise them without a network stub.
const Dashboards = (() => {
  'use strict';
  const BASE = 'https://api.openalex.org/works';
  const journalTypes = ['article', 'review'];
  const text = v => typeof v === 'string' ? v.trim() : '';
  const countries = [['AR','Argentina'],['AU','Australia'],['AT','Austria'],['BD','Bangladesh'],['BE','Belgium'],
    ['BR','Brazil'],['CA','Canada'],['CL','Chile'],['CN','China'],['CO','Colombia'],['CZ','Czechia'],['DK','Denmark'],
    ['EG','Egypt'],['ET','Ethiopia'],['FI','Finland'],['FR','France'],['DE','Germany'],['GH','Ghana'],['GR','Greece'],
    ['HK','Hong Kong'],['HU','Hungary'],['IN','India'],['ID','Indonesia'],['IR','Iran'],['IQ','Iraq'],['IE','Ireland'],
    ['IL','Israel'],['IT','Italy'],['JP','Japan'],['JO','Jordan'],['KE','Kenya'],['MY','Malaysia'],['MX','Mexico'],
    ['MM','Myanmar'],['NP','Nepal'],['NL','Netherlands'],['NZ','New Zealand'],['NG','Nigeria'],['NO','Norway'],
    ['PK','Pakistan'],['PE','Peru'],['PH','Philippines'],['PL','Poland'],['PT','Portugal'],['QA','Qatar'],
    ['RO','Romania'],['RU','Russia'],['SA','Saudi Arabia'],['SG','Singapore'],['ZA','South Africa'],['KR','South Korea'],
    ['ES','Spain'],['LK','Sri Lanka'],['SE','Sweden'],['CH','Switzerland'],['TW','Taiwan'],['TZ','Tanzania'],
    ['TH','Thailand'],['TR','Turkey'],['UG','Uganda'],['UA','Ukraine'],['AE','United Arab Emirates'],
    ['GB','United Kingdom'],['US','United States'],['VN','Vietnam']];
  function filterString(topicQuery, extra) {
    const parts = ['title_and_abstract.search:' + text(topicQuery), 'type:' + journalTypes.join('|')];
    if (extra) parts.push(extra);
    return parts.join(',');
  }
  function yearFilter(fromYear, toYear) {
    if (!fromYear && !toYear) return '';
    return 'publication_year:' + (fromYear || 1900) + '-' + (toYear || new Date().getFullYear());
  }
  async function get(params, signal) {
    const target = new URL(BASE);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') target.searchParams.set(key, String(value));
    const response = await atlasFetch(target, signal);
    if (!response.ok) throw new Error(response.status === 429 ? 'OpenAlex rate limit reached. Try again shortly.' : 'OpenAlex returned HTTP ' + response.status + '.');
    return response.json();
  }
  // Ascending {year,count} series across the requested range; years with no works still appear as 0.
  function yearSeries(json, fromYear, toYear) {
    const byYear = new Map((json.group_by || []).map(g => [Number(g.key), g.count]).filter(([y]) => Number.isInteger(y) && y > 1000));
    if (!byYear.size) return [];
    const years = [...byYear.keys()];
    const lo = fromYear || Math.min(...years), hi = toYear || Math.max(...years);
    const out = [];
    for (let y = lo; y <= hi; y++) out.push({ year: y, count: byYear.get(y) || 0 });
    return out;
  }
  function namedGroups(json, limit) {
    return (json.group_by || []).filter(g => g.key && g.key !== 'unknown').map(g => ({ id: g.key, name: text(g.key_display_name) || g.key, count: g.count })).slice(0, limit);
  }
  function countryGroups(json, limit) {
    return (json.group_by || []).filter(g => /\/countries\//.test(g.key || '')).map(g => ({ code: g.key.split('/').pop(), name: text(g.key_display_name) || g.key, count: g.count })).slice(0, limit);
  }
  // Pairs a recent-window topic breakdown against a prior window and ranks by growth.
  function growthTable(recentJson, priorJson, limit) {
    const prior = new Map(namedGroups(priorJson, 10000).map(g => [g.id, g.count]));
    const rows = namedGroups(recentJson, 10000).filter(g => g.count >= 3).map(g => {
      const before = prior.get(g.id) || 0;
      const ratio = before === 0 ? Infinity : (g.count - before) / before;
      return { ...g, before, ratio };
    });
    rows.sort((a, b) => (b.ratio === a.ratio ? b.count - a.count : b.ratio - a.ratio));
    return rows.slice(0, limit);
  }
  function citedList(json, limit) {
    return (json.results || []).slice(0, limit).map(w => ({
      title: text(w.display_name || w.title), year: w.publication_year || 0, cited: w.cited_by_count || 0,
      journal: text(w.primary_location?.source?.display_name),
      url: text(w.primary_location?.landing_page_url) || (w.doi ? text(w.doi) : '')
    })).filter(r => r.title);
  }
  async function fetchYearCounts(topicQuery, fromYear, toYear, mailto, signal) {
    const json = await get({ filter: filterString(topicQuery, yearFilter(fromYear, toYear)), group_by: 'publication_year', 'per-page': 200, mailto }, signal);
    return { total: json.meta?.count || 0, series: yearSeries(json, fromYear, toYear) };
  }
  async function fetchCountryCounts(topicQuery, fromYear, toYear, mailto, signal, limit = 15) {
    const json = await get({ filter: filterString(topicQuery, yearFilter(fromYear, toYear)), group_by: 'authorships.countries', 'per-page': 200, mailto }, signal);
    return { total: json.meta?.count || 0, rows: countryGroups(json, limit) };
  }
  async function fetchTopTopics(topicQuery, fromYear, toYear, mailto, signal, limit = 10) {
    const json = await get({ filter: filterString(topicQuery, yearFilter(fromYear, toYear)), group_by: 'primary_topic.id', 'per-page': 200, mailto }, signal);
    return namedGroups(json, limit);
  }
  async function fetchTopJournals(topicQuery, fromYear, toYear, mailto, signal, limit = 10) {
    const json = await get({ filter: filterString(topicQuery, yearFilter(fromYear, toYear)), group_by: 'primary_location.source.id', 'per-page': 200, mailto }, signal);
    return namedGroups(json, limit);
  }
  async function fetchMostCited(topicQuery, fromYear, toYear, mailto, signal, limit = 10) {
    const json = await get({
      filter: filterString(topicQuery, yearFilter(fromYear, toYear)), sort: 'cited_by_count:desc', 'per-page': limit, mailto,
      select: 'id,display_name,title,cited_by_count,publication_year,primary_location,doi'
    }, signal);
    return citedList(json, limit);
  }
  // Fastest-growing topics: the most recent third of the range against the third before it.
  async function fetchGrowth(topicQuery, fromYear, toYear, mailto, signal, limit = 10) {
    const hi = toYear || new Date().getFullYear(), lo = fromYear || hi - 9, span = Math.max(1, Math.round((hi - lo + 1) / 3));
    const recent = { from: hi - span + 1, to: hi }, prior = { from: lo, to: lo + span - 1 };
    const [recentJson, priorJson] = await Promise.all([
      get({ filter: filterString(topicQuery, yearFilter(recent.from, recent.to)), group_by: 'primary_topic.id', 'per-page': 200, mailto }, signal),
      get({ filter: filterString(topicQuery, yearFilter(prior.from, prior.to)), group_by: 'primary_topic.id', 'per-page': 200, mailto }, signal)
    ]);
    return { recent, prior, rows: growthTable(recentJson, priorJson, limit) };
  }
  async function fetchCountrySeries(topicQuery, countryCode, fromYear, toYear, mailto, signal) {
    const json = await get({ filter: filterString(topicQuery, yearFilter(fromYear, toYear) + ',authorships.countries:' + countryCode), group_by: 'publication_year', 'per-page': 200, mailto }, signal);
    return yearSeries(json, fromYear, toYear);
  }
  return { countries, filterString, yearFilter, yearSeries, namedGroups, countryGroups, growthTable, citedList,
    fetchYearCounts, fetchCountryCounts, fetchTopTopics, fetchTopJournals, fetchMostCited, fetchGrowth, fetchCountrySeries };
})();
