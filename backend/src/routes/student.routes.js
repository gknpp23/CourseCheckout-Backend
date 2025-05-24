const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/asyncHandler');
const Student = require('../db/models/Student');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// Rota de verificação de e-mail (mantida igual)
router.get('/verificar-email', asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, message: 'Parâmetro email é obrigatório' });
  const alunoExistente = await Student.findOne({ email });
  res.json({ success: true, emailDisponivel: !alunoExistente });
}));

// Nova rota de inscrição com idempotência
router.post('/inscricao', [
  body('nome').notEmpty().trim().isLength({ min: 3 }),
  body('idade').isInt({ min: 1, max: 120 }).toInt(),
  body('email').isEmail().normalizeEmail(),
  body('celular').notEmpty().trim().matches(/^[0-9]{10,15}$/)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] || uuidv4();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verifica se já existe inscrição PAGA
    const alunoExistente = await Student.findOne({ 
      $or: [
        { idempotencyKey },
        { email, statusPagamento: 'approved' }
      ]
    }).session(session);

    if (alunoExistente) {
      await session.commitTransaction();
      return res.status(200).json(alunoExistente);
    }

    // Cria novo registro
    const aluno = await Student.findOneAndUpdate(
      { email },
      { 
        ...req.body, 
        statusPagamento: 'pending',
        idempotencyKey
      },
      { 
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session
      }
    );

    await session.commitTransaction();
    res.status(201).json({
      success: true,
      paymentRequired: true,
      paymentId: aluno._id
    });

  } catch (err) {
    await session.abortTransaction();
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Este e-mail já está cadastrado'
      });
    }
    throw err;
  } finally {
    session.endSession();
  }
}));

module.exports = router;