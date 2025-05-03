const express = require('express');
const { post } = require('axios');
const Student = require('../db/models/Student.js'); // Ajuste o caminho conforme sua estrutura
const asyncHandler = require('../middlewares/asyncHandler.js'); // Middleware para tratamento de erros

const router = express.Router();

// Configuração do Gateway de Pagamento
const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1';
const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY;

// Helper para requisições à API de pagamento
const makePaymentRequest = async (endpoint, data) => {
  try {
    const response = await post(`${ABACATEPAY_API_URL}${endpoint}`, data, {
      headers: {
        'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Erro na requisição para ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
};

// Criação de cliente no gateway
const createPaymentCustomer = async (customerData) => {
  return makePaymentRequest('/customer/create', customerData);
};

// Criação de cobrança
const createPaymentBilling = async (billingData) => {
  return makePaymentRequest('/billing/create', billingData);
};

// Rota de checkout
router.post('/checkout', asyncHandler(async (req, res) => {
  const { nome, email, celular, taxId } = req.body;

  // 1. Criar cliente no gateway
  const customerData = {
    name: nome,
    cellphone: celular,
    taxId: taxId,
    email: email,
    metadata: { email }
  };

  const customerResponse = await createPaymentCustomer(customerData);
  const customerId = customerResponse.customerId || customerResponse.id;

  // 2. Criar aluno no banco de dados
  const aluno = new Student({ 
    nome, 
    idade: req.body.idade || null, 
    email, 
    celular,
    customerId 
  });
  await aluno.save();

  // 3. Criar cobrança
  const billingData = {
    frequency: 'ONE_TIME',
    methods: ['PIX'],
    products: [{
      externalId: 'prod-1234',
      name: 'Assinatura de Programa Fitness',
      description: 'Acesso ao programa fitness premium por 1 mês.',
      quantity: 1,
      price: 2000 // em centavos
    }],
    returnUrl: process.env.PAYMENT_RETURN_URL,
    completionUrl: process.env.PAYMENT_SUCCESS_URL,
    customerId,
    customer: customerData
  };

  const billingResponse = await createPaymentBilling(billingData);
  const checkoutUrl = billingResponse.data?.url || billingResponse.url;

  // 4. Atualizar aluno com dados da transação
  aluno.transactionId = billingResponse.id;
  await aluno.save();

  res.json({ 
    success: true, 
    checkoutUrl,
    transactionId: aluno._id
  });
}));

// Webhook de pagamento
router.post("/webhook", express.json(), asyncHandler(async (req, res) => {
  console.log("📩 Requisição recebida no webhook");

  const secretRecebida = req.query.secret || req.headers['x-webhook-secret'];
  if (secretRecebida !== process.env.WEBHOOK_SECRET) {
    console.warn("❌ Secret inválida recebida");
    return res.status(403).send("Acesso negado");
  }

  const event = req.body;
  console.log("📦 Evento recebido:", JSON.stringify(event, null, 2));

  const eventType = event?.event;
  const customer = event?.data?.billing?.customer || event?.data?.customer;
  const email = customer?.email || customer?.metadata?.email;

  if (!email) {
    console.error("❌ Email do cliente ausente");
    return res.status(400).send("Email não encontrado");
  }

  if (eventType === 'billing.paid') {
    const alunoAtualizado = await Student.findOneAndUpdate(
      { email },
      { 
        pagamentoConfirmado: true,
        dataPagamento: new Date(),
        statusPagamento: 'approved'
      },
      { new: true }
    );

    if (!alunoAtualizado) {
      console.warn("⚠️ Aluno não encontrado para o e-mail:", email);
      return res.status(404).send("Aluno não encontrado");
    }

    await sendEmail(
      email,
      "Confirmação de Pagamento 🎉",
      `Olá ${alunoAtualizado.nome}, seu pagamento foi confirmado!`
    );

    console.log("✅ Pagamento confirmado para:", email);
    return res.status(200).send("Webhook processado com sucesso");
  }

  res.status(200).send("Evento não tratado");
}));

// Rota administrativa para confirmação manual de pagamento
router.put('/confirm-payment/:transactionId', asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const aluno = await Student.findByIdAndUpdate(
    transactionId, 
    { 
      pagamentoConfirmado: true,
      dataPagamento: new Date() 
    }, 
    { new: true }
  );

  if (!aluno) {
    return res.status(404).json({ success: false, message: 'Inscrição não encontrada' });
  }

  res.json({ 
    success: true, 
    message: 'Pagamento confirmado com sucesso', 
    aluno: {
      id: aluno._id,
      nome: aluno.nome,
      email: aluno.email,
      status: 'confirmed'
    }
  });
}));

module.exports = router;