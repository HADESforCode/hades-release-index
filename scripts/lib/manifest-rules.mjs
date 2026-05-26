const releasesUrlPrefix = "https://github.com/";

function parseIsoDate(value) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function expectedAssetPrefix(repositorySlug) {
  return `${releasesUrlPrefix}${repositorySlug}/releases/download/`;
}

export function validateEntryRules({ fileName, entry, repositorySlug }) {
  const errors = [];
  const expectedFileName = `${entry.slug}.json`;
  const platformKeys = new Set();
  const assetPrefix = expectedAssetPrefix(repositorySlug);

  if (fileName !== expectedFileName) {
    errors.push(
      `file name must match slug: expected ${expectedFileName} but received ${fileName}`
    );
  }

  if (!parseIsoDate(entry.updatedAt)) {
    errors.push("updatedAt must be a valid ISO timestamp");
  }

  for (const platform of entry.platforms) {
    const key = `${platform.os}:${platform.arch}`;

    if (platformKeys.has(key)) {
      errors.push(`duplicate platform entry for ${key}`);
    }

    platformKeys.add(key);

    if (!platform.downloadUrl.startsWith(assetPrefix)) {
      errors.push(`downloadUrl must target ${assetPrefix}`);
    }

    if (!platform.downloadUrl.endsWith(`/${platform.fileName}`)) {
      errors.push(`downloadUrl file name must match ${platform.fileName}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateManifestRules(entries) {
  const errors = [];
  const seen = new Set();

  for (const entry of entries) {
    if (seen.has(entry.slug)) {
      errors.push(`duplicate slug found in manifest: ${entry.slug}`);
    }

    seen.add(entry.slug);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
