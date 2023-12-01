import * as fs from "fs/promises";
import * as toml from "toml";

import type { RewarderInfoRaw } from "./decorateRewarders";

const main = async () => {
  const raw = await fs.readFile(`${__dirname}/../../Rewarders.toml`);
  const data = toml.parse(raw.toString()) as { rewarders: RewarderInfoRaw[] };
  await fs.writeFile(
    `${__dirname}/../config/rewarder-list.json`,
    JSON.stringify(data, null, 2),
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
