// Run: npm run sync  (uses mock data unless OCTOPUS_API_KEY, OCTOPUS_MPAN and OCTOPUS_METER_SERIAL are set)
try {
  process.loadEnvFile();
} catch {
  // .env is optional
}
const { syncOctopusData } = await import("../lib/sync");
console.log(await syncOctopusData());
