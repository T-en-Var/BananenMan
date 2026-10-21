# Soullink v2 — Implementation Plan

Status: **planning only — nothing in this document has been built yet.**

## 1. Do I understand Soullink?

A **Nuzlocke** is a self-imposed permadeath challenge: only the first Pokémon encountered
per route may be caught, everything is nicknamed, and a fainted Pokémon is "dead" — boxed
forever, never used again. A **Soullink** is a *multiplayer* Nuzlocke where two or more
players' games are linked route-for-route: whatever Player A encounters on Route 1 is
soul-linked to whatever Player B (and C, D, ...) encounters on Route 1. The defining
consequence is **shared fate**: if the link dies, everyone's half of it dies together, even
members that are perfectly healthy, because they're spiritually one being split across
multiple games.

An **Encounter** is the whole linked group at one location (one entry per participating
player). "Pokemon Died" kills the **encounter**, not a single entry — everyone's Pokémon
tied to that location dies together, in one action, with one shared killer/location/level.
Everything else (per-player team/box/graveyard, 6-slot team cap, nicknames,
permadeath-to-graveyard) matches standard Nuzlocke rules.

## 2. Resolved decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Shared fate | "Pokemon Died" operates on the whole **Encounter**, not a single player's entry. See §3.1/§4.5. |
| 2 | Ephemeral confirmations | Only self-confirmations are ephemeral. Cross-user approvals are regular pinged channel messages. |
| 3 | Species entry without modal autocomplete | Modal → fuzzy match → `/soullink submitpokemon` fallback with real autocomplete. See §3.2. |
| 4 | Picking a Discord member from a button | `UserSelectMenu` everywhere. |
| 5 | Run creator & organizer succession | Creator auto-joins as the first `ACTIVE` player/organizer; succession goes to the remaining active player with the earliest `joinedAt`. |
| 6 | Vacant spot takeover | Full history transfers to whoever claims a vacant spot. |
| 7 | Storage | Postgres via Prisma, no JSON files. |
| 8 | Multi-guild | Every table is `guildId`-scoped. |
| 9 | Reminder persistence | DB-backed timestamps + periodic sweep. |
| 10 | >25 options in a select menu | See §3.3 — paginated + searchable picker. |
| 11 | No category configured | Blocked with a clear error; a since-deleted category is treated the same way. |
| 12 | The "Missed" outcome | The normal outcome whenever any entry is added after its encounter already died — most commonly because the person pressing "Pokemon Died" hadn't logged their own entry yet. Not catch-up-specific. Stored explicitly at creation time, not re-derived from timestamps (fixes a real Undo-interaction bug — see §3.4). |
| 13 | Run creator role gate + Administrator bypass | New `GuildSettings.soullinkCreatorRoleId`; Administrator always bypasses both this and every organizer-only action. See §3.5. |
| 14 | Per-player nicknames | Required before any other action, including for the run creator. Self-service via `/soullink nickname`, organizer-editable via Manage Users. See §3.6. |
| 15 | User management | Unified **Manage Users** screen (Add user, the public/private visibility toggle, per-entry Edit nickname/Kick); leaving/kicking asks the organizer whether to leave the spot vacant or delete it outright. See §4.11. |
| 16 | Concurrent runs per guild | Unbounded. |
| 17 | Export / Import | Export anytime to a downloadable JSON file. Import attaches to `/soullink start` but does **not** skip the lobby — the organizer builds the real player roster normally, then reconciles it against the imported file's historical players before the run can start. See §3.7. |
| 18 | Non-player viewers ("spectating") | No invite list — the organizer toggles the whole channel between private and public from Manage Users. "Spectator" behavior is simply what any non-player gets when they can see the channel: ephemeral-only View Pokemon / View Timeline, everything else denied — regardless of whether they're a random public viewer or an Administrator who isn't a player in this run. See §3.8. |

## 3. Foundations

### 3.1 Schema (`prisma/schema.prisma` additions)

