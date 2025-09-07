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

// Create wallet from mnemonic
app.get('/api/create-wallet/mnemonic', async (req, res) => {
     try {
          console.log(`Generating account from mnemonic`);
          const generate_account_from_mnemonic = accountlib.generate.mnemonic();
          console.log(`account ${JSON.stringify(generate_account_from_mnemonic, null, 2)}`);
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
app.get('/api/create-wallet/secret-numbers', async (req, res) => {
     try {
          console.log(`Generating account from secret numbers`);
          const generate_account_from_secret_numbers = accountlib.generate.secretNumbers();
          console.log(`account ${JSON.stringify(generate_account_from_secret_numbers, null, 2)}`);
          res.json(generate_account_from_secret_numbers);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to generate account from secret numbers' });
     }
});

// Get wallet created from a secret numbers
app.post('/api/derive/secret-numbers/:value', async (req, res) => {
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

// Create wallet from family-seed
app.get('/api/create-wallet/family-seed', async (req, res) => {
     try {
          console.log(`Generating account from family seed`);
          const generate_account_from_family_seed = accountlib.generate.familySeed();
          console.log(`account ${JSON.stringify(generate_account_from_family_seed, null, 2)}`);
          res.json(generate_account_from_family_seed);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to generate account from family seed' });
     }
});

// Get wallet created from a family seed
app.post('/api/derive/family-seed/:value', async (req, res) => {
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

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
