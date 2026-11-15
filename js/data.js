// All 40 squares of the London board, in board order starting from GO.
// Ownable squares have real-world geometry used for automatic check-in:
//   path:   a list of [lat, lng] points along the street (claim when near any segment)
//   point:  a single [lat, lng] (stations, squares, landmarks)
//   radius: metres around the path/point that count as "visited"
// Coordinates are hand-placed approximations; tweak them here if a claim
// triggers too early or too late on the ground.

export const COLORS = {
  brown: '#8B4A2B',
  lblue: '#9FD3EF',
  pink: '#D6338A',
  orange: '#F28C28',
  red: '#E2231A',
  yellow: '#FCE300',
  green: '#1FA34A',
  dblue: '#1B4FA0',
  station: '#1B1B1B',
  utility: '#8C8577',
};

// Groups that need dark text on top of their colour.
export const LIGHT_GROUPS = new Set(['lblue', 'yellow', 'orange']);

export const GROUP_NAMES = {
  brown: 'Brown',
  lblue: 'Light blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  dblue: 'Dark blue',
  station: 'Stations',
  utility: 'Utilities',
};

export const COLOUR_SETS = ['brown', 'lblue', 'pink', 'orange', 'red', 'yellow', 'green', 'dblue'];

const STREET = 60; // metres either side of a street line
const SPOT = 120; // squares and small landmarks
const STATION = 150; // big stations

