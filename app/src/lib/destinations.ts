export type Destination = {
  name: string;
  sub: string;
  lat: number;
  lng: number;
  zone: "east" | "west";
  group: "water & parks" | "town center" | "schools" | "food & shops" | "venues" | "pools & clubs";
};

// Curated from the official Nocatee EV Path map and OpenStreetMap POIs.
export const DESTINATIONS: Destination[] = [
  { name: "Nocatee Town Center", sub: "Shopping, dining, events", lat: 30.1100, lng: -81.41787, zone: "east", group: "town center" },
  { name: "Splash Waterpark", sub: "Pools, slides, cabanas", lat: 30.10359, lng: -81.41623, zone: "east", group: "water & parks" },
  { name: "Spray Waterpark", sub: "Splash pad for little ones", lat: 30.100119, lng: -81.414721, zone: "east", group: "water & parks" },
  { name: "Kids Splash Playground", sub: "Water play near the lagoon", lat: 30.10319, lng: -81.41589, zone: "east", group: "water & parks" },
  { name: "Nocatee Community Park", sub: "Athletic fields and courts", lat: 30.09667, lng: -81.41431, zone: "east", group: "water & parks" },
  { name: "Family Lagoon Pool", sub: "Resort pool at Town Center", lat: 30.10373, lng: -81.41584, zone: "east", group: "pools & clubs" },
  { name: "Crosswater Hall", sub: "Community events hall", lat: 30.1033, lng: -81.41516, zone: "east", group: "venues" },
  { name: "Crosswater Park", sub: "Neighborhood park", lat: 30.07135, lng: -81.40175, zone: "east", group: "water & parks" },
  { name: "Palm Valley Academy", sub: "Elementary school", lat: 30.12056, lng: -81.40763, zone: "east", group: "schools" },
  { name: "Ponte Vedra High School", sub: "Public high school", lat: 30.11246, lng: -81.39451, zone: "east", group: "schools" },
  { name: "Pine Island Academy", sub: "Elementary school", lat: 30.05015, lng: -81.39475, zone: "east", group: "schools" },
  { name: "Publix at Town Center", sub: "Grocery store", lat: 30.11054, lng: -81.41951, zone: "east", group: "food & shops" },
  { name: "Crosswater Community Church", sub: "Worship", lat: 30.12156, lng: -81.39673, zone: "east", group: "venues" },
  { name: "Valley Ridge Academy", sub: "School on the west side", lat: 30.09867, lng: -81.45477, zone: "west", group: "schools" },
  { name: "Allen D. Nease High School", sub: "School on the west side", lat: 30.07942, lng: -81.44765, zone: "west", group: "schools" },
  { name: "Palm Valley Golf Club", sub: "Golf and dining", lat: 30.10135, lng: -81.43561, zone: "west", group: "pools & clubs" },
  { name: "Cypress Park Pool", sub: "Pool on the west side", lat: 30.115640, lng: -81.455794, zone: "west", group: "pools & clubs" },
  { name: "Saint John Paul II Church", sub: "Worship on the west side", lat: 30.12303, lng: -81.43508, zone: "west", group: "venues" },

  { name: "Nocatee Fitness Club", sub: "Fitness center & gym", lat: 30.10318, lng: -81.41554, zone: "east", group: "pools & clubs" },
    { name: "Lap Pool", sub: "Lap swimming lanes", lat: 30.101855, lng: -81.415933, zone: "east", group: "water & parks" },
  { name: "Nocatee Welcome Center", sub: "245 Nocatee Center Way", lat: 30.103266, lng: -81.414941, zone: "east", group: "venues" },
  { name: "Nocatee Resident Services", sub: "245 Nocatee Center Way", lat: 30.1086, lng: -81.4202, zone: "east", group: "venues" },
  { name: "Orangetheory Fitness", sub: "Town Center studio", lat: 30.10972, lng: -81.41809, zone: "east", group: "pools & clubs" },
  { name: "Crosswater & Preservation Roundabout", sub: "Trail junction", lat: 30.1062, lng: -81.4248, zone: "east", group: "venues" },
  { name: "Splash right side", sub: "Pool decks at Splash", lat: 30.1036, lng: -81.4159, zone: "east", group: "water & parks" },

  { name: 'Bronx House Pizza', sub: 'Pizza', lat: 30.108241, lng: -81.415455, zone: 'east', group: 'food & shops' },
  { name: 'Clean Juice', sub: 'Juice bar', lat: 30.111483, lng: -81.419728, zone: 'east', group: 'food & shops' },
  { name: "Dunkin' Donuts", sub: 'Coffee', lat: 30.108403, lng: -81.415485, zone: 'east', group: 'food & shops' },
  { name: "Jersey Mike's Subs", sub: 'Subs', lat: 30.109730, lng: -81.418016, zone: 'east', group: 'food & shops' },
  { name: 'M Shack Nocatee', sub: 'Burgers', lat: 30.108854, lng: -81.409526, zone: 'east', group: 'food & shops' },
  { name: 'Publix GreenWise Market', sub: 'Market', lat: 30.110537, lng: -81.419510, zone: 'east', group: 'food & shops' },
  { name: 'South Kitchen & Spirits', sub: 'Dining', lat: 30.108861, lng: -81.414841, zone: 'east', group: 'food & shops' },
  { name: 'Starbucks Coffee', sub: 'Coffee', lat: 30.110139, lng: -81.417387, zone: 'east', group: 'food & shops' },
  { name: 'The Kookaburra Coffee', sub: 'Coffee', lat: 30.111613, lng: -81.418896, zone: 'east', group: 'food & shops' },
  { name: 'Loop Restaurant', sub: 'Dining', lat: 30.111613, lng: -81.418896, zone: 'east', group: 'food & shops' },
  { name: 'Tijuana Flats', sub: 'Mexican', lat: 30.110222, lng: -81.417428, zone: 'east', group: 'food & shops' },
  { name: 'CVS Pharmacy', sub: 'Pharmacy', lat: 30.108397, lng: -81.416913, zone: 'east', group: 'food & shops' },
  { name: 'GNC', sub: 'Vitamins', lat: 30.109701, lng: -81.418194, zone: 'east', group: 'food & shops' },
  { name: 'Publix Super Market', sub: 'Grocery', lat: 30.110537, lng: -81.419510, zone: 'east', group: 'food & shops' },
  { name: 'Verizon Wireless', sub: 'Mobile', lat: 30.108129, lng: -81.415436, zone: 'east', group: 'food & shops' },
  { name: 'Baptist Health AgeWell Center', sub: 'Health', lat: 30.112757, lng: -81.429209, zone: 'east', group: 'pools & clubs' },
  { name: 'Orange Theory Fitness', sub: 'Fitness', lat: 30.109717, lng: -81.418091, zone: 'east', group: 'pools & clubs' },
  { name: 'AT&T', sub: 'Mobile', lat: 30.109662, lng: -81.418406, zone: 'east', group: 'venues' },
  { name: 'The Link (Innovation & Activity Hub)', sub: 'Hub', lat: 30.109624, lng: -81.419238, zone: 'east', group: 'venues' },

  { name: "Settler's Pond", sub: "Pond & park loop", lat: 30.050470, lng: -81.402303, zone: "east", group: "water & parks" },
];
