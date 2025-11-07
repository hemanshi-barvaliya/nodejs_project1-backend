import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this';

export default async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: token missing'));

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return next(new Error('Authentication error: user not found'));

    socket.user = user; // attach user to socket
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
}
