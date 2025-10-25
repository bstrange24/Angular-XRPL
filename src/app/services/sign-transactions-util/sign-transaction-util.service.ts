import { Injectable } from '@angular/core';
import * as xrpl from 'xrpl';
import { XrplService } from '../xrpl.service';
import { UtilsService } from '../utils.service';

interface SignTransactionOptions {
     client: xrpl.Client;
     wallet: xrpl.Wallet;
     selectedTransaction?: 'accountFlagSet' | 'accountFlagClear' | 'setTrustline' | 'removeTrustline' | 'createTimeEscrow' | 'finishTimeEscrow' | 'createConditionEscrow' | 'finishConditionEscrow' | 'cancelEscrow' | 'createCheck' | 'cashCheck' | 'cancelCheck' | 'createMPT' | 'authorizeMPT' | 'unauthorizeMPT' | 'sendMPT' | 'lockMPT' | 'unlockMPT' | 'destroyMPT';
     isTicketEnabled?: boolean;
     ticketSequence?: string;
}

@Injectable({
     providedIn: 'root',
})
export class SignTransactionUtilService {
     constructor(private readonly xrplService: XrplService, private readonly utilsService: UtilsService) {}

     async createBatchpRequestText({ client, wallet }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let batchRequest: any = {
               TransactionType: 'Batch',
               Account: wallet.classicAddress,
               Flags: 65536,
               RawTransactions: [
                    {
                         RawTransaction: {
                              TransactionType: 'Payment',
                              Flags: 1073741824,
                              Account: wallet.classicAddress,
                              Destination: 'rskBKJYGVpTDNfTWV9qmM8smPJnNXEkSYH',
                              Amount: '0.00001',
                              Sequence: accountInfo.result.account_data.Sequence + 1,
                              Fee: '0',
                              SigningPubKey: '',
                         },
                    },
                    {
                         RawTransaction: {
                              TransactionType: 'Payment',
                              Flags: 1073741824,
                              Account: wallet.classicAddress,
                              Destination: 'r9KUJAJUbLpVeVd8zs78tbHnNroW38vbAq',
                              Amount: '0.00001',
                              Sequence: accountInfo.result.account_data.Sequence + 2,
                              Fee: '0',
                              SigningPubKey: '',
                         },
                    },
               ],
               Sequence: accountInfo.result.account_data.Sequence,
               Fee: '40',
               SigningPubKey: '',
               TxnSignature: '',
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          const txString = JSON.stringify(batchRequest, null, 2);
          return txString;
     }

     async createSendXrpRequestText({ client, wallet, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let xrpPaymentRequest: any = {
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Amount: '0.00001', // 1 XRP in drops
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               DestinationTag: 0,
               SourceTag: 0,
               InvoiceID: 0,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          // If using a Ticket
          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               xrpPaymentRequest.TicketSequence = Number(ticketSequence);
               xrpPaymentRequest.Sequence = 0;
          }

          const txString = JSON.stringify(xrpPaymentRequest, null, 2);
          return txString;
     }

     async modifyTrustlineRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'TrustSet',
               Account: wallet.classicAddress,
               Fee: '10',
               QualityIn: 0,
               QualityOut: 0,
               Flags: 0,
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (selectedTransaction === 'setTrustline') {
               modifyTrustlineRequest.LimitAmount = {
                    currency: '',
                    issuer: 'rsP3mgGb2tcYUrxiLFiHJiQXhsziegtwBc',
                    value: '10000000000000000000',
               };
          } else {
               modifyTrustlineRequest.LimitAmount = {
                    currency: '',
                    issuer: 'rsP3mgGb2tcYUrxiLFiHJiQXhsziegtwBc',
                    value: '0',
               };
          }

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async modifyAccountFlagsRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyAccountSetRequest: any = {
               TransactionType: 'AccountSet',
               Account: wallet.classicAddress,
               [selectedTransaction === 'accountFlagSet' ? 'SetFlag' : 'ClearFlag']: '0',
               Fee: '10',
               Flags: 0,
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Override for ticket use
               modifyAccountSetRequest.TicketSequence = ticketSequence;
               modifyAccountSetRequest.Sequence = 0;
          }

          return JSON.stringify(modifyAccountSetRequest, null, 2);
     }

     async createTimeEscrowRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'EscrowCreate',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Amount: '0',
               Fee: '10',
               FinishAfter: '0',
               CancelAfter: '0',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async finshEscrowRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'EscrowFinish',
               Account: wallet.classicAddress,
               Owner: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Fee: '10',
               OfferSequence: '0',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async createEscrowRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'EscrowCreate',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Amount: '0',
               Fee: '10',
               FinishAfter: '0',
               CancelAfter: '0',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async createCheckRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'CheckCreate',
               Account: wallet.classicAddress,
               SendMax: '',
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async cashCheckRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'CheckCash',
               Account: wallet.classicAddress,
               CheckID: 'CheckID',
               Amount: '0',
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async cancelCheckRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let modifyTrustlineRequest: any = {
               TransactionType: 'CheckCancel',
               Account: wallet.classicAddress,
               CheckID: '0',
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               modifyTrustlineRequest.TicketSequence = Number(ticketSequence);
               modifyTrustlineRequest.Sequence = 0;
          }

          const txString = JSON.stringify(modifyTrustlineRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async createMPTRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let mPTokenIssuanceCreateTx: any = {
               TransactionType: 'MPTokenIssuanceCreate',
               Account: wallet.classicAddress,
               MaximumAmount: '100',
               Fee: '10',
               Flags: '0',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               mPTokenIssuanceCreateTx.TicketSequence = Number(ticketSequence);
               mPTokenIssuanceCreateTx.Sequence = 0;
          }

          const txString = JSON.stringify(mPTokenIssuanceCreateTx, null, 2);
          return txString; // Set property instead of DOM
     }

     async authorizeMPTRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let mPTokenAuthorizeTx: any = {
               TransactionType: 'MPTokenAuthorize',
               Account: wallet.classicAddress,
               MPTokenIssuanceID: '0',
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               mPTokenAuthorizeTx.TicketSequence = Number(ticketSequence);
               mPTokenAuthorizeTx.Sequence = 0;
          }

          const txString = JSON.stringify(mPTokenAuthorizeTx, null, 2);
          return txString; // Set property instead of DOM
     }

