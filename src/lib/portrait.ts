type Alt = { vi: string; en: string };
export type PortraitAlt = { mat: Alt; giaiMat: Alt };

/**
 * UX section 5: real photos are used only as a pair (mat, giai-mat) with alt text in vi and en
 * for each. Returns true when photos should be shown, false for the placeholder; throws otherwise.
 */
export function usePhotos(mat: unknown, giaiMat: unknown, alt: PortraitAlt | undefined): boolean {
  if (!mat && !giaiMat) return false;
  const alts = [alt?.mat.vi, alt?.mat.en, alt?.giaiMat.vi, alt?.giaiMat.en];
  if (!mat || !giaiMat || alts.some((a) => !a?.trim())) {
    throw new Error("Portrait needs both images (mat, giai-mat) and alt text in vi and en for each.");
  }
  return true;
}
