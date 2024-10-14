let selectedPaymentMethod = 'card';

document.addEventListener('DOMContentLoaded', function() {
  initializeInputs();
  initializePaymentMethods();
  initializePayButton();
});

function initializeInputs() {
  const cardNumberInput = document.getElementById('cardnumber');
  const cardTypeIcon = document.getElementById('card-type-icon');
  const dateInput = document.getElementById('date');
  const phoneInput = document.getElementById('phoneNumber');
  const amountInputs = document.querySelectorAll('#cardAmount, #mpesaAmount');

  if (cardNumberInput && cardTypeIcon) {
    cardNumberInput.addEventListener('input', handleCardNumberInput);
  }

  if (dateInput) {
    dateInput.addEventListener('input', handleDateInput);
  }

  if (phoneInput) {
    initializePhoneInput(phoneInput);
  }

  amountInputs.forEach(input => {
    input.addEventListener('input', handleAmountInput);
  });
}

function handleCardNumberInput(e) {
  const cardTypeIcon = document.getElementById('card-type-icon');
  let value = e.target.value.replace(/\D/g, '');
  let formattedValue = '';
  
  for (let i = 0; i < value.length; i++) {
    if (i > 0 && i % 4 === 0) {
      formattedValue += ' ';
    }
    formattedValue += value[i];
  }
  
  e.target.value = formattedValue;

  if (value.startsWith('4')) {
    cardTypeIcon.src = '/images/visa.png';
    cardTypeIcon.style.display = 'block';
  } else if (value.startsWith('5')) {
    cardTypeIcon.src = '/images/mastercard.png';
    cardTypeIcon.style.display = 'block';
  } else {
    cardTypeIcon.style.display = 'none';
  }
}

function handleDateInput(e) {
  let value = e.target.value.replace(/\D/g, '');
  let formattedValue = '';
  
  if (value.length > 0) {
    formattedValue = value.substr(0, 2);
    if (value.length > 2) {
      formattedValue += ' / ' + value.substr(2, 2);
    }
  }
  
  e.target.value = formattedValue;
}

function initializePhoneInput(phoneInput) {
  const prefix = '+254';

  phoneInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (!value.startsWith('254')) {
      value = '254' + value;
    }
    
    if (value.length > 12) {
      value = value.slice(0, 12);
    }

    e.target.value = '+' + value;
  });

  phoneInput.addEventListener('focus', function(e) {
    if (e.target.value === '') {
      e.target.value = prefix;
    }
    e.target.setSelectionRange(prefix.length, prefix.length);
  });

  phoneInput.addEventListener('blur', function(e) {
    if (e.target.value === prefix) {
      e.target.value = '';
    }
  });
}

function handleAmountInput(e) {
  let value = e.target.value;
  if (value.includes('.')) {
    let parts = value.split('.');
    if (parts[1].length > 2) {
      e.target.value = parseFloat(value).toFixed(2);
    }
  }
}

function initializePaymentMethods() {
  const cardMethod = document.querySelector('.method.card');
  const mpesaMethod = document.querySelector('.method.mpesa');
  const cardForm = document.getElementById('cardPaymentForm');
  const mpesaForm = document.getElementById('mpesaPaymentForm');

  if (cardMethod && mpesaMethod && cardForm && mpesaForm) {
    cardMethod.addEventListener('click', () => showPaymentForm('card'));
    mpesaMethod.addEventListener('click', () => showPaymentForm('mpesa'));

    showPaymentForm('card');
  } else {
    console.error('Payment method elements not found');
  }
}

function showPaymentForm(method) {
  const cardForm = document.getElementById('cardPaymentForm');
  const mpesaForm = document.getElementById('mpesaPaymentForm');
  const cardMethod = document.querySelector('.method.card');
  const mpesaMethod = document.querySelector('.method.mpesa');

  if (cardForm && mpesaForm && cardMethod && mpesaMethod) {
    if (method === 'card') {
      cardForm.style.display = 'block';
      mpesaForm.style.display = 'none';
      cardMethod.classList.add('selected');
      mpesaMethod.classList.remove('selected');
      selectedPaymentMethod = 'card';
    } else if (method === 'mpesa') {
      cardForm.style.display = 'none';
      mpesaForm.style.display = 'block';
      cardMethod.classList.remove('selected');
      mpesaMethod.classList.add('selected');
      selectedPaymentMethod = 'mpesa';
    }
  } else {
    console.error('Payment form elements not found');
  }
}

