import { Injectable, Inject } from '@angular/core';
import { StorageService } from './storage.service';
import { Client } from 'xrpl';
import * as xrpl from 'xrpl';
import { AppConstants } from '../core/app.constants';
import { BehaviorSubject, Observable, of } from 'rxjs';

interface Token {
     transactionType: string;
     createdDate: Date;
     creationAge: string; // Optional field for age of token
     currency: string;
     issuer: string;
     transactionHash: string;
     timestamp: Date;
     action: string; // "Buy" or "Sell"
     amountToken: string; // Token amount (e.g., "100 PHNIX")
     amountXrp: string; // XRP amount (e.g., "10 XRP")
}

@Injectable({
     providedIn: 'root', // Singleton service
})
export class XrplService {
     private client: Client | null = null;
     private tokensSubject = new BehaviorSubject<Token[]>([]);
     tokens$ = this.tokensSubject.asObservable();
     private tokenCreationDates: Map<string, Date> = new Map(); // Track earliest TrustSet date by currency+issuer

     constructor(private storageService: StorageService) {}

     async getClient(): Promise<xrpl.Client> {
          if (!this.client || !this.client.isConnected()) {
               const { net } = this.getNet();
               this.client = new xrpl.Client(net);
               await this.client.connect();
          }
          return this.client;
     }

     async disconnect() {
          if (this.client) {
               await this.client.disconnect();
               this.client = null;
          }
     }

     getNet() {
          return this.storageService.getNet();
     }

     decodeCurrencyCode(hexCode: String) {
          const buffer = Buffer.from(hexCode, 'hex');
          const trimmed = buffer.subarray(0, buffer.findIndex(byte => byte === 0) === -1 ? 20 : buffer.findIndex(byte => byte === 0));
          return new TextDecoder().decode(trimmed);
     }

