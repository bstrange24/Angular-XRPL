// src/app/services/storage.service.ts
import { Injectable, EventEmitter } from '@angular/core';
import { AppConstants } from '../core/app.constants';

@Injectable({
     providedIn: 'root',
})
export class StorageService {
     inputsCleared = new EventEmitter<void>();

     private readonly pageTitles: { [key: string]: string } = {
          'send-xrp': 'Send XRP',
          'send-checks': 'Checks',
          'send-currency': 'Currency',
          'create-time-escrow': 'Create Time Escrow',
          'create-conditional-escrow': 'Create Conditional Escrow',
          account: 'Account Info',
          'create-offer': 'Create Offers',
          'create-nft': 'NFTs',
          'create-tickets': 'Tickets',
          'create-payment-channel': 'Payment Channel',
          'sign-Transactions': 'Sign Transactions',
          trustlines: 'Trustlines',
          'create-amm': 'AMM',
          'fiat-on-off-ramp': 'Fiat On/Off Ramp',
     };

     private readonly networkColors: { [key: string]: string } = {
          devnet: 'rgb(56, 113, 69)',
          testnet: '#ff6719',
          mainnet: 'rgb(115, 49, 55)',
     };

     readonly networkServers: { [key: string]: string } = {
          // Made public for NavbarComponent access
          devnet: 'wss://s.devnet.rippletest.net:51233',
          // devnet: 'ws://192.168.1.226:6007',
          testnet: 'wss://s.altnet.rippletest.net:51233',
          mainnet: 'wss://s1.ripple.com',
     };

     getNet() {
          const environment = localStorage.getItem('selectedNetwork') || 'devnet';
          let net;
          if (!localStorage.getItem('server') || localStorage.getItem('server') === 'undefined') {
               net = this.networkServers[environment];
          } else {
               net = localStorage.getItem('server') || this.networkServers[environment];
          }
          return { net, environment };
     }

     setNet(net: string, environment: string) {
          localStorage.setItem('server', net);
          localStorage.setItem('selectedNetwork', environment);
     }

     getNetworkColor(network: string): string {
          return this.networkColors[network.toLowerCase()] || '#1a1c21';
     }

     getInputValue(id: string): string {
          return localStorage.getItem(id) || '';
     }

     removeValue(id: string) {
          localStorage.removeItem(id);
     }

     claerValues() {
          localStorage.clear();
     }

     // Store a generic key-value pair
     // set(key: string, value: any): void {
     //      localStorage.setItem(key, JSON.stringify(value));
     // }

     set(key: string, value: any): void {
          if (value === undefined) {
               // Don't store "undefined" string
               localStorage.removeItem(key);
               return;
          }
          localStorage.setItem(key, JSON.stringify(value));
     }

     // Retrieve a generic key-value pair
     get(key: string): any {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
     }

     setKnownIssuers(key: string, knownIssuers: { [key: string]: string[] }): void {
          // Ensure XRP always exists (as an empty array)
          if (!knownIssuers['XRP']) {
               knownIssuers['XRP'] = [];
          }

          localStorage.setItem(key, JSON.stringify(knownIssuers));
     }

     getKnownIssuers(key: string): { [key: string]: string[] } | null {
          const value = localStorage.getItem(key);
          if (!value) return null;

          try {
               const parsed = JSON.parse(value);

               // Validate structure (make sure all values are arrays)
               Object.keys(parsed).forEach(currency => {
                    if (!Array.isArray(parsed[currency])) {
                         parsed[currency] = parsed[currency] ? [parsed[currency]] : [];
                    }
               });

               // Ensure XRP key exists
               if (!parsed['XRP']) parsed['XRP'] = [];

               return parsed;
          } catch (err) {
               console.error('Error parsing known issuers from storage:', err);
               return null;
          }
     }

     // Store knownIssuers object
     // setKnownIssuers(key: string, knownIssuers: { [key: string]: string }): void {
     //      knownIssuers['XRP'] = '';
     //      localStorage.setItem(key, JSON.stringify(knownIssuers));
     // }

     // // Retrieve knownIssuers object
     // getKnownIssuers(key: string): { [key: string]: string } | null {
     //      const value = localStorage.getItem(key);
     //      return value ? JSON.parse(value) : null;
     // }

     // Store knownIssuers object
     setKnownWhitelistAddress(key: string, knownWhitelistAddress: { [key: string]: string }): void {
          localStorage.setItem(key, JSON.stringify(knownWhitelistAddress));
     }

     // Retrieve knownIssuers object
     getKnownWhitelistAddress(key: string): { [key: string]: string } | null {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
     }

     setInputValue(id: string, value: string) {
          if (AppConstants.INPUT_IDS.includes(id)) {
               localStorage.setItem(id, value);
          }
     }

     getInputIds(): string[] {
          return [...AppConstants.INPUT_IDS];
     }

     getPageTitle(route: string): string {
          return this.pageTitles[route] || 'XRPL App';
     }

     getActiveNavLink(): string {
          return localStorage.getItem('activeNavLink') || '';
     }

     setActiveNavLink(link: string) {
          localStorage.setItem('activeNavLink', link);
          localStorage.removeItem('activeEscrowLink');
          localStorage.removeItem('activeAccountsLink');
     }

     getActiveEscrowLink(): string {
          return localStorage.getItem('activeEscrowLink') || '';
     }

     getActiveNftLink(): string {
          return localStorage.getItem('activeNftLink') || '';
     }

     setActiveEscrowLink(link: string) {
          localStorage.setItem('activeEscrowLink', link);
          localStorage.removeItem('activeNavLink');
          localStorage.removeItem('activeAccountsLink');
     }

     getActiveAccountsLink(): string {
          return localStorage.getItem('activeAccountsLink') || '';
     }

     setActiveAccountsLink(link: string) {
          localStorage.setItem('activeAccountsLink', link);
          localStorage.removeItem('activeNavLink');
          localStorage.removeItem('activeEscrowLink');
     }
}
