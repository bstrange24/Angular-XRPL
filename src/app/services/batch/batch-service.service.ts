import { Injectable } from '@angular/core';
import * as xrpl from 'xrpl';
import { XrplService } from '../../services/xrpl.service';
import { UtilsService } from '../../services/utils.service';

@Injectable({
     providedIn: 'root',
})
export class BatchService {
     constructor(private xrplService: XrplService, private utilsService: UtilsService) {}

     async submitBatchTransaction(
          client: xrpl.Client,
          wallet: xrpl.Wallet,
          innerTxns: any[],
          batchFlags: number,
          options?: {
               isMultiSign?: boolean;
               signerAddresses?: string;
               signerSeeds?: string;
               useRegularKeyWalletSignTx?: xrpl.Wallet;
               fee?: string;
          }
     ): Promise<any> {
          if (!innerTxns || innerTxns.length === 0) {
               throw new Error('No inner transactions provided');
          }

          const batchTx: any = {
               TransactionType: 'Batch',
               Account: wallet.classicAddress,
               Flags: batchFlags,
               RawTransactions: innerTxns.map(trx => ({
                    RawTransaction: {
                         ...trx,
                         Account: wallet.classicAddress,
                         Fee: '0',
                    },
               })),
               SigningPubKey: wallet.publicKey,
          };

          let signedTx: { tx_blob: string; hash: string } | null = null;

          if (options?.isMultiSign) {
               const signerAddresses = this.utilsService.getMultiSignAddress(options.signerAddresses ?? []);
               const signerSeeds = this.utilsService.getMultiSignSeeds(options.signerSeeds ?? []);
               if (signerAddresses.length === 0 || signerSeeds.length === 0) {
                    throw new Error('No signer addresses/seeds provided for multi-signing');
               }

               // Let autofill compute Sequence, LastLedgerSequence, Fee, etc.
               const preparedTx = await client.autofill(batchTx);

               const environment = this.xrplService.getNet().environment;
               const result = await this.utilsService.handleMultiSignTransaction({ client, wallet, environment, tx: preparedTx, signerAddresses, signerSeeds, fee: options.fee ?? preparedTx.Fee });

               signedTx = result.signedTx;
               preparedTx.Signers = result.signers;

               // Adjust fee for multisign (per signer)
               const multiSignFee = String((signerAddresses.length + 1) * Number(await this.xrplService.calculateTransactionFee(client)));
               preparedTx.Fee = multiSignFee;

               console.log(`Prepared multisign batch:`, preparedTx);
               console.log('Signed batch tx:', signedTx);
          } else {
               // Single signer (wallet or regular key)
               const preparedTx = await client.autofill(batchTx);
               console.log(`Prepared single-sign batch:`, preparedTx);
               signedTx = options?.useRegularKeyWalletSignTx ? options.useRegularKeyWalletSignTx.sign(preparedTx) : wallet.sign(preparedTx);
               console.log('Signed batch tx:', signedTx);
          }

          if (!signedTx) {
               throw new Error('Failed to sign batch transaction');
          }

          const response = await client.submitAndWait(signedTx.tx_blob);
          console.log('Batch submit response:', response);

          return response;
     }
}
