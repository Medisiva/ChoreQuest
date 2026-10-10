module.exports = function (api) {
  api.cache(true);
  // Zustand middleware includes ESM import.meta; Metro's script bundle needs
  // Expo's transform on web as well as native.
  return { presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]] };
};
