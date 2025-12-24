import * as semver from "semver";
import { VERSION } from "../../../shared/constants.js";
import { MIGRATIONS } from "./migrations.js";
import type { Migration, MigrationResult } from "./types.js";

export function migrateConfigs(
  athenaConfig: Record<string, unknown>,
  omoConfig: Record<string, unknown>,
  fromVersion: string
): MigrationResult {
  const targetVersion = VERSION;
  const migrationsApplied: string[] = [];
  const breakingChangeWarnings: string[] = [];
  let hasBreakingChanges = false;

  let currentAthena = { ...athenaConfig };
  let currentOmo = { ...omoConfig };

  const normalizedFrom = semver.valid(semver.coerce(fromVersion)) || "0.0.0";
  const normalizedTarget = semver.valid(semver.coerce(targetVersion)) || VERSION;

  const sortedMigrations = [...MIGRATIONS].sort((a, b) => {
    const aVersion = semver.valid(semver.coerce(a.fromVersion)) || "0.0.0";
    const bVersion = semver.valid(semver.coerce(b.fromVersion)) || "0.0.0";
    return semver.compare(aVersion, bVersion);
  });

  for (const migration of sortedMigrations) {
    const migrationFrom = semver.valid(semver.coerce(migration.fromVersion)) || "0.0.0";
    const migrationTo = semver.valid(semver.coerce(migration.toVersion)) || "0.0.0";

    if (semver.gt(migrationFrom, normalizedFrom)) continue;
    if (semver.lte(migrationTo, normalizedFrom)) continue;
    if (semver.gt(migrationTo, normalizedTarget)) continue;

    if (migration.migrateAthena) {
      currentAthena = migration.migrateAthena(currentAthena);
    }
    if (migration.migrateOmo) {
      currentOmo = migration.migrateOmo(currentOmo);
    }

    migrationsApplied.push(
      `${migration.fromVersion} → ${migration.toVersion}: ${migration.description}`
    );

    if (isBreakingMigration(migration)) {
      hasBreakingChanges = true;
      breakingChangeWarnings.push(
        `Migration ${migration.fromVersion} → ${migration.toVersion} contains breaking changes: ${migration.description}`
      );
    }
  }

  currentAthena.version = targetVersion;

  return {
    fromVersion,
    toVersion: targetVersion,
    migrationsApplied,
    athenaConfig: currentAthena,
    omoConfig: currentOmo,
    hasBreakingChanges,
    breakingChangeWarnings,
  };
}

function isBreakingMigration(migration: Migration): boolean {
  const fromMajor = semver.major(semver.coerce(migration.fromVersion) || "0.0.0");
  const toMajor = semver.major(semver.coerce(migration.toVersion) || "0.0.0");
  return toMajor > fromMajor;
}

export function needsMigration(fromVersion: string): boolean {
  const normalizedFrom = semver.valid(semver.coerce(fromVersion)) || "0.0.0";
  const normalizedTarget = semver.valid(semver.coerce(VERSION)) || VERSION;

  if (semver.gte(normalizedFrom, normalizedTarget)) {
    return false;
  }

  return MIGRATIONS.some((m: Migration) => {
    const migrationFrom = semver.valid(semver.coerce(m.fromVersion)) || "0.0.0";
    const migrationTo = semver.valid(semver.coerce(m.toVersion)) || "0.0.0";

    return semver.lte(migrationFrom, normalizedFrom) && semver.gt(migrationTo, normalizedFrom);
  });
}
