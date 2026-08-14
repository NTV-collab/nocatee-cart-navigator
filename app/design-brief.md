# Design Brief - Nocatee Cart Navigator

## Design read
For Nocatee residents who get around by electric golf cart: a calm, sunlit,
pocket-navigator tool that feels like the community itself, not like a tech
company. Warm sand backgrounds, teal greenways, clean function first.

## Concept spine
"The caretaker: the app sits in the passenger seat like a windshield-mounted
gps for the village" - plain, honest tool chrome with printed-map warmth and
monospace GPS data.

## Delivery tier
editorial - calm functional tool, micro-motion only (route trace draws in,
hover states, no scroll theater).

## Animation mode: non-animated
User named the product "Nocatee Cart Navigator" (a working GPS tool). Map-first
tool page, no scroll-scrub journey. The map and the route trace are the wow.

## Locked palette
- ink #142B2B (deep teal-black) - text, headers
- teal #0E7C66 - primary actions, cart paths on the map
- teal deep #0A5A4C - pressed/visited states
- lagoon #2FAE9A - map accents, active pill
- sand #F3EFE5 - page ground
- paper #FBF9F3 - cards and map well
- line #E2DAC6 - hairline borders
- clay #9E5B32 - reserved for rules/warning semantics only (equipment alerts)
Not the graphic+orange family, not near-black+neon, no purple, no beige+brass:
teal on warm sand with ink typography is coastal Florida, not AI default.

## Locked type
Outfit (display + body, 400-700) with IBM Plex Mono for mono GPS/data labels
(nav distances, zone tags, eyebrows-like tiny labels). Serif: none.

## Section plan
1. Tool section (the navigator): map well + control rail, full viewport
   presence, the hero itself
2. Route steps/summary inside the control rail
3. "Ride the rules" editorial pair: two flat lists (path rules, cart rules)
4. "Where the map comes from": image (bespoke hero render) + short text
5. Footer with affiliations: OpenStreetMap + Olth bearing

No repeating 3-col cards anywhere; no split-header; one accent.

## Asset plan
- Bespoke hero render (aerial-style: teal cart on a greenway) - generated,
  reused from the launch branding scene, /assets/hero.jpg
- Route line styling - CSS/SVG drawn in Leaflet
- App icon / OG / cover - generate_app_branding run
- Marker pins and mode pills - hand CSS, not icon sets, one stroke language

## CTA inventory
- "Use my location" - primary teal pill (locates and binds start)
- "Set start" / "Set destination" - toggle pick pills on the map
- "Clear route" - hairline text button
- "Plan a ride" strip - pills on destination chips (they set end + route)
Every CTA has its own interaction identity; none share class styles.

## Notes
Data: OpenStreetMap cart-legal network (paths + 25mph streets) clipped to the
Nocatee community polygon, official Nocatee EV path map as check. Beta that we
are not affiliated with Nocatee/The PARC Group. Text has no em dashes, no fake
stats.