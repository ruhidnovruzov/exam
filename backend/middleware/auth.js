const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token təqdim edilməyib' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, rol, kafedraId }
    next();
  } catch {
    return res.status(401).json({ message: 'Token etibarsızdır' });
  }
};

// Rol yoxlaması: authorize('ADMIN') və ya authorize('ADMIN','KAFEDRA')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ message: 'Bu əməliyyat üçün icazəniz yoxdur' });
  }
  next();
};

module.exports = { authenticate, authorize };