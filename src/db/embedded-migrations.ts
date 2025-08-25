// In development, return empty object to use file-based migrations
// This prevents the macro from trying to read files at compile time with wrong paths
export const EMBEDDED_MIGRATIONS = {};