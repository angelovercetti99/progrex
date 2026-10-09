// Types for the migrations.js file that drizzle-kit generates (it has none).
declare const bundled: {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
  };
  migrations: Record<string, string>;
};

export default bundled;
