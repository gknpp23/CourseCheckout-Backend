const { Schema, model } = require('mongoose');

const studentSchema = new Schema({
  nome: { 
    type: String, 
    required: [true, 'Nome é obrigatório'], 
    trim: true,
    maxlength: [100, 'Nome não pode exceder 100 caracteres']
  },
  idade: { 
    type: Number, 
    min: [1, 'Idade mínima é 1 ano'], 
    max: [120, 'Idade máxima é 120 anos'],
    validate: {
      validator: Number.isInteger,
      message: 'Idade deve ser um número inteiro'
    }
  },
  email: { 
    type: String, 
    required: [true, 'E-mail é obrigatório'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'E-mail inválido'],
    maxlength: [254, 'E-mail não pode exceder 254 caracteres']
  },
  celular: { 
    type: String, 
    required: [true, 'Celular é obrigatório'],
    trim: true,
    match: [/^[0-9]{10,15}$/, 'Celular deve conter apenas números (10-15 dígitos)']
  },
  dataInscricao: { 
    type: Date, 
    default: Date.now,
    immutable: true // Não pode ser alterado após criação
  },
  statusPagamento: { 
    type: String, 
    enum: {
      values: ['pending', 'processing', 'approved', 'rejected'],
      message: 'Status de pagamento inválido'
    }, 
    default: 'pending' 
  },
  customerId: { 
    type: String,
    index: true 
  },
  billingId: { 
    type: String, 
    unique: true, 
    sparse: true,
    index: true
  },
  idempotencyKey: { 
    type: String, 
    unique: true, 
    sparse: true,
    index: true,
    select: false // Não retornar em queries por padrão
  },
  dataPagamento: { 
    type: Date,
    validate: {
      validator: function(v) {
        // Só pode ter dataPagamento se status for approved
        return this.statusPagamento !== 'approved' || v !== null;
      },
      message: 'Data de pagamento é obrigatória para status approved'
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true }, // Incluir virtuais ao converter para JSON
  toObject: { virtuals: true }
});

// Índices compostos para otimização
studentSchema.index({ 
  email: 1,
  statusPagamento: 1 
}, { 
  name: 'email_status_index' 
});

studentSchema.index({ 
  billingId: 1,
  statusPagamento: 1 
}, { 
  name: 'billing_status_index',
  partialFilterExpression: { billingId: { $exists: true } }
});

// Virtual para status humanizado
studentSchema.virtual('statusDescricao').get(function() {
  const map = {
    pending: 'Pendente',
    processing: 'Processando',
    approved: 'Aprovado',
    rejected: 'Rejeitado'
  };
  return map[this.statusPagamento];
});

// Middleware para validação pré-save
studentSchema.pre('save', function(next) {
  if (this.isModified('statusPagamento') && this.statusPagamento === 'approved') {
    this.dataPagamento = this.dataPagamento || new Date();
  }
  next();
});

module.exports = model('Student', studentSchema);