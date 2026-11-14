// Historical reference only. Fictional vehicle dynamics and assets are defined separately.
// Season/chassis associations are indexed against F1DB v2026.20.0 (CC BY 4.0).
// Formula 1's season results corroborate participation, not unpublished technical figures.
const INDEX = 'https://github.com/f1db/f1db/releases/tag/v2026.20.0';
const RESULTS = 'https://www.formula1.com/en/results/';
const FIA_2026_TECHNICAL = 'https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_21_-_2026-10-19.pdf';
const FIA_2026_SPORTING = 'https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_09_-_2026-10-01.pdf';
const FIA_2026_TERMS = 'https://corp.formula1.com/f1-2026-regulations-terminology-update/';
const FIA_HISTORIC = 'https://www.fia.com/sites/default/files/appendix_k_2025_2.pdf';
const LOTUS = 'https://www.lotuscars.com/en-GB/lotus-story/about-lotus?channel=app';
const WILLIAMS = 'https://www.williamsf1.com/articles/29f7b359-e78b-447f-8033-69a923721d6f/riccardo-patrese-reunites-with-williams-icons';
const FERRARI = 'https://www.ferrari.com/content/dam/ferrari-fcom/old/pdf/pr_90_years_eng_fin.pdf';
const EARLY_AERO = 'https://www.formula1.com/en/latest/article/re-writing-the-f1-rule-book-part-1-from-wing-cars-to-flat-bottoms.EJZ73Lnn0c6EgcMKMAWOU';
const EXPERIMENTS = 'https://www.formula1.com/en/latest/article/from-the-six-wheeled-tyrrell-to-the-dual-rear-wing-ferrari-10-of-the.1uvMU2qhHxAphWRhgjxwCj';
const MERCEDES_ERAS = 'https://www.mercedesamgf1.com/news/the-past-six-new-f1-eras-what-changed-and-what-happened';
const RULE_CHANGES = 'https://www.formula1.com/en/latest/article/the-key-regulation-changes-in-f1-history-and-the-teams-that-nailed-them.2iq8c5E6S1HOffT5PBLl6i';

export const HISTORY_ERAS = [
  { id:'birth', from:1947, to:1953, title:'The birth of formula racing', summary:'Post-war formula racing preceded the 1950 World Championship. In 1952 and 1953 the championship Grands Prix used Formula 2 rules, with Indianapolis retaining its own rules.', source:FIA_HISTORIC },
  { id:'classic', from:1954, to:1960, title:'Classic Grand Prix machines', summary:'The 2.5-litre era encompassed both front-mounted and rear-mounted engines. Enclosed wheel streamlining was a specialized option at high-speed tracks.', source:'https://group.mercedes-benz.com/company/tradition/company-history/history-aerodynamic.html' },
  { id:'lightweight', from:1961, to:1967, title:'The lightweight revolution', summary:'Rear-engine packaging and stressed-skin monocoques marked the 1.5-litre period. The naturally aspirated displacement ceiling increased to 3 litres in 1966.', source:LOTUS },
  { id:'wings', from:1968, to:1976, title:'The aerodynamic revolution', summary:'Wings, wedge bodies and revised radiator placement changed how teams generated and packaged aerodynamic grip.', source:LOTUS },
  { id:'ground_effect', from:1977, to:1982, title:'Ground effect and early turbo power', summary:'Underbody tunnels and skirts increased aerodynamic load. The same period saw early turbo competition and the arrival of carbon composite monocoques.', source:EARLY_AERO },
  { id:'turbo', from:1983, to:1988, title:'The turbo years', summary:'Flat-bottom rules changed aerodynamic design. Turbo output depended on the car, session and year, and late-era limits constrained boost pressure and fuel.', source:EARLY_AERO },
  { id:'electronics', from:1989, to:1997, title:'Naturally aspirated power and electronics', summary:'The post-turbo field included V8, V10 and V12 engines. Some teams used active suspension before its prohibition for 1994.', source:RULE_CHANGES },
  { id:'v10', from:1998, to:2005, title:'High-revving V10s', summary:'The 1998 rules brought narrower cars and grooved dry tyres. High-revving naturally aspirated V10s became the dominant engine configuration.', source:RULE_CHANGES },
  { id:'v8', from:2006, to:2013, title:'V8s and advanced aerodynamics', summary:'The main engine formula became 2.4-litre V8. Slicks and optional KERS arrived in 2009, and DRS entered competition in 2011.', source:MERCEDES_ERAS },
  { id:'hybrid', from:2014, to:2016, title:'The turbo-hybrid revolution', summary:'The power unit paired a turbocharged 1.6-litre V6 with kinetic and turbo-shaft energy recovery. Energy and fuel use became central to race strategy.', source:MERCEDES_ERAS },
  { id:'wide_hybrid', from:2017, to:2021, title:'Wide, high-downforce hybrids', summary:'Wider bodies and tyres arrived in 2017. The Halo became mandatory in 2018 while the turbo-hybrid power unit formula continued.', source:MERCEDES_ERAS },
  { id:'modern_floor', from:2022, to:2025, title:'Modern ground effect', summary:'Underfloor tunnels returned as a major downforce source. The new 18-inch wheels changed tyre construction and aerodynamic packaging.', source:MERCEDES_ERAS },
  { id:'active_aero', from:2026, to:2026, title:'Active aerodynamics and electrical strategy', summary:'Front and rear wing adjustment, a larger electrical contribution and removal of the MGU-H changed the balance of mechanical and electrical power. Straight and Corner modes control aerodynamic configuration. Boost, Overtake and Recharge address energy use under separate rules.', source:FIA_2026_TECHNICAL },
];

