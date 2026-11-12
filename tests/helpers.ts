import { readFileSync } from 'node:fs';
import { CinemaDB } from '../src/data/dexie/db';
import { DexieRepository } from '../src/data/dexie/DexieRepository';
import { normalizeSeed } from '../src/domain/seed';
import { planSeedImport } from '../src/services/seedImport';

let n = 0;
export function freshRepo() {
  const db = new CinemaDB(`test-${Date.now()}-${n++}`);
  return { db, repo: new DexieRepository(db) };
}

export function loadFixture(path = 'tests/fixtures/sample_seed.json'): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function importSeed(repo: DexieRepository, raw: unknown) {
  const seed = normalizeSeed(raw);
  if (seed.errors.length) throw new Error(seed.errors.join('\n'));
  const plan = planSeedImport(seed, await repo.load());
  await repo.applyChanges(plan.changes, 'merge');
  return { seed, plan };
}
