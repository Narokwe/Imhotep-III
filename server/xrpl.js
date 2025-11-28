import { Client, Wallet } from 'xrpl';
import crypto from 'crypto';

// Read envs – support both label ("testnet"/"mainnet") and full wss URL
const ENV_NETWORK = process.env.XRPL_NETWORK || process.env.XRP_NETWORK || 'testnet';
const ENV_SECRET  = process.env.XRPL_SECRET  || process.env.XRP_SECRET  || '';
const ENV_ADDRESS = process.env.XRPL_ADDRESS || process.env.XRP_ADDRESS || '';

// Default endpoints
const TESTNET_WSS = 'wss://testnet.xrpl-labs.com'; // updated default testnet
const MAINNET_WSS = 'wss://s1.ripple.com:51233';


function getWssEndpoint(envNetwork) {
  if (!envNetwork) return TESTNET_WSS;
  if (envNetwork.startsWith('wss://')) return envNetwork;
  if (envNetwork.toLowerCase().includes('main')) return MAINNET_WSS;
  return TESTNET_WSS;
}

const WSS = getWssEndpoint(ENV_NETWORK);

/** Helper: ASCII string -> HEX (for MemoType) */
function toHex(str) {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase();
}


export async function submitRecordHash(hexHash) {
  const client = new Client(WSS, {
    connectionTimeout: 20000,   
    maxConnectionAttempts: 3    
  });

  console.log('[xrpl] Connecting to', WSS);

  try {
    await client.connect();
  } catch (err) {
    console.error('[xrpl] Connection failed:', err?.message || err);
    return {
      success: false,
      error: `XRPL connection failed: ${err?.message || String(err)}`
    };
  }

  let wallet;
  try {
    if (ENV_SECRET) {
      wallet = Wallet.fromSeed(ENV_SECRET);
      console.log('[xrpl] Using env wallet:', ENV_ADDRESS || wallet.address);
    } else {
      wallet = Wallet.generate();
      console.log('[xrpl] Generated ephemeral wallet (no secret provided):', wallet.address);
      console.log('[xrpl] NOTE: ephemeral wallet must be funded on testnet for tx to succeed.');
    }

    const tx = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address, 
      Amount: '1', 
      Memos: [
        {
          Memo: {
            MemoType: toHex('imhotep:record_hash'),
            MemoData: hexHash 
          }
        }
      ]
    };

    
    const prepared = await client.autofill(tx);
    const signed   = wallet.sign(prepared);
    const submit   = await client.submitAndWait(signed.tx_blob);

    const engineResult =
      submit.result?.engine_result ||
      submit.result?.meta?.TransactionResult ||
      null;

    await client.disconnect();

    return {
      success: engineResult && engineResult.toLowerCase().startsWith('tes'),
      txHash: signed.hash,
      engine_result: engineResult,
      engine_result_message: submit.result?.engine_result_message || null,
      result: submit
    };
  } catch (err) {
    console.error('[xrpl] submitRecordHash error:', err?.message || err);
    try { await client.disconnect(); } catch (e) {}
    return {
      success: false,
      error: err?.message || String(err)
    };
  }
}


export function computeSha256Hex(text) {
  return crypto
    .createHash('sha256')
    .update(text, 'utf8')
    .digest('hex')
    .toUpperCase();
}