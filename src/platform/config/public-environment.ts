/**
 * P0 has no browser-visible environment values. Additions require an explicit
 * security review because every value exported here becomes public build data.
 */
export type PublicEnvironment = Readonly<Record<string, never>>;

export const publicEnvironment: PublicEnvironment = Object.freeze({});