export const HISTORY_RULES_2026 = {
  verified: '2026-11-13',
  technicalIssue: 21,
  sportingIssue: 9,
  sources: [FIA_2026_TECHNICAL, FIA_2026_SPORTING, FIA_2026_TERMS],
  facts: [
    'The ERS-K absolute electrical DC limit is 350 kW. The propulsion limit also depends on speed and mode, with specified Race or Sprint power-limited sectors subject to lower curves (C5.2.7–8).',
    'Driver-adjustable bodywork is restricted to authorized activation zones and has a partial-activation provision for Low Grip Conditions (B7.1).',
    'In Low Grip Conditions, Boost may only prevent a reduction in maximum driver power demand. Overtake is disabled (B7.2).',
    'The FIA supplies competition-specific energy and activation parameters. The 350 kW limit is a ceiling, not a constant wheel-power figure.',
  ],
};

// The chassis identifiers allow every selection to be checked against the dated entry index.
const SEASONS = [
  [1950, 'alfa_158_1950', 'alfa-romeo-158', 'Alfa Romeo 158', 'Alfa Romeo'],
  [1951, 'alfa_159_1951', 'alfa-romeo-159', 'Alfa Romeo 159', 'Alfa Romeo'],
  [1952, 'ferrari_500_1952', 'ferrari-500', 'Ferrari 500 F2', 'Ferrari'],
  [1953, 'ferrari_500_1953', 'ferrari-500', 'Ferrari 500 F2', 'Ferrari'],
  [1954, 'mercedes_w196_streamlined_1954', 'mercedes-w196', 'Mercedes-Benz W 196 R Streamliner', 'Mercedes'],
  [1955, 'mercedes_w196_open_1955', 'mercedes-w196', 'Mercedes-Benz W 196 R Open Wheel', 'Mercedes'],
  [1956, 'ferrari_d50_1956', null, 'Ferrari D50', 'Ferrari'],
  [1957, 'maserati_250f_1957', 'maserati-250f', 'Maserati 250F', 'Maserati'],
  [1958, 'vanwall_vw5_1958', 'vanwall-vw-5', 'Vanwall VW5', 'Vanwall'],
  [1959, 'cooper_t51_1959', 'cooper-t51', 'Cooper T51', 'Climax'],
  [1960, 'lotus_18_1960', 'lotus-18', 'Lotus 18', 'Climax'],
  [1961, 'ferrari_156_1961', 'ferrari-156', 'Ferrari 156', 'Ferrari'],
  [1962, 'lotus_25_1962', 'lotus-25', 'Lotus 25', 'Climax'],
  [1963, 'lotus_25_1963', 'lotus-25', 'Lotus 25', 'Climax'],
  [1964, 'ferrari_158_1964', 'ferrari-158', 'Ferrari 158', 'Ferrari'],
  [1965, 'honda_ra272_1965', 'honda-ra272', 'Honda RA272', 'Honda'],
  [1966, 'brabham_bt19_1966', 'brabham-bt19', 'Brabham BT19', 'Repco'],
  [1967, 'lotus_49_1967', 'lotus-49', 'Lotus 49', 'Ford Cosworth'],
  [1968, 'lotus_49b_1968', 'lotus-49b', 'Lotus 49B', 'Ford Cosworth'],
  [1969, 'matra_ms80_1969', 'matra-ms80', 'Matra MS80', 'Ford Cosworth'],
  [1970, 'lotus_72_1970', 'lotus-72c', 'Lotus 72', 'Ford Cosworth'],
  [1971, 'tyrrell_003_1971', 'tyrrell-003', 'Tyrrell 003', 'Ford Cosworth'],
  [1972, 'lotus_72d_1972', 'lotus-72d', 'Lotus 72D', 'Ford Cosworth'],
  [1973, 'mclaren_m23_1973', 'mclaren-m23', 'McLaren M23', 'Ford Cosworth'],
  [1974, 'brabham_bt44_1974', 'brabham-bt44', 'Brabham BT44', 'Ford Cosworth'],
  [1975, 'ferrari_312t_1975', 'ferrari-312t', 'Ferrari 312T', 'Ferrari'],
  [1976, 'tyrrell_p34_1976', 'tyrrell-p34', 'Tyrrell P34', 'Ford Cosworth'],
  [1977, 'lotus_78_1977', 'lotus-78', 'Lotus 78', 'Ford Cosworth'],
  [1978, 'lotus_79_1978', 'lotus-79', 'Lotus 79', 'Ford Cosworth'],
  [1979, 'ferrari_312t4_1979', 'ferrari-312t4', 'Ferrari 312T4', 'Ferrari'],
  [1980, 'williams_fw07b_1980', 'williams-fw07b', 'Williams FW07B', 'Ford Cosworth'],
  [1981, 'mclaren_mp4_1_1981', 'mclaren-mp4-1', 'McLaren MP4/1', 'Ford Cosworth'],
  [1982, 'renault_re30b_1982', 'renault-re30b', 'Renault RE30B', 'Renault'],
  [1983, 'brabham_bt52_1983', 'brabham-bt52', 'Brabham BT52', 'BMW'],
  [1984, 'mclaren_mp4_2_1984', 'mclaren-mp4-2', 'McLaren MP4/2', 'TAG Porsche'],
  [1985, 'lotus_97t_1985', 'lotus-97t', 'Lotus 97T', 'Renault'],
  [1986, 'williams_fw11_1986', 'williams-fw11', 'Williams FW11', 'Honda'],
  [1987, 'williams_fw11b_1987', 'williams-fw11b', 'Williams FW11B', 'Honda'],
  [1988, 'mclaren_mp4_4_1988', 'mclaren-mp4-4', 'McLaren MP4/4', 'Honda'],
  [1989, 'mclaren_mp4_5_1989', 'mclaren-mp4-5', 'McLaren MP4/5', 'Honda'],
  [1990, 'ferrari_641_1990', 'ferrari-641', 'Ferrari 641', 'Ferrari'],
  [1991, 'jordan_191_1991', 'jordan-191', 'Jordan 191', 'Ford Cosworth'],
  [1992, 'williams_fw14b_1992', 'williams-fw14b', 'Williams FW14B', 'Renault'],
  [1993, 'williams_fw15c_1993', 'williams-fw15c', 'Williams FW15C', 'Renault'],
  [1994, 'benetton_b194_1994', 'benetton-b194', 'Benetton B194', 'Ford Cosworth'],
  [1995, 'ferrari_412t2_1995', 'ferrari-412t2', 'Ferrari 412 T2', 'Ferrari'],
  [1996, 'williams_fw18_1996', 'williams-fw18', 'Williams FW18', 'Renault'],
  [1997, 'ferrari_f310b_1997', 'ferrari-f310b', 'Ferrari F310B', 'Ferrari'],
  [1998, 'mclaren_mp4_13_1998', 'mclaren-mp4-13', 'McLaren MP4/13', 'Mercedes'],
  [1999, 'ferrari_f399_1999', 'ferrari-f399', 'Ferrari F399', 'Ferrari'],
  [2000, 'ferrari_f1_2000_2000', 'ferrari-f1-2000', 'Ferrari F1-2000', 'Ferrari'],
  [2001, 'ferrari_f2001_2001', 'ferrari-f2001', 'Ferrari F2001', 'Ferrari'],
  [2002, 'ferrari_f2002_2002', 'ferrari-f2002', 'Ferrari F2002', 'Ferrari'],
  [2003, 'williams_fw25_2003', 'williams-fw25', 'Williams FW25', 'BMW'],
  [2004, 'ferrari_f2004_2004', 'ferrari-f2004', 'Ferrari F2004', 'Ferrari'],
  [2005, 'renault_r25_2005', 'renault-r25', 'Renault R25', 'Renault'],
  [2006, 'renault_r26_2006', 'renault-r26', 'Renault R26', 'Renault'],
  [2007, 'ferrari_f2007_2007', 'ferrari-f2007', 'Ferrari F2007', 'Ferrari'],
  [2008, 'mclaren_mp4_23_2008', 'mclaren-mp4-23', 'McLaren MP4-23', 'Mercedes'],
  [2009, 'brawn_bgp001_2009', 'brawn-bgp-001', 'Brawn BGP 001', 'Mercedes'],
  [2010, 'red_bull_rb6_2010', 'red-bull-rb6', 'Red Bull RB6', 'Renault'],
  [2011, 'red_bull_rb7_2011', 'red-bull-rb7', 'Red Bull RB7', 'Renault'],
  [2012, 'red_bull_rb8_2012', 'red-bull-rb8', 'Red Bull RB8', 'Renault'],
  [2013, 'red_bull_rb9_2013', 'red-bull-rb9', 'Red Bull RB9', 'Renault'],
  [2014, 'mercedes_w05_2014', 'mercedes-f1-w05', 'Mercedes F1 W05 Hybrid', 'Mercedes'],
  [2015, 'mercedes_w06_2015', 'mercedes-f1-w06', 'Mercedes F1 W06 Hybrid', 'Mercedes'],
  [2016, 'mercedes_w07_2016', 'mercedes-f1-w07', 'Mercedes F1 W07 Hybrid', 'Mercedes'],
  [2017, 'ferrari_sf70h_2017', 'ferrari-sf70h', 'Ferrari SF70H', 'Ferrari'],
  [2018, 'mercedes_w09_2018', 'mercedes-f1-w09', 'Mercedes W09', 'Mercedes'],
  [2019, 'mercedes_w10_2019', 'mercedes-f1-w10', 'Mercedes W10', 'Mercedes'],
  [2020, 'mercedes_w11_2020', 'mercedes-f1-w11', 'Mercedes W11', 'Mercedes'],
  [2021, 'red_bull_rb16b_2021', 'red-bull-rb16b', 'Red Bull RB16B', 'Honda'],
  [2022, 'red_bull_rb18_2022', 'red-bull-rb18', 'Red Bull RB18', 'Red Bull Powertrains'],
  [2023, 'red_bull_rb19_2023', 'red-bull-rb19', 'Red Bull RB19', 'Honda RBPT'],
  [2024, 'mclaren_mcl38_2024', 'mclaren-mcl38', 'McLaren MCL38', 'Mercedes'],
  [2025, 'mclaren_mcl39_2025', 'mclaren-mcl39', 'McLaren MCL39', 'Mercedes'],
  [2026, 'mclaren_mcl40_2026', 'mclaren-mcl40', 'McLaren MCL40', 'Mercedes'],
];

