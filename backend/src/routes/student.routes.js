const express = require('express');
const router = express.Router();
const asyncHandler = require('../middlewares/asyncHandler');
const Student = require('../db/models/Student');
const { body, validationResult } = require('express-validator');
const { sendEmail } = require('../services/email.services');

router.get('/verificar-email', asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Parâmetro email é obrigatório' });
  }
  const alunoExistente = await Student.findOne({ email });
  res.json({ success: true, emailDisponivel: !alunoExistente });
}));

router.post('/inscricao', [
  body('nome').notEmpty().withMessage('Nome é obrigatório').trim().escape().isLength({ min: 3 }),
  body('idade').isInt({ min: 1, max: 120 }).withMessage('Idade deve ser entre 1 e 120 anos').toInt(),
  body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
  body('celular').notEmpty().withMessage('Celular é obrigatório').trim().matches(/^[0-9]{10,15}$/)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { nome, idade, email, celular } = req.body;
  
  const alunoExistente = await Student.findOne({ email });
  if (alunoExistente) {
    return res.status(409).json({ success: false, message: 'E-mail já cadastrado' });
  }

  const aluno = new Student({ nome, idade, email, celular });
  await aluno.save();

  try {
    await sendEmail(email, 'Confirmação de Inscrição', `Olá ${nome}, sua inscrição foi realizada com sucesso!`);
  } catch (emailError) {
    console.error('Erro ao enviar e-mail:', emailError);
  }

  res.json({ 
    success: true, 
    aluno: { 
      id: aluno._id, 
      nome: aluno.nome, 
      email: aluno.email 
    } 
  });
}));

module.exports = router;