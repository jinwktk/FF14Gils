import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const PERFORMANCE_BUDGETS = Object.freeze({
  firstParty: 40 * 1024,
  marketInitial: 64 * 1024,
});

export async function measurePerformanceBudget(baseDirectory) {
  const baseUrl = toDirectoryUrl(baseDirectory);
  const sourceNames = (await readdir(new URL('src/', baseUrl)))
    .filter((name) => name.endsWith('.js'));
  const firstPartyFiles = [
    new URL('index.html', baseUrl),
    new URL('styles.css', baseUrl),
    ...sourceNames.map((name) => new URL(`src/${name}`, baseUrl)),
  ];
  const worldIndexUrl = new URL('data/worlds.json', baseUrl);
  const worldIndex = JSON.parse(await readFile(worldIndexUrl, 'utf8'));
  const defaultWorld = worldIndex.worlds.find(
    (world) => world.name === worldIndex.defaultWorld,
  );
  const snapshotPath = defaultWorld?.periods?.[worldIndex.defaultPeriod] ?? defaultWorld?.path;

  if (!snapshotPath) {
    throw new Error('既定snapshot pathが必要です');
  }

  const firstPartyBytes = await gzipFilesIndividually(firstPartyFiles);
  const dataBytes = await gzipCompactJsonFiles([
    worldIndexUrl,
    new URL(snapshotPath, baseUrl),
  ]);

  return {
    firstPartyBytes,
    marketInitialBytes: firstPartyBytes + dataBytes,
  };
}

export function assertPerformanceBudget(measurement) {
  const failures = [];

  if (measurement.firstPartyBytes > PERFORMANCE_BUDGETS.firstParty) {
    failures.push(
      `first-party gzip ${measurement.firstPartyBytes} bytes exceeds ${PERFORMANCE_BUDGETS.firstParty}`,
    );
  }
  if (measurement.marketInitialBytes > PERFORMANCE_BUDGETS.marketInitial) {
    failures.push(
      `market initial gzip ${measurement.marketInitialBytes} bytes exceeds ${PERFORMANCE_BUDGETS.marketInitial}`,
    );
  }
  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

async function gzipFilesIndividually(urls) {
  const buffers = await Promise.all(urls.map((url) => readFile(url)));
  return buffers.reduce((total, buffer) => total + gzipSync(buffer).byteLength, 0);
}

async function gzipCompactJsonFiles(urls) {
  const buffers = await Promise.all(
    urls.map(async (url) => Buffer.from(JSON.stringify(JSON.parse(await readFile(url, 'utf8'))))),
  );
  return buffers.reduce((total, buffer) => total + gzipSync(buffer).byteLength, 0);
}

function toDirectoryUrl(value) {
  if (value instanceof URL) {
    return value.href.endsWith('/') ? value : new URL(`${value.href}/`);
  }

  return pathToFileURL(`${resolve(String(value))}${sep}`);
}

const isDirectRun = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const measurement = await measurePerformanceBudget(process.argv[2] ?? '.');
  assertPerformanceBudget(measurement);
  console.log(
    `Performance budget OK: first-party ${measurement.firstPartyBytes}/${PERFORMANCE_BUDGETS.firstParty} bytes, `
      + `market initial ${measurement.marketInitialBytes}/${PERFORMANCE_BUDGETS.marketInitial} bytes`,
  );
}