const VARIANTS = [
  [1948, 'maserati_4clt48_1948', 'maserati-4clt-48', 'Maserati 4CLT/48', 'Maserati'],
  [1950, 'talbot_t26c_1950', 'talbot-lago-t26c', 'Talbot-Lago T26C', 'Talbot-Lago'],
  [1951, 'ferrari_375_1951', 'ferrari-375', 'Ferrari 375 F1', 'Ferrari'],
  [1951, 'brm_p15_1951', 'brm-p15', 'BRM P15', 'BRM'],
  [1953, 'maserati_a6gcm_1953', 'maserati-a6gcm', 'Maserati A6GCM', 'Maserati'],
  [1954, 'mercedes_w196_open_1954', 'mercedes-w196', 'Mercedes-Benz W 196 R Open Wheel', 'Mercedes'],
  [1955, 'lancia_d50_1955', 'lancia-d50', 'Lancia D50', 'Lancia'],
  [1958, 'cooper_t43_1958', 'cooper-t43', 'Cooper T43', 'Climax'],
  [1962, 'brm_p57_1962', 'brm-p57', 'BRM P57', 'BRM'],
  [1965, 'lotus_33_1965', 'lotus-33', 'Lotus 33', 'Climax'],
  [1970, 'ferrari_312b_1970', 'ferrari-312b', 'Ferrari 312B', 'Ferrari'],
  [1971, 'lotus_56b_1971', 'lotus-56b', 'Lotus 56B', 'Pratt & Whitney'],
  [1977, 'renault_rs01_1977', 'renault-rs01', 'Renault RS01', 'Renault'],
  [1978, 'brabham_bt46b_1978', 'brabham-bt46b', 'Brabham BT46B', 'Alfa Romeo'],
  [1979, 'williams_fw07_1979', 'williams-fw07', 'Williams FW07', 'Ford Cosworth'],
  [1980, 'brabham_bt49_1980', 'brabham-bt49', 'Brabham BT49', 'Ford Cosworth'],
  [1981, 'lotus_88_1981', 'lotus-88', 'Lotus 88', 'Ford Cosworth'],
  [1987, 'ferrari_f1_87_1987', 'ferrari-f1-87', 'Ferrari F1-87', 'Ferrari'],
  [2004, 'williams_fw26_2004', 'williams-fw26', 'Williams FW26', 'BMW'],
  [2005, 'mclaren_mp4_20_2005', 'mclaren-mp4-20', 'McLaren MP4-20', 'Mercedes'],
  [2009, 'red_bull_rb5_2009', 'red-bull-rb5', 'Red Bull RB5', 'Renault'],
  [2015, 'ferrari_sf15t_2015', 'ferrari-sf15-t', 'Ferrari SF15-T', 'Ferrari'],
  [2017, 'mercedes_w08_2017', 'mercedes-f1-w08', 'Mercedes W08', 'Mercedes'],
  [2022, 'ferrari_f1_75_2022', 'ferrari-f1-75', 'Ferrari F1-75', 'Ferrari'],
  [2022, 'mercedes_w13_2022', 'mercedes-f1-w13', 'Mercedes W13', 'Mercedes'],
];

