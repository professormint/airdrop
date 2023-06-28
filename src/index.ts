/**
 * RUN with 
 *  npx ts-node ./src/index.ts
 * 
 * Will send out refunds based on csv file columns address,amount
 * Will create a failed_transactoin.json for all failed transactions
 * if failed_transactoin json is present in dir it will attempt to resend only those transactions
 * otherwise sends out all amounts to addresses from csv
 */

import { LAMPORTS_PER_SOL, Connection, PublicKey, Keypair, Transaction, SystemProgram, TransactionConfirmationStrategy } from "@solana/web3.js";
import fs from 'fs';
import csv, { parseFile } from 'fast-csv';
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Replace with your refund wallet
const PRIVATE_KEY_PATH = '/Users/professormint/.config/solana/id.json'; // Replace with your actual private key path
const SLEEP_TIME = 400

const PRIVATE_KEY = JSON.parse(fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'));

// Change to mainnet RPC before proccedding
const url = 'http://127.0.0.1:8899';
const connection = new Connection(url, 'confirmed');
const wallet = Keypair.fromSecretKey(new Uint8Array(PRIVATE_KEY));
const failedTxPath = 'failed_transactions.json';

// const PRESALE_PRICE = 16 * LAMPORTS_PER_SOL;

// Check if failed transactions file exists
if (fs.existsSync(failedTxPath)) {
    // Load failed transactions and retry
    const failedAddresses : {address: string, amount: number}[] = JSON.parse(fs.readFileSync(failedTxPath, 'utf8'));
    sendRefunds(failedAddresses);
} else {
    // Load CSV
    let addresses : {address: string, amount: number}[] = [];
    parseFile('addresses.csv', { headers: true })
    .on('error', error => console.error(error))
    .on('data', row => addresses.push(row))
    .on('end', () => {
        sendRefunds(addresses);
    });
}
async function sendRefunds(addresses : {address: string, amount: number}[]) {
    let failedTx = [];
    for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        // Retry for 5 times
        for (let j = 0; j < 5; j++) { 
            try {
                await sendSolana(address.address, address.amount);
                console.log(`Refund sent to ${address.address}`);
                break;
            } catch (e : any) {
                console.error(`Failed to send to ${address.address} for ${address.amount}: ${e}`);
                if (j === 4) {
                    failedTx.push({...address, error : e.toString()});
                    // Save failed transactions to JSON
                    fs.writeFileSync('failed_transactions.json', JSON.stringify(failedTx, null, 4));
                }
                await sleep(SLEEP_TIME)
            }
            
        }
    }


}

async function sendSolana(receiverAddress : string, amount : number) {
    const transaction =  new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(receiverAddress),
            lamports: amount * LAMPORTS_PER_SOL
        }),
    );

    transaction.recentBlockhash = (
        await connection.getLatestBlockhash("confirmed")
    ).blockhash;
    transaction.sign(wallet);

    const rawTransaction = transaction.serialize();
    const result = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
    });
    const blockhash = await connection.getLatestBlockhash()
    
    const strategy : TransactionConfirmationStrategy = {
        signature: result,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight
    };

    await connection.confirmTransaction(strategy);
}
function existsSync(failedTxPath: any) {
    throw new Error("Function not implemented.");
}

