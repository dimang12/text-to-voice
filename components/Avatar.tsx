"use client";

import { useEffect, useState } from "react";
import { VOICES, type Voice } from "@/lib/tts";

const HAIR = [
  "M14 30c2-12 12-18 22-18s20 6 22 18c-4-6-12-9-22-9s-18 3-22 9z",
  "M12 34c0-14 10-22 24-22s24 8 24 22l-6-2c-2-8-9-12-18-12s-16 4-18 12z",
  "M16 28c4-10 12-16 20-16 10 0 18 6 20 16-6-4-12-6-20-6s-14 2-20 6z",
  "M10 36c2-16 12-24 26-24s24 8 26 24c-8-10-16-14-26-14S18 26 10 36z",
];
const SKIN = ["#f6d3b9", "#e8b48f", "#c98e62", "#8d5a3b"];
const HAIR_COLOR = ["#2b2140", "#5a3a2a", "#e7c27a", "#3f4a8a"];
const SHIRT = ["#8f7cff", "#ff7ad9", "#6ee7ff", "#ffb86b"];

type Props = { voice: Voice; size?: "lg" | "sm" | "xs" };

// Remembers which voices have real artwork so each PNG is probed once per page load.
const imageCache = new Map<Voice, boolean>();

/** Placeholder cartoon face. Drop a PNG at /public/avatars/<voice>.png to replace it. */
export function Avatar({ voice, size = "lg" }: Props) {
  const [hasImage, setHasImage] = useState(() => imageCache.get(voice) === true);

  useEffect(() => {
    if (imageCache.has(voice)) return;
    const probe = new Image();
    probe.onload = () => { imageCache.set(voice, true); setHasImage(true); };
    probe.onerror = () => { imageCache.set(voice, false); };
    probe.src = `/avatars/${voice}.png`;
  }, [voice]);
  const i = VOICES.indexOf(voice);
  const glasses = i % 5 === 2;
  return (
    <div className={`avatar g-${voice} ${size === "lg" ? "" : size}`}>
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/avatars/${voice}.png`} alt="" />
      )}
      {!hasImage && (
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="80" r="26" fill={HAIR_COLOR[(i * 3) % 4]} opacity=".9" />
          <path d="M22 74c0-10 6-16 14-16s14 6 14 16z" fill={SHIRT[i % 4]} />
          <circle cx="36" cy="38" r="17" fill={SKIN[i % 4]} />
          <path d={HAIR[i % HAIR.length]} fill={HAIR_COLOR[(i * 3) % 4]} />
          <circle cx="29" cy="39" r="2" fill="#1a1530" />
          <circle cx="43" cy="39" r="2" fill="#1a1530" />
          {glasses && (
            <>
              <circle cx="29" cy="39" r="5" fill="none" stroke="#1a1530" strokeWidth="1.4" />
              <circle cx="43" cy="39" r="5" fill="none" stroke="#1a1530" strokeWidth="1.4" />
              <path d="M34 39h4" stroke="#1a1530" strokeWidth="1.4" />
            </>
          )}
          <path d="M30 46q6 5 12 0" stroke="#1a1530" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
