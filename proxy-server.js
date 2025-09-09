const express = require('express');
const axios = require('axios');
const cors = require('cors');
const accountlib = require('xrpl-accountlib');
const xrpl = require('xrpl');

const app = express();
app.use(cors());
app.use(express.json()); // allow JSON bodies

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
app.post('/api/create-wallet/family-seed', async (req, res) => {
     try {
          const { environment, algorithm = 'ed25519' } = req.body;

          console.log(`Generating account from family seed`);
          console.log(`environment ${environment}, algorithm ${algorithm}`);

          const generatedWallet = accountlib.generate.familySeed({ algorithm: algorithm });
          console.log(`account ${JSON.stringify(generatedWallet, null, 2)}`);
          let faucet = 'https://faucet.devnet.rippletest.net/accounts';

          if (environment !== 'mainnet') {
               if (environment === 'testnet') {
                    faucet = 'https://faucet.altnet.rippletest.net/accounts';
               }

               const faucetResponse = await fetch(faucet, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination: generatedWallet.address }),
               });

               if (!faucetResponse.ok) {
                    throw new Error(`Faucet request failed: ${faucetResponse.statusText}`);
               }

               const faucetResult = await faucetResponse.json();
               console.log(`faucetResult ${JSON.stringify(faucetResult, null, 2)}`);
          }

          // For mainnet just return generated wallet without funding
          res.json(generatedWallet);
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
app.post('/api/create-wallet/mnemonic', async (req, res) => {
     try {
          const { environment, algorithm = 'ed25519' } = req.body;
          console.log(`Generating account from mnemonic`);
          console.log(`environment: ${environment}`);
          console.log(`algorithm: ${algorithm}`);

          const generatedWallet = accountlib.generate.mnemonic({ algorithm: algorithm });
          console.log(`account ${JSON.stringify(generatedWallet, null, 2)}`);

          let facet = 'https://faucet.devnet.rippletest.net/accounts';

          if (environment !== 'mainnet') {
               if (environment === 'testnet') {
                    facet = 'https://faucet.altnet.rippletest.net/accounts';
               }

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

               // return res.json({ wallet: generatedWallet, faucet: faucetResult });
               return res.json(generatedWallet);
          }

          // For mainnet just return generated wallet without funding
          return res.json(generatedWallet);
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
app.post('/api/create-wallet/secret-numbers', async (req, res) => {
     try {
          const { environment, algorithm = 'ed25519' } = req.body;
          console.log(`Generating account from secret numbers`);
          console.log(`environment: ${environment}`);
          console.log(`algorithm: ${algorithm}`);

          // Generate secret-numbers wallet
          const generatedWallet = accountlib.generate.secretNumbers({ algorithm: algorithm });
          console.log(`account ${JSON.stringify(generatedWallet, null, 2)}`);
          let facet = 'https://faucet.devnet.rippletest.net/accounts';

          if (environment !== 'mainnet') {
               if (environment === 'testnet') {
                    facet = 'https://faucet.altnet.rippletest.net/accounts';
               }

               // Fund via faucet
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

               // return res.json({ wallet: generatedWallet, faucet: faucetResult });
               return res.json(generatedWallet);
          }

          // For mainnet just return wallet, no faucet funding
          return res.json(generatedWallet);
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
          console.log(`account ${JSON.stringify(derive_account_with_secret_numbers, null, '\t')}`);
          res.json(derive_account_with_secret_numbers);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to fetch from XPMarket' });
     }
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