function initializePayButton() {
  const payButton = document.getElementById('payButton');
  if (payButton) {
    payButton.addEventListener('click', handlePayment);
  } else {
    console.error('Pay button not found');
  }
}

async function handlePayment() {
  const payButton = document.getElementById('payButton');
  payButton.textContent = 'Processing...';
  payButton.disabled = true;

  try {
    if (selectedPaymentMethod === 'mpesa') {
      await handleMpesaPayment();
    } else if (selectedPaymentMethod === 'card') {
      await handleCardPayment();
    } else {
      throw new Error('Please select a payment method.');
    }
  } catch (error) {
    showError(error.message);
  } finally {
    payButton.textContent = 'Complete Purchase';
    payButton.disabled = false;
  }
}

async function handleMpesaPayment() {
  const phoneInput = document.getElementById('phoneNumber');
  const amountInput = document.getElementById('mpesaAmount');
  
  if (!phoneInput || !amountInput) {
    throw new Error('Phone number or amount input not found');
  }
  
  const phoneNumber = phoneInput.value;
  const amount = amountInput.value;
  
  if (!phoneNumber || !amount) {
    throw new Error('Please enter both phone number and amount.');
  }

  const response = await fetch('/initiate-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phoneNumber, amount })
  });

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const result = await response.json();
    if (result.ResponseCode === "0") {
      alert('Payment initiated. Please check your phone to complete the payment.');
      await checkPaymentStatus(result.CheckoutRequestID);
    } else {
      throw new Error(result.errorMessage || 'Failed to initiate payment');
    }
  } else {
    const text = await response.text();
    console.error('Server responded with non-JSON content:', text);
    throw new Error('Unexpected server response. Please try again later.');
  }
}

async function handleCardPayment() {
  const cardholderInput = document.getElementById('cardholder');
  const cardNumberInput = document.getElementById('cardnumber');
  const dateInput = document.getElementById('date');
  const cvvInput = document.getElementById('verification');
  const amountInput = document.getElementById('cardAmount');

  if (!cardholderInput || !cardNumberInput || !dateInput || !cvvInput || !amountInput) {
    throw new Error('One or more card input elements not found');
  }

  const cardholderName = cardholderInput.value;
  const cardNumber = cardNumberInput.value.replace(/\s/g, '');
  const expiryDate = dateInput.value.split(' / ');
  const cvv = cvvInput.value;
  const amount = amountInput.value;

  if (!cardholderName || !cardNumber || expiryDate.length !== 2 || !cvv || !amount) {
    throw new Error('Please fill in all Card details and amount.');
  }

  const expiryMonth = expiryDate[0];
  const expiryYear = '20' + expiryDate[1];

  const response = await fetch('/initiate-pesapal-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: parseFloat(amount),
      description: 'Payment for goods',
      type: 'MERCHANT',
      reference: 'ORDER-' + Date.now(),
      first_name: cardholderName.split(' ')[0],
      last_name: cardholderName.split(' ').slice(1).join(' '),
      email: 'customer@example.com',
      phonenumber: '',
      card_number: cardNumber,
      expiry_month: expiryMonth,
      expiry_year: expiryYear,
      cvv: cvv
    })
  });

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const result = await response.json();
    if (result.success) {
      window.location.href = result.redirect_url;
    } else {
      throw new Error(result.error || 'Failed to initiate payment');
    }
  } else {
    const text = await response.text();
    console.error('Server responded with non-JSON content:', text);
    throw new Error('Unexpected server response. Please try again later.');
  }
}

async function checkPaymentStatus(checkoutRequestID) {
  const maxAttempts = 10;
  const pollInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const response = await fetch('/check-payment-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ checkoutRequestID })
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const result = await response.json();
        if (result.status === 'completed') {
          alert('Payment successful!');
          window.location.href = '/thankyou';
          return;
        } else if (result.status === 'failed' || result.status === 'cancelled') {
          throw new Error('Payment was not successful. Please try again.');
        }
      } else {
        const text = await response.text();
        console.error('Server responded with non-JSON content:', text);
        throw new Error('Unexpected server response. Please try again later.');
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      throw error;
    }
  }

  throw new Error('Unable to confirm payment status. Please contact support if you believe this is an error.');
}

function showError(message) {
  alert(message);
}