// Names in the reference index are separate from the original vehicles used in the simulation.
const FOUNDATION = [
  ['alfa_158_1950','Front-engine supercharged racer'],
  ['ferrari_500_1952','Formula 2 championship racer'],
  ['mercedes_w196_streamlined_1954','Streamlined front-engine racer'],
  ['cooper_t51_1959','Rear-engine racer'],
  ['lotus_25_1962','Lightweight monocoque racer'],
  ['lotus_49_1967','Naturally aspirated three-litre racer'],
  ['lotus_72_1970','Early winged racer'],
  ['lotus_56b_1971','Four-wheel-drive turbine experiment'],
  ['tyrrell_p34_1976','Six-wheel racer'],
  ['lotus_79_1978','Ground-effect racer'],
  ['brabham_bt46b_1978','Fan-assisted racer'],
  ['williams_fw11_1986','High-boost turbo racer'],
  ['mclaren_mp4_4_1988','Late-turbo racer'],
  ['williams_fw14b_1992','Active-suspension racer'],
  ['ferrari_412t2_1995','Naturally aspirated V12 racer'],
  ['ferrari_f2004_2004','High-revving V10 racer'],
  ['renault_r26_2006','Naturally aspirated V8 racer'],
  ['brawn_bgp001_2009','Double-diffuser racer'],
  ['red_bull_rb7_2011','High-downforce V8 racer'],
  ['mercedes_w05_2014','First-generation turbo-hybrid racer'],
  ['mercedes_w09_2018','Wide hybrid with Halo'],
  ['mercedes_w11_2020','Advanced turbo-hybrid racer'],
  ['red_bull_rb18_2022','Ground-effect hybrid racer'],
  ['mclaren_mcl38_2024','Mature ground-effect racer'],
  ['mclaren_mcl40_2026','Active-aero turbo-hybrid racer'],
];

