/**
 * Shift — Phase 0, check U9: 0G Storage upload and download with the real SDK.
 *
 * Uploads a tiny JSON from memory, downloads it back by root hash and compares SHA-256.
 * Needs a funded operator wallet (OPERATOR_PRIVATE_KEY) on the chosen network. No mocks: any failure is reported as is.
 *
 * Usage: pnpm storage-check
 * Output: docs/spike/STORAGE_RESULTS.json (no secrets)
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import { loadDotEnv } from "./lib/env";

loadDotEnv();

const RPC_URL = process.env.ZG_CHAIN_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const INDEXER_URL = process.env.ZG_STORAGE_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai";
const EXPLORER_URL = process.env.ZG_EXPLORER_URL ?? "https://chainscan-galileo.0g.ai";
const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY ?? "";

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function main(): Promise<void> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) throw new Error("OPERATOR_PRIVATE_KEY is missing or malformed (expected 0x + 64 hex chars).");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(signer.address);
  console.log(`Chain ID ${network.chainId} · RPC ${RPC_URL}\nIndexer ${INDEXER_URL}\nOperator ${signer.address} · balance ${ethers.formatEther(balance)} 0G\n`);
  if (balance === 0n) throw new Error(`Operator wallet ${signer.address} has no balance on chain ${network.chainId}; fund it first (faucet for testnet).`);

  const payload = new TextEncoder().encode(JSON.stringify({ app: "shift", check: "U9", at: new Date().toISOString() }));
  const memData = new MemData(payload);
  const [, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`Merkle tree generation failed: ${treeErr}`);

  const indexer = new Indexer(INDEXER_URL);
  const [tx, uploadErr] = await indexer.upload(memData, RPC_URL, signer as never);
  if (uploadErr !== null) throw new Error(`Upload failed: ${uploadErr}`);
  const { rootHash, txHash } = "rootHash" in tx ? tx : { rootHash: tx.rootHashes[0]!, txHash: tx.txHashes[0]! };
  console.log(`✅ Uploaded ${payload.length} bytes\n   root hash ${rootHash}\n   tx ${EXPLORER_URL}/tx/${txHash}`);

  const outPath = join(mkdtempSync(join(tmpdir(), "shift-storage-")), "downloaded.json");
  const downloadErr = await indexer.download(rootHash, outPath, true);
  if (downloadErr !== null) throw new Error(`Download failed: ${downloadErr}`);
  const downloaded = new Uint8Array(readFileSync(outPath));
  const matched = sha256(downloaded) === sha256(payload);
  console.log(`${matched ? "✅" : "❌"} Downloaded ${downloaded.length} bytes, SHA-256 ${matched ? "matches" : "DOES NOT match"} the upload`);

  mkdirSync("docs/spike", { recursive: true });
  writeFileSync(
    "docs/spike/STORAGE_RESULTS.json",
    JSON.stringify({ chainId: Number(network.chainId), rpc: RPC_URL, indexer: INDEXER_URL, bytes: payload.length, rootHash, txHash, matched, at: new Date().toISOString() }, null, 2),
  );
  process.exitCode = matched ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error(`❌ U9 failed — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
