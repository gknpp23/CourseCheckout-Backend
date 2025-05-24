// src/routes/payment.routes.js
const express = require('express');
const { post } = require('axios');
const Student = require('../db/models/Student.js'); 
const asyncHandler = require('../middlewares/asyncHandler.js');
const { sendEmail } = require('../services/email.services'); 
const mongoose = require('mongoose');

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

// Rota de checkout com prevenção de duplicidade

router.post('/checkout', asyncHandler(async (req, res) => {
  const { nome, email, celular, taxId, idade } = req.body;

  // Validação básica
  if (!nome || !email || !celular || !taxId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Nome, email, celular e CPF/CNPJ são obrigatórios' 
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Verifica/Cria aluno
    const aluno = await Student.findOneAndUpdate(
      { email },
      { 
        nome, idade: idade || null, celular,
        statusPagamento: 'pending'
      },
      { 
        upsert: true, 
        new: true, 
        session,
        setDefaultsOnInsert: true 
      }
    );

    // 2. Cria cliente no gateway
    const customerResponse = await createPaymentCustomer({
      name: nome,
      email,
      cellphone: celular,
      taxId: taxId.replace(/\D/g, ''),
      metadata: { studentId: aluno._id.toString() }
    });

    // 3. Cria cobrança
    const billingResponse = await createPaymentBilling({
      customerId: customerResponse.data.id,
      frequency: 'ONE_TIME',
      methods: ['PIX'],
      products: [{
        name: 'Taxa de inscrição',
        price: 5000, // em centavos
        quantity: 1
      }],
      returnUrl: process.env.PAYMENT_RETURN_URL,
      metadata: { studentId: aluno._id.toString() }
    });

    // 4. Atualiza aluno
    aluno.customerId = customerResponse.data.id;
    aluno.billingId = billingResponse.data.id;
    await aluno.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      checkoutUrl: billingResponse.data.payment_url,
      transactionId: aluno._id
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('Erro no checkout:', err);
    
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Já existe uma inscrição com este e-mail'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Falha no processamento',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    session.endSession();
  }
}));

// Webhook de pagamento (mantido igual)
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

// Rota administrativa para confirmação manual de pagamento (mantida igual)
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