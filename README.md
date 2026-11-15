# Full Board · London

A walking game for a group of friends: explore London and claim every street, station and utility on the UK Monopoly board, until the board is complete.

## What it does

- **Claims places automatically.** Keep the app open while you walk; when you reach a street (anywhere along it), station or landmark, it becomes yours.
- **Shows the real board.** Claimed squares are bright with a tick, unclaimed ones are faded. It always opens on the full board; pinch, double-tap or use **+ / − / full board** to zoom.
- **Celebrates each claim.** Each claim gets a Monopoly-style "Congratulations!" screen with the property's title deed, an OWNED stamp, and a short "Why is it on the board?" fact.
- **Colour-set bonuses.** Finishing a colour set triggers a FULL SET screen and doubles that set's rent.
- **Nudges you about nearby places.** When an unclaimed property is within 1 km you get a notification. It's limited to one every 10 minutes, and the same place won't come up again for 3 hours.
- **Chance and Community Chest cards (rare).** There are at most 2 a day, never in the first 15 minutes. A card only points you somewhere if it's within 1 km, and claiming that place within the hour pays a £50 bonus.
- **Photo stamps.** Add a crew selfie to any deed. The photo is framed as a title deed with a dated "ACQUIRED" stamp, ready to share.
- **Counters.** Properties claimed out of 28, colour sets out of 8, bonuses, and the portfolio value in Monopoly money.

Everything is stored on the phone (no account, no server). One phone runs the game for the group.

## Playing it

1. Open the site on your phone (it must be served over **https**: GitHub Pages does this for you).
2. **iPhone:** tap **Share → Add to Home Screen**, then open it from the home screen. Notifications on iPhone only work this way (iOS 16.4+).
3. Tap **Start the game** and allow location and notifications.
4. In **Settings**, turn on **Keep screen awake** while walking. Phones pause location when the screen locks, so the game can only claim places while it's open.

## Testing without walking

Open the site with `?test=1` at the end of the address (or turn on **Test mode** in Settings). An orange **TEST** button appears:

- **Arrive here**: claims the chosen place.
- **Stand 600 m away**: triggers a "nearby" nudge.
- **Draw a card**: shows a Chance / Community Chest card.
- **Go far away**: moves you off the board.

Turn test mode off and use **Settings → Reset the game** before you play for real.

## Tuning

- Street lines, points and claim radii are in `js/data.js`. If a claim fires too early or too late on the ground, adjust that square's coordinates or `radius`.
- Nudge and card timings are at the top of `js/app.js`.
- Electric Company is Battersea Power Station; Water Works is the Museum of Water & Steam at Kew Bridge. Change them in `js/data.js`.

## Running locally

It's a static site with no build step:

```
python3 -m http.server 8000
```

then open http://localhost:8000/?test=1. Location only works on `localhost` or https.

## Deploying (GitHub Pages)

Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**. The site appears at `https://<user>.github.io/monopoly/`.

---

Personal fan project, not affiliated with or endorsed by Hasbro. MONOPOLY is a trademark of Hasbro.
