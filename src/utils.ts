import type { Network } from "@saberhq/solana-contrib";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fastStringify from "fast-json-stable-stringify";

export const stringify = (v: unknown) =>
  JSON.stringify(
    JSON.parse(fastStringify(JSON.parse(JSON.stringify(v, serialize)))),
    null,
    2,
  );

export const serialize = (_: unknown, v: unknown) => {
  if (v instanceof PublicKey) {
    return v.toString();
  }
  return v;
};

export const makeProvider = (network: Network) => {
  return SolanaProvider.init({
    connection: new Connection(
      network === "mainnet-beta"
        ? process.env.MAINNET_SOLANA_RPC_ENDPOINT ??
          "https://mainnet.helius-rpc.com/?api-key=26bec238-00c2-4961-ba13-faa7c0a2d767"
        : "https://api.devnet.solana.com",
    ),
    wallet: new SignerWallet(Keypair.generate()),
  });
};
