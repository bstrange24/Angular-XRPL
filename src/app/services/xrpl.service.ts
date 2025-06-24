import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Client } from 'xrpl';
import * as xrpl from 'xrpl';
import { AccountSet, TransactionMetadataBase } from 'xrpl';

@Injectable({
     providedIn: 'root', // Singleton service
})
export class XrplService {
     private client: Client | null = null;

     constructor(private storageService: StorageService) {}

     async getClient(): Promise<Client> {
          if (!this.client) {
               const { net } = this.getNet();
               this.client = new Client(net);
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
}