const NOTES = {
  maserati_4clt48_1948: {
    source:'https://api.goodwood.com/grr/event-coverage/goodwood-revival/maserati-spotters-guide-for-the-2026-goodwood-revival/', sourceLabel:'Goodwood event archive',
    summary:'Reg Parnell won the first Goodwood Trophy in a 4CLT in 1948. This post-war Grand Prix car predates the World Championship.',
    specs:{ enginePlacement:'Front', architecture:'Tubular frame' },
  },
  alfa_158_1950: {
    source:'https://www.media.stellantis.com/em-en/alfa-romeo/press/65-years-ago-the-first-victory-of-alfa-romeo-in-formula-1',
    sourceLabel:'Alfa Romeo heritage',
    summary:'Nino Farina won the first championship race at Silverstone. Alfa Romeo identifies the 1,479 cc inline-eight and reports nearly 300 hp for that Silverstone specification. Output evolved over the season.',
    specs:{ enginePlacement:'Front', engineLayout:'Inline-eight', displacementCc:1479, aspiration:'Supercharged', power:'Nearly 300 hp at the 1950 Silverstone race, manufacturer retrospective' },
  },
  alfa_159_1951: {
    source:'https://www.media.stellantis.com/uk-en/alfa-romeo/press/alfa-romeo-gp-tipo-159-alfetta-to-appear-at-f1-british-grand-prix', sourceLabel:'Alfa Romeo heritage',
    summary:'Fangio won the 1951 title in the evolved Alfetta. Alfa Romeo retired from the championship after the season.',
    specs:{ enginePlacement:'Front', displacementCc:1479 },
  },
  ferrari_500_1952: { source:FERRARI, sourceLabel:'Ferrari heritage', summary:'Alberto Ascari won the first of two consecutive titles with the Ferrari 500 F2. This was a Formula 2 chassis competing in a championship Grand Prix season.' },
  ferrari_500_1953: { source:FERRARI, sourceLabel:'Ferrari heritage', summary:'Ascari took a second consecutive championship with the 500 F2. This entry describes its 1953 campaign.' },
  mercedes_w196_streamlined_1954: {
    source:'https://media.mercedes-benz.com/en/article/29004d7c-53c6-4531-89b1-4bf163ec3b8e', sourceLabel:'Mercedes-Benz Classic',
    summary:'The streamlined W 196 R took a one-two on its debut at Reims in July 1954. Mercedes also fielded a separate open-wheel body for other circuits.',
    specs:{ enginePlacement:'Front', engineLayout:'Inline-eight', displacementCc:2497, aspiration:'Naturally aspirated', power:'188–213 kW for W 196 R specifications spanning 1954–1955' },
  },
  mercedes_w196_open_1955: { source:'https://group.mercedes-benz.com/company/tradition/company-history/history-aerodynamic.html', sourceLabel:'Mercedes-Benz heritage', summary:'The open-wheel variant offered a clear view of the front wheels and was used alongside the streamliner.' },
  ferrari_d50_1956: { source:FERRARI, sourceLabel:'Ferrari heritage', summary:'Fangio won the 1956 drivers’ title in Ferrari’s development of the Lancia D50.' },
  maserati_250f_1957: { source:'https://www.maserati.com/es/es/mundo-maserati/stories-of-audacity/f-tributo/racing-roots', sourceLabel:'Maserati heritage', summary:'Fangio took the 1957 title with the 250F. This entry describes the front-engine inline-six version. Maserati also experimented with a V12 during the season.', specs:{enginePlacement:'Front'} },
  cooper_t43_1958: { source:'https://www.formula1.com/en/latest/article/7-incredible-season-openers-from-each-decade-of-f1.1MwMFvzoqBQPYAuVutrzbh', sourceLabel:'Formula 1 season history', summary:'Stirling Moss won the 1958 Argentine Grand Prix in a rear-engine Cooper T43. This entry represents the two-litre configuration used there.', specs:{enginePlacement:'Rear-mid'} },
  cooper_t51_1959: { source:'https://www.formula1.com/en/latest/article/5-times-f1-teams-got-the-new-regulations-wrong.1odf2dnvDZkY5uYTaqRYfp', sourceLabel:'Formula 1 technical history', summary:'This is the 2.5-litre championship version of the T51. The engine sat behind the driver and the lighter rear-engine package displaced the front-engine designs that had dominated the previous decade.', specs:{enginePlacement:'Rear-mid'} },
  lotus_25_1962: { source:'https://www.lotuscars.com/en-CA/lotus-story/race-cars/type-25', sourceLabel:'Lotus Type 25 archive', summary:'The Type 25’s aluminium monocoque replaced a separate spaceframe with a load-bearing shell. Jim Clark raced it in 1962 and took the drivers’ title in 1963.', specs:{ enginePlacement:'Rear-mid', architecture:'Riveted aluminium monocoque', transmission:'ZF manual', gears:5, cockpit:'Reclined seating with exposed cockpit' } },
  lotus_25_1963: { source:LOTUS, sourceLabel:'Lotus heritage', summary:'Jim Clark and Lotus earned both 1963 championship titles with the Type 25.' },
  ferrari_158_1964: { source:'https://www.ferrari.com/en-EN/formula1/158-f1', sourceLabel:'Ferrari car archive', summary:'Ferrari used the 158 V8 alongside other engine configurations. Its model designation is separate from Alfa Romeo’s pre-war-derived 158.', specs:{enginePlacement:'Rear-mid'} },
  honda_ra272_1965: { source:'https://honda.racing/features/tsunoda-mexicogp-ra272-60th', sourceLabel:'Honda Collection Hall account', summary:'Richie Ginther took Honda’s first Formula 1 win at the Mexican Grand Prix in the 1.5-litre V12 RA272.' },
  lotus_49_1967: { source:LOTUS, sourceLabel:'Lotus heritage', summary:'Lotus introduced the Ford Cosworth DFV in the Type 49, mounting the V8 as a structural part of the car.', specs:{ enginePlacement:'Rear-mid', engineLayout:'V8', aspiration:'Naturally aspirated', displacementCc:2993 } },
  lotus_49b_1968: { source:LOTUS, sourceLabel:'Lotus heritage', summary:'The 49 lineage saw Formula 1’s first aerofoil experiments. Its 1968 configuration shows how wings began to influence setup and vehicle appearance.' },
  matra_ms80_1969: { source:'https://www.motorsportmagazine.com/archive/article/june-1969/26/the-monaco-grand-prix-4/', sourceLabel:'Contemporary Monaco GP race report', summary:'The MS80 used the Ford Cosworth V8. The contemporary Monaco report records its changing aerofoils and nose configurations.' },
  lotus_72_1970: { source:LOTUS, sourceLabel:'Lotus heritage', summary:'The Type 72 combined a wedge silhouette, radiators mounted between the axles and multi-element wings.' },
  lotus_56b_1971: { source:EXPERIMENTS, sourceLabel:'Formula 1 technical history', summary:'A Pratt & Whitney turbine powered four wheels through a single-speed system. It entered three championship Grands Prix, with eighth place at Monza its best finish.', specs:{ engineLayout:'Gas turbine', aspiration:'Turbine', drivenWheels:4, gears:1 }, competition:'Championship and non-championship experimental entries' },
  tyrrell_p34_1976: { source:EXPERIMENTS, sourceLabel:'Formula 1 technical history', summary:'Four small steerable front wheels and two conventional rear wheels reduced front tyre exposure. Jody Scheckter won the 1976 Swedish Grand Prix in the P34.', specs:{ architecture:'Six wheels, four steerable front wheels', drivenWheels:2 } },
  lotus_78_1977: { source:EARLY_AERO, sourceLabel:'Formula 1 technical history', summary:'Shaped sidepod undersides and skirts limited pressure leakage, making the underfloor a major source of load.' },
  renault_rs01_1977: { source:RULE_CHANGES, sourceLabel:'Formula 1 technical history', summary:'Renault brought a turbocharged engine into championship Formula 1 with the RS01 in 1977. The early car struggled with reliability while the technology developed.' },
  lotus_79_1978: { source:'https://www.formula1.com/en/latest/article/tech-tuesday-the-lotus-79-f1s-ground-effect-marvel.sAD9PXt7mC8iMSwwe6CCw', sourceLabel:'Formula 1 technical history', summary:'Venturi tunnels and skirts improved floor performance. Ride height and floor sealing affected the aerodynamic platform.', specs:{ enginePlacement:'Rear-mid', engineLayout:'V8', aspiration:'Naturally aspirated', aero:'Venturi tunnels and side skirts' } },
  brabham_bt46b_1978: { source:EXPERIMENTS, sourceLabel:'Formula 1 technical history', summary:'An engine-driven fan lowered underfloor pressure. The BT46B won on its sole championship appearance in Sweden and the team withdrew it afterward.', specs:{ engineLayout:'Flat-12', aero:'Engine-driven fan and skirt sealing' }, competition:'One championship appearance' },
  mclaren_mp4_1_1981: { source:'https://www.formula1.com/en/latest/article/the-75-best-drivers-cars-innovations-teams-and-key-figures-in-f1-history.6VcYXd7l9aI6fysNWtxFja', sourceLabel:'Formula 1 technical history', summary:'The carbon-fibre monocoque proved competitive and demonstrated the material’s structural potential in racing.', specs:{ architecture:'Carbon-fibre composite monocoque' } },
  lotus_88_1981: { source:'https://www.lotuscars.com/en-CA/lotus-story/race-cars/type-88', sourceLabel:'Lotus heritage', summary:'Lotus attempted to separate the aerodynamic structure from the sprung driver and mechanical chassis. The concept never started a championship race.', competition:'Prototype presented at events without a championship start' },
  williams_fw11_1986: { source:'https://honda.racing/features/reuniting-champions-the-story-of-the-restoration-of-hondas-williams-fw11', sourceLabel:'Honda FW11 restoration archive', summary:'Honda’s 1.5-litre RA166E twin-turbo V6 helped the FW11 earn the 1986 constructors’ title. Period output depended on boost setting and session.', specs:{ engineLayout:'V6', aspiration:'Twin-turbocharged' }, sources:[WILLIAMS] },
  williams_fw11b_1987: { source:WILLIAMS, sourceLabel:'Williams Heritage', summary:'The FW11B evolved the Honda-powered FW11 for the 1987 season.' },
  williams_fw14b_1992: { source:WILLIAMS, sourceLabel:'Williams Heritage', summary:'The FW14B’s active suspension helped manage its aerodynamic platform as load changed. The system belongs to specific cars from this period.', specs:{ engineLayout:'V10', aspiration:'Naturally aspirated', suspension:'Active hydraulic suspension' } },
  williams_fw15c_1993: { source:'https://www.formula1.com/en/latest/article/tech-tuesday-wizardry-behind-williams-fw15c.6IzOXYuuPYOWyaaGGS4AgS', sourceLabel:'Formula 1 technical history', summary:'Active ride-height control and electronic assistance were central to the FW15C. Several such systems were prohibited for 1994.', specs:{suspension:'Active hydraulic suspension',transmission:'Semi-automatic paddle shift',electronicAssists:'Traction control and later-season ABS'} },
  ferrari_f2004_2004: { source:FERRARI, sourceLabel:'Ferrari heritage', summary:'Michael Schumacher took his final title in the F2004. Its high-revving V10 and grooved dry tyres illustrate the established 2004 formula.', specs:{ tyreType:'Grooved dry-weather tyres' }, sources:['https://www.formula1.com/en/latest/article/exclusive-from-trendsetters-to-title-winners-ross-brawn-reveals-his.6FIAnV6e71kvi8PVInIuPo'] },
  brawn_bgp001_2009: { source:MERCEDES_ERAS, sourceLabel:'Mercedes-AMG team archive', summary:'The first-year Brawn team won the 2009 titles. Its double diffuser increased underfloor extraction within the team’s reading of the rules.', specs:{ engineLayout:'V8', aspiration:'Naturally aspirated', aero:'Double diffuser' } },
  red_bull_rb7_2011: { source:'https://www.formula1.com/en/latest/article/fia-thursday-press-conference-germany-2019.4zUg7WebFN9CcdCm4W9qvF', sourceLabel:'FIA press conference with Sebastian Vettel', summary:'Vettel describes the RB7’s exhaust-fed aerodynamic load and the changes in setup and technique needed to use it.', specs:{aero:'Exhaust-blown diffuser'} },
  mercedes_w05_2014: { source:'https://www.mercedesamgf1.com/news/how-mercedes-mastered-a-new-era-ten-years-on-from-our-first-f1-constructors', sourceLabel:'Mercedes-AMG team archive', summary:'Mercedes won its first constructors’ title as a works team with the W05, powered by the new turbo-hybrid design.', specs:{ engineLayout:'V6', displacementCc:1600, aspiration:'Turbocharged', gears:8, energy:'MGU-K and MGU-H' } },
  mercedes_w11_2020: { source:'https://www.formula1.com/en/latest/article/tech-tuesday-how-ferrari-and-hamilton-pushed-mercedes-to-create-the.1zMRmGDpJtpDXrlZBbjIs9.1zMRmGDpJtpDXrlZBbjIs9', sourceLabel:'Formula 1 technical history', summary:'The W11 combined a long wheelbase with aerodynamic development and driver-operated Dual Axis Steering, which changed front toe for tyre management.', specs:{steering:'Dual Axis Steering system'} },
  mclaren_mcl38_2024: { source:'https://www.mclaren.com/racing/formula-1/2024/mclaren-mcl38-technical-specification/', sourceLabel:'McLaren MCL38 technical specification', summary:'The MCL38 used the Mercedes M14 turbo-hybrid, 18-inch wheels and an adjustable rear DRS wing. McLaren lists 798 kg including the driver and excluding fuel.', specs:{massKg:798, engineLayout:'90° V6', rpmLimit:15000, gears:8, tyreType:'Pirelli slick, intermediate and wet tyres on 18-inch wheels',energy:'MGU-K and MGU-H',aero:'Underfloor tunnels and rear-wing DRS'} },
  mclaren_mcl40_2026: {
    source:'https://www.mclaren.com/racing/formula-1/2026/what-is-the-technical-specification-of-our-2026-formula-1/', sourceLabel:'McLaren MCL40 technical specification',
    summary:'McLaren’s published chassis pairs adjustable front and rear flaps with the Mercedes M17 1.6-litre turbo V6 and an MGU-K. October FIA rules govern mode eligibility and the electrical limits.',
    specs:{ engineLayout:'90° V6', displacementCc:1600, aspiration:'Turbocharged', gears:8, transmission:'Electro-hydraulic seamless shift', drivenWheels:2, tyreType:'18-inch wheels with slick, intermediate or wet tyres', energy:'MGU-K with 350 kW DC ceiling subject to FIA operating limits', aero:'Adjustable front and rear wing flaps', brakes:'Carbon-carbon discs with rear brake-by-wire' },
    sources:[FIA_2026_TECHNICAL,FIA_2026_SPORTING,FIA_2026_TERMS],
  },
};

