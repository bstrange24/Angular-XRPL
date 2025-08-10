const express = require('express');
const axios = require('axios');
const cors = require('cors');

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

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
