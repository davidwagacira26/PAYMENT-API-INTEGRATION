# Payment Checkout System

This project is a web-based payment checkout system that integrates both Card and Mpesa payment methods. It allows users to choose their preferred payment method, enter the required details, and complete the payment process. The project uses front-end technologies (HTML, CSS, JavaScript) and a back-end server (Node.js with Express) for handling payment processing.

## Features

- **Card Payment Integration:** Users can input their card details and complete a payment via card.
- **Mpesa Payment Integration:** Users can choose to pay via Mpesa and input their phone number.
- **Responsive Design:** The UI is responsive and adapts to different screen sizes.
- **Error Handling:** Displays relevant error messages if the payment fails.
- **Payment Method Selection:** Dynamic switching between card and Mpesa payment forms.
- **Real-time Payment Status:** Polling mechanism to check the status of the payment.

## Technology Stack

- **Frontend:**
  - HTML
  - CSS (Poppins font family)
  - JavaScript (client-side)
  
- **Backend:**
  - Node.js with Express
  - Mpesa Integration
  - Pesapal API for card payments

## Project Structure

```bash
├── public
│   ├── checkout.html         # Payment form (HTML)
│   ├── checkout.css          # Styles for the checkout page
│   ├── checkout.js           # Client-side logic for handling payments
│   └── images                # Payment method icons (Visa, Mastercard)
├── server.js                 # Node.js server to handle requests
├── .env                      # Environment variables (not included in repo)
└── README.md                 # Project documentation