export const SQUARES = [
  { kind: 'corner', id: 'go', label: 'GO' },
  {
    kind: 'property', id: 'old-kent-road', name: 'Old Kent Road', boardName: 'OLD KENT\nROAD', group: 'brown', price: 60,
    rents: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgage: 30,
    path: [[51.4946, -0.0898], [51.4890, -0.0790], [51.4835, -0.0690], [51.4790, -0.0600]], radius: STREET,
    fact: 'The only property south of the Thames. It follows the line of Watling Street, the Roman road that ran from London out to Kent.',
  },
  { kind: 'chest', id: 'chest-1', label: 'COMMUNITY\nCHEST' },
  {
    kind: 'property', id: 'whitechapel-road', name: 'Whitechapel Road', boardName: 'WHITECHAPEL\nROAD', group: 'brown', price: 60,
    rents: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgage: 30,
    path: [[51.5171, -0.0694], [51.5195, -0.0600], [51.5215, -0.0500]], radius: STREET,
    fact: 'The heart of the old East End. The Whitechapel Bell Foundry, which cast Big Ben, stood on this road for centuries.',
  },
  { kind: 'tax', id: 'income-tax', label: 'INCOME\nTAX', sub: 'PAY £200' },
  {
    kind: 'station', id: 'kings-cross', name: 'King’s Cross Station', boardName: 'KING’S CROSS\nSTATION', group: 'station', price: 200,
    point: [51.5320, -0.1233], radius: STATION,
    fact: 'Opened in 1852 as the London terminus of the Great Northern Railway. Look for the luggage trolley disappearing into the wall.',
  },
  {
    kind: 'property', id: 'angel-islington', name: 'The Angel Islington', boardName: 'THE ANGEL\nISLINGTON', group: 'lblue', price: 100,
    rents: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgage: 50,
    point: [51.5322, -0.1058], radius: SPOT,
    fact: 'The only square named after a building, not a street: the Angel was a coaching inn. The story goes that the board’s makers stopped for tea here while choosing the streets.',
  },
  { kind: 'chance', id: 'chance-1', label: 'CHANCE' },
  {
    kind: 'property', id: 'euston-road', name: 'Euston Road', boardName: 'EUSTON\nROAD', group: 'lblue', price: 100,
    rents: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgage: 50,
    path: [[51.5240, -0.1430], [51.5262, -0.1350], [51.5280, -0.1300], [51.5300, -0.1240]], radius: STREET,
    fact: 'Built in the 1750s as the “New Road”, London’s first bypass, so cattle could be driven to Smithfield market without clogging Oxford Street.',
  },
  {
    kind: 'property', id: 'pentonville-road', name: 'Pentonville Road', boardName: 'PENTONVILLE\nROAD', group: 'lblue', price: 120,
    rents: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgage: 60,
    path: [[51.5306, -0.1205], [51.5315, -0.1140], [51.5321, -0.1075]], radius: STREET,
    fact: 'The eastern stretch of the same New Road, named after Henry Penton, who developed the area in the 1770s.',
  },
  { kind: 'corner', id: 'jail', label: 'JAIL' },
  {
    kind: 'property', id: 'pall-mall', name: 'Pall Mall', boardName: 'PALL\nMALL', group: 'pink', price: 140,
    rents: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgage: 70,
    path: [[51.5053, -0.1388], [51.5063, -0.1340], [51.5072, -0.1300]], radius: STREET,
    fact: 'Named after “pall-mall”, a croquet-like game played here in the 1600s. Today it is lined with grand gentlemen’s clubs.',
  },
  {
    kind: 'utility', id: 'electric-company', name: 'Electric Company', boardName: 'ELECTRIC\nCOMPANY', group: 'utility', price: 150,
    point: [51.4816, -0.1445], radius: 200, stand: 'Battersea Power Station',
    fact: 'Our stand-in is Battersea Power Station, which once powered a fifth of London. Its four white chimneys are a landmark of the skyline.',
  },
  {
    kind: 'property', id: 'whitehall', name: 'Whitehall', boardName: 'WHITEHALL', group: 'pink', price: 140,
    rents: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgage: 70,
    path: [[51.5068, -0.1272], [51.5040, -0.1265], [51.5020, -0.1262]], radius: STREET,
    fact: 'The street of government. Downing Street opens off it, and the name has come to mean the civil service itself.',
  },
  {
    kind: 'property', id: 'northumberland-avenue', name: 'Northumberland Avenue', boardName: 'NORTHUMB’LND\nAVENUE', group: 'pink', price: 160,
    rents: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgage: 80,
    path: [[51.5072, -0.1263], [51.5065, -0.1243], [51.5058, -0.1225]], radius: STREET,
    fact: 'Named after Northumberland House, the Duke of Northumberland’s mansion, which was demolished in the 1870s to make way for this avenue of grand hotels.',
  },
  {
    kind: 'station', id: 'marylebone-station', name: 'Marylebone Station', boardName: 'MARYLEBONE\nSTATION', group: 'station', price: 200,
    point: [51.5225, -0.1631], radius: STATION,
    fact: 'Opened in 1899, it was the last of London’s great railway termini to be built, and is still one of the smallest and calmest.',
  },
  {
    kind: 'property', id: 'bow-street', name: 'Bow Street', boardName: 'BOW\nSTREET', group: 'orange', price: 180,
    rents: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgage: 90,
    path: [[51.5134, -0.1222], [51.5124, -0.1213], [51.5116, -0.1206]], radius: STREET,
    fact: 'Home of the Bow Street Runners, often called London’s first professional police force. The whole orange set has a police or court connection, fittingly placed just after Jail.',
  },
  { kind: 'chest', id: 'chest-2', label: 'COMMUNITY\nCHEST' },
  {
    kind: 'property', id: 'marlborough-street', name: 'Marlborough Street', boardName: 'MARL-\nBOROUGH\nSTREET', group: 'orange', price: 180,
    rents: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgage: 90,
    path: [[51.5140, -0.1418], [51.5146, -0.1393], [51.5151, -0.1368]], radius: STREET,
    fact: 'Great Marlborough Street was home to a famous magistrates’ court, which heard plenty of celebrity cases before it closed.',
  },
  {
    kind: 'property', id: 'vine-street', name: 'Vine Street', boardName: 'VINE\nSTREET', group: 'orange', price: 200,
    rents: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgage: 100,
    point: [51.5097, -0.1366], radius: 80,
    fact: 'One of the shortest streets on the board: a little lane off Piccadilly that was once home to a well-known police station.',
  },
  { kind: 'corner', id: 'free-parking', label: 'FREE' },
  {
    kind: 'property', id: 'strand', name: 'Strand', boardName: 'STRAND', group: 'red', price: 220,
    rents: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgage: 110,
    path: [[51.5086, -0.1250], [51.5100, -0.1210], [51.5112, -0.1175], [51.5124, -0.1140], [51.5132, -0.1123]], radius: STREET,
    fact: '“Strand” means shore: this road ran along the bank of the Thames before the Victoria Embankment pushed the river further away.',
  },
  { kind: 'chance', id: 'chance-2', label: 'CHANCE' },
  {
    kind: 'property', id: 'fleet-street', name: 'Fleet Street', boardName: 'FLEET\nSTREET', group: 'red', price: 220,
    rents: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgage: 110,
    path: [[51.5138, -0.1110], [51.5141, -0.1080], [51.5140, -0.1050]], radius: STREET,
    fact: 'For centuries this was the home of Britain’s newspapers, so much so that “Fleet Street” still means the national press.',
  },
  {
    kind: 'property', id: 'trafalgar-square', name: 'Trafalgar Square', boardName: 'TRAFALGAR\nSQUARE', group: 'red', price: 240,
    rents: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgage: 120,
    point: [51.5080, -0.1281], radius: SPOT,
    fact: 'Named after the Battle of Trafalgar in 1805. Nelson watches from his column, and the Fourth Plinth shows a changing piece of modern art.',
  },
  {
    kind: 'station', id: 'fenchurch-street', name: 'Fenchurch Street Station', boardName: 'FENCHURCH ST.\nSTATION', group: 'station', price: 200,
    point: [51.5115, -0.0786], radius: STATION,
    fact: 'The only main London terminus without its own Underground station.',
  },
  {
    kind: 'property', id: 'leicester-square', name: 'Leicester Square', boardName: 'LEICESTER\nSQUARE', group: 'yellow', price: 260,
    rents: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgage: 130,
    point: [51.5103, -0.1301], radius: SPOT,
    fact: 'London’s home of film premieres. Look out for the statues of famous film characters dotted around the square.',
  },
  {
    kind: 'property', id: 'coventry-street', name: 'Coventry Street', boardName: 'COVENTRY\nSTREET', group: 'yellow', price: 260,
    rents: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgage: 130,
    path: [[51.5099, -0.1340], [51.5101, -0.1325], [51.5103, -0.1312]], radius: STREET,
    fact: 'A short link between Piccadilly Circus and Leicester Square, once home to one of the huge Lyons Corner House restaurants.',
  },
  {
    kind: 'utility', id: 'water-works', name: 'Water Works', boardName: 'WATER\nWORKS', group: 'utility', price: 150,
    point: [51.4884, -0.2885], radius: 200, stand: 'Museum of Water & Steam, Kew Bridge',
    fact: 'Our stand-in is the old Kew Bridge pumping station, now the Museum of Water & Steam, where giant steam engines once pumped London’s water.',
  },
  {
    kind: 'property', id: 'piccadilly', name: 'Piccadilly', boardName: 'PICCADILLY', group: 'yellow', price: 280,
    rents: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgage: 140,
    path: [[51.5098, -0.1352], [51.5080, -0.1400], [51.5065, -0.1440], [51.5050, -0.1475], [51.5038, -0.1500]], radius: STREET,
    fact: 'Named after “piccadills”, the stiff decorative collars sold by a 17th-century tailor whose house stood nearby.',
  },
  { kind: 'corner', id: 'go-to-jail', label: 'GOTOJAIL' },
  {
    kind: 'property', id: 'regent-street', name: 'Regent Street', boardName: 'REGENT\nSTREET', group: 'green', price: 300,
    rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgage: 150,
    path: [[51.5085, -0.1330], [51.5105, -0.1355], [51.5120, -0.1385], [51.5140, -0.1400], [51.5155, -0.1410], [51.5170, -0.1418]], radius: STREET,
    fact: 'Laid out by the architect John Nash for the Prince Regent in the early 1800s. Its sweeping curve is still one of London’s grandest.',
  },
  {
    kind: 'property', id: 'oxford-street', name: 'Oxford Street', boardName: 'OXFORD\nSTREET', group: 'green', price: 300,
    rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgage: 150,
    path: [[51.5135, -0.1585], [51.5145, -0.1530], [51.5152, -0.1480], [51.5160, -0.1420], [51.5165, -0.1370], [51.5162, -0.1310]], radius: STREET,
    fact: 'Another old Roman road, and now one of the busiest shopping streets in Europe.',
  },
  { kind: 'chest', id: 'chest-3', label: 'COMMUNITY\nCHEST' },
  {
    kind: 'property', id: 'bond-street', name: 'Bond Street', boardName: 'BOND\nSTREET', group: 'green', price: 320,
    rents: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgage: 160,
    path: [[51.5148, -0.1492], [51.5130, -0.1470], [51.5110, -0.1440], [51.5087, -0.1408]], radius: STREET,
    fact: 'Old and New Bond Street together run from Piccadilly to Oxford Street. Look for the bronze statue of Churchill and Roosevelt sharing a bench.',
  },
  {
    kind: 'station', id: 'liverpool-street', name: 'Liverpool Street Station', boardName: 'LIVERPOOL ST.\nSTATION', group: 'station', price: 200,
    point: [51.5178, -0.0817], radius: STATION,
    fact: 'Built on the original site of the Bethlem Royal Hospital, better known as “Bedlam”.',
  },
  { kind: 'chance', id: 'chance-3', label: 'CHANCE' },
  {
    kind: 'property', id: 'park-lane', name: 'Park Lane', boardName: 'PARK\nLANE', group: 'dblue', price: 350,
    rents: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgage: 175,
    path: [[51.5128, -0.1588], [51.5095, -0.1565], [51.5060, -0.1540], [51.5035, -0.1525]], radius: STREET,
    fact: 'A row of luxury hotels looking out over Hyde Park, running from Marble Arch down to Hyde Park Corner.',
  },
  { kind: 'tax', id: 'super-tax', label: 'SUPER\nTAX', sub: 'PAY £100' },
  {
    kind: 'property', id: 'mayfair', name: 'Mayfair', boardName: 'MAYFAIR', group: 'dblue', price: 400,
    rents: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgage: 200,
    point: [51.5098, -0.1478], radius: 450,
    fact: 'Not a street but a whole neighbourhood, named after the May Fair that was held here every spring in the 1700s. Any street in the middle of Mayfair counts.',
  },
];

