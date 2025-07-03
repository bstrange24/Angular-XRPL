// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AccountComponent } from './components/account/account.component';
import { SendXrpComponent } from './components/send-xrp/send-xrp.component';
import { CreatePaymentChannelComponent } from './components/create-payment-channel/create-payment-channel.component';
import { CreateTimeEscrowComponent } from './components/create-time-escrow/create-time-escrow.component';
import { CreateConditionalEscrowComponent } from './components/create-conditional-escrow/create-conditional-escrow.component';
import { SendChecksComponent } from './components/send-checks/send-checks.component';
import { CreateTicketsComponent } from './components/create-tickets/create-tickets.component';
import { CreateOfferComponent } from './components/create-offer/create-offer.component';
import { SendCurrencyComponent } from './components/send-currency/send-currency.component';
import { CreateNftComponent } from './components/create-nft/create-nft.component';
import { CreateAmmComponent } from './components/create-amm/create-amm.component';
import { TrustlinesComponent } from './components/trustlines/trustlines.component';
import { DeleteAccountComponent } from './components/delete-account/delete-account.component';
// import { FiatOnOffRampComponent } from './components/fiat-on-off-ramp/fiat-on-off-ramp.component';

export const routes: Routes = [
     { path: '', redirectTo: '/account', pathMatch: 'full' },
     { path: 'account', component: AccountComponent },
     { path: 'delete-account', component: DeleteAccountComponent },
     { path: 'send-xrp', component: SendXrpComponent },
     { path: 'create-payment-channel', component: CreatePaymentChannelComponent },
     { path: 'create-time-escrow', component: CreateTimeEscrowComponent },
     { path: 'create-conditional-escrow', component: CreateConditionalEscrowComponent },
     { path: 'send-checks', component: SendChecksComponent },
     { path: 'create-tickets', component: CreateTicketsComponent },
     { path: 'create-offer', component: CreateOfferComponent },
     { path: 'send-currency', component: SendCurrencyComponent },
     { path: 'create-nft', component: CreateNftComponent },
     { path: 'create-amm', component: CreateAmmComponent },
     { path: 'trustlines', component: TrustlinesComponent },
     // { path: 'fiat-on-off-ramp', component: FiatOnOffRampComponent },
];

// import { Routes } from '@angular/router';
// import { WalletInputComponent } from './components/wallet-input/wallet-input.component';
// import { AccountComponent } from './components/account/account.component';

// export const routes: Routes = [
//      {
//           path: '',
//           redirectTo: '/account',
//           pathMatch: 'full',
//      },
//      {
//           path: 'wallet-input',
//           loadComponent: () => import('./components/wallet-input/wallet-input.component').then(m => m.WalletInputComponent),
//      },
//      {
//           path: 'account',
//           loadComponent: () => import('./components/account/account.component').then(m => m.AccountComponent),
//      },
//      {
//           path: 'send-xrp',
//           loadComponent: () => import('./components/send-xrp/send-xrp.component').then(m => m.SendXrpComponent),
//      },
//      {
//           path: 'create-payment-channel',
//           loadComponent: () => import('./components/create-payment-channel/create-payment-channel.component').then(m => m.CreatePaymentChannelComponent),
//      },
//      {
//           path: 'create-time-escrow',
//           loadComponent: () => import('./components/create-time-escrow/create-time-escrow.component').then(m => m.CreateTimeEscrowComponent),
//      },
//      {
//           path: 'create-conditional-escrow',
//           loadComponent: () => import('./components/create-conditional-escrow/create-conditional-escrow.component').then(m => m.CreateConditionalEscrowComponent),
//      },
//      {
//           path: 'send-checks',
//           loadComponent: () => import('./components/send-checks/send-checks.component').then(m => m.SendChecksComponent),
//      },
//      {
//           path: 'create-tickets',
//           loadComponent: () => import('./components/create-tickets/create-tickets.component').then(m => m.CreateTicketsComponent),
//      },
//      {
//           path: 'create-offer',
//           loadComponent: () => import('./components/create-offer/create-offer.component').then(m => m.CreateOfferComponent),
//      },
//      {
//           path: 'send-currency',
//           loadComponent: () => import('./components/send-currency/send-currency.component').then(m => m.SendCurrencyComponent),
//      },
//      {
//           path: 'create-nft',
//           loadComponent: () => import('./components/create-nft/create-nft.component').then(m => m.CreateNftComponent),
//      },
//      {
//           path: 'create-amm',
//           loadComponent: () => import('./components/create-amm/create-amm.component').then(m => m.CreateAmmComponent),
//      },
//      // {
//      //      path: 'fiat-on-off-ramp',
//      //      loadComponent: () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
//      // },
//      {
//           path: '**',
//           redirectTo: '/transaction-search',
//      },
// ];
