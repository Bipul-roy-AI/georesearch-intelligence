const builtinRanks = (() => {
  const ranks = [];
  function add(issns, id, category, values) {
    for (const [year, quartile] of Object.entries(values)) {
      ranks.push({issns:issns.split(','), system:'SJR', category, year:Number(year), quartile,
        url:'https://www.scimagojr.com/journalsearch.php?q='+id+'&tip=sid'});
    }
  }
  add('1680-7316,1680-7324','12091','Atmospheric Science',{2024:'Q1',2025:'Q1'});
  add('2052-4463','21100451321','Information Systems',{2024:'Q1',2025:'Q1'});
  add('0028-0836,1476-4687','21206','Multidisciplinary',{2025:'Q1'});
  add('2471-1403','21100924773','Epidemiology',{2024:'Q1',2025:'Q1'});
  add('2471-1403','21100924773','Global and Planetary Change',{2024:'Q2',2025:'Q1'});
  add('2471-1403','21100924773','Public Health, Environmental and Occupational Health',{2024:'Q1',2025:'Q1'});
  add('1361-1682,1467-9671','13178','Earth and Planetary Sciences (miscellaneous)',{2024:'Q2',2025:'Q2'});
  add('1948-660X','21100332424','Computers in Earth Sciences',{2024:'Q3',2025:'Q3'});
  add('1948-660X','21100332424','Information Systems',{2024:'Q3',2025:'Q3'});
  add('1948-660X','21100332424','Geography, Planning and Development',{2024:'Q3',2025:'Q2'});
  add('0102-7786,1982-4351','21100242263','Atmospheric Science',{2024:'Q4',2025:'Q4'});
  add('1827-1987,1970-7096','12400154713','Geography, Planning and Development',{2024:'Q2',2025:'Q2'});
  add('1827-1987,1970-7096','12400154713','Health Policy',{2024:'Q3',2025:'Q3'});
  add('2366-3286,2366-3294','21101022415','Artificial Intelligence',{2024:'Q3',2025:'Q2'});
  add('2366-3286,2366-3294','21101022415','Computers in Earth Sciences',{2024:'Q2',2025:'Q2'});
  return ranks;
})();
