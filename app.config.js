// Dynamic config keeps Google Play and Samsung Store behavior separate.
module.exports = ({ config }) => {
  const isGalaxyStoreBuild = process.env.GALAXY_STORE_BUILD === 'true';
  const plugins = config.plugins ?? [];
  const selectedPlugins = isGalaxyStoreBuild
    ? plugins.filter((plugin) => {
        const name = Array.isArray(plugin) ? plugin[0] : plugin;
        return name !== 'expo-iap';
      })
    : plugins;

  return {
    ...config,
    plugins: selectedPlugins,
    ...(isGalaxyStoreBuild
      ? {
          autolinking: {
            ...(config.autolinking ?? {}),
            android: {
              ...(config.autolinking?.android ?? {}),
              exclude: [
                ...new Set([
                  ...(config.autolinking?.android?.exclude ?? []),
                  'expo-iap',
                ]),
              ],
            },
          },
          extra: {
            ...(config.extra ?? {}),
            distributionStore: 'galaxy-store',
          },
          updates: {
            ...(config.updates ?? {}),
            enabled: false,
            checkAutomatically: 'NEVER',
          },
        }
      : {
          extra: {
            ...(config.extra ?? {}),
            distributionStore: 'default',
          },
        }),
  };
};
