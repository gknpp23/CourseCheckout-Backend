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

  const emailJaExiste = await Student.findOne({ email });
  if (emailJaExiste) {
    return res.status(409).json({ success: false, message: 'E-mail já cadastrado' });
  }

  try {
    const aluno = new Student({ nome, idade, email, celular });
    await aluno.save();

    // Envia o e-mail de confirmação (sem bloquear a resposta)
    sendEmail(email, 'Confirmação de Inscrição', `Olá ${nome}, sua inscrição foi realizada com sucesso!`)
      .catch(err => console.error('Erro ao enviar e-mail:', err));

    return res.status(201).json({
      success: true,
      aluno: {
        id: aluno._id,
        nome: aluno.nome,
        email: aluno.email
      }
    });
  } catch (err) {
    console.error('Erro ao salvar aluno:', err);
    return res.status(500).json({ success: false, message: 'Erro interno ao salvar inscrição' });
  }
}));

module.exports = router;
