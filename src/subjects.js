// Reuse one identifier when a topic belongs to more than one subject group.
const PaperSubjects = (() => {
  const topics = new Map();
  const groups = [];
  function entry(id, label, pattern, query = label) {
    const match = new RegExp('\\b(?:' + pattern + ')\\b', 'i');
    const item = {id, label, query, match};
    topics.set(id, item);
    return item;
  }
  function group(id, label, pattern, query, rows) {
    const parent = entry(id, label, pattern, query);
    parent.children = rows.map(row => typeof row === 'string' ? topics.get(row) : entry(...row));
    groups.push(parent);
  }
  group('gis','GIS and Spatial Analysis','geospatial|gis|geographic(?:al)? information systems?|spatial science','geospatial analysis',[
    ['gis-systems','Geographic Information Systems (GIS)','gis|webgis|geographic(?:al)? information systems?|qgis|arcgis','geographic information systems'],
    ['spatial-analysis','Spatial analysis','(?:geo)?spatial analys(?:is|es|tics)|spatial autocorrelation|hot ?spot analysis|spatial clustering'],
    ['geostatistics','Geostatistics','geostatistic(?:s|al)?|(?:co)?kriging|(?:semi)?variograms?'],
    ['spatial-modelling','Spatial modelling','(?:geo)?spatial model(?:s|l?ing|l?ed)?|spatial regression|geographically weighted regression'],
    ['spatial-epi','Spatial epidemiology','(?:geo)?spatial epidemiolog(?:y|ic|ical)|geographical epidemiology|(?:geo)?spatial distribution of disease'],
    ['geo-data','Geospatial data science','(?:geo)?spatial data science|geographic data science|geospatial data analytics']
  ]);
  group('sensing','Remote Sensing','remote(?:ly)? sens(?:ing|ed)|earth observations?','remote sensing',[
    ['satellite','Satellite remote sensing','satellite (?:remote sensing|imag(?:e|es|ery|ing)|observations?|data)|satellite based|landsat|sentinel [12356]|modis|tropomi|viirs'],
    ['spectral','Hyperspectral and multispectral imagery','hyperspectral|multispectral','hyperspectral multispectral imagery'],
    ['sar','SAR and InSAR','synthetic aperture radar|interferometric sar|insar|dinsar|polsar|sar (?:imagery|data|images?|interferometry)|(?:polarimetric|spaceborne) sar','synthetic aperture radar'],
    ['lidar','LiDAR','lidar|light detection and ranging|laser scanning','LiDAR'],
    ['uav','UAV and drone remote sensing','uavs?|drones?|un(?:crewed|manned) aerial (?:systems?|vehicles?)','UAV remote sensing'],
    ['land-cover','Land-use/land-cover change','(?:land use|land cover)(?: land cover)? (?:changes?|dynamics|transitions?|change detection)|lulcc|lulc change','land cover change'],
    ['vegetation','Vegetation and forest monitoring','vegetation (?:indices|index|monitoring|dynamics)|forest (?:cover|monitoring|loss|disturbance)|deforestation|ndvi','vegetation monitoring']
  ]);
  group('ai','GeoAI and Machine Learning','artificial intelligence|machine learning|geoai','geospatial machine learning',[
    ['ml','Machine learning','machine learning|random forests?|gradient boost(?:ing|ed)|support vector machines?|deep learning|xgboost'],
    ['dl','Deep learning','deep learning|deep neural networks?|convolutional neural networks?|vision transformers?|u net'],
    ['vision','Computer vision','computer vision|image segmentation|object detection|semantic segmentation'],
    ['xai','Explainable AI','explainable (?:artificial intelligence|ai|machine learning)|interpretable machine learning|xai|shapley additive explanations','explainable artificial intelligence'],
    ['foundations','Geospatial foundation models','(?:earth observation|(?:geo)?spatial|remote sensing) foundation models?|foundation models? for (?:earth observation|remote sensing|geospatial)','geospatial foundation models'],
    ['geoai','GeoAI','geo ?ai|geospatial (?:artificial intelligence|machine learning)','geospatial artificial intelligence'],
    ['spatiotemporal','Spatiotemporal prediction','spatio ?temporal (?:predict(?:ion|ions|ing|ive)|forecast(?:ing|s)?)|(?:predicting|forecasting) spatio ?temporal']
  ]);
  group('health','Public Health and Geospatial Analysis','public health|population health|geohealth|geospatial health|environmental epidemiology','geospatial public health',[
    'spatial-epi',
    ['disease-mapping','Disease mapping','disease (?:risk )?(?:mapping|maps?)|mapping (?:of )?(?:disease|malaria|dengue|cholera|cancer)|disease risk maps?'],
    ['health-access','Health accessibility','(?:spatial )?access(?:ibility)? to (?:health ?care|health services|hospitals|clinics)|(?:health ?care|hospital|health service|health) access(?:ibility)?','spatial accessibility to healthcare'],
    ['environmental-health','Environmental health','environmental health|environmental epidemiology|environmental exposure(?:s)? and health'],
    ['climate-disease','Climate-sensitive diseases','climate sensitive (?:infectious )?diseases?|climate sensitive infections?','climate sensitive disease'],
    ['pollution-health','Air pollution and human health','air pollution and (?:human |public )?health|health (?:effects?|impacts?|risks?) of air pollution','air pollution health effects'],
    ['vector','Vector-borne diseases','vector borne (?:diseases?|infections?)|mosquito borne|malaria|dengue|chikungunya|lyme disease|west nile virus','vector borne disease'],
    ['inequality','Health inequality and spatial vulnerability','health (?:inequalit(?:y|ies)|inequit(?:y|ies)|disparit(?:y|ies))|spatial vulnerability|spatial health disparities','health inequalities spatial vulnerability']
  ]);
  group('geography','Geography and Human–Environment Interaction','geograph(?:y|ies)|human environment interactions?','geography human environment',[
    ['human-geog','Human geography','human geograph(?:y|ies)|cultural geography|social geography'],
    ['physical-geog','Physical geography','physical geography|geomorpholog(?:y|ical)|biogeograph(?:y|ical)'],
    ['urban-geog','Urban geography','urban geograph(?:y|ies)|urban morphology|urban spatial structure'],
    ['population','Population geography','population geograph(?:y|ies)|population (?:distribution|mapping)|mapping population|gridded population'],
    ['human-environment','Human–environment interaction','human (?:environment|environmental|nature) interactions?|human environment relations?|coupled human (?:and )?natural systems','human environment interaction'],
    ['climate-society','Climate change and society','climate change and society|social (?:dimensions?|impacts?) of climate change|societal impacts? of climate change','climate change and society'],
    ['env-vulnerability','Environmental vulnerability','environmental vulnerability|ecological vulnerability'],
    ['disaster','Disaster risk and resilience','disaster (?:risk|resilience)|(?:flood|wildfire|landslide|seismic) (?:risk|exposure|susceptibility|resilience)|expos(?:ed|ure) to floods','disaster risk resilience']
  ]);
  group('climate','Atmosphere and Climate Science','atmospher(?:e|ic science)|climatology|climate change|climate science','atmospheric climate science',[
    ['atmos-model','Atmospheric modelling','atmospher(?:ic|e) model(?:s|l?ing)?|weather research and forecasting|numerical weather prediction'],
    ['air','Air quality','air quality|air pollution|atmospheric pollution|ambient particulate matter|pm2 5|pm 2 5'],
    ['climate-model','Climate modelling','climate model(?:s|l?ing)?|climate projections?|general circulation models?|cmip[356]'],
    ['aerosol','Aerosol studies','aerosols?|aerosol optical depth','atmospheric aerosols'],
    ['heat','Urban heat islands','urban heat islands?|surface urban heat islands?|urban heat island effect','urban heat island'],
    ['precip','Precipitation and drought','precipitation|droughts?|rainfall','precipitation drought'],
    ['climate-impact','Climate change impacts','climate change impacts?|(?:impacts?|effects?|consequences?) of (?:future )?climate change','climate change impacts']
  ]);
  group('hydrology','Hydrology, Hydraulics and Groundwater','hydrolog(?:y|ic|ical)|hydraulic(?:s|ally)?|groundwater|water resources','hydrology hydraulics groundwater modelling',[
    ['hydro-model','Hydrological and watershed modelling','hydrolog(?:ical|ic)? model(?:s|l?ing|l?ed)?|rainfall ?runoff model(?:s|l?ing)?|swat model|hec ?hms|watershed model(?:s|l?ing)?','hydrological watershed modelling'],
    ['hydraulic-model','Hydraulic and hydrodynamic modelling','hydraulic model(?:s|l?ing|l?ed)?|hydrodynamic model(?:s|l?ing|l?ed)?|1d ?2d (?:coupled )?model(?:s|l?ing)?|hec ?ras|mike ?(?:11|21|flood|fm)','hydraulic hydrodynamic modelling'],
    ['groundwater','Groundwater hydrology and modelling','groundwater (?:flow|hydrology|modell?ing|recharge|level|depletion)|aquifers?|modflow','groundwater hydrology modelling'],
    ['flood-model','Flood inundation modelling','flood (?:inundation|simulation)|flood model(?:s|l?ing|l?ed)|inundation model(?:s|l?ing|l?ed)|flood extent mapping','flood inundation modelling'],
    ['watershed','Watershed and catchment hydrology','watershed hydrology|catchment hydrology|basin hydrology|watershed delineation|catchment (?:characteristics|analysis)','watershed catchment hydrology'],
    ['river-hydraulics','River and surface water hydraulics','river hydraulics|open channel (?:flow|hydraulics)|fluvial hydraulics|channel morphology|surface water hydraulics','river surface water hydraulics'],
    ['water-resources','Water resources management','water resources (?:management|planning|assessment|availability)|integrated water resources management|iwrm','water resources management'],
    ['water-quality','Water quality modelling','water quality model(?:s|l?ing|l?ed)|surface water quality|river water quality|pollutant transport model(?:s|l?ing)','water quality modelling']
  ]);

  function valid(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter(id => topics.has(id)))];
  }
  function expanded(ids) {
    const set = new Set(ids);
    for (const group of groups) if (group.children.some(t => set.has(t.id))) set.add(group.id);
    return set;
  }
  function infer(record) {
    const text = [record.title, record.topic, ...(record.keywords || [])].filter(Boolean).join(' | ');
    const normalized = Atlas.norm(text);
    const found = [...topics.values()].filter(t => t.match.test(normalized)).map(t => t.id);
    const words = new Set(found);
    if ((words.has('air') || /\bairborne particulate matter\b/.test(normalized)) &&
        /\b(?:mortality|morbidity|asthma|cardiovascular|respiratory|human health|public health|health effects|health outcomes)\b/.test(normalized)) found.push('pollution-health');
    if (/\bSAR\b/.test(text) && /\b(?:radar|satellite|sentinel 1|remote sensing|backscatter)\b/.test(normalized)) found.push('sar');
    if (words.has('ml') && /\b(?:geospatial|geographic artificial intelligence)\b/.test(normalized)) found.push('geoai');
    return valid(found);
  }
  // A child implies all its parents. Display a broad label when no child supplies it.
  function compact(ids) {
    const set = new Set(ids);
    return valid(ids).filter(id => !topics.get(id).children?.some(t => set.has(t.id)));
  }
  function effective(record) { return record.assignedSubjects ?? record.inferredSubjects ?? []; }
  function matches(ids, selected, mode) {
    const subjects = expanded(ids);
    if (!selected.length) return true;
    const hit = id => id === 'unclassified' ? subjects.size === 0 : subjects.has(id);
    return mode === 'all' ? selected.every(hit) : selected.some(hit);
  }
  return {topics, groups, valid, expanded, compact, infer, effective, matches};
})();
