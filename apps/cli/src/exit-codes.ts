export const ExitCode = {
  ok: 0,
  invalidInput: 2,
  uninitialized: 3,
  needsSync: 4,
  conflict: 5,
  gitFailure: 6,
  incompatible: 7,
  unexpected: 1
} as const;
