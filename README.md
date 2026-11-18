# BadTeam – players, groups and attendance

**Online (after setup):** https://badteam.mpdalbeck.workers.dev/

Part of the “Bad Apps” family, next to [BadClip](https://badclip.mpdalbeck.workers.dev/) (video library) and [BadPlan](https://badplan.mpdalbeck.workers.dev/) (training plans).
Keep your players and groups, tick off attendance at training on your phone, see who came how often and print attendance lists.
Local-first: no login, no server, no build step.

## Status
Working: players (birthday/age, playing hand, injuries, notes, active/paused, several groups, contact – parents’ contact only under 18),
groups (members, newsletter by email with all addresses in BCC), attendance (present / excused / absent per training; trainings come from
BadPlan’s dates and weekly slots or are created here), stats per group and period (“often absent lately”), A4 print of attendance lists
(never with phone numbers or emails), Dropbox sync, tour, German/English, light/dark.
BadPlan reads groups, players (without contact data) and attendance from `badteam-daten.json` and uses the number present for its court check.
Later: guests and trial training, teams and match days.

## How it works with BadPlan
- BadTeam owns players and groups. Groups that exist only in BadPlan are taken over once with the same id, so BadPlan’s dates and slots still match.
- BadTeam only **reads** `badplan-daten.json` (groups, slots, holidays, dates, session names) – it never writes BadPlan’s file.
- An attendance record points to BadPlan with `ref`: `ps:<slotId>:<day>` for a weekly slot (also when BadPlan has a date for it), `pd:<dateId>` for a single date, `null` for a training created in BadTeam.

## Files
- `index.html`, `styles.css`: user interface (look and shortcut logic shared with BadPlan, accent blue `#4f7bff`)
- `js/store.js`: data layer (IndexedDB, export/import, merge with tombstones)
- `js/i18n.js`: all UI texts in German and English
- `js/icons.js`: icon set and the BadTeam logo
- `js/app.js`: routing, home and backup pages, keyboard shortcuts
- `js/players.js`: player list, detail page, form
- `js/groups.js`: groups, members, newsletter dialog
- `js/trainings.js`: training list and attendance page
- `js/stats.js`: statistics
- `js/print.js`: A4 print views
- `js/badplan.js`: BadPlan bridge (reads `badplan-daten.json` from the shared Dropbox folder)
- `js/sync.js`, `js/dropbox.js`, `js/config.js`: Dropbox sync (shared Dropbox app “Bad Apps”, file `Dropbox/Apps/Bad Apps/badteam-daten.json`)
- `js/tour.js`: introduction tour
- `js/family.js`: app switcher – identical in all Bad Apps
- `sw.js`, `manifest.webmanifest`, `icon.svg`: PWA
- `wrangler.jsonc`, `_headers`, `.assetsignore`: Cloudflare Workers hosting

## Data format (`badteam-daten.json`)
```
players   { id, name, birthday, hand, injuries, note, active, groups: [groupId], phone, email, parentName, parentPhone, parentEmail, createdAt, updatedAt }
groups    { id, name, updatedAt }
trainings { id, day, start, end, groupId, place, ref, att: { playerId: 'p' | 'e' | 'a' }, note, createdAt, updatedAt }
deleted   { id: timestamp }   (kept 120 days)
```

## Keyboard shortcuts
Players: `N` new, `/` search, `E` edit, `Esc` back, `Ctrl+Enter` save. Groups: `N` new group, `M` email group.
Attendance: `A` all/rest present, `D` print. Stats: `D` print list. Backup: `E` export, `I` import.

## Run locally
ES modules need a small web server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/. For Dropbox, add the local address as a redirect URI in the Dropbox app “Bad Apps”.
