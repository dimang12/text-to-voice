# Studio plan

Studio is Voice Studio's full-page editing workspace. This document fixes the direction and the code structure before the multi-track work starts, so client and server stay cleanly separated as features grow.

## Direction (agreed 2026-09-19)

- **Studio is a navigation item, not a tab panel.** Clicking it opens a full-page workspace with its own header: back, project title, save status, export. The tabbed workspace (Create, Scripts, History, Voices, Bookmarked) is not shown inside it.
- **Multiple tracks, up to 50 per project.** Free-form: any clip can sit on any track. Each track has a name, volume, mute and solo.
- **Three ways to get audio onto the timeline:** import a file (MP3 or WAV, later M4A/OGG), add a clip from History, or generate in place using the same form as the Create page.
- **Generate in place.** The Create form is reused inside Studio as a panel. A script panel lists segments; each segment generates one clip placed after the previous one, and regenerating a segment replaces only that clip.
- **Effects come later, starting with EQ.** Previewed live in the browser and rendered identically on export.
- **Create stays** as the quick single-clip tool.

## Selection, highlighting and batch actions

**Visual rule.** Clips at rest are quiet: a soft tint with the waveform readable but low contrast, so a busy timeline stays calm. Selected clips flip to full contrast with a strong outline. Tracks work the same way: the selected track's header and lane are highlighted. The rule is "you only see strong colour where your selection is".

**Selection model.** Selection is a set, never a single item.

- Click selects one clip. Shift-click adds a range on the same track, ⌘-click toggles one more clip anywhere. Dragging on empty lane space with the Select tool draws a rubber band that selects everything it touches, across tracks.
- Clicking a track header selects the track and all its clips. ⌘A selects every clip in the project. Escape clears.
- Track headers form a layers panel on the left of the timeline, like layers in an image editor: name, mute, solo, volume, and a drag handle to reorder. It is the primary way to select whole tracks.

**Batch actions** apply to the whole selection at once, whether that is one clip, a rubber-band of clips, or entire tracks:

- Move, delete, cut, copy, duplicate.
- Volume, fade in and fade out.
- **Speed.** Slow down or speed up all selected clips together. This changes length, and the clips after them on the same track are not moved automatically. Pitch is preserved: the browser preview uses a time-stretch library, and export uses ffmpeg's tempo filter, so they match.
- **Effects and styles.** Bass boost, EQ, compression. A **style** is a named bundle of effects, for example "Podcast" = gentle EQ, compression, normalisation. Styles can be applied to selected clips or to whole tracks. Effects live on clips and on tracks; a track effect applies to everything on it.

Every batch action is one reducer action carrying the selection, so undo reverts the whole batch in one step.

## The Create tool (drag to create)

The tool rail has a **Create** tool next to Select and Razor. It works like drawing an event in a calendar:

1. With the Create tool active, the user presses on a track at the point where the new piece should start and drags to the point where it should end. A placeholder block follows the drag and shows its length.
2. On release, the block stays as a **placeholder clip** and the Generate panel opens for it, pre-filled with the target length and a **word budget**: the number of words that would roughly fill that time at the chosen voice and speed. About 150 words per minute for English at 1x; Khmer is estimated from characters. The estimate updates live as the user types, showing "about 2:10 of 2:00" so they can trim or add text before generating.
3. Generate fills the placeholder with the real clip. The clip takes its **actual** length; the placeholder was only a target. If the result runs longer than the drawn block it simply extends, and the user trims it or edits the script and regenerates. Nothing is cut automatically.
4. A placeholder that is never generated is saved with the project and shown hatched, so the user can come back to it. Deleting it works like deleting a clip.

The same panel can be opened without drawing: click a track at the playhead with the Create tool, and the target length is left empty.

## Copy and paste

- Copy (⌘C) and cut (⌘X) take the selected clips, keeping their relative positions. Paste (⌘V) places them at the **playhead** on the **selected track**, not on the track they came from. Duplicate (⌘D) is copy plus paste in one step.
- The paste target is always explicit in the UI: the selected track is highlighted and the playhead marks the position, so the user can see where clips will land before pressing paste.
- Paste does not push other clips aside. If the pasted clips overlap something already on that track, the user resolves it by moving or trimming, the same as after a drag.
- The clipboard is per session in the browser, so clips can be copied between two projects open in the same window.

## Limits

