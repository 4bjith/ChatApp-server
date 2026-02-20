import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
    sendFriendRequest,
    getFriendRequests,
    acceptFriendRequest,
    getFriendsList
} from '../controllers/friends.js';

const router = express.Router();

router.post('/request', verifyToken, sendFriendRequest);
router.get('/requests', verifyToken, getFriendRequests);
router.post('/accept', verifyToken, acceptFriendRequest);
router.get('/list', verifyToken, getFriendsList);

export default router;
