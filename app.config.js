// Dynamic config keeps Google Play and Samsung Store behavior separate.
module.exports = ({ config }) => {
  const isGalaxyStoreBuild = process.env.GALAXY_STORE_BUILD === 'true';

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      distributionStore: isGalaxyStoreBuild ? 'galaxy-store' : 'default',
    },
    ...(isGalaxyStoreBuild
      ? {
          updates: {
            ...(config.updates ?? {}),
            enabled: false,
            checkAutomatically: 'NEVER',
          },
        }
      : {}),
  };
};
