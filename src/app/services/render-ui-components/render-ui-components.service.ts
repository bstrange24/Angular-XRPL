import { Injectable } from '@angular/core';
import { UtilsService } from '../utils.service';
import { XrplService } from '../xrpl.service';
import { flagNames } from 'flagnames';
import * as xrpl from 'xrpl';
import { AppConstants } from '../../core/app.constants';

@Injectable({
     providedIn: 'root',
})
export class RenderUiComponentsService {
     constructor(private readonly xrplService: XrplService, private utilsService: UtilsService) {}

     renderSimulatedTransactionsResults(transactions: { type: string; result: any } | { type: string; result: any }[], container: HTMLElement): void {
          const txArray = Array.isArray(transactions) ? transactions : [transactions];
          if (!container) {
               console.error('Error: container not found');
               return;
          }
          container.classList.remove('error', 'success');
          // container.innerHTML = ''; // Clear content

          if (txArray[0].result.clearInnerHtml === undefined || txArray[0].result.clearInnerHtml) {
               container.innerHTML = ''; // Clear content
          }

          container.innerHTML = `<div class="simulate-banner">You are in SIMULATION MODE — No real transaction was performed</div>`;
          if (txArray[0].result.errorMessage !== undefined && txArray[0].result.errorMessage !== null && txArray[0].result.errorMessage !== '') {
               container.innerHTML += `<div class="simulate-banner-error">${txArray[0].result.engine_result_message}</div>`;
          }
          container.classList.add('simulate-mode');

          // Add search bar (if not already present)
          let searchBar = container.querySelector('#resultSearch') as HTMLInputElement;
          if (!searchBar) {
               searchBar = document.createElement('input');
               searchBar.type = 'text';
               searchBar.id = 'resultSearch';
               searchBar.placeholder = 'Search transactions...';
               searchBar.className = 'result-search';
               searchBar.style.boxSizing = 'border-box';
               searchBar.setAttribute('aria-label', 'Search displayed transactions by type, hash, or other fields');
               container.appendChild(searchBar);
          }

          // Define nested fields for transactions
          const nestedFields = {
               Payment: ['Amount', 'DeliverMax', 'DestinationTag', 'SourceTag', 'InvoiceID', 'PreviousFields', 'Balance', 'Sequence'],
               OfferCancel: ['OfferSequence'],
               OfferCreate: ['TakerGets', 'TakerPays'],
               TrustSet: ['LimitAmount'],
               AccountSet: ['ClearFlag', 'SetFlag', 'Domain', 'EmailHash', 'MessageKey', 'TransferRate', 'TickSize'],
               AccountDelete: [],
               SetRegularKey: ['RegularKey'],
               SignerListSet: ['SignerEntries'],
               EscrowCreate: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
               EscrowFinish: ['Condition', 'Fulfillment'],
               EscrowCancel: [],
               PaymentChannelCreate: ['Amount', 'DestinationTag', 'SourceTag', 'PublicKey'],
               PaymentChannelFund: ['Amount'],
               PaymentChannelClaim: ['Balance', 'Amount', 'Signature', 'PublicKey'],
               CheckCreate: ['Amount', 'DestinationTag', 'SourceTag', 'InvoiceID'],
               CheckCash: ['Amount', 'DeliverMin'],
               CheckCancel: [],
               DepositPreauth: ['Authorize', 'Unauthorize'],
               TicketCreate: [],
               NFTokenMint: ['NFTokenTaxon', 'Issuer', 'TransferFee', 'URI'],
               NFTokenBurn: [],
               NFTokenCreateOffer: ['Amount', 'Destination'],
               NFTokenCancelOffer: ['NFTokenOffers'],
               NFTokenAcceptOffer: [],
               AMMCreate: ['Amount', 'Amount2', 'TradingFee'],
               AMMFund: ['Amount', 'Amount2'],
               AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
               AMMWithdraw: ['Amount', 'Amount2', 'LPTokenIn'],
               AMMVote: [],
               AMMDelete: [],
               MPTokenIssuanceCreate: ['AssetScale', 'Fee', 'Flags', 'MaximumAmount', 'TransferFee'],
               EnableAmendment: [],
               SetFee: [],
               UNLModify: [],
               Clawback: ['Amount'],
               XChainBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainCreateClaimId: [],
               XChainCommit: ['Amount', 'OtherChainDestination'],
               XChainClaim: [],
               XChainAccountCreateCommit: ['Amount', 'SignatureReward'],
               XChainAddAccountCreateAttestation: [],
               XChainAddClaimAttestation: [],
               XChainCreateBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainModifyBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               DIDSet: ['Data', 'URI', 'Attestation'],
               DIDDelete: [],
               RawTransaction: ['Account', 'Fee', 'Flags'],
          };

          if (txArray.length === 0) {
               container.innerHTML += 'No transactions to display.';
               return;
          }

          // Create Transactions section
          const details = document.createElement('details');
          details.className = 'result-section';
          details.setAttribute('open', 'open');
          const summary = document.createElement('summary');
          summary.textContent = txArray.length === 1 && txArray[0].result?.tx_json?.TransactionType ? 'Transactions' : 'Transactions';
          details.appendChild(summary);

          // Render each transaction
          txArray.forEach((tx, index) => {
               const result = tx.result || {};
               const txType = result.tx_json?.TransactionType || 'Unknown';
               const isSuccess = result.engine_result === 'tesSUCCESS';

               const txDetails = document.createElement('details');
               txDetails.className = `nested-object${isSuccess ? '' : ' error-transaction'}`;
               const txSummary = document.createElement('summary');
               txSummary.textContent = `${txType} ${index + 1}${isSuccess ? '' : ' (Failed)'}${tx.result.OfferSequence ? ` (Sequence: ${tx.result.OfferSequence})` : ''}`;
               txDetails.appendChild(txSummary);

               if (result.error) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: ${result.error}`;
                    txDetails.appendChild(errorMessage);
               } else if (!isSuccess && result.meta?.TransactionResult) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: Transaction failed with result ${result.meta.TransactionResult}`;
                    txDetails.appendChild(errorMessage);
               }

               // Transaction Details Table
               const txTable = document.createElement('div');
               txTable.className = 'result-table';
               const txHeader = document.createElement('div');
               txHeader.className = 'result-row result-header';
               txHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txTable.appendChild(txHeader);

               const txContent = [
                    { key: 'Transaction Type', value: txType },
                    // { key: 'Accepted', value: result.accepted ? `${result.accepted}` : 'N/A' },
                    // { key: 'Account Sequence Available', value: result.account_sequence_available ? `${result.account_sequence_available}` : 'N/A' },
                    // { key: 'Account Sequence Next', value: result.account_sequence_next ? `${result.account_sequence_next}` : 'N/A' },
                    { key: 'Applied', value: result.applied ? `${Boolean(result.applied)}` : 'False' },
                    // { key: 'Broadcast', value: result.broadcast ? `${result.broadcast}` : 'N/A' },
                    { key: 'Engine Result', value: result.engine_result ? `${result.engine_result}` : 'N/A' },
                    { key: 'Engine Result Code', value: result.engine_result_code ? `${result.engine_result_code}` : '0' },
                    { key: 'Engine Result Message', value: result.engine_result_message ? `${result.engine_result_message}` : 'N/A' },
                    { key: 'Ledger Index', value: result.ledger_index ? `${result.ledger_index}` : 'N/A' },
                    // { key: 'Kept', value: result.kept ? `${result.kept}` : 'N/A' },
                    // { key: 'Open Ledger Cost', value: result.open_ledger_cost ? `${result.open_ledger_cost}` : 'N/A' },
                    // { key: 'Queued', value: result.queued ? `${result.queued}` : 'False' },
                    // { key: 'Tx Blob', value: result.tx_blob ? `${result.tx_blob}` : 'N/A' },
               ];

               txContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value}</div>
              `;
                    txTable.appendChild(row);
               });

               // Transaction Data Table
               const txDataContent = result.tx_json
                    ? Object.entries(result.tx_json)
                           .filter(([key]) => key !== 'TransactionType')
                           .map(([key, value]) => ({ key, value: this.utilsService.formatValue(key, value, nestedFields[txType as keyof typeof nestedFields] || []) }))
                    : [];

               const txDataTable = document.createElement('div');
               txDataTable.className = 'result-table';
               const txDataHeader = document.createElement('div');
               txDataHeader.className = 'result-row result-header';
               txDataHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txDataTable.appendChild(txDataHeader);

               txDataContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';

                    let displayValue: string;
                    if (typeof item.value === 'object' && item.value !== null) {
                         if (item.key === 'LimitAmount' && typeof item.value === 'object') {
                              const currency = (item.value as { currency: string }).currency;
                              const value = (item.value as { value: string }).value;
                              const issuer = (item.value as { issuer: string }).issuer;
                              displayValue = `${currency} ${value} (issuer: <code>${issuer}</code>)`;
                         } else {
                              displayValue = JSON.stringify(item.value, null, 2).replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
                         }
                    } else {
                         displayValue = String(item.value);
                         if (item.key === 'Account' || item.key === 'OfferSequence' || item.key === 'SigningPubKey' || item.key === 'TxnSignature' || item.key === 'ctid') {
                              displayValue = `<code>${displayValue}</code>`;
                         }
                         if ((item.key == 'Asset' || item.key == 'Asset2') && item.value.includes('undefined')) {
                              displayValue = item.value.split(' ')[1];
                         } else if(item.key == 'Memos' && tx.result.tx_json.Memos.length>0) {
                              displayValue = `${this.utilsService.formatMemos(tx.result.tx_json.Memos)}`;
                         }
                    }

                    row.innerHTML = `
                      <div class="result-cell key">${item.key}</div>
                      <div class="result-cell value">${displayValue}</div>
                    `;
                    txDataTable.appendChild(row);
               });

               const txDataDetails = document.createElement('details');
               txDataDetails.className = 'nested-object';
               const txDataSummary = document.createElement('summary');
               txDataSummary.textContent = 'Transaction Data';
               txDataDetails.appendChild(txDataSummary);
               txDataDetails.appendChild(txDataTable);

               // Meta Data Table
               const metaContent = result.meta
                    ? [
                           { key: 'Transaction Index', value: result.meta.TransactionIndex || 'N/A' },
                           { key: 'Transaction Result', value: result.meta.TransactionResult || 'N/A' },
                           { key: 'Delivered Amount', value: result.meta.delivered_amount ? this.utilsService.formatAmount(result.meta.delivered_amount) : 'N/A' },
                      ]
                    : [];

               const metaTable = document.createElement('div');
               metaTable.className = 'result-table';
               const metaHeader = document.createElement('div');
               metaHeader.className = 'result-row result-header';
               metaHeader.innerHTML = `
                   <div class="result-cell key">Key</div>
                   <div class="result-cell value">Value</div>
                 `;
               metaTable.appendChild(metaHeader);

               metaContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                     <div class="result-cell key">${item.key}</div>
                     <div class="result-cell value">${item.value}</div>
                   `;
                    metaTable.appendChild(row);
               });

               const metaDetails = document.createElement('details');
               metaDetails.className = 'nested-object';
               const metaSummary = document.createElement('summary');
               metaSummary.textContent = 'Meta Data';
               metaDetails.appendChild(metaSummary);
               metaDetails.appendChild(metaTable);

               // Affected Nodes
               const affectedNodesContent = result.meta?.AffectedNodes
                    ? result.meta.AffectedNodes.map((node: any, nodeIndex: number) => {
                           const nodeType = Object.keys(node)[0];
                           const entry = node[nodeType] || {};
                           return {
                                key: `${nodeType} ${nodeIndex + 1}`,
                                content: [
                                     { key: 'Ledger Entry Type', value: entry.LedgerEntryType || 'N/A' },
                                     { key: 'Ledger Index', value: entry.LedgerIndex ? `<code>${entry.LedgerIndex}</code>` : 'N/A' },
                                     ...(entry.PreviousTxnID ? [{ key: 'Previous Txn ID', value: `<code>${entry.PreviousTxnID}</code>` }] : []),
                                     ...(entry.PreviousTxnLgrSeq ? [{ key: 'Previous Txn Lgr Seq', value: entry.PreviousTxnLgrSeq }] : []),
                                     ...Object.entries(entry.FinalFields || {}).map(([k, v]) => ({
                                          key: k,
                                          value: this.utilsService.formatValue(k, v),
                                     })),
                                     ...Object.entries(entry.NewFields || {}).map(([k, v]) => ({
                                          key: k,
                                          value: this.utilsService.formatValue(k, v),
                                     })),
                                     ...(entry.PreviousFields
                                          ? [
                                                 {
                                                      key: 'Previous Fields',
                                                      content: Object.entries(entry.PreviousFields).map(([k, v]) => ({
                                                           key: k,
                                                           value: this.utilsService.formatValue(k, v),
                                                      })),
                                                 },
                                            ]
                                          : []),
                                ],
                           };
                      })
                    : [];

               const affectedNodesDetails = document.createElement('details');
               affectedNodesDetails.className = 'nested-object';
               const affectedNodesSummary = document.createElement('summary');
               affectedNodesSummary.textContent = 'Affected Nodes';
               affectedNodesDetails.appendChild(affectedNodesSummary);

               affectedNodesContent.forEach((node: { key: string; content: any[] }) => {
                    const nodeDetails = document.createElement('details');
                    nodeDetails.className = 'nested-object';
                    const nodeSummary = document.createElement('summary');
                    nodeSummary.textContent = node.key;
                    nodeDetails.appendChild(nodeSummary);

                    const nodeTable = document.createElement('div');
                    nodeTable.className = 'result-table';
                    const nodeHeader = document.createElement('div');
                    nodeHeader.className = 'result-row result-header';
                    nodeHeader.innerHTML = `
                       <div class="result-cell key">Key</div>
                       <div class="result-cell value">Value</div>
                   `;
                    nodeTable.appendChild(nodeHeader);

                    node.content.forEach(item => {
                         const row = document.createElement('div');
                         row.className = 'result-row';

                         if (item.content) {
                              // Keep proper key + value structure
                              row.innerHTML = `<div class="result-cell key">${item.key}</div>`;

                              const valueCell = document.createElement('div');
                              valueCell.className = 'result-cell value';

                              const nestedDetails = document.createElement('details');
                              nestedDetails.className = 'nested-object';

                              const nestedSummary = document.createElement('summary');
                              nestedSummary.textContent = item.key;
                              nestedDetails.appendChild(nestedSummary);

                              const nestedTable = document.createElement('div');
                              nestedTable.className = 'result-table';
                              const nestedHeader = document.createElement('div');
                              nestedHeader.className = 'result-row result-header';
                              nestedHeader.innerHTML = `
                       <div class="result-cell key">Key</div>
                       <div class="result-cell value">Value</div>
                   `;
                              nestedTable.appendChild(nestedHeader);

                              item.content.forEach((nestedItem: { key: string; value?: string }) => {
                                   const nestedRow = document.createElement('div');
                                   nestedRow.className = 'result-row';
                                   nestedRow.innerHTML = `
                           <div class="result-cell key">${nestedItem.key}</div>
                           <div class="result-cell value">${nestedItem.value || ''}</div>
                       `;
                                   nestedTable.appendChild(nestedRow);
                              });

                              nestedDetails.appendChild(nestedTable);
                              valueCell.appendChild(nestedDetails);
                              row.appendChild(valueCell);
                         } else {
                              // Normal key-value row
                              row.innerHTML = `
                               <div class="result-cell key">${item.key}</div>
                               <div class="result-cell value">${item.value || ''}</div>
                           `;
                         }

                         nodeTable.appendChild(row);
                    });

                    nodeDetails.appendChild(nodeTable);
                    affectedNodesDetails.appendChild(nodeDetails);
               });

               txDetails.appendChild(txTable);
               txDetails.appendChild(txDataDetails);
               txDetails.appendChild(metaDetails);
               txDetails.appendChild(affectedNodesDetails);
               details.appendChild(txDetails);
          });

          container.appendChild(details);

          document.querySelectorAll('.result-section, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (savedState === 'open' || title === 'Account Data' || title === 'RippleState') {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Updated search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               console.debug('Search query:', search);
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data' || (title && title.includes('Trust Lines'))) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;

                    // Skip directRows since there are none in this case
                    const nestedDetails = section.querySelectorAll('.nested-object');
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key');
                              const valueCell = row.querySelector('.value');
                              const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML) : '';
                              const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML) : '';
                              // console.debug('Row content:', { keyText, valueText, search });
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) {
                                   nestedHasVisibleContent = true;
                                   console.debug('Match found:', { keyText, valueText, search });
                              }
                         });
                         (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     renderTransactionsResults(transactions: { type: string; result: any } | { type: string; result: any }[], container: HTMLElement): void {
          const txArray = Array.isArray(transactions) ? transactions : [transactions];
          if (!container) {
               console.error('Error: container not found');
               return;
          }
          container.classList.remove('error', 'success');
          // container.innerHTML = ''; // Clear content

          if (txArray[0].result.clearInnerHtml === undefined || txArray[0].result.clearInnerHtml) {
               container.innerHTML = ''; // Clear content
          }

          if (txArray[0].result.errorMessage !== undefined && txArray[0].result.errorMessage !== null && txArray[0].result.errorMessage !== '') {
               container.innerHTML += `<div class="simulate-banner-error">${txArray[0].result.errorMessage}</div>`;
          }

          type EnvKey = keyof typeof AppConstants.XRPL_WIN_URL; // "MAINNET" | "TESTNET" | "DEVNET"
          const env = this.xrplService.getNet().environment.toUpperCase() as EnvKey;
          const url = AppConstants.XRPL_WIN_URL[env] || AppConstants.XRPL_WIN_URL.DEVNET;

          // Add search bar (if not already present)
          let searchBar = container.querySelector('#resultSearch') as HTMLInputElement;
          if (!searchBar) {
               searchBar = document.createElement('input');
               searchBar.type = 'text';
               searchBar.id = 'resultSearch';
               searchBar.placeholder = 'Search transactions...';
               searchBar.className = 'result-search';
               searchBar.style.boxSizing = 'border-box';
               searchBar.setAttribute('aria-label', 'Search displayed transactions by type, hash, or other fields');
               container.appendChild(searchBar);
          }

          // Define nested fields for transactions
          const nestedFields = {
               Payment: ['Amount', 'DeliverMax', 'DestinationTag', 'SourceTag', 'InvoiceID', 'PreviousFields', 'Balance', 'Sequence'],
               OfferCancel: ['OfferSequence'],
               OfferCreate: ['TakerGets', 'TakerPays'],
               TrustSet: ['LimitAmount'],
               AccountSet: ['ClearFlag', 'SetFlag', 'Domain', 'EmailHash', 'MessageKey', 'TransferRate', 'TickSize'],
               AccountDelete: [],
               SetRegularKey: ['RegularKey'],
               SignerListSet: ['SignerEntries'],
               EscrowCreate: ['Amount', 'Condition', 'DestinationTag', 'SourceTag'],
               EscrowFinish: ['Condition', 'Fulfillment'],
               EscrowCancel: [],
               PaymentChannelCreate: ['Amount', 'DestinationTag', 'SourceTag', 'PublicKey'],
               PaymentChannelFund: ['Amount'],
               PaymentChannelClaim: ['Balance', 'Amount', 'Signature', 'PublicKey'],
               CheckCreate: ['Amount', 'DestinationTag', 'SourceTag', 'InvoiceID'],
               CheckCash: ['Amount', 'DeliverMin'],
               CheckCancel: [],
               DepositPreauth: ['Authorize', 'Unauthorize'],
               TicketCreate: [],
               NFTokenMint: ['NFTokenTaxon', 'Issuer', 'TransferFee', 'URI'],
               NFTokenBurn: [],
               NFTokenCreateOffer: ['Amount', 'Destination'],
               NFTokenCancelOffer: ['NFTokenOffers'],
               NFTokenAcceptOffer: [],
               AMMCreate: ['Amount', 'Amount2', 'TradingFee'],
               AMMFund: ['Amount', 'Amount2'],
               AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
               AMMWithdraw: ['Amount', 'Amount2', 'LPTokenIn'],
               AMMVote: [],
               AMMDelete: [],
               MPTokenIssuanceCreate: ['AssetScale', 'Fee', 'Flags', 'MaximumAmount', 'TransferFee'],
               EnableAmendment: [],
               SetFee: [],
               UNLModify: [],
               Clawback: ['Amount'],
               XChainBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainCreateClaimId: [],
               XChainCommit: ['Amount', 'OtherChainDestination'],
               XChainClaim: [],
               XChainAccountCreateCommit: ['Amount', 'SignatureReward'],
               XChainAddAccountCreateAttestation: [],
               XChainAddClaimAttestation: [],
               XChainCreateBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               XChainModifyBridge: ['MinAccountCreateAmount', 'SignatureReward'],
               DIDSet: ['Data', 'URI', 'Attestation'],
               DIDDelete: [],
               RawTransaction: ['Account', 'Fee', 'Flags'],
          };

          if (txArray.length === 0) {
               container.innerHTML += 'No transactions to display.';
               return;
          }

          // Create Transactions section
          const details = document.createElement('details');
          details.className = 'result-section';
          details.setAttribute('open', 'open');
          const summary = document.createElement('summary');
          // summary.textContent = txArray.length === 1 && txArray[0].result?.tx_json?.TransactionType ? txArray[0].result.tx_json.TransactionType : 'Transactions';
          summary.textContent = txArray.length === 1 && txArray[0].result?.tx_json?.TransactionType ? 'Transactions' : 'Transactions';
          details.appendChild(summary);

          let txDetails = document.createElement('details');
          // Render each transaction
          txArray.forEach((tx, index) => {
               const result = tx.result || {};
               const txType = result.tx_json?.TransactionType || 'Unknown';
               const isSuccess = result.meta?.TransactionResult === 'tesSUCCESS';

               // const txDetails = document.createElement('details');
               txDetails = document.createElement('details');
               txDetails.className = `nested-object${isSuccess ? '' : ' error-transaction'}`;
               const txSummary = document.createElement('summary');
               // txSummary.textContent = `${tx.result.tx_json.TransactionType} ${isSuccess ? '' : ' (Failed)'}`; // Indicate failure in summary
               txSummary.textContent = `${txType} ${index + 1}${isSuccess ? '' : ' (Failed)'}${tx.result.OfferSequence ? ` (Sequence: ${tx.result.OfferSequence})` : ''}`; // Include sequence
               txDetails.appendChild(txSummary);

               if (result.error) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: ${result.error}`;
                    txDetails.appendChild(errorMessage);
               } else if (!isSuccess && result.meta?.TransactionResult) {
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = `Error: Transaction failed with result ${result.meta.TransactionResult}`;
                    txDetails.appendChild(errorMessage);
               }

               // Transaction Details Table
               const txTable = document.createElement('div');
               txTable.className = 'result-table';
               const txHeader = document.createElement('div');
               txHeader.className = 'result-row result-header';
               txHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txTable.appendChild(txHeader);

               const txContent = [
                    { key: 'Transaction Type', value: txType },
                    // { key: 'Hash', value: result.hash ? `<code>${result.hash}</code>` : 'N/A' },
                    {
                         key: 'Hash',
                         value: result.hash
                              ? `<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                   <code>${result.hash}</code>
                                   <div style="display: flex; align-items: center; gap: 4px;">
                                        <button class="copy-btn" data-text="${result.hash}" title="Copy hash to clipboard" style="background: none; border: 1px solid #ddd; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; transition: all 0.2s ease;">
                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                             </svg>
                                        </button>
                                        <a href="${url}${result.hash}" target="_blank" rel="noopener noreferrer" title="View transaction on XRPLWin" style="background: none; border: 1px solid #ddd; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; text-decoration: none; color: inherit; transition: all 0.2s ease;">
                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                             <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                             <polyline points="15 3 21 3 21 9"></polyline>
                                             <line x1="10" y1="14" x2="21" y2="3"></line>
                                             </svg>
                                        </a>
                                   </div>
                              </div>`
                              : 'N/A',
                    },
                    // {
                    // key: 'Hash',
                    //      value: result.hash
                    //           ? `<div style="display: flex; align-items: center; gap: 1px;"><code>${result.hash}</code>
                    //                <button class="copy-btn" data-text="${result.hash}" title="Copy hash to clipboard" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center;">
                    //                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    //                     <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    //                     <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    //                     </svg>
                    //                </button>
                    //                 <a href="${url}${result.hash}" target="_blank" rel="noopener noreferrer" title="View transaction on XRPLWin" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; text-decoration: none; color: inherit;">
                    //                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    //                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    //                          <polyline points="15 3 21 3 21 9"></polyline>
                    //                          <line x1="10" y1="14" x2="21" y2="3"></line>
                    //                     </svg>
                    //                </a>
                    //           </div>`
                    //           : 'N/A',
                    // },
                    { key: 'CTID', value: result.ctid || 'N/A' },
                    { key: 'Date', value: result.close_time_iso ? new Date(result.close_time_iso).toLocaleString() : result.date || 'N/A' },
                    // { key: 'Result', value: result.meta?.TransactionResult ? (isSuccess ? result.meta.TransactionResult : `<span class="error-result">${result.meta.TransactionResult}</span>`) : 'N/A' },
                    { key: 'Result', value: result.error ? `<span class="error-result">${result.error}</span>` : result.meta?.TransactionResult ? (isSuccess ? result.meta.TransactionResult : `<span class="error-result">${result.meta.TransactionResult}</span>`) : 'N/A' },
                    { key: 'Ledger Index', value: result.ledger_index || 'N/A' },
                    { key: 'Validated', value: result.validated !== undefined ? result.validated.toString() : 'N/A' },
               ];

               txContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value}</div>
              `;
                    txTable.appendChild(row);
               });

               // Transaction Data Table
               const txDataContent = result.tx_json
                    ? Object.entries(result.tx_json)
                           .filter(([key]) => key !== 'TransactionType')
                           .map(([key, value]) => ({ key, value: this.utilsService.formatValue(key, value, nestedFields[txType as keyof typeof nestedFields] || []) }))
                    : [];

               const txDataTable = document.createElement('div');
               txDataTable.className = 'result-table';
               const txDataHeader = document.createElement('div');
               txDataHeader.className = 'result-row result-header';
               txDataHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               txDataTable.appendChild(txDataHeader);

               txDataContent.forEach(item => {
                    // console.debug(`ite ${item.key} ${item.value}`);
                    const row = document.createElement('div');
                    row.className = 'result-row';

                    // Format value based on type
                    let displayValue: string;
                    if (typeof item.value === 'object' && item.value !== null) {
                         // Handle LimitAmount object
                         if (item.key === 'LimitAmount' && typeof item.value === 'object') {
                              const currency = (item.value as { currency: string }).currency;
                              const value = (item.value as { value: string }).value;
                              const issuer = (item.value as { issuer: string }).issuer;
                              displayValue = `${currency} ${value} (issuer: <code>${issuer}</code>)`;
                         } else {
                              // Fallback for other objects
                              displayValue = JSON.stringify(item.value, null, 2).replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
                         }
                    } else {
                         // Handle strings or other primitives
                         displayValue = String(item.value);
                         // Wrap in <code> if it looks like an address or key
                         if (item.key === 'Account' || item.key === 'OfferSequence' || item.key === 'SigningPubKey' || item.key === 'TxnSignature' || item.key === 'ctid') {
                              // if (item.key === 'Account' || item.key === 'SigningPubKey' || item.key === 'TxnSignature' || item.key === 'ctid') {
                              displayValue = `<code>${displayValue}</code>`;
                         }
                         if ((item.key == 'Asset' || item.key == 'Asset2') && item.value.includes('undefined')) {
                              displayValue = item.value.split(' ')[1];
                         } else if(item.key == 'Memos' && tx.result.tx_json.Memos.length>0) {
                              displayValue = `${this.utilsService.formatMemos(tx.result.tx_json.Memos)}`;
                         }
                    }

                    row.innerHTML = `
                      <div class="result-cell key">${item.key}</div>
                      <div class="result-cell value">${displayValue}</div>
                    `;
                    txDataTable.appendChild(row);
               });

               const txDataDetails = document.createElement('details');
               txDataDetails.className = 'nested-object';
               const txDataSummary = document.createElement('summary');
               txDataSummary.textContent = 'Transaction Data';
               txDataDetails.appendChild(txDataSummary);
               txDataDetails.appendChild(txDataTable);

               // Meta Data Table
               const metaContent = result.meta
                    ? [
                           { key: 'Transaction Index', value: result.meta.TransactionIndex || 'N/A' },
                           { key: 'Transaction Result', value: result.meta.TransactionResult || 'N/A' },
                           { key: 'Delivered Amount', value: result.meta.delivered_amount ? this.utilsService.formatAmount(result.meta.delivered_amount) : 'N/A' },
                      ]
                    : [];

               const metaTable = document.createElement('div');
               metaTable.className = 'result-table';
               const metaHeader = document.createElement('div');
               metaHeader.className = 'result-row result-header';
               metaHeader.innerHTML = `
              <div class="result-cell key">Key</div>
              <div class="result-cell value">Value</div>
            `;
               metaTable.appendChild(metaHeader);

               metaContent.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'result-row';
                    row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value}</div>
              `;
                    metaTable.appendChild(row);
               });

               const metaDetails = document.createElement('details');
               metaDetails.className = 'nested-object';
               const metaSummary = document.createElement('summary');
               metaSummary.textContent = 'Meta Data';
               metaDetails.appendChild(metaSummary);
               metaDetails.appendChild(metaTable);

               // Affected Nodes
               const affectedNodesContent = result.meta?.AffectedNodes
                    ? result.meta.AffectedNodes.map((node: any, nodeIndex: number) => {
                           const nodeType = Object.keys(node)[0];
                           const entry = node[nodeType] || {};
                           return {
                                key: `${nodeType} ${nodeIndex + 1}`,
                                content: [
                                     { key: 'Ledger Entry Type', value: entry.LedgerEntryType || 'N/A' },
                                     { key: 'Ledger Index', value: entry.LedgerIndex ? `<code>${entry.LedgerIndex}</code>` : 'N/A' },
                                     ...(entry.PreviousTxnID ? [{ key: 'Previous Txn ID', value: `<code>${entry.PreviousTxnID}</code>` }] : []),
                                     ...(entry.PreviousTxnLgrSeq ? [{ key: 'Previous Txn Lgr Seq', value: entry.PreviousTxnLgrSeq }] : []),
                                     ...Object.entries(entry.FinalFields || {}).map(([k, v]) => ({
                                          key: k,
                                          value: this.utilsService.formatValue(k, v),
                                     })),
                                     ...Object.entries(entry.NewFields || {}).map(([k, v]) => ({
                                          key: k,
                                          value: this.utilsService.formatValue(k, v),
                                     })),
                                     ...(entry.PreviousFields
                                          ? [
                                                 {
                                                      key: 'Previous Fields',
                                                      content: Object.entries(entry.PreviousFields).map(([k, v]) => ({
                                                           key: k,
                                                           value: this.utilsService.formatValue(k, v),
                                                      })),
                                                 },
                                            ]
                                          : []),
                                ],
                           };
                      })
                    : [];

               const affectedNodesDetails = document.createElement('details');
               affectedNodesDetails.className = 'nested-object';
               const affectedNodesSummary = document.createElement('summary');
               affectedNodesSummary.textContent = 'Affected Nodes';
               affectedNodesDetails.appendChild(affectedNodesSummary);

               affectedNodesContent.forEach((node: { key: string; content: any[] }) => {
                    const nodeDetails = document.createElement('details');
                    nodeDetails.className = 'nested-object';
                    const nodeSummary = document.createElement('summary');
                    nodeSummary.textContent = node.key;
                    nodeDetails.appendChild(nodeSummary);

                    const nodeTable = document.createElement('div');
                    nodeTable.className = 'result-table';
                    const nodeHeader = document.createElement('div');
                    nodeHeader.className = 'result-row result-header';
                    nodeHeader.innerHTML = `
        <div class="result-cell key">Key</div>
        <div class="result-cell value">Value</div>
    `;
                    nodeTable.appendChild(nodeHeader);

                    node.content.forEach(item => {
                         const row = document.createElement('div');
                         row.className = 'result-row';

                         if (item.content) {
                              // Keep proper key + value structure
                              row.innerHTML = `<div class="result-cell key">${item.key}</div>`;

                              const valueCell = document.createElement('div');
                              valueCell.className = 'result-cell value';

                              const nestedDetails = document.createElement('details');
                              nestedDetails.className = 'nested-object';

                              const nestedSummary = document.createElement('summary');
                              nestedSummary.textContent = item.key;
                              nestedDetails.appendChild(nestedSummary);

                              const nestedTable = document.createElement('div');
                              nestedTable.className = 'result-table';
                              const nestedHeader = document.createElement('div');
                              nestedHeader.className = 'result-row result-header';
                              nestedHeader.innerHTML = `
        <div class="result-cell key">Key</div>
        <div class="result-cell value">Value</div>
    `;
                              nestedTable.appendChild(nestedHeader);

                              item.content.forEach((nestedItem: { key: string; value?: string }) => {
                                   const nestedRow = document.createElement('div');
                                   nestedRow.className = 'result-row';
                                   nestedRow.innerHTML = `
            <div class="result-cell key">${nestedItem.key}</div>
            <div class="result-cell value">${nestedItem.value || ''}</div>
        `;
                                   nestedTable.appendChild(nestedRow);
                              });

                              nestedDetails.appendChild(nestedTable);
                              valueCell.appendChild(nestedDetails);
                              row.appendChild(valueCell);
                         } else {
                              // Normal key-value row
                              row.innerHTML = `
                <div class="result-cell key">${item.key}</div>
                <div class="result-cell value">${item.value || ''}</div>
            `;
                         }

                         nodeTable.appendChild(row);
                    });

                    nodeDetails.appendChild(nodeTable);
                    affectedNodesDetails.appendChild(nodeDetails);
               });

               txDetails.appendChild(txTable);
               txDetails.appendChild(txDataDetails);
               txDetails.appendChild(metaDetails);
               txDetails.appendChild(affectedNodesDetails);
               details.appendChild(txDetails);
          });

          container.appendChild(details);

          document.querySelectorAll('.result-section, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (savedState === 'open' || title === 'Account Data' || title === 'RippleState') {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Updated search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               console.debug('Search query:', search);
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data' || (title && title.includes('Trust Lines'))) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;

                    // Skip directRows since there are none in this case
                    const nestedDetails = section.querySelectorAll('.nested-object');
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key');
                              const valueCell = row.querySelector('.value');
                              const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML) : '';
                              const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML) : '';
                              // console.debug('Row content:', { keyText, valueText, search });
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) {
                                   nestedHasVisibleContent = true;
                                   console.debug('Match found:', { keyText, valueText, search });
                              }
                         });
                         (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });

          // Add event listeners for copy buttons
          txDetails.addEventListener('click', function (e: Event) {
               // Check if target exists and is an Element
               if (!e.target || !(e.target instanceof Element)) {
                    return;
               }

               // Use optional chaining and type assertion
               const button = e.target.closest('.copy-btn') as HTMLElement | null;

               if (button && button instanceof HTMLElement) {
                    const textToCopy = button.getAttribute('data-text');

                    if (!textToCopy) {
                         return;
                    }

                    navigator.clipboard
                         .writeText(textToCopy)
                         .then(() => {
                              // Visual feedback
                              const originalTitle = button.getAttribute('title');
                              button.setAttribute('title', 'Copied!');

                              // Change icon color to green
                              const svg = button.querySelector('svg');
                              if (svg instanceof SVGElement) {
                                   svg.style.color = 'green';
                              }

                              setTimeout(() => {
                                   if (originalTitle) {
                                        button.setAttribute('title', originalTitle);
                                   }
                                   const svg = button.querySelector('svg');
                                   if (svg instanceof SVGElement) {
                                        svg.style.color = '';
                                   }
                              }, 2000);
                         })
                         .catch(err => {
                              console.error('Failed to copy: ', err);
                              const svg = button.querySelector('svg');
                              if (svg instanceof SVGElement) {
                                   svg.style.color = 'red';
                                   setTimeout(() => {
                                        svg.style.color = '';
                                   }, 2000);
                              }
                         });
               }
          });
     }

     renderAccountDetails(accountInfo: any, accountObjects: xrpl.AccountObjectsResponse) {
          const container = document.getElementById('resultField') as HTMLInputElement;
          if (!container) {
               console.error('Error: #resultField not found');
               return;
          }
          container.classList.remove('error', 'success');
          container.innerHTML = ''; // Clear content

          // Add search bar
          const searchBar = document.createElement('input');
          searchBar.type = 'text';
          searchBar.id = 'resultSearch';
          searchBar.placeholder = 'Search account info...';
          searchBar.className = 'result-search';
          searchBar.style.boxSizing = 'border-box';
          container.appendChild(searchBar);

          // Group account objects by LedgerEntryType while preserving order
          interface AccountObject {
               LedgerEntryType: string;
               [key: string]: any;
          }

          interface ObjectsByTypeGroup {
               type: string;
               objects: (AccountObject & { originalIndex: number })[];
               order: number;
          }

          type ObjectsByType = {
               [type: string]: ObjectsByTypeGroup;
          };

          const objectsByType: ObjectsByType = accountObjects.result.account_objects.reduce((acc: ObjectsByType, obj: AccountObject, idx: number) => {
               const type = obj.LedgerEntryType;
               if (!acc[type]) {
                    acc[type] = { type, objects: [], order: idx };
               }
               acc[type].objects.push({ ...obj, originalIndex: idx });
               return acc;
          }, {});

          // Convert grouped objects to subSections
          const subSections = Object.values(objectsByType)
               // .sort((a, b) => {
               //      // Prioritize RippleState, then maintain original order
               //      if (a.type === 'RippleState' && b.type !== 'RippleState') return -1;
               //      if (a.type !== 'RippleState' && b.type === 'RippleState') return 1;
               //      return a.order - b.order;
               // })
               .map((group: any) => {
                    const typeMap: { [key: string]: string[] } = {
                         RippleState: ['Balance', 'HighLimit', 'LowLimit', 'Flags'],
                         Offer: ['TakerPays', 'TakerGets'],
                         SignerList: ['SignerEntries'],
                         Check: ['Amount'],
                         Escrow: ['Amount', 'Condition'],
                         PayChannel: ['Amount', 'Balance'],
                         NFTokenPage: ['NFTokens'],
                         Ticket: [],
                         Delegate: ['Permissions'],
                         PermissionedDomain: ['AcceptedCredentials'],
                         DepositPreauth: [],
                         AMMBid: ['BidMin', 'BidMax', 'AuthAccounts'],
                         AMM: ['LPTokenBalance', 'TradingFee', 'Asset', 'Asset2'],
                         AMMWithdraw: ['LPTokenBalance', 'TradingFee', 'Asset', 'Asset2'],
                    };
                    const nestedFields = typeMap[group.type as keyof typeof typeMap] || [];

                    interface SubItemContent {
                         key: string;
                         value: string;
                    }

                    interface SubItemSubItem {
                         key: string;
                         content: SubItemContent[];
                    }

                    interface SubItem {
                         id: string;
                         content: SubItemContent[];
                         subItems: SubItemSubItem[];
                    }

                    const subItems: SubItem[] = group.objects.map((obj: Record<string, any>, idx: number): SubItem => {
                         const subItemContent: SubItemContent[] = Object.entries(obj)
                              .filter(([k]) => !nestedFields.includes(k) && k !== 'originalIndex')
                              .map(([key, value]) => ({
                                   key,
                                   value: key.includes('PreviousTxnID') || key.includes('index') || key === 'Account' || key.includes('PublicKey') ? `<code>${value}</code>` : value,
                              }));

                         const subItemSubItems: SubItemSubItem[] = nestedFields
                              .filter((field: string) => obj[field])
                              .map((field: string) => {
                                   let content: SubItemContent[];
                                   if (field === 'SignerEntries') {
                                        content = obj[field].map((entry: any, i: number) => ({
                                             key: `Signer ${i + 1}`,
                                             value: `<code>${entry.SignerEntry.Account}</code> (Weight: ${entry.SignerEntry.SignerWeight})`,
                                        }));
                                   } else if (field === 'NFTokens') {
                                        content = obj[field].map((nft: any, i: number) => ({
                                             key: `NFT ${i + 1}`,
                                             value: `NFT ID: <code>${nft.NFToken.NFTokenID}</code></br>URI: ${this.utilsService.decodeHex(nft.NFToken.URI)}</br><img id="nftImage" src="${this.utilsService.decodeHex(nft.NFToken.URI)}" width="150" height="150">`,
                                        }));
                                   } else if (field === 'AuthAccounts') {
                                        content = obj[field].map((acc: any, i: number) => ({
                                             key: `Account ${i + 1}`,
                                             value: `<code>${acc.AuthAccount.Account}</code>`,
                                        }));
                                   } else if (field === 'Permissions') {
                                        content = obj[field].map((acc: any, i: number) => ({
                                             key: `Permission ${i + 1}`,
                                             value: `<code>${acc.Permission.PermissionValue}</code>`,
                                        }));
                                   } else if (field === 'AcceptedCredentials') {
                                        content = obj[field].map((acc: any, i: number) => ({
                                             key: `Credential ${i + 1}`,
                                             value: `Credential Type: <code>${Buffer.from(acc.Credential.CredentialType, 'hex').toString('utf8')}</code></br>Issuer: <code>${acc.Credential.Issuer}</code>`,
                                        }));
                                   } else if (field === 'Amount' && typeof obj['Amount'] === 'string') {
                                        content = [{ key: field, value: xrpl.dropsToXrp(obj['Amount']) + ' XRP' }];
                                   } else if (field === 'Balance' && typeof obj['Balance'] === 'string') {
                                        content = [{ key: field, value: xrpl.dropsToXrp(obj['Balance']) + ' XRP' }];
                                   } else if (field === 'TakerGets' && typeof obj['TakerGets'] === 'string') {
                                        content = [{ key: field, value: xrpl.dropsToXrp(obj['TakerGets']) + ' XRP' }];
                                   } else if (field === 'TakerPays' && typeof obj['TakerPays'] === 'string') {
                                        content = [{ key: field, value: xrpl.dropsToXrp(obj['TakerPays']) + ' XRP' }];
                                   } else if (typeof obj[field] === 'object') {
                                        content = Object.entries(obj[field]).map(([k, v]) => ({
                                             key: k,
                                             value: this.utilsService.formatValueForKey(k, v),
                                        }));
                                   } else if (nestedFields.includes('HighLimit') && field === 'Flags') {
                                        content = [{ key: field, value: this.utilsService.getFlagName(obj[field]) }];
                                   } else {
                                        content = [{ key: field, value: obj[field] }];
                                   }
                                   return { key: field, content };
                              });

                         return {
                              id: `${group.type} ${idx + 1}`,
                              content: subItemContent,
                              subItems: subItemSubItems,
                         };
                    });

                    return {
                         type: group.type,
                         id: group.type, // e.g., "RippleState"
                         content: [], // No direct content for group
                         subItems,
                    };
               });

          type Section = {
               title: string;
               content: { key: string; value: any }[];
               subSections?: any[];
          };

          const sections: { [key: string]: Section } = {
               account: {
                    title: 'Account Data',
                    content: [
                         { key: 'Account', value: `<code>${accountInfo.result.account_data.Account}</code>` },
                         { key: 'Balance', value: (parseInt(accountInfo.result.account_data.Balance) / 1_000_000).toFixed(6) + ' XRP' },
                         { key: 'My Flags', value: accountInfo.result.account_data.Flags ? this.utilsService.formatFlags(this.utilsService.decodeAccountFlags(accountInfo)) : '0' },
                         { key: 'Flags', value: accountInfo.result.account_data.Flags ? flagNames(accountInfo.result.account_data.LedgerEntryType, accountInfo.result.account_data.Flags) : '0' },
                         { key: 'OwnerCount', value: accountInfo.result.account_data.OwnerCount },
                         { key: 'Sequence', value: accountInfo.result.account_data.Sequence },
                         { key: 'Regular Key', value: accountInfo.result.account_data.RegularKey ? `<code>${accountInfo.result.account_data.RegularKey}</code>` : 'Not Set' },
                    ],
               },
               metadata: {
                    title: 'Account Meta Data',
                    content: [
                         { key: 'BurnedNFTokens', value: accountInfo.result.account_data.BurnedNFTokens ? accountInfo.result.account_data.BurnedNFTokens : 'Not Set' },
                         { key: 'MintedNFTokens', value: accountInfo.result.account_data.MintedNFTokens ? accountInfo.result.account_data.MintedNFTokens : 'Not Set' },
                         { key: 'MessageKey', value: accountInfo.result.account_data.MessageKey ? accountInfo.result.account_data.MessageKey : 'Not Set' },
                         {
                              key: 'Domain',
                              value: accountInfo.result.account_data.Domain ? Buffer.from(accountInfo.result.account_data.Domain, 'hex').toString('ascii') : 'Not Set',
                         },
                         { key: 'TickSize', value: accountInfo.result.account_data.TickSize ? accountInfo.result.account_data.TickSize : 'Not Set' },
                         {
                              key: 'TransferRate',
                              value: accountInfo.result.account_data.TransferRate ? ((accountInfo.result.account_data.TransferRate / 1_000_000_000 - 1) * 100).toFixed(6) + '%' : 'Not Set',
                         },
                         // { key: 'TransferRate', value: (accountInfo.result.account_data.TransferRate / 1_000_000_000).toFixed(9) },
                         { key: 'FirstNFTokenSequence', value: accountInfo.result.account_data.FirstNFTokenSequence ? accountInfo.result.account_data.FirstNFTokenSequence : 'Not Set' },
                    ],
               },
               flags: {
                    title: 'Flag Details',
                    content: Object.entries(accountInfo.result.account_flags).map(([key, value]) => ({
                         key,
                         value: value ? '<span class="flag-true">True</span>' : 'False',
                    })),
               },
               objects: {
                    title: 'Account Objects',
                    content: [],
                    subSections,
               },
          };

          // Render sections
          for (const section of Object.values(sections)) {
               if (section.content.length || section.subSections?.length) {
                    const details = document.createElement('details');
                    details.className = 'result-section';
                    if (section.title === 'Account Data') {
                         details.setAttribute('open', 'open');
                    }
                    const summary = document.createElement('summary');
                    summary.textContent = section.title;
                    details.appendChild(summary);

                    if (section.content.length) {
                         const table = document.createElement('div');
                         table.className = 'result-table';
                         const header = document.createElement('div');
                         header.className = 'result-row result-header';
                         header.innerHTML = `
                              <div class="result-cell key">Key</div>
                              <div class="result-cell value">Value</div>
                         `;
                         table.appendChild(header);

                         for (const item of section.content) {
                              const row = document.createElement('div');
                              row.className = 'result-row';
                              row.innerHTML = `
                              <div class="result-cell key">${item.key}</div>
                              <div class="result-cell value">${item.value}</div>
                              `;
                              table.appendChild(row);
                         }
                         details.appendChild(table);
                    }

                    if (section.subSections) {
                         for (const group of section.subSections) {
                              const groupDetails = document.createElement('details');
                              groupDetails.className = 'object-group'; // New class for groups
                              const groupSummary = document.createElement('summary');
                              groupSummary.textContent = group.id;
                              groupDetails.appendChild(groupSummary);

                              if (group.content.length) {
                                   const groupTable = document.createElement('div');
                                   groupTable.className = 'result-table';
                                   const groupHeader = document.createElement('div');
                                   groupHeader.className = 'result-row result-header';
                                   groupHeader.innerHTML = `
                                   <div class="result-cell key">Key</div>
                                   <div class="result-cell value">Value</div>
                              `;
                                   groupTable.appendChild(groupHeader);

                                   for (const item of group.content) {
                                        const row = document.createElement('div');
                                        row.className = 'result-row';
                                        row.innerHTML = `
                                        <div class="result-cell key">${item.key}</div>
                                        <div class="result-cell value">${item.value}</div>
                                   `;
                                        groupTable.appendChild(row);
                                   }
                                   groupDetails.appendChild(groupTable);
                              }

                              for (const subItem of group.subItems) {
                                   const objDetails = document.createElement('details');
                                   objDetails.className = 'nested-object';
                                   const objSummary = document.createElement('summary');
                                   objSummary.textContent = subItem.id;
                                   objDetails.appendChild(objSummary);

                                   if (subItem.content.length) {
                                        const objTable = document.createElement('div');
                                        objTable.className = 'result-table';
                                        const objHeader = document.createElement('div');
                                        objHeader.className = 'result-row result-header';
                                        objHeader.innerHTML = `
                                        <div class="result-cell key">Key</div>
                                        <div class="result-cell value">Value</div>
                                   `;
                                        objTable.appendChild(objHeader);

                                        for (const item of subItem.content) {
                                             const row = document.createElement('div');
                                             row.className = 'result-row';
                                             row.innerHTML = `
                                             <div class="result-cell key">${item.key}</div>
                                             <div class="result-cell value">${item.value}</div>
                                        `;
                                             objTable.appendChild(row);
                                        }
                                        objDetails.appendChild(objTable);
                                   }

                                   for (const nestedItem of subItem.subItems) {
                                        const nestedDetails = document.createElement('details');
                                        nestedDetails.className = 'nested-object';
                                        const nestedSummary = document.createElement('summary');
                                        nestedSummary.textContent = nestedItem.key;
                                        nestedDetails.appendChild(nestedSummary);

                                        const nestedTable = document.createElement('div');
                                        nestedTable.className = 'result-table';
                                        const nestedHeader = document.createElement('div');
                                        nestedHeader.className = 'result-row result-header';
                                        nestedHeader.innerHTML = `
                                        <div class="result-cell key">Key</div>
                                        <div class="result-cell value">Value</div>
                                   `;
                                        nestedTable.appendChild(nestedHeader);

                                        for (const nestedContent of nestedItem.content) {
                                             const nestedRow = document.createElement('div');
                                             nestedRow.className = 'result-row';
                                             nestedRow.innerHTML = `
                                             <div class="result-cell key">${nestedContent.key}</div>
                                             <div class="result-cell value">${nestedContent.value}</div>
                                        `;
                                             nestedTable.appendChild(nestedRow);
                                        }
                                        nestedDetails.appendChild(nestedTable);
                                        objDetails.appendChild(nestedDetails);
                                   }

                                   groupDetails.appendChild(objDetails);
                              }

                              details.appendChild(groupDetails);
                         }
                    }
                    container.appendChild(details);
               }
               container.classList.add('success');
          }

          // Add toggle event listeners and persist state
          document.querySelectorAll('.result-section, .object-group, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (
                         savedState === 'open' ||
                         title === 'Account Data' ||
                         title === 'RippleState' // Open RippleState group by default
                    ) {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.object-group, .nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data') {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;
                    const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)');
                    directRows.forEach(row => {
                         const keyCell = row.querySelector('.key');
                         const valueCell = row.querySelector('.value');
                         const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                         const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) hasVisibleContent = true;
                    });

                    const groupDetails = section.querySelectorAll('.object-group');
                    groupDetails.forEach(group => {
                         let groupHasVisibleContent = false;
                         const nestedDetails = group.querySelectorAll('.nested-object');
                         nestedDetails.forEach(nested => {
                              let nestedHasVisibleContent = false;
                              const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                              tableRows.forEach(row => {
                                   const keyCell = row.querySelector('.key');
                                   const valueCell = row.querySelector('.value');
                                   const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                                   const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                                   const isMatch = keyText.includes(search) || valueText.includes(search);
                                   (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                                   if (isMatch) nestedHasVisibleContent = true;
                              });

                              const deeperDetails = nested.querySelectorAll('.nested-object');
                              deeperDetails.forEach(deeper => {
                                   let deeperHasVisibleContent = false;
                                   const deeperRows = deeper.querySelectorAll('.result-table > .result-row:not(.result-header)');
                                   deeperRows.forEach(row => {
                                        const keyCell = row.querySelector('.key');
                                        const valueCell = row.querySelector('.value');
                                        const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                                        const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                                        const isMatch = keyText.includes(search) || valueText.includes(search);
                                        (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                                        if (isMatch) deeperHasVisibleContent = true;
                                   });
                                   (deeper as HTMLElement).style.display = deeperHasVisibleContent ? '' : 'none';
                                   if (deeperHasVisibleContent) nestedHasVisibleContent = true;
                              });

                              (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                              if (nestedHasVisibleContent) groupHasVisibleContent = true;
                         });

                         (group as HTMLElement).style.display = groupHasVisibleContent ? '' : 'none';
                         if (groupHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     renderDetails(data: any) {
          const container = document.getElementById('resultField');
          if (!container) {
               console.error('Error: #resultField not found');
               return;
          }
          container.classList.remove('error', 'success');
          container.innerHTML = '';

          // Add search bar
          const searchBar = document.createElement('input');
          searchBar.type = 'text';
          searchBar.id = 'resultSearch';
          searchBar.placeholder = 'Search results...';
          searchBar.className = 'result-search';
          searchBar.style.boxSizing = 'border-box';
          container.appendChild(searchBar);

          // Render sections (unchanged)
          for (const section of data.sections) {
               if (!section.content && !section.subItems) continue;
               const details = document.createElement('details');
               details.className = 'result-section';
               if (section.openByDefault) {
                    details.setAttribute('open', 'open');
               }
               const summary = document.createElement('summary');
               summary.textContent = section.title;
               details.appendChild(summary);

               if (section.content && section.content.length) {
                    const table = document.createElement('div');
                    table.className = 'result-table';
                    const header = document.createElement('div');
                    header.className = 'result-row result-header';
                    header.innerHTML = `
                <div class="result-cell key" data-key="Key">Key</div>
                <div class="result-cell value" data-key="Value">Value</div>
              `;
                    table.appendChild(header);

                    for (const item of section.content) {
                         const row = document.createElement('div');
                         row.className = 'result-row';
                         row.innerHTML = `
                  <div class="result-cell key" data-key="Key">${item.key}</div>
                  <div class="result-cell value" data-key="Value">${item.value}</div>
                `;
                         table.appendChild(row);
                    }
                    details.appendChild(table);
               }

               if (section.subItems && section.subItems.length) {
                    for (const subItem of section.subItems) {
                         const subDetails = document.createElement('details');
                         subDetails.className = 'nested-object';
                         if (subItem.openByDefault) {
                              subDetails.setAttribute('open', 'open');
                         }
                         const subSummary = document.createElement('summary');
                         subSummary.textContent = subItem.key;
                         subDetails.appendChild(subSummary);

                         const subTable = document.createElement('div');
                         subTable.className = 'result-table';
                         const subHeader = document.createElement('div');
                         subHeader.className = 'result-row result-header';
                         subHeader.innerHTML = `
                  <div class="result-cell key" data-key="Key">Key</div>
                  <div class="result-cell value" data-key="Value">Value</div>
                `;
                         subTable.appendChild(subHeader);

                         for (const subContent of subItem.content) {
                              const subRow = document.createElement('div');
                              subRow.className = 'result-row';
                              subRow.innerHTML = `
                    <div class="result-cell key" data-key="Key">${subContent.key}</div>
                    <div class="result-cell value" data-key="Value">${subContent.value || ''}</div>
                  `;
                              subTable.appendChild(subRow);
                         }
                         subDetails.appendChild(subTable);
                         details.appendChild(subDetails);
                    }
               }
               container.appendChild(details);
          }
          container.classList.add('success');

          // Add toggle event listeners (unchanged)
          document.querySelectorAll('.result-section, .nested-object').forEach(details => {
               const summary = details.querySelector('summary');
               if (summary) {
                    const title = summary.textContent;
                    const savedState = localStorage.getItem(`collapse_${title}`);
                    if (savedState === 'closed') details.removeAttribute('open');
                    else if (savedState === 'open' || title === 'Account Data' || title === 'RippleState') {
                         details.setAttribute('open', 'open');
                    }
                    details.addEventListener('toggle', () => {
                         localStorage.setItem(`collapse_${title}`, (details as HTMLDetailsElement).open ? 'open' : 'closed');
                         container.offsetHeight;
                         container.style.height = 'auto';
                    });
               }
          });

          // Updated search functionality
          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement | null;
               const search = target ? target.value.toLowerCase().trim() : '';
               console.debug('Search query:', search);
               const sections = document.querySelectorAll('.result-section');

               if (!search) {
                    sections.forEach(section => {
                         (section as HTMLElement).style.display = '';
                         section.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach(row => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : '';
                         if (title === 'Account Data' || (title && title.includes('Trust Lines'))) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;

                    // Skip directRows since there are none in this case
                    const nestedDetails = section.querySelectorAll('.nested-object');
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)');
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key');
                              const valueCell = row.querySelector('.value');
                              const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML) : '';
                              const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML) : '';
                              // console.debug('Row content:', { keyText, valueText, search });
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              (row as HTMLElement).style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) {
                                   nestedHasVisibleContent = true;
                                   console.debug('Match found:', { keyText, valueText, search });
                              }
                         });
                         (nested as HTMLElement).style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    (section as HTMLElement).style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }

     attachSearchListener(container: HTMLElement): void {
          const searchBar = container.querySelector('#resultSearch') as HTMLInputElement;
          if (!searchBar) {
               // console.error('Error: #resultSearch not found');
               return;
          }

          searchBar.addEventListener('input', e => {
               const target = e.target as HTMLInputElement;
               const search = target.value.toLowerCase().trim();
               const sections = container.querySelectorAll('.result-section') as NodeListOf<HTMLElement>;

               if (!search) {
                    sections.forEach(section => {
                         section.style.display = '';
                         section.querySelectorAll('.result-row').forEach((row: Element) => ((row as HTMLElement).style.display = 'flex'));
                         section.querySelectorAll('.nested-object').forEach(nested => {
                              (nested as HTMLElement).style.display = '';
                              nested.querySelectorAll('.result-row').forEach((row: Element) => ((row as HTMLElement).style.display = 'flex'));
                         });
                         const summaryElement = section.querySelector('summary');
                         const title = summaryElement ? summaryElement.textContent : null;
                         if (title === 'Transactions' || title?.includes('Transaction')) {
                              section.setAttribute('open', 'open');
                         } else {
                              section.removeAttribute('open');
                         }
                    });
                    return;
               }

               sections.forEach(section => {
                    let hasVisibleContent = false;
                    const directRows = section.querySelectorAll(':scope > .result-table > .result-row:not(.result-header)') as NodeListOf<HTMLElement>;
                    directRows.forEach(row => {
                         const keyCell = row.querySelector('.key') as HTMLElement;
                         const valueCell = row.querySelector('.value') as HTMLElement;
                         const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                         const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                         const isMatch = keyText.includes(search) || valueText.includes(search);
                         row.style.display = isMatch ? 'flex' : 'none';
                         if (isMatch) hasVisibleContent = true;
                    });

                    const nestedDetails = section.querySelectorAll('.nested-object') as NodeListOf<HTMLElement>;
                    nestedDetails.forEach(nested => {
                         let nestedHasVisibleContent = false;
                         const tableRows = nested.querySelectorAll('.result-table > .result-row:not(.result-header)') as NodeListOf<HTMLElement>;
                         tableRows.forEach(row => {
                              const keyCell = row.querySelector('.key') as HTMLElement;
                              const valueCell = row.querySelector('.value') as HTMLElement;
                              const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                              const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                              const isMatch = keyText.includes(search) || valueText.includes(search);
                              row.style.display = isMatch ? 'flex' : 'none';
                              if (isMatch) nestedHasVisibleContent = true;
                         });

                         const deeperDetails = nested.querySelectorAll('.nested-object') as NodeListOf<HTMLElement>;
                         deeperDetails.forEach(deeper => {
                              let deeperHasVisibleContent = false;
                              const deeperRows = deeper.querySelectorAll('.result-table > .result-row:not(.result-header)') as NodeListOf<HTMLElement>;
                              deeperRows.forEach(row => {
                                   const keyCell = row.querySelector('.key') as HTMLElement;
                                   const valueCell = row.querySelector('.value') as HTMLElement;
                                   const keyText = keyCell ? this.utilsService.stripHTMLForSearch(keyCell.innerHTML).toLowerCase() : '';
                                   const valueText = valueCell ? this.utilsService.stripHTMLForSearch(valueCell.innerHTML).toLowerCase() : '';
                                   const isMatch = keyText.includes(search) || valueText.includes(search);
                                   row.style.display = isMatch ? 'flex' : 'none';
                                   if (isMatch) deeperHasVisibleContent = true;
                              });
                              deeper.style.display = deeperHasVisibleContent ? '' : 'none';
                              if (deeperHasVisibleContent) nestedHasVisibleContent = true;
                         });

                         nested.style.display = nestedHasVisibleContent ? '' : 'none';
                         if (nestedHasVisibleContent) hasVisibleContent = true;
                    });

                    section.style.display = hasVisibleContent ? '' : 'none';
                    if (hasVisibleContent) section.setAttribute('open', 'open');
               });
          });
     }
}
