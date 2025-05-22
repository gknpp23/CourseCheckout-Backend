const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/asyncHandler');
const Student = require('../db/models/Student');
const { body, validationResult } = require('express-validator');
const { sendEmail } = require('../services/email.services');

// Rota de verificação de e-mail
router.get('/verificar-email', asyncHandler(async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Parâmetro email é obrigatório' });
  }

  const alunoExistente = await Student.findOne({ email });
  res.json({ success: true, emailDisponivel: !alunoExistente });
}));

// Rota de inscrição

router.post('/inscricao', [
  body('nome')
    .notEmpty().withMessage('Nome é obrigatório')
    .trim().escape()
    .isLength({ min: 3 }).withMessage('Nome deve ter no mínimo 3 caracteres'),

  body('idade')
    .isInt({ min: 1, max: 120 }).withMessage('Idade deve ser entre 1 e 120 anos')
    .toInt(),

  body('email')
    .isEmail().withMessage('E-mail inválido')
    .normalizeEmail(),

  body('celular')
    .notEmpty().withMessage('Celular é obrigatório')
    .trim().escape()
    .matches(/^[0-9]{10,15}$/).withMessage('Celular deve conter apenas números entre 10 e 15 dígitos')

], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { nome, idade, email, celular } = req.body;

  try {
    // Método create() verifica duplicatas automaticamente
    const aluno = await Student.create({ nome, idade, email, celular });
    
    // Envio de email SÍNCRONO (aguarda conclusão)
    await sendEmail(
      email, 
      'Confirmação de Inscrição', 
      `Olá ${nome}, sua inscrição #${aluno._id} foi confirmada!`
    );

    return res.status(201).json({
      success: true,
      aluno: { id: aluno._id, nome, email }
    });

  } catch (err) {
    // Erro específico de e-mail duplicado
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Este e-mail já está cadastrado',
        errorCode: 'DUPLICATE_EMAIL'
      });
    }

    console.error('Erro no cadastro:', err);
    return res.status(500).json({
      success: false,
      message: 'Falha ao processar inscrição'
    });
  }
}));


module.exports = router;
