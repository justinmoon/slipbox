// Get the data directory - ALWAYS requires SLIPBOX_DATA_DIR
const getDataDir = () => {
  if (!process.env.SLIPBOX_DATA_DIR) {
    throw new Error(
      "SLIPBOX_DATA_DIR environment variable is required. Run scripts/init.sh to set up.",
    );
  }
  return process.env.SLIPBOX_DATA_DIR;
};

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  dataDir: getDataDir(),
  // Keep notesDir for backward compatibility with migration scripts
  notesDir: getDataDir(),
  defaultPageSize: 10,
  minPageSize: 5,
  maxPageSize: 50,
  searchDebounceMs: 300,
  maxPreviewLength: 100,
};
