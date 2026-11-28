/**
 * Return display dimensions for a video track. Rotation is optional because
 * expo-video 58.0.14 exposes VideoTrack.size but no track rotation property.
 * The API's playable MP4 is transcoded by FFmpeg with autorotation enabled,
 * so its decoded track dimensions are already in display orientation.
 */
export function getDisplayVideoSize(size, rotationDegrees = 0) {
  if (
    !size ||
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    return null;
  }

  const rotation = ((rotationDegrees % 360) + 360) % 360;
  if (rotation === 90 || rotation === 270) {
    return { width: size.height, height: size.width };
  }

  return { width: size.width, height: size.height };
}

/**
 * Use cover only when the source and viewport ratios are close enough that
 * the crop is negligible. Otherwise contain preserves every source edge.
 */
export function resolveCommunityVideoFit(videoSize, viewportSize, tolerance = 0.12) {
  if (
    !videoSize ||
    !viewportSize ||
    !Number.isFinite(videoSize.width) ||
    !Number.isFinite(videoSize.height) ||
    !Number.isFinite(viewportSize.width) ||
    !Number.isFinite(viewportSize.height) ||
    videoSize.width <= 0 ||
    videoSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return null;
  }

  const videoRatio = videoSize.width / videoSize.height;
  const viewportRatio = viewportSize.width / viewportSize.height;
  const relativeDifference = Math.abs(videoRatio - viewportRatio) / Math.max(videoRatio, viewportRatio);

  return relativeDifference < tolerance ? 'cover' : 'contain';
}