| Thing | Limit |
|---|---|
| Tracks per project | 50 |
| Clips per project | 500 |
| Import file size | 25 MB |
| Import formats | mp3, wav (m4a, ogg later) |
| Imports per user | 200 MB total while on the free storage tier |

## Domain model

A project's `timeline` column holds versioned JSON. Version 2 adds tracks with mix settings and effects. The zod schema in `lib/studio/schema.ts` is the single source of truth; the client and every server entry point validate with it.

```
Timeline { version: 2, tracks: Track[] }
Track    { id, name, order, gain, muted, solo, effects: Effect[], clips: Clip[] }
Clip     { id, sourceId, start, offset, duration, gain, fadeIn, fadeOut, rate, effects: Effect[] }
         rate is a playback speed multiplier (1 = original); duration is the length on the timeline after rate
         sourceId is null for a placeholder; a placeholder also stores its draft script and target length
Effect   { type: "eq", bands: { frequency, gain, q }[] } | { type: "compressor", ... } | { type: "bass", gain }
Style    a named preset that expands to a list of Effects (for example "Podcast")
```

`sourceId` refers to a row in `generations`, which is the app's single clip store. Imports are rows with `engine = "upload"`, so History, the clip bin, quotas and signed URLs stay one system.

## Code structure

Client and server never share mutable state; they share only types and zod schemas.

```
lib/studio/
  schema.ts        zod schemas + TS types for Timeline v2, migration from v1
  timeline.ts      pure functions: duration, sort, split, move, trim, add/remove track
  effects.ts       effect registry: parameters + defaults, one definition per effect
  edl.ts           builds the render edit list from a timeline (server-side only use)
lib/media/
  sources.ts       list generations + uploads as ClipSource with signed URLs
  uploads.ts       validate and store an imported file, record the row
lib/actions/
  projects.ts      create, save, rename, delete (thin: validate, persist, revalidate)
app/api/
  render/route.ts  timeline -> EDL -> media service -> store -> generation row
  uploads/route.ts multipart import -> lib/media/uploads
app/(app)/studio/page.tsx        projects list (inside the normal shell)
app/studio/[id]/page.tsx         full-page editor, its own layout, no tabs
components/studio/
  StudioShell.tsx   header, panels layout, keyboard shortcuts
  state/            reducer + actions + undo/redo + autosave hook (useStudio)
  audio/            TimelinePlayer (Web Audio), peaks, effect graph builder
  timeline/         Ruler, TrackLane, ClipView, Playhead, tool rail
  panels/           ClipBin, ImportPanel, GeneratePanel, ScriptSegments, Inspector
components/create/
  GenerateForm.tsx  the form extracted from the Create page, used by both pages
services/tts-mms/   media service: /synthesize, /render (per-track gain, mute, effects)
```

Rules:

1. Every timeline change goes through the reducer as a named action. No component mutates timeline JSON directly. Undo, autosave and later collaboration all hang off this.
2. Route handlers are thin. They authenticate, validate with the shared schema, call one function in `lib/`, and return.
3. Effects are defined once in `lib/studio/effects.ts`. The client maps a definition to Web Audio nodes; the server maps the same definition to ffmpeg filters. Adding an effect means one registry entry plus two mappers.
4. The media service only receives files and an edit list. It never touches the database or storage.
5. Timeline JSON is versioned and migrated on read, never rewritten in place by a migration script.

## Phases

- **A. Workspace and tracks.** Full-page editor, up to 50 tracks with add, rename, reorder, delete, mute, solo, volume. Move clips between tracks. Multi-select, copy, cut, paste at playhead on the selected track, duplicate. Import MP3/WAV by button or drag-and-drop. Export mixes all tracks.
- **B. Generate in place.** Extract the Create form, open it as a Studio panel, place the result at the playhead on the chosen track. The Create tool: drag to draw a placeholder, word budget from the target length, generate into it. Script segments panel with per-segment voice and regenerate.
- **C. Mix polish.** Multi-select and rubber band, layers panel with track selection, batch volume and fades, batch speed with pitch preserved, track meters, solo/mute behaviour during playback, master volume, export parity checks against the browser mix.
- **D. Effects and styles.** EQ and bass per clip and per track with live preview and identical render, then compressor and noise gate through the same registry. Styles as named bundles ("Podcast", "Narration", "Phone call"), applied to a selection or a track.
- **E. Later.** Music ducking under voice, a video track, shared projects.

Each phase ships on its own and is usable before the next starts.
