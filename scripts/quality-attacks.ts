// npm run quality:attacks — prints the attack battery report (also served live by GET /api/quality).
import { runAttackBattery } from "../lib/quality/attacks";

runAttackBattery().then((report) => {
  for (const r of report.results) console.log(`${r.blocked ? "BLOQUEADO" : "FALHOU   "}  #${r.id} ${r.vector}: ${r.content} — ${r.detail}`);
  console.log(`\n${report.blocked} de ${report.total} bloqueados`);
  process.exit(report.blocked === report.total ? 0 : 1);
});
