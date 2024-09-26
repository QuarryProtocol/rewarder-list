import { fetchDigitalAsset, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { PublicKey } from "@solana/web3.js";

export const getMetadata = async (mints: string[]) => {
    const umi = createUmi(process.env.MAINNET_SOLANA_RPC_ENDPOINT)
        .use(mplTokenMetadata())

    const metadata = await Promise.all(mints.map(async mint => { 
        try {
            const data = await fetchDigitalAsset(umi, fromWeb3JsPublicKey(new PublicKey(mint)));
            const dataFromUrl = await fetch(data.metadata.uri).then(res => res.json());
        
            return { ...data, imageUrl: dataFromUrl.image };
        } catch (e) {
            return undefined;
        }
    }));

    return metadata;
}