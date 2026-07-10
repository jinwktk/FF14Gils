import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function compactJsonDirectory(directory) {
  const root = directory instanceof URL ? fileURLToPath(directory) : resolve(directory);
  const files = await collectJsonFiles(root);

  for (const path of files) {
    const value = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(path, JSON.stringify(value));
  }

  return { files: files.length };
}

async function collectJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path);
    }
  }

  return files;
}

const commandPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (commandPath === fileURLToPath(import.meta.url)) {
  const target = resolve(process.argv[2] ?? 'dist/data');
  const result = await compactJsonDirectory(target);
  console.log(`Compacted ${result.files} JSON files in ${target}`);
}
