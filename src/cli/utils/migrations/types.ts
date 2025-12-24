export interface Migration {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrateAthena?: (config: Record<string, unknown>) => Record<string, unknown>;
  migrateOmo?: (config: Record<string, unknown>) => Record<string, unknown>;
}

export interface MigrationResult {
  fromVersion: string;
  toVersion: string;
  migrationsApplied: string[];
  athenaConfig: Record<string, unknown>;
  omoConfig: Record<string, unknown>;
  hasBreakingChanges: boolean;
  breakingChangeWarnings: string[];
}