// Nominal engine classes from the pinned season entrant engine index.
// When the entrant group includes multiple engines, the source note identifies the chosen specification.
const ENGINE_CLASSES = [
  [1.5, 'Inline-eight', 'Supercharged', [
    'alfa_158_1950', 'alfa_159_1951',
  ]],
  [4.5, 'Inline-six', 'Naturally aspirated', [
    'talbot_t26c_1950',
  ]],
  [4.5, 'V12', 'Naturally aspirated', [
    'ferrari_375_1951',
  ]],
  [1.5, 'V16', 'Supercharged', [
    'brm_p15_1951',
  ]],
  [2.0, 'Inline-six', 'Naturally aspirated', [
    'maserati_a6gcm_1953',
  ]],
  [2.5, 'Inline-eight', 'Naturally aspirated', [
    'mercedes_w196_streamlined_1954', 'mercedes_w196_open_1954', 'mercedes_w196_open_1955',
  ]],
  [2.5, 'V8', 'Naturally aspirated', [
    'lancia_d50_1955', 'ferrari_d50_1956',
  ]],
  [2.5, 'Inline-four', 'Naturally aspirated', [
    'vanwall_vw5_1958', 'lotus_18_1960', 'cooper_t51_1959',
  ]],
  [1.5, 'V6', 'Naturally aspirated', [
    'ferrari_156_1961',
  ]],
  [1.5, 'V8', 'Naturally aspirated', [
    'lotus_25_1962', 'brm_p57_1962', 'lotus_25_1963', 'lotus_33_1965',
    'ferrari_158_1964',
  ]],
  [1.5, 'V12', 'Naturally aspirated', [
    'honda_ra272_1965',
  ]],
  [3.0, 'V8', 'Naturally aspirated', [
    'brabham_bt19_1966', 'lotus_49b_1968', 'lotus_72_1970', 'tyrrell_003_1971',
    'lotus_72d_1972', 'mclaren_m23_1973', 'brabham_bt44_1974', 'tyrrell_p34_1976',
    'lotus_78_1977', 'lotus_79_1978', 'williams_fw07_1979', 'williams_fw07b_1980',
    'brabham_bt49_1980', 'mclaren_mp4_1_1981', 'lotus_88_1981', 'lotus_49_1967',
    'matra_ms80_1969',
  ]],
  [3.0, 'Flat-12', 'Naturally aspirated', [
    'ferrari_312b_1970', 'ferrari_312t_1975', 'brabham_bt46b_1978', 'ferrari_312t4_1979',
  ]],
  [1.5, 'V6', 'Turbocharged', [
    'renault_rs01_1977', 'renault_re30b_1982', 'mclaren_mp4_2_1984', 'lotus_97t_1985',
    'williams_fw11_1986', 'williams_fw11b_1987', 'ferrari_f1_87_1987', 'mclaren_mp4_4_1988',
  ]],
  [1.5, 'Inline-four', 'Turbocharged', [
    'brabham_bt52_1983',
  ]],
  [3.5, 'V10', 'Naturally aspirated', [
    'mclaren_mp4_5_1989', 'williams_fw14b_1992', 'williams_fw15c_1993',
  ]],
  [3.5, 'V12', 'Naturally aspirated', [
    'ferrari_641_1990',
  ]],
  [3.5, 'V8', 'Naturally aspirated', [
    'jordan_191_1991', 'benetton_b194_1994',
  ]],
  [3.0, 'V12', 'Naturally aspirated', [
    'ferrari_412t2_1995',
  ]],
  [3.0, 'V10', 'Naturally aspirated', [
    'williams_fw18_1996', 'ferrari_f310b_1997', 'mclaren_mp4_13_1998', 'ferrari_f399_1999',
    'ferrari_f1_2000_2000', 'ferrari_f2001_2001', 'ferrari_f2002_2002', 'williams_fw25_2003',
    'ferrari_f2004_2004', 'williams_fw26_2004', 'renault_r25_2005', 'mclaren_mp4_20_2005',
  ]],
  [2.4, 'V8', 'Naturally aspirated', [
    'renault_r26_2006', 'ferrari_f2007_2007', 'mclaren_mp4_23_2008', 'brawn_bgp001_2009',
    'red_bull_rb5_2009', 'red_bull_rb6_2010', 'red_bull_rb7_2011', 'red_bull_rb8_2012',
    'red_bull_rb9_2013',
  ]],
  [1.6, 'V6', 'Turbocharged hybrid', [
    'mercedes_w05_2014', 'mercedes_w06_2015', 'ferrari_sf15t_2015', 'mercedes_w07_2016',
    'ferrari_sf70h_2017', 'mercedes_w08_2017', 'mercedes_w09_2018', 'mercedes_w10_2019',
    'mercedes_w11_2020', 'red_bull_rb16b_2021', 'red_bull_rb18_2022', 'ferrari_f1_75_2022',
    'mercedes_w13_2022', 'red_bull_rb19_2023', 'mclaren_mcl38_2024', 'mclaren_mcl39_2025',
    'mclaren_mcl40_2026',
  ]],
  [1.5, 'Inline-four', 'Supercharged', [
    'maserati_4clt48_1948',
  ]],
  [2.0, 'Inline-four', 'Naturally aspirated', [
    'ferrari_500_1952', 'ferrari_500_1953', 'cooper_t43_1958',
  ]],
  [2.5, 'Inline-six', 'Naturally aspirated', [
    'maserati_250f_1957',
  ]],
];

