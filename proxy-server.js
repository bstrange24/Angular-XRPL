const express = require('express');
const axios = require('axios');
const cors = require('cors');
const accountlib = require('xrpl-accountlib');
// import { generate, derive } from 'xrpl-accountlib';

const app = express();
app.use(cors());

app.get('/api/xpmarket/token/:currencyIssuer', async (req, res) => {
     try {
          const [currency, issuer] = req.params.currencyIssuer.split('.');
          console.log(`currency ${currency} issuer ${issuer}`);
          const url = `https://api.xrpscan.com/api/v1/account/${issuer}`;
          const response = await axios.get(url);
          console.log('response', response.data.inception);
          res.json(response.data);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to fetch from XPMarket' });
     }
});

// Create wallet from family-seed and fund it
app.get('/api/create-wallet/family-seed/:environment', async (req, res) => {
     try {
          console.log(`Generating account from family seed`);

          console.log(`environment ${req.params.environment}`);
          let generatedWallet;
          let facet = 'https://faucet.devnet.rippletest.net/accounts';
          if (req.params.environment !== 'mainnet') {
               if (req.params.environment === 'testnet') {
                    facet = 'https://faucet.altnet.rippletest.net/accounts';
               }
               // Generate accountlib wallet
               generatedWallet = accountlib.generate.familySeed({ algorithm: 'secp256k1' });
               console.log(`account ${JSON.stringify(generatedWallet, null, 2)}`);

               // Call Devnet faucet to fund it
               const faucetResponse = await fetch(facet, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination: generatedWallet.address }),
               });

               if (!faucetResponse.ok) {
                    throw new Error(`Faucet request failed: ${faucetResponse.statusText}`);
               }

               const faucetResult = await faucetResponse.json();
               console.log(`faucetResult ${JSON.stringify(faucetResult, null, '\t')}`);
          }

          res.json(generatedWallet);
          // Combine both: wallet details + funding result
          // res.json({ wallet: generatedWallet, faucet: faucetResult, });
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to generate or fund account' });
     }
});

// Get wallet created from a family seed
app.get('/api/derive/family-seed/:value', async (req, res) => {
     try {
          console.log(`seed ${req.params.value}`);
          const derive_account_with_seed = accountlib.derive.familySeed(req.params.value);
          console.log(`account ${derive_account_with_seed}`);
          res.json(derive_account_with_seed);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to derive account from family seed' });
     }
});

// Create wallet from mnemonic
app.get('/api/create-wallet/mnemonic/:environment', async (req, res) => {
     try {
          console.log(`Generating account from mnemonic`);

          console.log(`environment ${req.params.environment}`);
          let generate_account_from_mnemonic;
          let facet = 'https://faucet.devnet.rippletest.net/accounts';
          if (req.params.environment !== 'mainnet') {
               if (req.params.environment === 'testnet') {
                    facet = 'https://faucet.altnet.rippletest.net/accounts';
               }
               // Generate accountlib wallet
               generate_account_from_mnemonic = accountlib.generate.mnemonic({ algorithm: 'secp256k1' });
               console.log(`account ${JSON.stringify(generate_account_from_mnemonic, null, 2)}`);

               // Call Devnet faucet to fund it
               const faucetResponse = await fetch(facet, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination: generate_account_from_mnemonic.address }),
               });

               if (!faucetResponse.ok) {
                    throw new Error(`Faucet request failed: ${faucetResponse.statusText}`);
               }

               const faucetResult = await faucetResponse.json();
               console.log(`faucetResult ${JSON.stringify(faucetResult, null, '\t')}`);
          }

          res.json(generate_account_from_mnemonic);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to generate account from mnemonic' });
     }
});

// Get wallet created from a mnemonic
app.get('/api/derive/mnemonic/:mnemonic', async (req, res) => {
     try {
          console.log(`mnemonic ${req.params.mnemonic}`);
          const derive_account_with_mnemonic = accountlib.derive.mnemonic(req.params.mnemonic);
          console.log(`account ${derive_account_with_mnemonic}`);
          res.json(derive_account_with_mnemonic);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to fetch from XPMarket' });
     }
});

// Create wallet from secret-numbers
app.get('/api/create-wallet/secret-numbers/:environment', async (req, res) => {
     try {
          console.log(`Generating account from secret numbers`);

          console.log(`environment ${req.params.environment}`);
          let generate_account_from_secret_numbers;
          let facet = 'https://faucet.devnet.rippletest.net/accounts';
          if (req.params.environment !== 'mainnet') {
               if (req.params.environment === 'testnet') {
                    facet = 'https://faucet.altnet.rippletest.net/accounts';
               }
               // Generate accountlib wallet
               generate_account_from_secret_numbers = accountlib.generate.secretNumbers({ algorithm: 'secp256k1' });
               console.log(`account ${JSON.stringify(generate_account_from_secret_numbers, null, 2)}`);

               // Call Devnet faucet to fund it
               const faucetResponse = await fetch(facet, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination: generate_account_from_secret_numbers.address }),
               });

               if (!faucetResponse.ok) {
                    throw new Error(`Faucet request failed: ${faucetResponse.statusText}`);
               }

               const faucetResult = await faucetResponse.json();
               console.log(`faucetResult ${JSON.stringify(faucetResult, null, '\t')}`);
          }

          res.json(generate_account_from_secret_numbers);
          // Combine both: wallet details + funding result
          // res.json({ wallet: generatedWallet, faucet: faucetResult, });
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to generate account from secret numbers' });
     }
});

// Get wallet created from a secret numbers
app.get('/api/derive/secret-numbers/:value', async (req, res) => {
     try {
          console.log(`secret_numbers ${req.params.value}`);
          const nums = req.params.value?.split(','); // comma-separated string
          const derive_account_with_secret_numbers = accountlib.derive.secretNumbers(nums);
          console.log(`account ${derive_account_with_secret_numbers}`);
          res.json(derive_account_with_secret_numbers);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to fetch from XPMarket' });
     }
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
