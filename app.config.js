module.exports = ({ config }) => {
  const isGooglePlayRelease = process.env.GOOGLE_PLAY_RELEASE === 'true';
  const resolvedConfig = {
    ...config,
    extra: {
      ...config.extra,
      distributionStore: isGooglePlayRelease ? 'google-play' : 'direct',
    },
  };

  // Google Play build is a consumption-only version for Premium: no external
  // checkout links and no Google Play Billing integration are shipped in it.
  // Click and Payme checkout remain available in the web/direct distribution.
  if (isGooglePlayRelease) {
    resolvedConfig.plugins = (resolvedConfig.plugins || []).filter((plugin) =>
      (typeof plugin === 'string' ? plugin : plugin[0]) !== 'expo-iap'
    );
    resolvedConfig.autolinking = {
      ...(resolvedConfig.autolinking || {}),
      android: {
        ...((resolvedConfig.autolinking || {}).android || {}),
        exclude: [...new Set([
          ...(((resolvedConfig.autolinking || {}).android || {}).exclude || []),
          'expo-iap',
        ])],
      },
    };
  }

  resolvedConfig.plugins = [
    ...(resolvedConfig.plugins || []),
    ['expo-build-properties', { android: { compileSdkVersion: 37, targetSdkVersion: 36 } }],
  ];

  return resolvedConfig;
};