```prisma
model SoullinkRun {
  id                 String   @id @default(cuid())
  guildId            String
  channelId          String?
  name               String
  organizerPlayerId  String?
  status             SoullinkRunStatus @default(LOBBY)
  panelMessageId     String?
  createdAt          DateTime @default(now())
  startedAt          DateTime?
  endedAt            DateTime?

  isPublic           Boolean  @default(false) // @everyone can view when true; see §3.8
  players            SoullinkPlayer[]
  encounters         SoullinkEncounter[]
  events             SoullinkEvent[]

  @@index([guildId])
}

enum SoullinkRunStatus { LOBBY ACTIVE ENDED }

model SoullinkPlayer {
  id         String   @id @default(cuid())
  runId      String
  run        SoullinkRun @relation(fields: [runId], references: [id])
  userId     String?  // null while a slot is vacant
  nickname   String?  // null until set — gates all other actions, see §3.6
  status     SoullinkPlayerStatus @default(PENDING)
  invitedAt  DateTime @default(now())
  joinedAt   DateTime?
  leftAt     DateTime?
  entries    SoullinkEncounterEntry[]

  @@index([runId])
}

enum SoullinkPlayerStatus { PENDING ACTIVE VACANT DECLINED KICKED }

model SoullinkEncounter {
  id               String   @id @default(cuid())
  runId            String
  run              SoullinkRun @relation(fields: [runId], references: [id])
  location         String
  status           SoullinkEncounterStatus @default(OPEN)
  createdAt        DateTime @default(now())
  completedAt      DateTime?
  lastReminderAt   DateTime?
  diedAt           DateTime?
  killedByPlayerId String?
  deathLocation    String?
  deathLevel       Int?
  entries          SoullinkEncounterEntry[]

  @@index([runId])
}

enum SoullinkEncounterStatus { OPEN COMPLETE }

model SoullinkEncounterEntry {
  id          String   @id @default(cuid())
  encounterId String
  encounter   SoullinkEncounter @relation(fields: [encounterId], references: [id])
  playerId    String
  player      SoullinkPlayer @relation(fields: [playerId], references: [id])
  nickname    String
  species     String
  // "team" | "box" | "daycare" | custom, OR the literal "missed" — see §3.4. "missed" is
  // decided once, at creation time, and is never auto-reverted; Graveyard, by contrast, is
  // still a display-time override (this field stays whatever it really was) for exactly the
  // reason Undo needs it to be.
  placement   String
  placedAt    DateTime  @default(now())

  @@unique([encounterId, playerId])
}

model SoullinkEvent {
  id        String   @id @default(cuid())
  runId     String
  run       SoullinkRun @relation(fields: [runId], references: [id])
  type      String
  actorId   String?
  payload   Json
  createdAt DateTime @default(now())

  @@index([runId, createdAt])
}

model GuildSettings {
  guildId               String @id
  soullinkCategoryId    String?
  soullinkCreatorRoleId String?
}
```

Deletion is always a hard delete — mitigated by §3.7's export existing specifically so that
doesn't have to mean "gone forever."

### 3.2 `/soullink submitpokemon` + pending-action state
Unchanged: a second slash command with real `setAutocomplete`, resuming a short-lived
in-memory "pending species request" when a modal's fuzzy match wasn't exact/unique.

### 3.3 Reusable "encounter picker"
Unchanged: paginated (25 at a time, newest first) + searchable `StringSelectMenu`, shared by
Pokemon Died, Move, and Edit.

### 3.4 Per-player catch-up queue, reminders, and "Missed" (corrected)

The queue is unchanged: every active player has an implicit queue of not-yet-entered
encounters (oldest first), and the reminder sweep only nags about the head of it. Each
reminder — both the cold 15-minute one and the hot instant-advance-to-the-next-item one —
carries its own **Add encounter** button right on the ping itself, rather than just naming
the location and leaving the player to go hunt down the original message in channel history
(which, for a thirty-encounter backlog on an old channel, would otherwise be genuinely
impractical).

**Both Graveyard and Missed are one-time, direct decisions made the moment they happen —
nothing is ever compared on every view.** They just happen at different moments and need
different things to survive Undo:
- **Graveyard**: when "Pokemon Died" fires, existing entries aren't touched at all — their
  `placement` stays exactly what it really was (team/box), and the parent encounter being
  dead is what makes the display show them as Graveyard. Undo just clears the encounter's
  death fields and every entry is immediately back where it really lived — nothing to redo.
- **Missed**: when a *new* entry is added to an encounter that's *already* dead, there's no
  real placement to preserve — it was never alive — so `placement` is written as the literal
  value `"missed"` right then, once, permanently.

