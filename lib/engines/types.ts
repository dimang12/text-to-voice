import type { Format } from "@/lib/tts";

/** A credential or option the user must supply for an external engine. Rendered generically by the Settings page. */
export type CredentialField = {
  key: string;
  labelKey: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  helpKey?: string;
};

export type ModelSpec = {
  id: string;
  label: string;
  noteKey?: string;
  /** Model accepts free-text style instructions. */
  instructions: boolean;
};

export type VoiceSpec = {
  id: string;
  name: string;
  tagKey: string;
  gradient: string;
  languages: string[];
};

export type EngineManifest = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  kind: "self-hosted" | "external";
  credentials: CredentialField[];
  models: ModelSpec[];
  voices: VoiceSpec[];
  formats: Format[];
  speed: { min: number; max: number; step: number };
  maxChars: number;
  /** Requests are split into pieces of this many characters; omit when the engine takes the whole text. */
  chunkChars?: number;
  stylePresets: boolean;
  docsUrl?: string;
};

/** Manifest plus this user's status, as sent to the client. Never carries secrets. */
export type EngineView = EngineManifest & {
  status: {
    available: boolean;
    configured: boolean;
    enabled: boolean;
    source: "site" | "user" | null;
    fields: Record<string, string>;
  };
};
