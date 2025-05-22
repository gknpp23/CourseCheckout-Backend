// models/Student.js

const { Schema, model } = require('mongoose');

// Define o esquema de aluno
const studentSchema = new Schema({
  nome: { 
    type: String, 
    required: true, 
    trim: true 
  },
  idade: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 120 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    index:true,
    trim: true, 
    lowercase: true, 
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'E-mail inválido'] 
  },
  celular: { 
    type: String, 
    required: true, 
    trim: true 
  },
  dataInscricao: { 
    type: Date, 
    default: Date.now 
  },
  pagamentoConfirmado: { 
    type: Boolean, 
    default: false 
  },
  customerId: { 
    type: String 
  },
  transactionId: { 
    type: String 
  },
  statusPagamento: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  }
}, { timestamps: true });

// Exporta o modelo de Student
module.exports = model('Student', studentSchema);
