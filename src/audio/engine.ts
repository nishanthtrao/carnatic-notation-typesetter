/*
 * Playback with Web Audio: a soft voice for the swaras, a tanpura drone and
 * tala clicks. Everything is synthesised; nothing is downloaded.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import type { Timeline } from './schedule';

export interface PlayOptions {
  /** frequency of middle Sa */
  saHz: number;
  /** aksharas (beats) per minute */
  tempo: number;
  tanpura: boolean;
  clicks: boolean;
  /** where to start, in aksharas */
  from?: number;
}

const LOOKAHEAD = 0.6; // seconds of sound scheduled ahead
const TICK = 100; // ms between scheduling passes

export class NotationPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer = 0;
  private t0 = 0; // ctx time of akshara `from`
  private from = 0;
  private nextNote = 0;
  private nextBeat = 0;
  private nextDrone = 0;
  private tl: Timeline | null = null;
  private opt: PlayOptions | null = null;
  private onEnd: (() => void) | null = null;
  private live = new Set<AudioScheduledSourceNode>();
  playing = false;

  /** Current position in aksharas (or -1 when stopped). */
  position(): number {
    if (!this.playing || !this.ctx || !this.opt) return -1;
    return this.from + Math.max(0, this.ctx.currentTime - this.t0) * (this.opt.tempo / 60);
  }

  async play(tl: Timeline, opt: PlayOptions, onEnd?: () => void) {
    this.stop();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.tl = tl;
    this.opt = opt;
    this.onEnd = onEnd || null;
    this.from = Math.max(0, Math.min(opt.from || 0, tl.length));
    this.t0 = ctx.currentTime + 0.12;
    this.nextNote = tl.notes.findIndex((n) => n.start + n.dur > this.from + 1e-6);
    if (this.nextNote < 0) this.nextNote = tl.notes.length;
    this.nextBeat = tl.beats.findIndex((b) => b.at >= this.from - 1e-6);
    if (this.nextBeat < 0) this.nextBeat = tl.beats.length;
    this.nextDrone = this.t0;
    this.playing = true;
    this.pump();
    this.timer = window.setInterval(() => this.pump(), TICK);
  }

  stop() {
    window.clearInterval(this.timer);
    this.playing = false;
    for (const n of this.live) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.live.clear();
    if (this.master && this.ctx) {
      const g = this.master;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      setTimeout(() => g.disconnect(), 200);
    }
    this.master = null;
  }

  /** Release the audio device (when the player is closed). */
  close() {
    this.stop();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private at(akshara: number): number {
    return this.t0 + (akshara - this.from) * (60 / this.opt!.tempo);
  }

  private pump() {
    const ctx = this.ctx;
    const tl = this.tl;
    const opt = this.opt;
    if (!ctx || !tl || !opt || !this.master) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    const spb = 60 / opt.tempo;

    while (this.nextNote < tl.notes.length && this.at(tl.notes[this.nextNote].start) < horizon) {
      const n = tl.notes[this.nextNote++];
      const start = Math.max(this.at(Math.max(n.start, this.from)), ctx.currentTime);
      const len = Math.max(0.06, (n.start + n.dur - Math.max(n.start, this.from)) * spb);
      this.voice(start, len, opt.saHz * Math.pow(2, n.semis / 12), n.gamaka);
    }
    if (opt.clicks)
      while (this.nextBeat < tl.beats.length && this.at(tl.beats[this.nextBeat].at) < horizon) {
        const b = tl.beats[this.nextBeat++];
        this.click(Math.max(this.at(b.at), ctx.currentTime), b.accent);
      }
    if (opt.tanpura)
      while (this.nextDrone < horizon) {
        this.tanpura(this.nextDrone, opt.saHz);
        this.nextDrone += 2.4;
      }

    const end = this.at(tl.length) + 0.4;
    if (ctx.currentTime > end) {
      this.stop();
      this.onEnd?.();
    }
  }

  private track<T extends AudioScheduledSourceNode>(node: T, stopAt: number): T {
    node.stop(stopAt);
    this.live.add(node);
    node.onended = () => this.live.delete(node);
    return node;
  }

  /** A soft, slightly reedy voice. Gamakas: ~ shake, / \ slides, ^ flick. */
  private voice(start: number, len: number, hz: number, gamaka: string | null) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    const peak = 0.22;
    const end = start + len;
    out.gain.setValueAtTime(0, start);
    out.gain.linearRampToValueAtTime(peak, start + 0.015);
    out.gain.setTargetAtTime(peak * 0.7, start + 0.02, 0.12);
    out.gain.setValueAtTime(peak * 0.7, Math.max(start + 0.03, end - 0.04));
    out.gain.linearRampToValueAtTime(0, end + 0.03);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = Math.min(hz * 5, 6000);
    out.connect(this.master!);
    tone.connect(out);

    const oscs = [
      { type: 'triangle' as OscillatorType, mult: 1, gain: 1 },
      { type: 'sawtooth' as OscillatorType, mult: 1, gain: 0.18 },
      { type: 'sine' as OscillatorType, mult: 2, gain: 0.12 },
    ].map((o) => {
      const osc = ctx.createOscillator();
      osc.type = o.type;
      osc.frequency.value = hz * o.mult;
      const g = ctx.createGain();
      g.gain.value = o.gain;
      osc.connect(g).connect(tone);
      osc.start(start);
      return this.track(osc, end + 0.06);
    });

    const bend = (cents: number, over: number) => {
      for (const o of oscs) {
        o.detune.setValueAtTime(cents, start);
        o.detune.linearRampToValueAtTime(0, start + over);
      }
    };
    if (!gamaka) return;
    if (gamaka === '~' || gamaka === '~~') {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.value = gamaka === '~~' ? 110 : 60;
      lfo.connect(depth);
      for (const o of oscs) depth.connect(o.detune);
      lfo.start(start + 0.04);
      this.track(lfo, end + 0.06);
    } else if (gamaka === '/') bend(-200, Math.min(0.14, len * 0.6));
    else if (gamaka === '//') bend(-400, Math.min(0.2, len * 0.7));
    else if (gamaka === '\\') bend(200, Math.min(0.14, len * 0.6));
    else if (gamaka === '\\\\') bend(400, Math.min(0.2, len * 0.7));
    else if (gamaka === '^') bend(120, Math.min(0.09, len * 0.5));
  }

  /** Four tanpura strings: Pa (lower), Sa, Sa, Sa (lower), one cycle every 2.4 s. */
  private tanpura(at: number, sa: number) {
    const ctx = this.ctx!;
    const strings = [(sa / 2) * Math.pow(2, 7 / 12), sa, sa, sa / 2];
    strings.forEach((hz, i) => {
      const t = at + i * 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(hz * 9, t);
      lp.frequency.exponentialRampToValueAtTime(hz * 3, t + 2.5);
      lp.Q.value = 2.5; // a little of the tanpura's buzz (jivari)
      lp.connect(g).connect(this.master!);
      for (const detune of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz;
        o.detune.value = detune;
        o.connect(lp);
        o.start(t);
        this.track(o, t + 3.3);
      }
    });
  }

  /** Tala click: higher and louder at angas and at the start of the cycle. */
  private click(at: number, accent: 0 | 1 | 2) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = [900, 1300, 1700][accent];
    const g = ctx.createGain();
    const v = [0.07, 0.12, 0.18][accent];
    g.gain.setValueAtTime(v, at);
    g.gain.exponentialRampToValueAtTime(0.0005, at + 0.05);
    o.connect(g).connect(this.master!);
    o.start(at);
    this.track(o, at + 0.06);
  }
}
