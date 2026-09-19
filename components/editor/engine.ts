import type { Clip, ClipSource } from "@/lib/types";

/**
 * Plays a timeline of clips with the browser's Web Audio API.
 * Each clip becomes a buffer source scheduled at the right moment, with its own gain and fades.
 */
export class TimelinePlayer {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private active: AudioBufferSourceNode[] = [];
  private startedAt = 0;
  private startPos = 0;
  private endAt = 0;
  playing = false;

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  has(sourceId: string): boolean {
    return this.buffers.has(sourceId);
  }

  buffer(sourceId: string): AudioBuffer | undefined {
    return this.buffers.get(sourceId);
  }

  /** Download and decode a source once. Safe to call repeatedly. */
  load(source: ClipSource): Promise<AudioBuffer> {
    const cached = this.buffers.get(source.id);
    if (cached) return Promise.resolve(cached);
    const inflight = this.pending.get(source.id);
    if (inflight) return inflight;
    if (!source.url) return Promise.reject(new Error("Source has no URL"));
    const p = fetch(source.url)
      .then((r) => { if (!r.ok) throw new Error(`Could not fetch audio (${r.status})`); return r.arrayBuffer(); })
      .then((ab) => this.context().decodeAudioData(ab))
      .then((buf) => { this.buffers.set(source.id, buf); this.pending.delete(source.id); return buf; })
      .catch((err) => { this.pending.delete(source.id); throw err; });
    this.pending.set(source.id, p);
    return p;
  }

  /** Start playback of the given clips from a timeline position in seconds. */
  play(clips: Clip[], from: number, totalEnd: number): void {
    this.stop();
    const ctx = this.context();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime + 0.05;
    this.startedAt = now;
    this.startPos = from;
    this.endAt = totalEnd;
    for (const clip of clips) {
      const buf = this.buffers.get(clip.sourceId);
      if (!buf) continue;
      const clipEnd = clip.start + clip.duration;
      if (clipEnd <= from) continue;
      const skip = Math.max(0, from - clip.start);
      const when = now + Math.max(0, clip.start - from);
      const sourceOffset = clip.offset + skip;
      const playFor = Math.max(0, Math.min(clip.duration - skip, buf.duration - sourceOffset));
      if (playFor <= 0) continue;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const g = clip.gain;
      gain.gain.setValueAtTime(g, when);
      if (clip.fadeIn > 0 && skip < clip.fadeIn) {
        const startLevel = g * (skip / clip.fadeIn);
        gain.gain.setValueAtTime(startLevel, when);
        gain.gain.linearRampToValueAtTime(g, when + (clip.fadeIn - skip));
      }
      if (clip.fadeOut > 0) {
        const fadeStart = when + playFor - clip.fadeOut;
        if (fadeStart > when) {
          gain.gain.setValueAtTime(g, fadeStart);
          gain.gain.linearRampToValueAtTime(0, when + playFor);
        } else {
          gain.gain.linearRampToValueAtTime(0, when + playFor);
        }
      }
      src.connect(gain).connect(ctx.destination);
      src.start(when, sourceOffset, playFor);
      this.active.push(src);
    }
    this.playing = true;
  }

  /** Current timeline position in seconds. */
  position(): number {
    if (!this.playing || !this.ctx) return this.startPos;
    return Math.min(this.endAt, this.startPos + (this.ctx.currentTime - this.startedAt));
  }

  finished(): boolean {
    return this.playing && this.position() >= this.endAt;
  }

  stop(): void {
    for (const s of this.active) { try { s.stop(); } catch {} s.disconnect(); }
    this.active = [];
    this.playing = false;
  }

  /** Short preview of a single source, used by the Add clip panel. */
  preview(source: ClipSource, seconds = 3): void {
    void this.load(source).then((buf) => {
      this.stop();
      const ctx = this.context();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0, 0, Math.min(seconds, buf.duration));
      this.active.push(src);
    });
  }
}

/** Peak amplitude per bucket at a fixed resolution, for drawing waveforms. */
export function computePeaks(buffer: AudioBuffer, bucketsPerSecond = 100): Float32Array {
  const channel = buffer.getChannelData(0);
  const bucket = Math.max(1, Math.floor(buffer.sampleRate / bucketsPerSecond));
  const count = Math.ceil(channel.length / bucket);
  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const end = Math.min(channel.length, (i + 1) * bucket);
    for (let j = i * bucket; j < end; j++) {
      const v = Math.abs(channel[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}