     async getXrplServerInfo(client: Client, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'server_info',
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error(`Error fetching ledger server info:: ${error}`);
               throw new Error(`Error fetching ledger server info:: ${error.message || 'Unknown error'}`);
          }
     }

     async getTxData(client: Client, transactionData: string) {
          try {
               const response = await client.request({
                    command: 'tx',
                    transaction: transactionData,
               });
               return response;
          } catch (error: any) {
               console.error(`Error fetching ${transactionData} data: ${error}`);
               throw new Error(`Failed to fetch trasnaction data: ${error.message || 'Unknown error'}`);
          }
     }

     async getXrplServerState(client: Client, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'server_state',
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching xrpl server state:', error);
               throw new Error(`Failed to fetch Ripple server state: ${error.message || 'Unknown error'}`);
          }
     }

     private knownCreationDates: { [key: string]: Date } = {
          'PHNIX:rDFXbW2ZZCG5WgPtqwNiA2xZokLMm9ivmN': new Date('2024-12-03T00:00:00Z'), // From[](https://www.globenewswire.com/news-release/2024/12/12/2996121/0/en/Phoenix-on-XRPL-Launches-PHNIX-Token-to-Dominate-the-Meme-Coin-Space-on-XRPL.html)
     };

     private formatTokenAge(fromDate: Date): string {
          const now = new Date();
          const diffMs = now.getTime() - fromDate.getTime();

          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const days = Math.floor(diffMinutes / (60 * 24));
          const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
          const minutes = diffMinutes % 60;

          const parts: string[] = [];
          if (days > 0) parts.push(`${days}d `);
          if (hours > 0 || days > 0) parts.push(`${hours}h `);
          parts.push(`${minutes}min`);

          return parts.join('');
     }

     async getTokenCreationDate1(currency: string, issuer: string, client: xrpl.Client, tokenCreationDates: Map<string, Date>) {
          const key = `${currency}:${issuer}`;

          if (tokenCreationDates.has(key)) {
               return tokenCreationDates.get(key)!;
          }

          if (this.knownCreationDates?.[key]) {
               tokenCreationDates.set(key, this.knownCreationDates[key]);
               return this.knownCreationDates[key];
          }

          try {
               const txHistory = await client
                    .request({
                         command: 'account_tx',
                         account: issuer,
                         limit: 200,
                         forward: true,
                    })
                    .catch(err => {
                         throw new Error(`Failed to fetch transactions: ${err.message}`);
                    });

               if (!txHistory?.result?.transactions) {
                    return null;
               }

               let creationTx = null;
               for (const tx of txHistory.result.transactions) {
                    const txData = tx.tx_json as any;

                    if ((txData.TransactionType === 'TrustSet' && txData.LimitAmount?.currency === currency) || (txData.TransactionType === 'Payment' && txData.Amount?.currency === currency)) {
                         creationTx = txData;
                         break;
                    }
               }

               if (!creationTx) {
                    console.log('Token issuance transaction not found.');
                    return null;
               }

               // Get the ledger close time for the transaction
               const ledger = await client
                    .request({
                         command: 'ledger',
                         ledger_index: creationTx.ledger_index,
                         transactions: false,
                    })
                    .catch(err => {
                         throw new Error(`Failed to fetch ledger: ${err.message}`);
                    });

               if (!ledger?.result?.ledger?.close_time) {
                    return null;
               }

               // Convert Ripple Epoch (Jan 1, 2000) to UNIX timestamp
               const rippleEpoch = 946684800;
               const unixTimestamp = rippleEpoch + ledger.result.ledger.close_time;
               let creationDate: Date | null = null;
               creationDate = new Date(unixTimestamp * 1000);

               console.log(`Token ${currency} issued by ${issuer} was created on: ${creationDate.toUTCString()}`);
               return creationDate;
          } catch (error) {
               console.error('Error:', error);
               return null;
          }
     }

     async getTokenCreationDate(currency: string, issuer: string, client: xrpl.Client, tokenCreationDates: Map<string, Date>): Promise<Date> {
          const key = `${currency}:${issuer}`;

          if (tokenCreationDates.has(key)) {
               return tokenCreationDates.get(key)!;
          }

          if (this.knownCreationDates?.[key]) {
               tokenCreationDates.set(key, this.knownCreationDates[key]);
               return this.knownCreationDates[key];
          }

          try {
               const response = await client.request({
                    command: 'account_tx',
                    account: issuer,
                    limit: 100,
                    forward: true,
               });

               const transactions = response.result.transactions;

               let earliestDate: Date | null = null;

               for (const txObj of transactions) {
                    const tx = txObj.tx_json as any;

                    if (tx && tx.TransactionType === 'TrustSet' && tx.LimitAmount && tx.LimitAmount.currency === currency && tx.LimitAmount.issuer === issuer && typeof tx['date'] === 'number') {
                         const rippleEpoch: number = tx['date'];
                         const unixTimestamp = (rippleEpoch + 946684800) * 1000;
                         const txDate = new Date(unixTimestamp);

                         if (!earliestDate || txDate < earliestDate) {
                              earliestDate = txDate;
                         }
                    }
               }

               const creationDate = earliestDate || new Date(); // fallback
               tokenCreationDates.set(key, creationDate);
               return creationDate;
          } catch (error) {
               console.error(`Error fetching creation date for ${key}:`, error);
               const fallbackDate = new Date();
               tokenCreationDates.set(key, fallbackDate);
               return fallbackDate;
          }
     }

     async monitorNewTokens() {
          const client = await this.getClient();
          try {
               // Subscribe to ledger updates
               await client.request({
                    command: 'subscribe',
                    streams: ['ledger'],
               });

               client.on('ledgerClosed', async ledger => {
                    try {
                         // Fetch recent transactions
                         const response = await client.request({
                              command: 'ledger',
                              ledger_index: ledger.ledger_index,
                              transactions: true,
                              expand: true,
                         });

                         // Type assertion for response structure with tx_json
                         const ledgerData = response as {
                              result: {
                                   ledger: {
                                        transactions?: Array<{
                                             hash: string; // Transaction hash at top level
                                             tx_json: {
                                                  TransactionType: string;
                                                  LimitAmount?: { currency: string; issuer: string; value: string };
                                                  Amount?: { currency: string; issuer: string; value: string } | string;
                                                  SendMax?: { currency: string; issuer: string; value: string } | string;
                                                  DeliverMax?: { currency: string; issuer: string; value: string } | string;
                                                  TakerPays?: { currency: string; issuer: string; value: string } | string;
                                                  TakerGets?: { currency: string; issuer: string; value: string } | string;
                                             };
                                        }>;
                                   };
                              };
                         };

                         // Check if transactions exist
                         if (!ledgerData.result.ledger.transactions || ledgerData.result.ledger.transactions.length === 0) {
                              console.log('No transactions found in ledger:', ledger.ledger_index);
                              return;
                         }

                         // console.log('Processing transactions:', ledgerData.result.ledger.transactions);

                         const newTokens: Token[] = [];
                         for (const tx of ledgerData.result.ledger.transactions) {
                              let currency: string | undefined;
                              let issuer: string | undefined;
                              let action: string = 'Unknown';
                              let amountToken: string = '0';
                              let amountXrp: string = '0';
                              const txTimestamp = new Date();
                              const transactionType = tx.tx_json.TransactionType;

                              if (transactionType === 'TrustSet' && tx.tx_json.LimitAmount) {
                                   currency = tx.tx_json.LimitAmount.currency;
                                   issuer = tx.tx_json.LimitAmount.issuer;
                                   action = 'TrustSet';
                                   amountToken = tx.tx_json.LimitAmount.value || '0';
                              } else if (transactionType === 'Payment') {
                                   console.debug('Processing transaction:', tx.tx_json);
                                   // Handle token-based DeliverMax (Buy: receiving token)
                                   if (typeof tx.tx_json.DeliverMax === 'object' && tx.tx_json.DeliverMax) {
                                        currency = tx.tx_json.DeliverMax.currency;
                                        issuer = tx.tx_json.DeliverMax.issuer;
                                        action = 'Buy';
                                        amountToken = tx.tx_json.DeliverMax.value;
                                        amountXrp = typeof tx.tx_json.SendMax === 'string' ? Number(xrpl.dropsToXrp(tx.tx_json.SendMax)).toFixed(6) : '0';
                                   }
                                   // Handle token-based Amount (Buy: receiving token)
                                   else if (typeof tx.tx_json.Amount === 'object' && tx.tx_json.Amount) {
                                        currency = tx.tx_json.Amount.currency;
                                        issuer = tx.tx_json.Amount.issuer;
                                        action = 'Buy';
                                        amountToken = tx.tx_json.Amount.value;
                                        amountXrp = typeof tx.tx_json.SendMax === 'string' ? Number(xrpl.dropsToXrp(tx.tx_json.SendMax)).toFixed(6) : '0';
                                   }
                                   // Handle token-based SendMax (Sell: sending token)
                                   else if (typeof tx.tx_json.SendMax === 'object' && tx.tx_json.SendMax) {
                                        currency = tx.tx_json.SendMax.currency;
                                        issuer = tx.tx_json.SendMax.issuer;
                                        action = 'Sell';
                                        amountToken = tx.tx_json.SendMax.value;
                                        amountXrp = typeof tx.tx_json.Amount === 'string' ? Number(xrpl.dropsToXrp(tx.tx_json.Amount)).toFixed(6) : '0';
                                   } else {
                                        // Skip XRP-only payments
                                        continue;
                                   }

                                   const createdDate = await this.getTokenCreationDate(currency, issuer, client, this.tokenCreationDates);
                                   const createdLessThanTime = 2000;

                                   const isNewToken = createdDate ? Date.now() - createdDate.getTime() < createdLessThanTime * 60 * 1000 : false;
                                   // const isNewToken = Date.now() - createdDate.getTime() < createdLessThanTime * 60 * 1000;

                                   if (!isNewToken) {
                                        // Skip XRP-only payments
                                        continue;
                                   }
                              }
                              // else if (transactionType === 'OfferCreate') {
                              //      if (typeof tx.tx_json.TakerGets === 'object' && tx.tx_json.TakerGets) {
                              //           currency = tx.tx_json.TakerGets.currency;
                              //           issuer = tx.tx_json.TakerGets.issuer;
                              //           action = 'Buy';
                              //           amountToken = tx.tx_json.TakerGets.value;
                              //           amountXrp = typeof tx.tx_json.TakerPays === 'string' ? Number(xrpl.dropsToXrp(tx.tx_json.TakerPays)).toFixed(6) : '0';
                              //      } else if (typeof tx.tx_json.TakerPays === 'object' && tx.tx_json.TakerPays) {
                              //           currency = tx.tx_json.TakerPays.currency;
                              //           issuer = tx.tx_json.TakerPays.issuer;
                              //           action = 'Sell';
                              //           amountToken = tx.tx_json.TakerPays.value;
                              //           amountXrp = typeof tx.tx_json.TakerGets === 'string' ? Number(xrpl.dropsToXrp(tx.tx_json.TakerGets)).toFixed(6) : '0';
                              //      }
                              // }

                              if (currency && issuer) {
                                   let createdDate = await this.getTokenCreationDate(currency, issuer, client, this.tokenCreationDates);
                                   // const createdLessThanTime = 2000;
                                   // const isNewToken = Date.now() - createdDate.getTime() < createdLessThanTime * 60 * 1000;

                                   // if (isNewToken) {
                                   // console.log(`New token detected less than ${createdLessThanTime} minutes ago`);
                                   console.debug(`Token creation date for ${currency}:${issuer} is ${createdDate}`);

                                   let creationAge = '';
                                   if (createdDate !== null) {
                                        creationAge = this.formatTokenAge(createdDate);
                                   } else {
                                        createdDate = new Date();
                                   }

                                   newTokens.push({
                                        currency,
                                        issuer,
                                        transactionHash: tx.hash,
                                        timestamp: txTimestamp,
                                        createdDate,
                                        transactionType,
                                        creationAge,
                                        action,
                                        amountToken,
                                        amountXrp,
                                   });
                                   // }
                              }
                              // if (currency && issuer) {
                              //      const createdDate = await this.getTokenCreationDate(currency, issuer, client, this.tokenCreationDates);
                              //      const creationAge = this.formatTokenAge(createdDate);
                              //      // console.log(`creationAge ${creationAge}`);
                              //      newTokens.push({
                              //           transactionType: tx.tx_json.TransactionType,
                              //           currency,
                              //           issuer,
                              //           transactionHash: tx.hash,
                              //           timestamp: new Date(),
                              //           createdDate,
                              //           creationAge,
                              //      });
                              // }
                         }

                         if (newTokens.length > 0) {
                              this.tokensSubject.next([...this.tokensSubject.value, ...newTokens]);
                         }
                    } catch (error) {
                         console.error('Error processing ledger:', error);
                    }
               });
          } catch (error) {
               console.error('Error subscribing to ledger:', error);
          }
     }

     async getLastLedgerIndex(client: Client): Promise<number> {
          try {
               const response = await client.request({
                    command: 'ledger',
                    ledger_index: 'closed',
               });
               return response.result.ledger_index;
          } catch (error: any) {
               console.error('Error fetching last ledger index:', error);
               throw new Error(`Failed to fetch Ripple last ledger index: ${error.message || 'Unknown error'}`);
          }
     }

     async getLedgerCloseTime(client: xrpl.Client): Promise<number> {
          try {
               const response = await client.request({
                    command: 'ledger',
                    ledger_index: 'current',
               });
               return response.result.ledger.close_time;
          } catch (error: any) {
               console.error('Error fetching ledger close time:', error);
               throw new Error(`Failed to fetch Ripple ledger close time: ${error.message || 'Unknown error'}`);
          }
     }

     async getCurrentRippleTime(client: Client): Promise<number> {
          try {
               // Fetch the latest validated ledger info
               const ledgerResponse = await client.request({
                    command: 'ledger',
                    ledger_index: 'validated',
               });

               // Extract the ledger close time (in Ripple time)
               return ledgerResponse.result.ledger.close_time;
          } catch (error: any) {
               console.error('Error fetching Ripple time:', error);
               throw new Error(`Failed to fetch Ripple time: ${error.message || 'Unknown error'}`);
          }
     }

     async getTransactionFee(client: Client): Promise<string> {
          try {
               const response = await client.request({
                    command: 'fee',
                    ledger_index: 'closed',
               });
               return response.result.drops.open_ledger_fee;
          } catch (error: any) {
               console.error('Error fetching fee:', error);
               throw new Error(`Failed to fetch Ripple fee: ${error.message || 'Unknown error'}`);
          }
     }

     async calculateTransactionFee(client: xrpl.Client) {
          try {
               const feeResponse = await this.getTransactionFee(client);
               const baseFee = feeResponse || AppConstants.MIN_FEE;
               const fee = Math.min(parseInt(baseFee) * 1.5, parseInt(AppConstants.MAX_FEE)).toString();
               return fee;
          } catch (error: any) {
               console.error('Error calculating transaciton fee:', error);
               return AppConstants.MIN_FEE; // Fallback to minimum fee in case of error
          }
     }

     async getAccountInfo(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string): Promise<any> {
          try {
               if (type) {
                    const response = await client.request({
                         command: 'account_info',
                         account: address,
                         ledger_index: ledgerIndex,
                         type: type,
                    });
                    return response;
               } else {
                    const response = await client.request({
                         command: 'account_info',
                         account: address,
                         ledger_index: ledgerIndex,
                    });
                    return response;
               }
          } catch (error: any) {
               console.error('Error fetching account info:', error);
               throw new Error(`Failed to fetch account info: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountNFTs(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string): Promise<any> {
          try {
               if (type) {
                    const response = await client.request({
                         command: 'account_nfts',
                         account: address,
                         ledger_index: ledgerIndex,
                         type: type,
                    });
                    return response;
               } else {
                    const response = await client.request({
                         command: 'account_nfts',
                         account: address,
                         ledger_index: ledgerIndex,
                    });
                    return response;
               }
          } catch (error: any) {
               console.error('Error fetching account nft info:', error);
               throw new Error(`Failed to fetch account nft info: ${error.message || 'Unknown error'}`);
          }
     }

     async getNFTSellOffers(client: Client, nftId: string): Promise<any> {
          try {
               const response = await client.request({
                    command: 'nft_sell_offers',
                    nft_id: nftId,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching nft sell offers:', error);
               throw new Error(`Failed to fetch nft sell offers: ${error.message || 'Unknown error'}`);
          }
     }

     async getNFTBuyOffers(client: Client, nftId: string): Promise<any> {
          try {
               const response = await client.request({
                    command: 'nft_buy_offers',
                    nft_id: nftId,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching nft buy offers:', error);
               throw new Error(`Failed to fetch nft buy offers: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountObjects(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               if (type) {
                    const response = await client.request({
                         command: 'account_objects',
                         account: address,
                         ledger_index: ledgerIndex,
                         type: type as xrpl.AccountObjectType,
                    });
                    return response;
               } else {
                    const response = await client.request({
                         command: 'account_objects',
                         account: address,
                         ledger_index: ledgerIndex,
                    });
                    return response;
               }
          } catch (error: any) {
               console.error('Error fetching account objects:', error);
               throw new Error(`Failed to fetch account objects: ${error.message || 'Unknown error'}`);
          }
     }

     async checkAccountObjectsForDeletion(client: Client, address: string) {
          try {
               const response = await client.request({
                    command: 'account_objects',
                    account: address,
                    deletion_blockers_only: true,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching account objects:', error);
               throw new Error(`Failed to fetch account objects: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountLines(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               if (type) {
                    const response = await client.request({
                         command: 'account_lines',
                         account: address,
                         ledger_index: ledgerIndex,
                         type: type as xrpl.AccountObjectType,
                    });
                    return response;
               } else {
                    const response = await client.request({
                         command: 'account_lines',
                         account: address,
                         ledger_index: ledgerIndex,
                    });
                    return response;
               }
          } catch (error: any) {
               console.error('Error fetching account lines:', error);
               throw new Error(`Failed to fetch account lines: ${error.message || 'Unknown error'}`);
          }
     }

     async getTokenBalance(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'gateway_balances',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching gateway_balances:', error);
               throw new Error(`Failed to fetch gateway_balances: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountOffers(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'account_offers',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching account offers:', error);
               throw new Error(`Failed to fetch account offers: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountChannels(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'account_channels',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching account channels:', error);
               throw new Error(`Failed to fetch account channels: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountCurrencies(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'account_currencies',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching account currencies:', error);
               throw new Error(`Failed to fetch account currencies: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountTrustlines(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'account_lines',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching account trustlines:', error);
               throw new Error(`Failed to fetch account trustlines: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountTransactions(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'account_tx',
                    account: address,
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching account transactions:', error);
               throw new Error(`Failed to fetch account transactions: ${error.message || 'Unknown error'}`);
          }
     }

     async getAccountNoRippleCheck(client: Client, address: string, ledgerIndex: xrpl.LedgerIndex, type: string) {
          try {
               const response = await client.request({
                    command: 'noripple_check',
                    account: address,
                    role: 'gateway',
                    limit: 10,
                    ledger_index: ledgerIndex,
               });
               return response;
          } catch (error: any) {
               console.error('Error fetching account no ripple check:', error);
               throw new Error(`Failed to fetch account no ripple check: ${error.message || 'Unknown error'}`);
          }
     }

     async checkTicketExists(client: xrpl.Client, account: string, ticketSequence: number): Promise<boolean> {
          try {
               // Fetch account objects (tickets)
               const ticket_objects = await this.getAccountObjects(client, account, 'validated', 'ticket');
               console.debug('Ticket Objects: ', ticket_objects);

               // Check if the ticketSequence exists in the ticket_objects array
               const ticketExists = (ticket_objects.result.account_objects || []).some((ticket: any) => ticket.TicketSequence === ticketSequence);

               return ticketExists;
          } catch (error: any) {
               console.error('Error checking ticket: ', error);
               return false; // Return false if there's an error fetching tickets
          }
     }

     async getEscrowBySequence(client: xrpl.Client, account: string, sequence: number): Promise<any | null> {
          try {
               const escrowObjects = await this.getAccountObjects(client, account, 'validated', 'escrow');
               for (const [index, obj] of escrowObjects.result.account_objects.entries()) {
                    if (obj.PreviousTxnID) {
                         const sequenceTx = await this.getTxData(client, obj.PreviousTxnID);
                         if (sequenceTx.result.tx_json.Sequence === sequence) {
                              return { ...obj, Sequence: sequenceTx.result.tx_json.Sequence };
                         }
                    }
               }
               return null;
          } catch (error) {
               console.error('Error fetching escrow by sequence nunber:', error);
               return null;
          }
     }

     async getOnlyTokenBalance(client: xrpl.Client, address: string, currency: string): Promise<string> {
          try {
               const response = await this.getAccountLines(client, address, 'validated', '');
               const lines = response.result.lines || [];
               let assetCurrency = currency.length > 3 ? this.decodeCurrencyCode(currency) : currency;
               const tokenLine = lines.find((line: any) => line.currency.toUpperCase() === assetCurrency.toUpperCase());
               return tokenLine ? tokenLine.balance : '0';
          } catch (error: any) {
               console.error('Error fetching token balance:', error);
               throw new Error(`Failed to fetch token balance: ${error.message || 'Unknown error'}`);
          }
     }

     async getXrpReserveRequirements(client: Client, address: string) {
          try {
               const accountInfo = await this.getAccountInfo(client, address, 'validated', '');
               const currentReserve = accountInfo.result.account_data.Reserve;
               const ownerCount = accountInfo.result.account_data.OwnerCount;

               const server_info = await this.getXrplServerInfo(client, 'current', '');
               const reserveBaseXrp = server_info.result.info.validated_ledger?.reserve_base_xrp || 10;
               const reserveIncXrp = server_info.result.info.validated_ledger?.reserve_inc_xrp || 2;

               return {
                    baseReserve: reserveBaseXrp,
                    ownerReserve: reserveIncXrp,
                    currentReserve: currentReserve,
                    ownerCount: ownerCount,
               };
          } catch (error: any) {
               console.error('Error fetching XRP reserve requirements:', error);
               throw new Error(`Failed to fetch XRP reserve requirements: ${error.message || 'Unknown error'}`);
          }
     }
}