The only reason these aren't handled identically is that Graveyard has to be reversible
(there's a real "where it lived" to restore) and Missed doesn't (there's nothing to restore
it to). That's it — not timestamp math.

### 3.5 Privilege model: creator role + organizer + Administrator override
Unchanged: a shared `isPrivileged(member, run?)` helper used by every gated handler —
`/soullink start` needs the configured creator role (or since-fixed), organizer-only actions
need the current `organizerPlayerId`, and Discord `Administrator` bypasses both.

### 3.6 Required nicknames
Unchanged: `nickname` must be set before a player does anything else, including the run
creator (prompted immediately after channel creation, before the lobby message even posts).
`/soullink nickname "<value>"` for self-service changes later, scoped to whichever run owns
the channel it's run in; the organizer can rename anyone via Manage Users.

### 3.7 Export / Import (revised)

**Export** is unchanged: a `schemaVersion`-tagged JSON snapshot (run, players, encounters,
entries, events — positional references, no internal DB IDs), available during or after a
run, delivered as a file on an ephemeral reply.

**Import no longer bypasses the lobby.** Importing happens *before* "Start run" is pressed,
and the normal lobby invite/accept process still has to happen first — the organizer can't
know who's actually going to play until real people have joined. Concretely:

1. The organizer creates the run with `/soullink start` and an attached export file. The run
   enters `LOBBY` exactly as normal; the file is parsed and held, not yet applied.
2. The lobby's usual Add user / accept / nickname flow proceeds normally, building up the
   real current roster (this can include new people who were never in the original run).
3. Pressing **Start run** on a lobby with an attached import triggers a reconciliation step
   first, instead of starting immediately: for each player in the imported file, the
   organizer assigns one of the current lobby's real (already-accepted) players to it, or
   leaves it unassigned.
4. Once every imported player has been resolved:
   - **Assigned** → that real player's `SoullinkPlayer` inherits the imported player's full
     history (same mechanic as a vacant-spot takeover).
   - **Left unassigned** (fewer current players than the import had) → becomes a `VACANT`
     slot, nickname and history preserved, reclaimable later exactly like any other vacancy.
   - **Current lobby players not assigned to any imported slot** (more current players than
     the import had) → the organizer is prompted, per such player, to add them as a brand
     new player (starts with the full §3.4 catch-up queue from the imported run's first
     encounter) or kick them from the lobby entirely.
5. Only once every current player and every imported player has been resolved does **Start
   run** actually fire: all encounters/entries/events are imported **raw, timestamps
   untouched** — no resetting "aging clocks" — and the run goes `ACTIVE`. An imported `OPEN`
   encounter that already looks overdue by its original timestamps may fire a reminder
   immediately; that's expected and fine.

Two details worth being explicit about:
- **`SoullinkEvent.actorId` on imported events is preserved exactly as exported, never
  remapped to whichever real player got assigned to that historical slot.** The event log is
  a historical record of what actually happened; if it said the original Player A did
  something, it should keep saying that even if a completely different real Discord user is
  now controlling that slot going forward. View Timeline may therefore end up mentioning a
  Discord user who isn't even in the current roster (or the current server) for older
  entries — that's correct, not a bug.
- **Organizer identity is never part of what's imported.** The new run's organizer is always
  whoever ran `/soullink start` (same as any other run) — the imported file's historical
  organizer, if it even still matters, is irrelevant to the new run's management.

### 3.8 Channel visibility & non-player ("spectator") access

No invite list, no separate model — "spectator" isn't a role you're granted, it's simply
what you get by default when you can see the channel but aren't a player in the run.

- **Visibility toggle**: Manage Users (§4.11) gets a **Make public** / **Make private**
  button (organizer/Administrator). Public sets `isPublic = true` and removes the
  `@everyone` deny-`ViewChannel` overwrite (any guild member can now see the channel);
  private restores it. This replaces the earlier idea of inviting individual spectators —
  anyone who can see the channel is a potential viewer, full stop.
- **The authorization rule for every interaction, not just the panel**: first check whether
  the invoking user has an `ACTIVE` `SoullinkPlayer` row for this run.
  - **Is a player** → completely normal — every action available to them works exactly as
    specified elsewhere in this document, every response is the normal public/shared one.
  - **Is not a player** (true for a random guild member once the channel is public, and
    — this is the part that resolves the Administrator gray area — equally true for an
    Administrator who isn't personally a player in this run): **View Pokemon** and **View
    Timeline** are the only two actions available, and their response is **always
    ephemeral**. Every other *viewing-only* interaction is denied. However, an
    Administrator invoking one of the organizer-privileged *editing* actions (End run,
    Manage Users, Kick, the visibility toggle itself, ...) via the §3.5 bypass is not
    "just viewing" — those go through and post their normal, non-ephemeral messages, same
    as if the organizer had done it. The distinction is view-only vs. mutates-the-run, not
    "is this person an admin."

## 4. Per-feature technical approach

### 4.1 `/settings soullink` subcommands
`setcategory` and `setcreatorrole` (`.addRoleOption(...)`), both writing to `GuildSettings`.

### 4.2 `/soullink start` → lobby → channel creation
- Checks the §3.5 creator-role gate, then that the configured category still exists.
- Modal for the run name → `SoullinkRun` (`LOBBY`, `isPublic: false`) + creator's own
  `SoullinkPlayer` (`ACTIVE`, organizer) → creates the channel with `@everyone`'s
  `ViewChannel` explicitly denied (hidden from the whole guild by default, per §3.8 — only
  the creator, and later invited players, get an explicit `ViewChannel: true` overwrite) and
  the creator granted access → nickname modal for the creator (§3.6) → posts the lobby
  message (Add user / Leave run / Start run).
- If an import file was attached, it's parsed and held against the run for the
  reconciliation step described in §3.7; **Start run** triggers that reconciliation flow
  before the run can actually go `ACTIVE`.
- **Add user** → `UserSelectMenu` → `PENDING` → Accept/Decline ping → Accept leads straight
  into the nickname modal (§3.6) before the player is fully `ACTIVE`.
- **Leave run** → the unified flow in §4.11.

### 4.3 New Encounter
This is a two-step process, restored here in full since earlier compression of this section
had flattened it into one step and dropped some spec-mandated detail:

1. **New encounter** button → modal (location, nickname) → creates the `SoullinkEncounter`
   (`OPEN`) and posts an in-progress message listing contributed entries so far (none yet),
   with two buttons:
   - **Add encounter** (any player who doesn't already have an entry here) → species modal
     → §3.2's fuzzy-match/fallback flow → creates that player's own entry. On commit, scans
     every `SoullinkEncounterEntry` in the run for the same species case-insensitively and
     posts a non-blocking warning naming both locations if a duplicate is found — this never
     blocks the entry, it's informational only.
   - **Cancel** (the run's organizer/Administrator, **or** specifically whichever player
     created this particular encounter — nobody else) → confirmed, with the confirmation
     explicitly stating how many entries already exist and would be lost if any do → removes
     the encounter and its entries entirely (it never got far enough to matter for the
     shared-fate/history rules, so this is a true delete, not a §3.4 death).
2. **Completion**: once every player who was active when the encounter was created has an
   entry, or 5 minutes have elapsed, each player's placement is finalized (team if <6 team
   entries, else box) and the result message posts — image via the existing
   `generateBoxImageFromGroups`/`singlePokemonGroup` renderer, reused as-is. A late entry
   after completion re-triggers the result message. The result message has **Edit** and
   **Move** buttons; **Edit** is the canonical "encounter view" edit surface — rename a
   player's species, rename the location, remove a single entry — available to the player
   who owns the entry being edited, while **rename the encounter** and **remove it
   entirely** (affects everyone tied to it) carry the same organizer-or-original-creator
   restriction as the Cancel button above, confirmed the same way. §4.6's Edit pokemon
   action references this surface rather than duplicating it.

### 4.4 The Actions Panel
- Row 1 (anyone — reaching the panel at all already implies a nickname is set): New
  encounter, Pokemon died, View pokemon, View timeline, Move pokemon, Edit pokemon, Export
  (read-only — any active player, not just the organizer), Leave run. Row 2
  (organizer/Administrator only): End run, Manage Users.
- **Non-players** (§3.8) get an ephemeral denial on every button except View Pokemon / View
  Timeline, whose responses are ephemeral specifically for them, unlike the normal shared
  response those two buttons give an actual player — this applies equally to a random
  viewer once the channel is public and to an Administrator who isn't personally a player
  in this run.
- `panelMessageId` tracking and `/soullink paneltobottom` unchanged; the latter, along with
  `/soullink nickname`, only works for an actual active player of the run tied to that
  channel — a non-player gets the same "you're not a player in this run" denial.

### 4.5 Pokemon Died (shared fate)
Unchanged: targets any alive encounter via the §3.3 picker regardless of how many entries
currently exist (including zero) → group image → Confirm/reselect/Cancel → modal
(location, level) → sets the four death fields on the encounter. Undo / Change killer
unchanged.

### 4.6 Move pokemon / Edit pokemon
Unchanged — per-player, via the §3.3 picker, independent of §4.5. **Edit pokemon** opens the
same edit surface described in §4.3's result message (rename species/location/encounter,
remove) for whichever entry was selected, rather than a separate implementation.

### 4.7 View pokemon
Unchanged — Team / Box / Graveyard / Missed / Daycare / custom buckets, 16-per-page grid.
Public/shared response for actual players; ephemeral for any non-player (§3.8).

### 4.8 View timeline
Unchanged — `MOVE` events aggregate, `ENCOUNTER_DIED` events never do. Same
player-public-vs-non-player-ephemeral split as View pokemon.

### 4.9 Mid-run joins & vacant spot claims
Unchanged — "take X's vacant spot?" / organizer approval / full history inherited, brand-new
joins catch up via the §3.4 queue from the run's first encounter.

### 4.10 Ending a run
Unchanged — organizer/Administrator, confirmed, locks the channel, final message with
Export / Delete run (triple confirm) / View pokemon / View timeline.

### 4.11 Manage Users
- Lists every player (`@user "nickname"`) and every vacant spot (`VACANT "nickname"`), plus
  **Add user**, a **Make public**/**Make private** toggle (§3.8), and a dropdown over
  players/vacant-spots exposing **Edit nickname** and **Kick**.
- **During `LOBBY`** (before Start run), leaving or being kicked is unconditional removal —
  there's no encounter history yet for a "leave vacant?" question to make sense of, so it
  just deletes the `SoullinkPlayer` row outright.
- **Once `ACTIVE`**, leaving (self) or being kicked → regular channel ping to the current
  organizer: `User @user "nickname" left, leave spot vacant?` (Yes/No) — **except** when the
  departing player is the *last remaining active player in the run*, in which case there's
  nobody else to ping: they're shown the original "this permanently deletes the run and the
  channel" confirmation directly instead (matching the very first spec requirement for this
  — "if the last user wants to leave, prompt the user telling them the data will be
  permanently deleted and the channel too"), and the whole run is torn down the same way as
  a `LOBBY` reaching zero players.
  - **Yes** → `VACANT`, `userId` cleared, nickname + all entries kept.
  - **No** → confirmed, then hard-deletes the `SoullinkPlayer` row and every entry of
    theirs under a still-*alive* encounter; entries under an already-dead encounter (whether
    they ended up Graveyard or Missed) are left exactly as they are, since that outcome
    already happened independently of who currently owns the slot. This also means that
    encounter's own "all expected players have entered" completion check no longer waits on
    this player, since they're no longer part of the run.
  - Either way (short of the last-player case above), organizer succession (§2.5) runs
    first if the departing player was the organizer.
- Kicking an already-`VACANT` entry skips the Yes/No prompt (nothing to ask) and goes
  straight to the confirmed hard-delete.
- Adding a user who already has a `PENDING`/`ACTIVE` row for this run is rejected with a
  clear "already invited" / "already a player" message rather than creating a duplicate.

## 5. Delivery phases

1. **Schema + lobby + privilege model**: Postgres migration, both `/settings soullink`
   subcommands, the creator-role/Administrator gate, `/soullink start` through channel
   creation, required nicknames, Manage Users (including the public/private toggle),
   organizer succession, the unified leave/kick vacancy choice.
2. **Core encounter loop**: New encounter, species fuzzy-match + `/soullink submitpokemon`,
   duplicate warning, completion + placement, result message + image rendering.
3. **Shared-fate death, Move, Edit**: including killing partially/un-entered encounters,
   Undo, change-killer, custom locations, the §3.3 picker.
4. **View pokemon + View timeline**: paginated browsing, move-aggregation, the
   player-vs-non-player ephemeral split.
5. **The §3.4 queue + reminders, vacant-spot claims, mid-run joins, end-run/delete.**
6. **Export / Import**: including the reconciliation flow, which depends on every model
   above already being stable.

## 6. Testing & reliability strategy

Per phase: unit tests on state-transition logic (mocked Prisma) covering organizer
succession, the vacancy Yes/No branching and its selective cascade, the §3.4 queue's
head-selection, the Graveyard-vs-Missed timestamp comparison, and now the import
reconciliation's three branches (assigned / left vacant / add-new-or-kick); multi-row
mutations wrapped in `prisma.$transaction`; defensive handling of stale Discord
interactions; restart simulation at critical moments (mid-encounter-creation,
mid-death-confirmation, mid-vacant-claim, mid-reconciliation, across a reminder sweep tick),
asserting DB-backed state recovers cleanly with no double-fired reminders, orphaned rows, or
silently-lost actions; and an integration pass per phase against a real test Postgres before
moving on.

## 7. Final gap-check (this pass)

No new questions — this was a documentation-integrity audit, not a design round. Four
iterative rewrites had compressed §4.3 in particular down to one-liners, and in doing so
silently dropped a few things that were already correctly decided earlier. Found and
restored:

- **Zero-active-players-left deletion** (an original, explicit requirement — "if the last
  user wants to leave, prompt the user telling them the data will be permanently deleted and
  the channel too") had been quietly superseded by the generic Manage Users vacancy flow,
  which doesn't work when the departing player *is* the only one left to ask. §4.11 now
  special-cases this back in.
- **Leaving during `LOBBY` vs. `ACTIVE`** wasn't distinguished — asking "leave spot vacant?"
  before a run has even started doesn't mean anything (there's no history yet to preserve).
  §4.11 now makes lobby-leaves unconditional.
- **New Encounter's two-step structure and the Cancel button's authorization** (organizer,
  *or* specifically whoever created that one encounter — nobody else) had been flattened
  away entirely. Restored in full in §4.3, along with the duplicate-species warning's
  "names both locations" detail.
- **The Edit surface** (rename species/location/encounter, remove) was circularly
  under-specified — §4.3 said "see the Edit button," §4.6 said "same as §4.3" — with neither
  actually describing it. Now defined once in §4.3 and referenced, not duplicated, from §4.6.
- **Export's authorization was self-contradictory** — listed under the organizer-only row
  but annotated "not gated to the organizer." Resolved as: any active player can export
  (consistent with it being read-only and personally relevant to every player, same as View
  Pokemon/Timeline), not organizer-exclusive, but still denied to non-players per §3.8.
- Minor additions: `/soullink paneltobottom` and `/soullink nickname` are explicitly
  player-only now; duplicate invites are explicitly rejected; the "dead encounter" entries
  preserved during a Manage Users hard-delete explicitly covers both Graveyard and Missed.
- Confirmed the private-by-default channel creation (`@everyone`'s `ViewChannel` explicitly
  denied) is now spelled out directly in §4.2 rather than only implied by §3.1/§3.8.

## 8. Second gap-check pass

One genuine bug this time, not just missing documentation:

- **"Missed" had a real Undo interaction bug.** It was defined as derived by comparing
  `placedAt` to `encounter.diedAt` on every display. But Undo clears `diedAt` back to null —
  once that happens, a Pokémon that was never actually played (only backfilled into the
  record after its link had already died) would silently reappear on the player's team,
  because the comparison that used to mark it Missed no longer has anything to compare
  against. Fixed by making `"missed"` an explicit, permanent value stored in `placement` at
  creation time rather than a derived display state — Undo never touches `placement`, so a
  genuinely-missed entry stays missed regardless of what happens to the encounter's death
  status afterward. See §3.1/§3.4.
- **Catch-up reminders were passive notifications with nowhere to click.** A player thirty
  encounters behind would have been told "you're missing Route 12" with no way to act on it
  except scrolling back through channel history to find that specific old message. Reminders
  now carry their own **Add encounter** button directly.
- **Import didn't say whether historical event attribution survives reassignment.** Resolved
  as: `SoullinkEvent.actorId` on imported events is preserved exactly as exported, never
  remapped to whoever a historical slot gets reassigned to during reconciliation — the event
  log records what actually happened, not who currently controls the slot. Also clarified
  that organizer identity is never imported; it's always whoever ran `/soullink start`.
- **The New Encounter "Cancel" confirmation didn't say what it would destroy** (how many
  entries, if any, already existed) — added.
- **"Remove encounter" inside the Edit surface had no stated authorization** — it affects
  every player tied to that encounter, so it now carries the same organizer-or-original-
  creator restriction as Cancel, rather than being open to whoever happens to have Edit
  access to their own single entry.

Ready to proceed to Phase 1.
