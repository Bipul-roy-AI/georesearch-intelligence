// Each example DOI appears in a journal published or hosted by the named organization.
// A DOI keeps its prefix when a journal changes publisher. These are optional subsets
// of Crossref, independent of the catalog that the linked platform currently hosts.
// https://support.crossref.org/hc/en-us/articles/213022466-Transferring-titles-and-identifiers-to-a-new-owner
const publisherDirectory = [
  ['Elsevier', '10.1016', 'https://www.sciencedirect.com/', '10.1016/j.rse.2017.06.031', 'Remote Sensing of Environment'],
  ['Springer', '10.1007', 'https://link.springer.com/', '10.1007/s11869-026-01920-x', 'Air Quality, Atmosphere & Health'],
  ['Nature Portfolio', '10.1038', 'https://www.nature.com/siteindex', '10.1038/s41467-021-22702-2', 'Nature Communications'],
  ['Wiley', '10.1002', 'https://onlinelibrary.wiley.com/', '10.1002/qj.3803', 'Quarterly Journal of the Royal Meteorological Society'],
  ['Taylor & Francis', '10.1080', 'https://www.tandfonline.com/', '10.1080/13658816.2021.2004602', 'International Journal of Geographical Information Science'],
  ['Sage', '10.1177', 'https://journals.sagepub.com/', '10.1177/03091333251409690', 'Progress in Physical Geography'],
  ['Oxford University Press', '10.1093', 'https://academic.oup.com/journals/', '10.1093/ije/dyaa006', 'International Journal of Epidemiology'],
  ['Cambridge University Press', '10.1017', 'https://www.cambridge.org/core/', '10.1017/S0950268824001791', 'Epidemiology and Infection'],
  ['Copernicus Publications', '10.5194', 'https://publications.copernicus.org/open-access_journals/open_access_journals_a_z.html', '10.5194/acp-25-575-2025', 'Atmospheric Chemistry and Physics'],
  ['MDPI', '10.3390', 'https://www.mdpi.com/journal', '10.3390/ijgi14110416', 'ISPRS International Journal of Geo-Information'],
  ['Frontiers', '10.3389', 'https://www.frontiersin.org/journals', '10.3389/fpubh.2024.1429143', 'Frontiers in Public Health'],
  ['PLOS', '10.1371', 'https://plos.org/our-journals/', '10.1371/journal.pone.0107042', 'PLOS ONE'],
  ['American Meteorological Society', '10.1175', 'https://journals.ametsoc.org/', '10.1175/WCAS-D-23-0129.1', 'Weather, Climate, and Society'],
  ['American Geophysical Union', '10.1029', 'https://agupubs.onlinelibrary.wiley.com/', '10.1029/2023GL107364', 'Geophysical Research Letters']
].map(([name, prefix, url, exampleDoi, journal]) => ({
  name, prefix, url,
  group: 'Publisher collections',
  mode: 'Crossref prefix subset',
  detail: 'Search Crossref journal articles with DOI prefix ' + prefix + ', including records from ' + journal + '. Other prefixes and articles without DOIs require a wider search.',
  evidence: 'https://doi.org/' + exampleDoi
}));

const publisherAdapters = Object.fromEntries(publisherDirectory.map(({name, prefix}) => {
  const search = regionalAdapters.forCrossrefPrefix(name, prefix);
  return [name, (query, page = 1, signal) => search(query, page, signal)];
}));

