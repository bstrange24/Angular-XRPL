import { Injectable } from '@angular/core';
import * as xrpl from 'xrpl';
import { UtilsService } from '../utils.service';

@Injectable({
     providedIn: 'root',
})
export class XrplTransactionService {
     constructor(private utilsService: UtilsService) {}

     // HELPER: Sign transaction (handles both single and multi-sign)
     async signTransaction(client: any, wallet: xrpl.Wallet, environment: string, tx: any, useRegularKeyWalletSignTx: boolean, regularKeyWalletSignTx: any, fee: string, useMultiSign: boolean, multiSignAddress: any, multiSignSeeds: any): Promise<{ tx_blob: string; hash: string } | null> {
          if (useMultiSign) {
               const signerAddresses = this.utilsService.getMultiSignAddress(multiSignAddress);
               const signerSeeds = this.utilsService.getMultiSignSeeds(multiSignSeeds);

               if (signerAddresses.length === 0) {
                    throw new Error('No signer addresses provided for multi-signing');
               }
               if (signerSeeds.length === 0) {
                    throw new Error('No signer seeds provided for multi-signing');
               }

               const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: tx, signerAddresses, signerSeeds, fee });

               tx.Signers = result.signers;

               // Recalculate fee for multisign
               const multiSignFee = String((signerAddresses.length + 1) * Number(fee));
               tx.Fee = multiSignFee;

               console.debug(`tx`, tx);
               return result.signedTx;
          } else {
               console.debug(`tx`, tx);
               const preparedTx = await client.autofill(tx);
               return useRegularKeyWalletSignTx ? regularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);
          }
     }

     // HELPER: Submit or simulate transaction
     async submitTransaction(client: any, signedTx: { tx_blob: string; hash: string }, isSimulateEnabled: boolean): Promise<any> {
          if (isSimulateEnabled) {
               console.log(`[SIMULATE] Validating transaction locally for ${signedTx.hash} (no broadcast)`);
               return await client.submit(signedTx.tx_blob, { offline: true });
               // return await client.submit(signedTx.tx_blob, { failHard: true });
          } else {
               console.log(`[REAL] Submitting transaction ${signedTx.hash} to network`);
               return await client.submitAndWait(signedTx.tx_blob);
          }
     }
}
