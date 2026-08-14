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
  { name: "Spray Waterpark", sub: "Splash pad for little ones", lat: 30.10006, lng: -81.41568, zone: "east", group: "water & parks" },
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
  { name: "Cypress Park Pool", sub: "Pool on the west side", lat: 30.11511, lng: -81.45579, zone: "west", group: "pools & clubs" },
  { name: "Saint John Paul II Church", sub: "Worship on the west side", lat: 30.12303, lng: -81.43508, zone: "west", group: "venues" },
];
