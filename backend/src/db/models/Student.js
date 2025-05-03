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

// Verificar se o e-mail já está registrado antes de salvar
studentSchema.pre('save', async function(next) {
  const student = this;
  if (!student.isModified('email')) return next();

  try {
    const existingStudent = await model('Student').findOne({ email: student.email });
    if (existingStudent) {
      return next(new Error('Este e-mail já está registrado.'));
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Exporte o modelo de Student
module.exports = model('Student', studentSchema);
