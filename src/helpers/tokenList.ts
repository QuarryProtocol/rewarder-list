import type { Network } from "@saberhq/solana-contrib";
import type { TokenInfo, TokenList } from "@saberhq/token-utils";
import { networkToChainId } from "@saberhq/token-utils";
import axios from "axios";

import { TOKEN_LIST_URLS } from "../constants";

export const fetchAllTokenLists = async () => {
  return await Promise.all(
    TOKEN_LIST_URLS.map(async (url) => {
      try {
        const result = await axios.get<TokenList>(url);
        return result.data;
      } catch (e) {
        console.error(`Error fetching ${url}`, e);
        throw e;
      }
    })
  );
};

export const fetchAllTokens = async (
  network: Network
): Promise<{
  tokens: Record<string, TokenInfo>;
  tokenLists: readonly TokenList[];
}> => {
  const tokenLists = await fetchAllTokenLists();
  const tokens: Record<string, TokenInfo> = {};
  tokenLists
    .flatMap((list) => list.tokens)
    .forEach((token) => {
      if (
        !tokens[token.address] &&
        token.chainId === networkToChainId(network)
      ) {
        tokens[token.address] = token;
      }
    });
  return { tokens, tokenLists };
};