export const OWNABLE = SQUARES.filter((s) => s.kind === 'property' || s.kind === 'station' || s.kind === 'utility');
export const BY_ID = Object.fromEntries(SQUARES.map((s) => [s.id, s]));

// Chance and Community Chest cards. "target" cards only fire when an
// unclaimed property is within 1 km, and point the group at that property.
export const CARDS = [
  { deck: 'Chance', type: 'target', title: 'Advance to {name}.', body: 'It’s {dist} away. Claim it within the hour and the Bank pays a £50 bonus.' },
  { deck: 'Chance', type: 'jail', title: 'Go to Jail. Go directly to Jail.', body: 'Vine Street is {dist} away. This little lane was once home to a well-known police station. Get there within the hour for a £50 bonus.' },
  { deck: 'Community Chest', type: 'cash', amount: 100, title: 'Bank error in your favour.', body: 'Collect £100. Spend it wisely (on a round of drinks).' },
  { deck: 'Community Chest', type: 'cash', amount: 10, title: 'You have won second prize in a beauty contest.', body: 'Collect £10, and take a group photo to prove it.' },
  { deck: 'Community Chest', type: 'cash', amount: 50, title: 'It’s your birthday!', body: 'Collect £50 from every player. Or just a coffee each.' },
  { deck: 'Chance', type: 'target', title: 'Take a trip to {name}.', body: 'Only {dist} from here. Make it yours within the hour for a £50 bonus.' },
];
