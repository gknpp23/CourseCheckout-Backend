// src/routes/index.js
const express = require('express');
const router = express.Router();

// Importar suas rotas específicas
const studentRoutes = require('./student.routes');
// const paymentRoutes = require('./api/v1/payment.routes');
// const healthRoutes = require('./api/v1/health.routes');

// Configurar as rotas
router.use('/students', studentRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/health', healthRoutes);

module.exports = router; // ← Exporta o router configurado