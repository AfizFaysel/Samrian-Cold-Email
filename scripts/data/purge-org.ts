import { purgeOrganization } from "../../src/server/data/purge-org";
import { createDb } from "../../src/server/db/db";

const [orgId, flag] = process.argv.slice(2);
const url = process.env.DATABASE_URL;

if (!orgId || !url || (flag !== undefined && flag !== "--confirm")) {
  process.stderr.write(
    "Usage: DATABASE_URL=<owner url> bun run data:purge-org <orgId> [--confirm]\n"
  );
  process.exit(1);
}

const confirm = flag === "--confirm";
const { client } = createDb({ driver: "postgres-js", url });
const counts = await purgeOrganization(client, orgId, { confirm });

process.stdout.write(`${JSON.stringify({ orgId, deleted: confirm, counts }, null, 2)}\n`);
if (!confirm) process.stdout.write("Dry run. Nothing was deleted. Add --confirm to delete.\n");
process.exit(0);
