import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { createMessage, getMessages, deleteMessage,isSeen } from '../controllers/messages.js';


const router = express.Router();

router.post('/new',verifyToken, createMessage);
router.get('/', verifyToken, getMessages);
router.delete('/:message_id', verifyToken, deleteMessage);
router.put('/seen', verifyToken, isSeen);

export default router;