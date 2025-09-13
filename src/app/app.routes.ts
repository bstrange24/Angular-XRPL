import { Routes } from '@angular/router';
import { SendXrpComponent } from './components/send-xrp/send-xrp.component';
import { CreatePaymentChannelComponent } from './components/create-payment-channel/create-payment-channel.component';
import { CreateTimeEscrowComponent } from './components/create-time-escrow/create-time-escrow.component';
import { CreateConditionalEscrowComponent } from './components/create-conditional-escrow/create-conditional-escrow.component';
import { SendChecksComponent } from './components/send-checks/send-checks.component';
import { CreateTicketsComponent } from './components/create-tickets/create-tickets.component';
import { CreateOfferComponent } from './components/create-offer/create-offer.component';
import { CreateNftComponent } from './components/create-nft/create-nft.component';
import { CreateAmmComponent } from './components/create-amm/create-amm.component';
import { TrustlinesComponent } from './components/trustlines/trustlines.component';
import { DeleteAccountComponent } from './components/delete-account/delete-account.component';
import { AccountConfiguratorComponent } from './components/account-configurator/account-configurator.component';
import { CreateCredentialsComponent } from './components/create-credentials/create-credentials.component';
import { CreateDidComponent } from './components/create-did/create-did.component';
import { AccountChangesComponent } from './components/account-changes/account-changes.component';
import { MptComponent } from './components/mpt/mpt.component';
import { PermissionedDomainComponent } from './components/permissioned-domain/permissioned-domain.component';
import { AccountDelegateComponent } from './components/account-delegate/account-delegate.component';
// import { FiatOnOffRampComponent } from './components/fiat-on-off-ramp/fiat-on-off-ramp.component';

export const routes: Routes = [
     { path: '', redirectTo: '/account-configurator', pathMatch: 'full' },
     { path: 'account-changes', component: AccountChangesComponent, data: { title: 'Account Changes' } },
     { path: 'delete-account', component: DeleteAccountComponent, data: { title: 'Account Delete' } },
     { path: 'account-configurator', component: AccountConfiguratorComponent, data: { title: 'Account Configurator' } },
     { path: 'create-credentials', component: CreateCredentialsComponent, data: { title: 'Account Credentials' } },
     { path: 'create-did', component: CreateDidComponent, data: { title: 'Account DID' } },
     { path: 'permissioned-domain', component: PermissionedDomainComponent, data: { title: 'Permissioned Domain' } },
     { path: 'account-delegate', component: AccountDelegateComponent, data: { title: 'Account Delegate' } },

     { path: 'send-xrp', component: SendXrpComponent, data: { title: 'Send XRP' } },
     { path: 'create-payment-channel', component: CreatePaymentChannelComponent, data: { title: 'Payment Channel' } },
     { path: 'create-time-escrow', component: CreateTimeEscrowComponent, data: { title: 'Time Escrow' } },
     { path: 'create-conditional-escrow', component: CreateConditionalEscrowComponent, data: { title: 'Conditional Escrow' } },
     { path: 'send-checks', component: SendChecksComponent, data: { title: 'Checks' } },
     { path: 'create-tickets', component: CreateTicketsComponent, data: { title: 'Tickets' } },
     { path: 'create-offer', component: CreateOfferComponent, data: { title: 'Create Offers' } },
     { path: 'create-nft', component: CreateNftComponent, data: { title: 'NFT' } },
     { path: 'create-amm', component: CreateAmmComponent, data: { title: 'AMM' } },
     { path: 'trustlines', component: TrustlinesComponent, data: { title: 'Trustlines' } },
     { path: 'mpt', component: MptComponent, data: { title: 'MPT' } },
     // { path: 'fiat-on-off-ramp', component: FiatOnOffRampComponent, data: { title: 'Send XRP' } },
];
