const errorHandler = (err, req, res, next) => {
    console.error('🔥 ERRO:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  };
  
module.exports = errorHandler;