     async unauthorizeMPTRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let mPTokenAuthorizeTx: any = {
               TransactionType: 'MPTokenAuthorize',
               Account: wallet.classicAddress,
               MPTokenIssuanceID: '0',
               Flags: xrpl.MPTokenAuthorizeFlags.tfMPTUnauthorize,
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               mPTokenAuthorizeTx.TicketSequence = Number(ticketSequence);
               mPTokenAuthorizeTx.Sequence = 0;
          }

          const txString = JSON.stringify(mPTokenAuthorizeTx, null, 2);
          return txString; // Set property instead of DOM
     }

     async sendMPTRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let sendMptPaymentTx: any = {
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               Amount: {
                    mpt_issuance_id: '',
                    value: '0',
               },
               Destination: '',
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               sendMptPaymentTx.TicketSequence = Number(ticketSequence);
               sendMptPaymentTx.Sequence = 0;
          }

          const txString = JSON.stringify(sendMptPaymentTx, null, 2);
          return txString; // Set property instead of DOM
     }

     async lockMPTRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let mPTokenIssuanceSetTx: any = {
               TransactionType: 'MPTokenIssuanceSet',
               Account: wallet.classicAddress,
               MPTokenIssuanceID: '0',
               Flags: xrpl.MPTokenIssuanceSetFlags.tfMPTLock,
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               mPTokenIssuanceSetTx.TicketSequence = Number(ticketSequence);
               mPTokenIssuanceSetTx.Sequence = 0;
          }

          const txString = JSON.stringify(mPTokenIssuanceSetTx, null, 2);
          return txString; // Set property instead of DOM
     }

     async unlockMPTRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let mPTokenIssuanceSetTx: any = {
               TransactionType: 'MPTokenIssuanceSet',
               Account: wallet.classicAddress,
               MPTokenIssuanceID: '0',
               Flags: xrpl.MPTokenIssuanceSetFlags.tfMPTUnlock,
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               mPTokenIssuanceSetTx.TicketSequence = Number(ticketSequence);
               mPTokenIssuanceSetTx.Sequence = 0;
          }

          const txString = JSON.stringify(mPTokenIssuanceSetTx, null, 2);
          return txString; // Set property instead of DOM
     }

     async destroyMPTRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let mPTokenIssuanceDestroyTx: any = {
               TransactionType: 'MPTokenIssuanceDestroy',
               Account: wallet.classicAddress,
               MPTokenIssuanceID: '0',
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: '',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);

               // Overwrite fields for ticketed tx
               mPTokenIssuanceDestroyTx.TicketSequence = Number(ticketSequence);
               mPTokenIssuanceDestroyTx.Sequence = 0;
          }

          const txString = JSON.stringify(mPTokenIssuanceDestroyTx, null, 2);
          return txString; // Set property instead of DOM
     }
}
