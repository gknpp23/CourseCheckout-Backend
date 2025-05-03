// // db/connection.js
const mongoose = require('mongoose');

process.env.MONGODB_DRIVER_PATH = require.resolve('mongodb');
process.env.MONGODB_SCRAM_SHA_1_DISABLE_SASL_PREP = "1";

mongoose.set('strictQuery', false); // Recomendado para Mongoose 8+

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      ssl: true,
      tlsAllowInvalidCertificates: false,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      family: 4, // Força IPv4 no Railway
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ MongoDB conectado com sucesso');
  } catch (err) {
    console.error('❌ Falha crítica na conexão:', err.message);
    process.exit(1); // Encerra o processo com erro
  }
};

// Eventos de conexão
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Conexão perdida com MongoDB');
});

module.exports = connectDB;