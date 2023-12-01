import * as fs from "fs/promises";
import * as toml from "toml";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = async () => {
  const raw = await fs.readFile(`${__dirname}/Rewarders.toml`);
  const data = toml.parse(raw.toString());
  await fs.mkdir(`${__dirname}/src/config`, { recursive: true });
  await fs.writeFile(
    `${__dirname}/src/config/rewarder-list.json`,
    JSON.stringify(data, null, 2),
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
