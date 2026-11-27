export type VideoDimensions = { width: number; height: number };

export declare function getDisplayVideoSize(
  size: VideoDimensions | null | undefined,
  rotationDegrees?: number,
): VideoDimensions | null;

export declare function resolveCommunityVideoFit(
  videoSize: VideoDimensions | null | undefined,
  viewportSize: VideoDimensions | null | undefined,
  tolerance?: number,
): 'cover' | 'contain' | null;
