// 错误处理中间件

// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 全局错误处理中间件
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  console.error('Error:', err);
  
  // 处理不同类型的错误
  if (err.name === 'SequelizeValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `验证失败: ${errors.join(', ')}`;
    error = new AppError(message, 400);
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = '该资源已存在';
    error = new AppError(message, 400);
  }
  
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const message = '关联资源不存在';
    error = new AppError(message, 400);
  }
  
  if (err.code === 'ECONNREFUSED') {
    const message = '数据库连接失败';
    error = new AppError(message, 503);
  }
  
  // 处理其他错误
  const statusCode = error.statusCode || 500;
  const message = error.message || '服务器内部错误';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      status: error.status || 'error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// 处理404错误
const notFound = (req, res, next) => {
  const error = new AppError(`找不到请求的资源: ${req.originalUrl}`, 404);
  next(error);
};

module.exports = {
  AppError,
  errorHandler,
  notFound
};