const ENGINES_BY_ID = new Map(ENGINE_CLASSES.flatMap(([nominalDisplacementL, engineLayout, aspiration, ids]) =>
  ids.map(id => [id, {nominalDisplacementL, engineLayout, aspiration}])));

const UNKNOWN_SPECS = {
  architecture:null, enginePlacement:null, engineLayout:null, displacementCc:null, nominalDisplacementL:null, aspiration:null,
  power:null, torque:null, torqueCurve:null, rpmLimit:null, transmission:null, gears:null, drivenWheels:null,
  massKg:null, dimensions:null, wheelbase:null, trackWidth:null, tyreType:null, drag:null, aero:null,
  brakes:null, suspension:null, steering:null, fuel:null, energy:null, electronicAssists:null,
  cockpit:null, sound:null, geometry:null,
};

function historicalEntry([year, id, chassisIndexId, name, engineManufacturer], representative) {
  const era = HISTORY_ERAS.find(item => year >= item.from && year <= item.to);
  const note = NOTES[id] || {};
  const foundation = FOUNDATION.find(([entryId]) => entryId === id);
  const seasonSource = year >= 1950 ? `${RESULTS}${year}/races` : null;
  const formula = year < 1950 ? 'Post-war Grand Prix formula' : year === 1952 || year === 1953 ? 'Formula 2' : 'Formula 1';
  const source = note.source || (year < 1950 ? FIA_HISTORIC : INDEX);
  const sources = [
    ...((note.sources || []).map(url => ({ url, label:'Additional historical source' }))),
    ...(seasonSource ? [{ url:seasonSource, label:`${year} official race results` }] : []),
    ...(source !== INDEX && chassisIndexId ? [{ url:INDEX, label:'F1DB season and chassis index (CC BY 4.0)' }] : []),
  ];
  return {
    id, year, season: year >= 1950 ? year : null, name, era:era.id, representative,
    constructor: name.startsWith('Alfa Romeo') ? 'Alfa Romeo' : name.startsWith('Mercedes-Benz') ? 'Mercedes-Benz' : name.startsWith('Red Bull') ? 'Red Bull Racing' : name.startsWith('Talbot-Lago') ? 'Talbot-Lago' : name.split(' ')[0],
    engineManufacturer, chassisIndexId, formula,
    competition:note.competition || (year >= 1950 ? 'World Championship entry' : 'Pre-championship Grand Prix racing'),
    source,
    sourceLabel:note.sourceLabel || (year < 1950 ? 'FIA historic formula classification' : 'F1DB season and chassis index'),
    seasonSource, indexSource:INDEX, sources,
    summary:note.summary || `${name} competed in the ${year} championship with ${engineManufacturer} power. ${era.summary}`,
    historicalSpecs:{ ...UNKNOWN_SPECS, ...ENGINES_BY_ID.get(id), ...note.specs },
    confidence:note.source ? 'Manufacturer or official historical account for documented details' : 'Season/chassis index with unpublished technical values omitted',
    foundation:foundation?.[1] || null,
    referenceType:'catalogue',
  };
}

export const HISTORY_CATALOGUE = [
  ...SEASONS.map(row => historicalEntry(row, true)),
  ...VARIANTS.map(row => historicalEntry(row, false)),
].sort((a,b) => a.year - b.year || Number(b.representative) - Number(a.representative));

export const HISTORY_FOUNDATION = FOUNDATION.map(([id, architecture]) => ({ id, architecture }));
