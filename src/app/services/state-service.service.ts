import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppState {
     isMemoEnabled: boolean;
     memoField: string;
     amountField: string;
     invoiceIdField: string;
     ticketSequence: string;
     destinationTagField: string;
     sourceTagField: string;
     isTicket: boolean;
     isMultiSign: boolean;
     isRegularKeyAddress: boolean;
     regularKeyAddress: string;
     regularKeySeed: string;
     signerQuorum: number;
     multiSignAddress: string;
     multiSignSeeds: string;
}

@Injectable({
     providedIn: 'root',
})
export class StateService {
     private readonly initialState: AppState = Object.freeze({
          isMemoEnabled: false,
          memoField: '',
          amountField: '',
          invoiceIdField: '',
          ticketSequence: '',
          destinationTagField: '',
          sourceTagField: '',
          isTicket: false,
          isRegularKeyAddress: false,
          regularKeyAddress: 'No RegularKey configured for account',
          regularKeySeed: '',
          isMultiSign: false,
          signerQuorum: 0,
          multiSignAddress: 'No Multi-Sign address configured for account',
          multiSignSeeds: '',
     });

     private stateSubject = new BehaviorSubject<AppState>({ ...this.initialState });
     state$ = this.stateSubject.asObservable();

     // Full reset
     resetState() {
          this.stateSubject.next(this.initialState);
     }

     // Update just part of the state
     updateState(partial: Partial<AppState>) {
          const current = this.stateSubject.getValue();
          this.stateSubject.next({ ...current, ...partial });
          console.log('[StateService] updateState:', this.stateSubject.getValue());
     }

     // Reset just a subset (using defaults)
     resetPartialState<K extends keyof AppState>(keys: K[]) {
          const current = this.stateSubject.getValue();
          const newState: AppState = { ...current };

          keys.forEach(key => {
               newState[key] = this.initialState[key]; // now guaranteed to be the true default
          });

          this.stateSubject.next(newState);
          console.log('[StateService] reset keys:', keys, '->', this.stateSubject.getValue());
     }

     getState(): AppState {
          return this.stateSubject.getValue();
     }
}
