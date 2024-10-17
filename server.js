import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.post('/initiate-payment', async (req, res) => {
  try {
    const { phoneNumber, amount } = req.body;
    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required' });
    }
    const accessToken = await getAccessToken();
    const stkPushResponse = await initiateSTKPush(accessToken, phoneNumber, amount);
    res.json(stkPushResponse);
  } catch (error) {
    console.error('Error in /initiate-payment:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/mpesa-callback', (req, res) => {
  console.log('M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));

  const { Body } = req.body;

  if (Body && Body.stkCallback) {
    const { ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;

    if (ResultCode === 0 && CallbackMetadata && CallbackMetadata.Item) {
      // Successful transaction
      const transactionDetails = {
        amount: CallbackMetadata.Item.find(item => item.Name === 'Amount')?.Value,
        mpesaReceiptNumber: CallbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber')?.Value,
        transactionDate: CallbackMetadata.Item.find(item => item.Name === 'TransactionDate')?.Value,
        phoneNumber: CallbackMetadata.Item.find(item => item.Name === 'PhoneNumber')?.Value
      };

      if (Object.values(transactionDetails).every(Boolean)) {
        console.log('Successful M-Pesa transaction:', transactionDetails);
        // Here you would typically update your database with the transaction details
        res.json({ success: true, message: 'Payment successful', details: transactionDetails });
      } else {
        console.log('Incomplete transaction details:', transactionDetails);
        res.status(400).json({ error: 'Incomplete transaction details' });
      }
    } else {
      // Failed or canceled transaction
      console.log('M-Pesa transaction failed or canceled:', ResultDesc);
      res.json({ success: false, message: ResultDesc });
    }
  } else {
    res.status(400).json({ error: 'Invalid callback data' });
  }
});

async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET is not set in the environment variables');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  console.log('Requesting access token...');
  const response = await fetch(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  const data = await response.json();
  console.log('Access Token Response:', JSON.stringify(data, null, 2));

  if (!data.access_token) {
    console.error('Failed to get access token:', data);
    throw new Error('Failed to get access token');
  }
  return data.access_token;
}

async function initiateSTKPush(accessToken, phoneNumber, amount) {
  const apiUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const shortCode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  
  if (!shortCode || !passkey) {
    console.error('Environment variables check:', {
      MPESA_SHORTCODE: shortCode ? 'Set' : 'Not set',
      MPESA_PASSKEY: passkey ? 'Set' : 'Not set'
    });
    throw new Error('MPESA_SHORTCODE or MPESA_PASSKEY is not set in the environment variables');
  }

  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
  const formattedPhoneNumber = phoneNumber.replace(/[+\s]/g, '');

  const requestBody = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: formattedPhoneNumber,
    PartyB: shortCode,
    PhoneNumber: formattedPhoneNumber,
    CallBackURL: process.env.MPESA_CALLBACK_URL || "https://donatelive.requestcatcher.com/test",
    AccountReference: "PdreamsLtd",
    TransactionDesc: "Payment"
  };

  console.log('STK Push Request:', JSON.stringify(requestBody, null, 2));
  console.log('Access Token used:', accessToken);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const responseBody = await response.text();

  console.log('STK Push Response:', responseBody);

  if (!response.ok) {
    console.error('Failed to initiate payment:', responseBody);
    throw new Error(responseBody || 'Failed to initiate payment');
  }

  return JSON.parse(responseBody);
}

app.post('/initiate-pesapal-payment', async (req, res) => {
  try {
    const {
      amount,
      description,
      type,
      reference,
      first_name,
      last_name,
      email,
      phonenumber,
    } = req.body;

    // Validate required fields
    if (!amount || !description || !type || !reference || !first_name || !last_name || !email || !phonenumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pesapalResponse = await initiatePesaPalPayment(
      amount,
      description,
      type,
      reference,
      first_name,
      last_name,
      email,
      phonenumber
    );

    res.json(pesapalResponse);
  } catch (error) {
    console.error('Error in /initiate-pesapal-payment:', error);
    res.status(500).json({ error: error.message });
  }
});

async function initiatePesaPalPayment(
  amount,
  description,
  type,
  reference,
  first_name,
  last_name,
  email,
  phonenumber
) {
  const pesapalConsumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const pesapalConsumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  const pesapalIpnId = process.env.PESAPAL_IPN_ID || '';

  if (!pesapalConsumerKey || !pesapalConsumerSecret) {
    throw new Error('PesaPal consumer key or secret is not set in the environment variables');
  }

  const callback_url = process.env.PESAPAL_CALLBACK_URL || 'https://your-domain.com/pesapal-callback';

  const post_xml = `<?xml version="1.0" encoding="utf-8"?>
    <PesapalDirectOrderInfo
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:xsd="http://www.w3.org/2001/XMLSchema"
      Amount="${amount}"
      Description="${description}"
      Type="${type}"
      Reference="${reference}"
      FirstName="${first_name}"
      LastName="${last_name}"
      Email="${email}"
      PhoneNumber="${phonenumber}"
      xmlns="http://www.pesapal.com" />`;

  const pesapal_url = 'https://www.pesapal.com/API/PostPesapalDirectOrderV4';

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  let signature_string = `${pesapalConsumerKey}&${nonce}&${timestamp}`;
  if (pesapalIpnId) {
    signature_string += `&${pesapalIpnId}`;
  }
  signature_string += `&${post_xml}&${callback_url}`;

  const signature = crypto.createHmac('sha256', pesapalConsumerSecret)
    .update(signature_string)
    .digest('base64');

  let auth_header = `OAuth ` +
    `oauth_callback="${encodeURIComponent(callback_url)}", ` +
    `oauth_consumer_key="${pesapalConsumerKey}", ` +
    `oauth_nonce="${nonce}", ` +
    `oauth_signature="${encodeURIComponent(signature)}", ` +
    `oauth_signature_method="HMAC-SHA256", ` +
    `oauth_timestamp="${timestamp}", ` +
    `oauth_version="1.0"`;

  if (pesapalIpnId) {
    auth_header += `, pesapal_merchant_reference="${pesapalIpnId}"`;
  }

  auth_header += `, pesapal_request_data="${encodeURIComponent(post_xml)}"`;

  const response = await fetch(pesapal_url, {
    method: 'GET',
    headers: {
      'Authorization': auth_header,
    },
  });

  const responseBody = await response.text();

  console.log('PesaPal Response:', responseBody);

  if (!response.ok) {
    console.error('Failed to initiate PesaPal payment:', responseBody);
    throw new Error(responseBody || 'Failed to initiate PesaPal payment');
  }

  return { success: true, redirect_url: responseBody };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment variables check:', {
    MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY ? 'Set' : 'Not set',
    MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET ? 'Set' : 'Not set',
    MPESA_SHORTCODE: process.env.MPESA_SHORTCODE ? 'Set' : 'Not set',
    MPESA_PASSKEY: process.env.MPESA_PASSKEY ? 'Set' : 'Not set',
    MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL ? 'Set' : 'Not set',
    PESAPAL_CONSUMER_KEY: process.env.PESAPAL_CONSUMER_KEY ? 'Set' : 'Not set',
    PESAPAL_CONSUMER_SECRET: process.env.PESAPAL_CONSUMER_SECRET ? 'Set' : 'Not set',
    PESAPAL_IPN_ID: process.env.PESAPAL_IPN_ID ? 'Set' : 'Not set (optional)',
    PESAPAL_CALLBACK_URL: process.env.PESAPAL_CALLBACK_URL ? 'Set' : 'Not set'
  });
});