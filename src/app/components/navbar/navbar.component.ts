import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { XrplService } from '../../services/xrpl.service';
import { AppConstants } from '../../core/app.constants';
import { DatePipe } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { formatInTimeZone } from 'date-fns-tz';
import { UtilsService } from '../../services/utils.service';
import { debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs';
import * as xrpl from 'xrpl';
import { RenderUiComponentsService } from '../../services/render-ui-components/render-ui-components.service';

@Component({
     selector: 'app-navbar',
     standalone: true,
     imports: [CommonModule, RouterModule],
     providers: [DatePipe],
     templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {
     @Output() transactionResult = new EventEmitter<{ result: string; isError: boolean; isSuccess: boolean }>();
     selectedNetwork: string = 'Devnet';
     networkColor: string = '#1a1c21';
     navbarColor: string = '#1a1c21';
     isNetworkDropdownOpen: boolean = false;
     isEscrowsDropdownOpen: boolean = false;
     isAccountDropdownOpen: boolean = false;
     isNftDropdownOpen: boolean = false;
     isMptDropdownOpen: boolean = false;
     isUtilsDropdownOpen: boolean = false;
     isEscrowsDropdownActive: boolean = false;
     isNftDropdownActive: boolean = false;
     isMptDropdownActive: boolean = false;
     isAccountsDropdownActive: boolean = false;
     currentDateTime: string = ''; // Store formatted date/time
     private timerSubscription: Subscription | null = null; // For real-time updates
     private searchSubject = new Subject<void>();
     transactionInput = '';
     spinner = false;

     constructor(private readonly storageService: StorageService, private readonly utilsService: UtilsService, private readonly xrplService: XrplService, private readonly router: Router, private readonly datePipe: DatePipe, private readonly renderUiComponentsService: RenderUiComponentsService) {}

     ngOnInit() {
          // Initialize network
          const { environment } = this.storageService.getNet();
          this.selectedNetwork = environment.charAt(0).toUpperCase() + environment.slice(1);
          this.networkColor = this.storageService.getNetworkColor(environment);

          // Initialize active link
          const activeNavLink = this.storageService.getActiveNavLink();
          const activeEscrowLink = this.storageService.getActiveEscrowLink();
          const activeNftLink = this.storageService.getActiveNftLink();
          const activeMptLink = this.storageService.getActiveMptLink();
          this.isEscrowsDropdownActive = !!activeEscrowLink;
          const activeAccountLink = this.storageService.getActiveAccountsLink();
          this.isAccountDropdownOpen = !!activeAccountLink;
          this.isNftDropdownActive = !!activeNftLink;
          this.isMptDropdownActive = !!activeMptLink;

          if (activeAccountLink) {
               this.isAccountsDropdownActive = true;
               this.isAccountDropdownOpen = true;
               this.isEscrowsDropdownActive = false;
               this.isNftDropdownActive = false;
               this.isMptDropdownActive = false;
          } else if (activeEscrowLink) {
               this.isEscrowsDropdownActive = true;
               this.isAccountsDropdownActive = false;
               this.isNftDropdownActive = false;
               this.isMptDropdownActive = false;
          } else if (activeNftLink) {
               this.isNftDropdownActive = true;
               this.isAccountsDropdownActive = false;
               this.isEscrowsDropdownActive = false;
               this.isMptDropdownActive = false;
          } else if (activeMptLink) {
               this.isMptDropdownActive = true;
               this.isNftDropdownActive = false;
               this.isAccountsDropdownActive = false;
               this.isEscrowsDropdownActive = false;
          } else {
               this.isEscrowsDropdownActive = !!activeNavLink && activeNavLink.includes('escrow');
               this.isAccountsDropdownActive = !!activeNavLink && activeNavLink.includes('account');
               this.isNftDropdownActive = !!activeNavLink && activeNavLink.includes('nft');
               this.isMptDropdownActive = !!activeNavLink && activeNavLink.includes('mpt');
          }

          // Initialize date/time and set up timer for real-time updates
          this.updateDateTime();
          this.timerSubscription = interval(100).subscribe(() => {
               this.updateDateTime();
          });

          this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
               this.getTransaction();
          });
     }

     triggerSearch() {
          this.searchSubject.next();
     }

     ngOnDestroy() {
          // Clean up timer subscription to prevent memory leaks
          if (this.timerSubscription) {
               this.timerSubscription.unsubscribe();
          }
     }

     updateDateTime() {
          const now = new Date();
          this.currentDateTime = formatInTimeZone(now, 'America/New_York', 'M/d/yyyy h:mm:ss aa');
     }

     toggleNetworkDropdown() {
          this.isNetworkDropdownOpen = !this.isNetworkDropdownOpen;
          this.isEscrowsDropdownOpen = false;
          this.isUtilsDropdownOpen = false;
          this.isAccountDropdownOpen = false;
          this.isNftDropdownOpen = false;
          this.isMptDropdownOpen = false;
     }

     toggleAccountsDropdown(event: Event) {
          event.preventDefault();
          event.stopPropagation(); // Prevent event bubbling that might interfere
          this.isAccountDropdownOpen = !this.isAccountDropdownOpen;
          this.isAccountsDropdownActive = this.isAccountDropdownOpen; // Sync active state with open state
          this.isNetworkDropdownOpen = false;
          this.isEscrowsDropdownOpen = false;
          this.isNftDropdownOpen = false;
          this.isMptDropdownOpen = false;
          this.isEscrowsDropdownActive = false; // Explicitly reset Escrows active state
          this.isUtilsDropdownOpen = false;
          this.storageService.removeValue('activeEscrowLink'); // Clear escrow link from storage
     }

     toggleEscrowsDropdown(event: Event) {
          event.preventDefault();
          this.isEscrowsDropdownOpen = !this.isEscrowsDropdownOpen;
          this.isNetworkDropdownOpen = false;
          this.isUtilsDropdownOpen = false;
          this.isAccountDropdownOpen = false;
          this.isNftDropdownOpen = false;
          this.isMptDropdownOpen = false;
          this.storageService.removeValue('activeAccountLink'); // Clear escrow link from storage
     }

     toggleNftDropdown(event: Event) {
          event.preventDefault();
          this.isNftDropdownOpen = !this.isNftDropdownOpen;
          this.isMptDropdownOpen = false;
          this.isNetworkDropdownOpen = false;
          this.isUtilsDropdownOpen = false;
          this.isAccountDropdownOpen = false;
          this.storageService.removeValue('activeAccountLink'); // Clear escrow link from storage
     }

     toggleMptDropdown(event: Event) {
          event.preventDefault();
          this.isMptDropdownOpen = !this.isMptDropdownOpen;
          this.isNftDropdownOpen = false;
          this.isNetworkDropdownOpen = false;
          this.isUtilsDropdownOpen = false;
          this.isAccountDropdownOpen = false;
          this.storageService.removeValue('activeAccountLink'); // Clear escrow link from storage
     }

     toggleUtilsDropdown(event: Event) {
          event.preventDefault();
          this.isUtilsDropdownOpen = !this.isUtilsDropdownOpen;
          this.isNetworkDropdownOpen = false;
          this.isEscrowsDropdownOpen = false;
          this.isAccountDropdownOpen = false;
     }

     selectNetwork(network: string) {
          this.selectedNetwork = network.charAt(0).toUpperCase() + network.slice(1);
          this.networkColor = this.storageService.getNetworkColor(network.toLowerCase());
          this.storageService.setNet(this.storageService['networkServers'][network.toLowerCase()], network.toLowerCase());
          this.isNetworkDropdownOpen = false;
     }

     setActiveLink(link: string) {
          this.storageService.setActiveNavLink(link);
          this.isEscrowsDropdownActive = false;
          this.isEscrowsDropdownOpen = false;
          this.isUtilsDropdownOpen = false;
          this.isAccountDropdownOpen = false;
     }

     setActiveEscrowLink(link: string) {
          this.storageService.setActiveEscrowLink(link);
          this.isEscrowsDropdownActive = true;
          this.isEscrowsDropdownOpen = false;
          this.isUtilsDropdownOpen = false;
          this.isAccountDropdownOpen = false;
     }

     setActiveAccountsLink(link: string) {
          this.storageService.setActiveAccountsLink(link);
          this.storageService.removeValue('activeEscrowLink'); // Clear escrow link from storage
          this.isAccountDropdownOpen = true;
          this.isAccountsDropdownActive = true; // Mark Accounts dropdown as active
          this.isEscrowsDropdownActive = false; // Reset Escrows active state
          this.isEscrowsDropdownOpen = false;
          this.isUtilsDropdownOpen = false;
          this.isNetworkDropdownOpen = false;
     }

     private resetDropdownStates(exclude: string = '') {
          if (exclude !== 'network') {
               this.isNetworkDropdownOpen = false;
          }
          if (exclude !== 'accounts') {
               this.isAccountDropdownOpen = false;
               this.isAccountsDropdownActive = false;
          }
          if (exclude !== 'escrows') {
               this.isEscrowsDropdownOpen = false;
               this.isEscrowsDropdownActive = false;
          }
          if (exclude !== 'utils') {
               this.isUtilsDropdownOpen = false;
          }
     }

     async disconnectClient(event: Event) {
          event.preventDefault();
          await this.xrplService.disconnect();
          this.isUtilsDropdownOpen = false;
     }

     clearFields(event: Event) {
          event.preventDefault();
          event.stopPropagation();
          this.storageService.inputsCleared.emit();
          this.isUtilsDropdownOpen = false;

          (document.getElementById('theForm') as HTMLFormElement)?.reset();

          const account1addressField = document.getElementById('account1address') as HTMLInputElement | null;
          const seed1Field = document.getElementById('account1seed') as HTMLInputElement | null;

          const account2addressField = document.getElementById('account2address') as HTMLInputElement | null;
          const seed2Field = document.getElementById('account2seed') as HTMLInputElement | null;

          const mnemonic1Field = document.getElementById('account1mnemonic') as HTMLInputElement | null;
          const mnemonic2Field = document.getElementById('account2mnemonic') as HTMLInputElement | null;

          const secretNumbers1Field = document.getElementById('account1secretNumbers') as HTMLInputElement | null;
          const secretNumbers2Field = document.getElementById('account2secretNumbers') as HTMLInputElement | null;

          if (document.getElementById('issuerName')) {
               const issuerNameField = document.getElementById('issuerName') as HTMLInputElement | null;
               const issuerAddressField = document.getElementById('issuerAddress') as HTMLInputElement | null;
               const issuerSeedField = document.getElementById('issuerSeed') as HTMLInputElement | null;

               if (issuerNameField) issuerNameField.value = AppConstants.EMPTY_STRING;
               if (issuerAddressField) issuerAddressField.value = AppConstants.EMPTY_STRING;
               if (issuerSeedField) issuerSeedField.value = AppConstants.EMPTY_STRING;
          }

          if (account1addressField) account1addressField.value = AppConstants.EMPTY_STRING;
          if (seed1Field) seed1Field.value = AppConstants.EMPTY_STRING;
          if (account2addressField) account2addressField.value = AppConstants.EMPTY_STRING;
          if (seed2Field) seed2Field.value = AppConstants.EMPTY_STRING;
          if (mnemonic1Field) mnemonic1Field.value = AppConstants.EMPTY_STRING;
          if (mnemonic2Field) mnemonic2Field.value = AppConstants.EMPTY_STRING;
          if (secretNumbers1Field) secretNumbers1Field.value = AppConstants.EMPTY_STRING;
          if (secretNumbers2Field) secretNumbers2Field.value = AppConstants.EMPTY_STRING;

          const xrpBalance1Field = document.getElementById('xrpBalance1Field') as HTMLInputElement | null;
          const xrpBalanceField = document.getElementById('xrpBalanceField') as HTMLInputElement | null;
          const ownerCountField = document.getElementById('ownerCountField') as HTMLInputElement | null;
          const totalXrpReservesField = document.getElementById('totalXrpReservesField') as HTMLInputElement | null;
          const totalExecutionTime = document.getElementById('totalExecutionTime') as HTMLInputElement | null;

          if (xrpBalance1Field) xrpBalance1Field.value = AppConstants.EMPTY_STRING;
          if (xrpBalanceField) xrpBalanceField.value = AppConstants.EMPTY_STRING;
          if (ownerCountField) ownerCountField.value = AppConstants.EMPTY_STRING;
          if (totalXrpReservesField) totalXrpReservesField.value = AppConstants.EMPTY_STRING;
          if (totalExecutionTime) totalExecutionTime.value = AppConstants.EMPTY_STRING;

          const resultField = document.getElementById('resultField') as HTMLInputElement | null;
          if (resultField) resultField.innerHTML = AppConstants.EMPTY_STRING;

          AppConstants.INPUT_IDS.forEach(id => {
               const element = document.getElementById(id) as HTMLInputElement | null;
               console.debug('id:' + id + ' element: ' + element);
               if (element) this.storageService.removeValue(id || '');
          });
     }

     gatherAccountInfo(event: Event) {
          event.preventDefault();
          this.isUtilsDropdownOpen = false;

          const resultField = document.getElementById('resultField') as HTMLInputElement | null;
          if (resultField) {
               resultField.classList.remove('error', 'success');
          }

          const account1name = document.getElementById('account1name') as HTMLInputElement | null;
          const account1address = document.getElementById('account1address') as HTMLInputElement | null;
          const account1seed = document.getElementById('account1seed') as HTMLInputElement | null;

          const account2name = document.getElementById('account2name') as HTMLInputElement | null;
          const account2address = document.getElementById('account2address') as HTMLInputElement | null;
          const account2seed = document.getElementById('account2seed') as HTMLInputElement | null;

          const account1mnemonic = document.getElementById('account1mnemonic') as HTMLInputElement | null;
          const account2mnemonic = document.getElementById('account2mnemonic') as HTMLInputElement | null;

          const account1secretNumbers = document.getElementById('account1secretNumbers') as HTMLInputElement | null;
          const account2secretNumbers = document.getElementById('account2secretNumbers') as HTMLInputElement | null;

          let seedOrMnemonicOrSecret1 = (account1seed?.value?.trim() || account1mnemonic?.value?.trim() || account1secretNumbers?.value?.trim()) ?? '';
          let accountData = (account1name?.value ?? '') + '\n' + (account1address?.value ?? '') + '\n' + seedOrMnemonicOrSecret1 + '\n';
          let seedOrMnemonicOrSecret2 = account2seed?.value?.trim() || account2mnemonic?.value?.trim() || account2secretNumbers?.value?.trim() || '';
          accountData += (account2name?.value ?? '') + '\n' + (account2address?.value ?? '') + '\n' + seedOrMnemonicOrSecret2 + '\n';

          if (document.getElementById('issuerName')) {
               const issuerName = document.getElementById('issuerName') as HTMLInputElement | null;
               const issuerAddress = document.getElementById('issuerAddress') as HTMLInputElement | null;
               const issuerSeed = document.getElementById('issuerSeed') as HTMLInputElement | null;
               const issuerSecretNumbers = document.getElementById('issuerSecretNumbers') as HTMLInputElement | null;
               const issuerMnemonic = document.getElementById('issuerMnemonic') as HTMLInputElement | null;
               let seedOrMnemonicOrSecret3 = issuerSeed?.value?.trim() || issuerMnemonic?.value?.trim() || issuerSecretNumbers?.value?.trim() || '';
               accountData += (issuerName?.value ?? '') + '\n' + (issuerAddress?.value ?? '') + '\n' + seedOrMnemonicOrSecret3 + '\n';
          }
          if (resultField) {
               resultField.innerHTML = accountData;
          }
     }

     distributeAccountInfo(event: Event) {
          event.preventDefault();
          // Implement as needed
          this.isUtilsDropdownOpen = false;

          const account1name = document.getElementById('account1name') as HTMLInputElement | null;
          const account1address = document.getElementById('account1address') as HTMLInputElement | null;
          const account1seed = document.getElementById('account1seed') as HTMLInputElement | null;

          const account2name = document.getElementById('account2name') as HTMLInputElement | null;
          const account2address = document.getElementById('account2address') as HTMLInputElement | null;
          const account2seed = document.getElementById('account2seed') as HTMLInputElement | null;

          const account1mnemonic = document.getElementById('account1mnemonic') as HTMLInputElement | null;
          const account2mnemonic = document.getElementById('account2mnemonic') as HTMLInputElement | null;

          const account1secretNumbers = document.getElementById('account1secretNumbers') as HTMLInputElement | null;
          const account2secretNumbers = document.getElementById('account2secretNumbers') as HTMLInputElement | null;

          const issuerName = document.getElementById('issuerName') as HTMLInputElement | null;
          const issuerAddress = document.getElementById('issuerAddress') as HTMLInputElement | null;
          const issuerSeed = document.getElementById('issuerSeed') as HTMLInputElement | null;
          const issuerSecretNumbers = document.getElementById('issuerSecretNumbers') as HTMLInputElement | null;
          const issuerMnemonic = document.getElementById('issuerMnemonic') as HTMLInputElement | null;

          const accountName1Field = document.getElementById('accountName1Field') as HTMLInputElement | null;
          const accountAddress1Field = document.getElementById('accountAddress1Field') as HTMLInputElement | null;
          const accountSeed1Field = document.getElementById('accountSeed1Field') as HTMLInputElement | null;

          const resultField = document.getElementById('resultField') as HTMLInputElement | null;
          if (!resultField) {
               return;
          }

          let accountInfo = resultField.innerHTML.split('\n');
          if (account1name) account1name.value = this.utilsService.stripHTML(accountInfo[0]);
          if (account1address) account1address.value = this.utilsService.stripHTML(accountInfo[1]);

          if (accountName1Field) accountName1Field.value = this.utilsService.stripHTML(accountInfo[0]);
          if (accountAddress1Field) accountAddress1Field.value = this.utilsService.stripHTML(accountInfo[1]);

          if (accountInfo[2].split(' ').length > 1) {
               if (account1mnemonic) account1mnemonic.value = this.utilsService.stripHTML(accountInfo[2]);
               if (account1seed) account1seed.value = this.utilsService.stripHTML(accountInfo[2]);
               if (account1secretNumbers) account1secretNumbers.value = AppConstants.EMPTY_STRING;
          } else if (accountInfo[2].includes(',')) {
               if (account1secretNumbers) account1secretNumbers.value = this.utilsService.stripHTML(accountInfo[2]);
               if (account1seed) account1seed.value = this.utilsService.stripHTML(accountInfo[2]);
               if (account1mnemonic) account1mnemonic.value = AppConstants.EMPTY_STRING;
          } else {
               if (account1seed) account1seed.value = this.utilsService.stripHTML(accountInfo[2]);
               if (accountSeed1Field) accountSeed1Field.value = this.utilsService.stripHTML(accountInfo[2]);
               if (account1secretNumbers) account1secretNumbers.value = AppConstants.EMPTY_STRING;
               if (account1mnemonic) account1mnemonic.value = AppConstants.EMPTY_STRING;
          }

          if (account2name) account2name.value = this.utilsService.stripHTML(accountInfo[3]);
          if (account2address) account2address.value = this.utilsService.stripHTML(accountInfo[4]);

          if (accountInfo[5].split(' ').length > 1) {
               if (account2mnemonic) account2mnemonic.value = this.utilsService.stripHTML(accountInfo[5]);
               if (account2seed) account2seed.value = this.utilsService.stripHTML(accountInfo[5]);
               if (account2secretNumbers) account2secretNumbers.value = AppConstants.EMPTY_STRING;
          } else if (accountInfo[5].includes(',')) {
               if (account2secretNumbers) account2secretNumbers.value = this.utilsService.stripHTML(accountInfo[5]);
               if (account2seed) account2seed.value = this.utilsService.stripHTML(accountInfo[5]);
               if (account2mnemonic) account2mnemonic.value = AppConstants.EMPTY_STRING;
          } else {
               if (account2seed) account2seed.value = this.utilsService.stripHTML(accountInfo[5]);
               if (account2secretNumbers) account2secretNumbers.value = AppConstants.EMPTY_STRING;
               if (account2mnemonic) account2mnemonic.value = AppConstants.EMPTY_STRING;
          }

          if (accountInfo[8].length >= 9) {
               if (issuerName) issuerName.value = this.utilsService.stripHTML(accountInfo[6]);
               if (issuerAddress) issuerAddress.value = this.utilsService.stripHTML(accountInfo[7]);

               if (accountInfo[8].split(' ').length > 1) {
                    if (issuerMnemonic) issuerMnemonic.value = this.utilsService.stripHTML(accountInfo[8]);
                    if (issuerSeed) issuerSeed.value = this.utilsService.stripHTML(accountInfo[8]);
                    if (issuerSecretNumbers) issuerSecretNumbers.value = AppConstants.EMPTY_STRING;
               } else if (accountInfo[8].includes(',')) {
                    if (issuerSecretNumbers) issuerSecretNumbers.value = this.utilsService.stripHTML(accountInfo[8]);
                    if (issuerSeed) issuerSeed.value = this.utilsService.stripHTML(accountInfo[8]);
                    if (issuerMnemonic) issuerMnemonic.value = AppConstants.EMPTY_STRING;
               } else {
                    if (issuerSeed) issuerSeed.value = this.utilsService.stripHTML(accountInfo[8]);
                    if (issuerSecretNumbers) issuerSecretNumbers.value = AppConstants.EMPTY_STRING;
                    if (issuerMnemonic) issuerMnemonic.value = AppConstants.EMPTY_STRING;
               }
          }
          this.saveInputValues();
     }

     saveInputValues() {
          console.log('Entering saveInputValues');
          AppConstants.INPUT_IDS.forEach(id => {
               const element = document.getElementById(id) as HTMLInputElement | null;
               console.debug('id:' + id + ' element: ' + element);
               if (element) this.storageService.setInputValue(id, element.value || '');
          });
          console.log('Leaving saveInputValues');
     }

     async getTransaction() {
          console.log('Entering getTransaction');
          const startTime = Date.now();
          this.spinner = true;

          const input = this.transactionInput.trim();
          if (!input) {
               this.transactionResult.emit({
                    result: `<p>ERROR: Transaction field cannot be empty</p>`,
                    isError: true,
                    isSuccess: false,
               });
               this.spinner = false;
               return;
          }
          if (!this.utilsService.isValidTransactionHash(input) && !this.utilsService.isValidCTID(input) && !xrpl.isValidAddress(input)) {
               this.transactionResult.emit({
                    result: `<p>ERROR: Invalid input. Must be a valid Transaction Hash, CTID, or Address</p>`,
                    isError: true,
                    isSuccess: false,
               });
               this.spinner = false;
               return;
          }

          try {
               const client = await this.xrplService.getClient();

               const tempDiv = document.createElement('div');

               let txResponse;
               if (this.utilsService.isValidTransactionHash(input)) {
                    txResponse = await client.request({
                         command: 'tx',
                         transaction: input,
                    });
               } else if (this.utilsService.isValidCTID(input)) {
                    txResponse = await client.request({
                         command: 'tx',
                         ctid: input,
                    });
               } else if (xrpl.isValidAddress(input)) {
                    txResponse = await client.request({
                         command: 'account_tx',
                         account: input,
                         ledger_index_min: -1,
                         ledger_index_max: -1,
                         limit: 10,
                    });
               }

               tempDiv.innerHTML += `\nTransaction data retrieved successfully.\n`;

               if (txResponse) {
                    this.renderUiComponentsService.renderTransactionsResults(txResponse, tempDiv);

                    this.transactionResult.emit({
                         result: tempDiv.innerHTML,
                         isError: false,
                         isSuccess: true,
                    });
               } else {
                    this.transactionResult.emit({
                         result: `<p>ERROR: No transaction data found.</p>`,
                         isError: true,
                         isSuccess: false,
                    });
               }
          } catch (error: any) {
               console.error('Error:', error);
               this.transactionResult.emit({
                    result: `ERROR: ${error.message || 'Unknown error'}`,
                    isError: true,
                    isSuccess: false,
               });
          } finally {
               this.spinner = false;
               console.log(`Leaving getTransaction in ${Date.now() - startTime}ms`);
          }
     }
}
