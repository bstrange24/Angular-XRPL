import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Client } from 'xrpl';
import * as xrpl from 'xrpl';
import { AppConstants } from '../core/app.constants';

@Injectable({
     providedIn: 'root', // Singleton service
})
export class XrplService {
     private client: Client | null = null;

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
               const tokenLine = lines.find((line: any) => line.currency.toUpperCase() === currency.toUpperCase());
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
