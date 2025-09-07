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

app.get('/api/create-wallet/mnemonic/', async (req, res) => {
     try {
          const generate_account_with_mnemonic = accountlib.generate.mnemonic();
          console.log(`account ${generate_account_with_mnemonic}`);
          res.json(generate_account_with_mnemonic);
     } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Failed to fetch from XPMarket' });
     }
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
