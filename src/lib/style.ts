import { ART_STYLES, type ArtStyle } from "@/stores/movie-store";

export function resolveStyle(custom: string, preset: ArtStyle): string {
  if (custom.trim()) return custom.trim();
  return ART_STYLES.find((s) => s.key === preset)?.label ?? preset;
}
