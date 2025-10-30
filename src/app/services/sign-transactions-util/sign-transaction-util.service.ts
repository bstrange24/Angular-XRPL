import { Injectable } from '@angular/core';
import * as xrpl from 'xrpl';
import { XrplService } from '../xrpl.service';
import { UtilsService } from '../utils.service';

interface SignTransactionOptions {
     client: xrpl.Client;
     wallet: xrpl.Wallet;
     selectedTransaction?:
          | 'accountFlagSet'
          | 'accountFlagClear'
          | 'setTrustline'
          | 'removeTrustline'
          | 'issueCurrency'
          | 'createTimeEscrow'
          | 'createTimeEscrowToken'
          | 'finishTimeEscrow'
          | 'finishTimeEscrowToken'
          | 'createConditionEscrow'
          | 'createConditionEscrowToken'
          | 'finishConditionEscrow'
          | 'finishConditionEscrowToken'
          | 'cancelEscrow'
          | 'createCheck'
          | 'createCheckToken'
          | 'cashCheck'
          | 'cashCheckToken'
          | 'cancelCheck'
          | 'createMPT'
          | 'authorizeMPT'
          | 'unauthorizeMPT'
          | 'sendMPT'
          | 'lockMPT'
          | 'unlockMPT'
          | 'destroyMPT';
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
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
               Destination: 'rMiqQ8m11gBUR3XhTstpjJDbTPdcdATCgE',
               Amount: xrpl.xrpToDrops('0.000001'), // 1 XRP in drops
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
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
          };

          if (selectedTransaction === 'setTrustline') {
               modifyTrustlineRequest.LimitAmount = {
                    currency: 'CTZ',
                    issuer: 'rLBknJdCzFGV15Vyyewd3U8jQmDR3abRJ4',
                    value: '10000000000',
               };
          } else {
               modifyTrustlineRequest.LimitAmount = {
                    currency: 'CTZ',
                    issuer: 'rLBknJdCzFGV15Vyyewd3U8jQmDR3abRJ4',
                    value: '0',
               };
          }

          modifyTrustlineRequest.Fee = '10';
          // modifyTrustlineRequest.QualityIn = 0;
          // modifyTrustlineRequest.QualityOut = 0;
          // modifyTrustlineRequest.Flags = 0;
          modifyTrustlineRequest.LastLedgerSequence = currentLedger;
          modifyTrustlineRequest.Sequence = accountInfo.result.account_data.Sequence;
          modifyTrustlineRequest.Memos = [
               {
                    Memo: {
                         MemoData: '',
                         MemoType: 'text/plain',
                    },
               },
               {
                    Memo: {
                         MemoData: '',
                         MemoType: 'text/plain',
                    },
               },
          ];

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

     async issueCurrencyRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let issueCurrencyRequest: any = {
               TransactionType: 'Payment',
               Account: wallet.classicAddress,
               Destination: 'rHp1RqKdRSG5cJY5ikZadRA91yE35wTJFf',
               Amount: {
                    currency: 'CTZ',
                    issuer: 'rLBknJdCzFGV15Vyyewd3U8jQmDR3abRJ4',
                    value: '100',
               },
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               // If using a Ticket
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               issueCurrencyRequest.TicketSequence = Number(ticketSequence);
               issueCurrencyRequest.Sequence = 0;
          }

          const txString = JSON.stringify(issueCurrencyRequest, null, 2);
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
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

          let createTimeEscrowRequest: any = {
               TransactionType: 'EscrowCreate',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Amount: '0',
               Fee: '10',
               FinishAfter: '815102293',
               CancelAfter: '815102343',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (selectedTransaction === 'createTimeEscrowToken') {
               createTimeEscrowRequest.Amount = {
                    currency: 'CTZ',
                    issuer: 'rLBknJdCzFGV15Vyyewd3U8jQmDR3abRJ4',
                    value: '100',
               };
          }

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               createTimeEscrowRequest.TicketSequence = Number(ticketSequence);
               createTimeEscrowRequest.Sequence = 0;
          }

          const txString = JSON.stringify(createTimeEscrowRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async finshTimeEscrowRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let finshTimeEscrowRequest: any = {
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               finshTimeEscrowRequest.TicketSequence = Number(ticketSequence);
               finshTimeEscrowRequest.Sequence = 0;
          }

          const txString = JSON.stringify(finshTimeEscrowRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async createConditionalEscrowRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let createConditionalEscrowRequest: any = {
               TransactionType: 'EscrowCreate',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Amount: '0',
               Fee: '10',
               Condition: 'A0258020B5C9EDAD034B32EE218F7F31ABC1CD42778D0919D5EBC5AF65F460650764E73F810120',
               CancelAfter: '815102343',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (selectedTransaction === 'createConditionEscrowToken') {
               createConditionalEscrowRequest.Amount = {
                    currency: 'CTZ',
                    issuer: 'rLBknJdCzFGV15Vyyewd3U8jQmDR3abRJ4',
                    value: '100',
               };
          }

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               createConditionalEscrowRequest.TicketSequence = Number(ticketSequence);
               createConditionalEscrowRequest.Sequence = 0;
          }

          const txString = JSON.stringify(createConditionalEscrowRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async finsishConditionalEscrowRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let finsishConditionalEscrowRequest: any = {
               TransactionType: 'EscrowFinish',
               Account: wallet.classicAddress,
               Owner: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Fee: '40',
               Condition: 'A0258020B5C9EDAD034B32EE218F7F31ABC1CD42778D0919D5EBC5AF65F460650764E73F810120',
               Fulfillment: 'A0228020A21657FA950220324BC9060B548BFCBE63ADF26AA5716BDB5AC00116CA7CA097',
               OfferSequence: '0',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               finsishConditionalEscrowRequest.TicketSequence = Number(ticketSequence);
               finsishConditionalEscrowRequest.Sequence = 0;
          }

          const txString = JSON.stringify(finsishConditionalEscrowRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async cancelEscrowRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let cancelEscrowRequestRequest: any = {
               TransactionType: 'EscrowCancel',
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               cancelEscrowRequestRequest.TicketSequence = Number(ticketSequence);
               cancelEscrowRequestRequest.Sequence = 0;
          }

          const txString = JSON.stringify(cancelEscrowRequestRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async createCheckRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let createCheckRequestRequest: any = {
               TransactionType: 'CheckCreate',
               Account: wallet.classicAddress,
               Destination: 'rB59o63jhXxHU9RHDMUq2bypc8pW4m5f6s',
               Fee: '10',
               LastLedgerSequence: currentLedger,
               Sequence: accountInfo.result.account_data.Sequence,
               Memos: [
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (selectedTransaction === 'createCheck') {
               createCheckRequestRequest.SendMax = '';
          } else {
               createCheckRequestRequest.SendMax = {
                    currency: 'CTZ',
                    issuer: 'rLBknJdCzFGV15Vyyewd3U8jQmDR3abRJ4',
                    value: '1',
               };
          }

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               createCheckRequestRequest.TicketSequence = Number(ticketSequence);
               createCheckRequestRequest.Sequence = 0;
          }

          const txString = JSON.stringify(createCheckRequestRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async cashCheckRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let cashCheckRequestRequest: any = {
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (selectedTransaction === 'cashCheck') {
               cashCheckRequestRequest.Amount = '0';
          } else {
               cashCheckRequestRequest.Amount = {
                    currency: 'CTZ',
                    issuer: 'rLBknJdCzFGV15Vyyewd3U8jQmDR3abRJ4',
                    value: '50',
               };
          }

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               cashCheckRequestRequest.TicketSequence = Number(ticketSequence);
               cashCheckRequestRequest.Sequence = 0;
          }

          const txString = JSON.stringify(cashCheckRequestRequest, null, 2);
          return txString; // Set property instead of DOM
     }

     async cancelCheckRequestText({ client, wallet, selectedTransaction, isTicketEnabled, ticketSequence }: SignTransactionOptions): Promise<string> {
          const [accountInfo, currentLedger] = await Promise.all([this.xrplService.getAccountInfo(client, wallet.classicAddress, 'validated', ''), this.xrplService.getLastLedgerIndex(client)]);

          let cancelCheckRequestRequest: any = {
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               cancelCheckRequestRequest.TicketSequence = Number(ticketSequence);
               cancelCheckRequestRequest.Sequence = 0;
          }

          const txString = JSON.stringify(cancelCheckRequestRequest, null, 2);
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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

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
                              MemoType: 'text/plain',
                         },
                    },
                    {
                         Memo: {
                              MemoData: '',
                              MemoType: 'text/plain',
                         },
                    },
               ],
          };

          if (isTicketEnabled && ticketSequence) {
               const ticketExists = await this.xrplService.checkTicketExists(client, wallet.classicAddress, Number(ticketSequence));

               if (!ticketExists) {
                    throw new Error(`ERROR: Ticket Sequence ${ticketSequence} not found for account ${wallet.classicAddress}`);
               }

               // Overwrite fields for ticketed tx
               mPTokenIssuanceDestroyTx.TicketSequence = Number(ticketSequence);
               mPTokenIssuanceDestroyTx.Sequence = 0;
          }

          const txString = JSON.stringify(mPTokenIssuanceDestroyTx, null, 2);
          return txString; // Set property instead of DOM
     }
}
