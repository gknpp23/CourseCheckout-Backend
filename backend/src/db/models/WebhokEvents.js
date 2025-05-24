const { Schema, model } = require('mongoose');

const webhookEventSchema = new Schema({
  eventId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  billingId: { 
    type: String, 
    required: true 
  },
  payload: { 
    type: String 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

// Índice para buscas por billingId
webhookEventSchema.index({ billingId: 1 });

module.exports = model('WebhookEvent', webhookEventSchema);