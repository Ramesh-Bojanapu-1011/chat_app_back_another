const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const MessageSchema = require('./models/message');
const User = require('./models/user');

const { dbconnect } = require('./database/mangodb');
const dotenv = require('dotenv');
dotenv.config();


const siteurl = process.env.NODE_ENV == 'production' ? process.env.SITE_URL : 'http://localhost:3000';


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: siteurl,
    methods: ['GET', 'POST'],
  },
});

const PORT = 5000;
dbconnect();
let onlineUsers = [];
// Real-time messaging
io.on('connection', (socket) => {
  console.log('🔵 User Connected:', socket.id);

  // Register user as online
  socket.on('userOnline', async (userId) => {
    if (!onlineUsers.find((user) => user.userId === userId)) {
      onlineUsers.push({ userId, socketId: socket.id });
    }
    console.log('✅ Online Users:', onlineUsers);
    try {
      dbconnect();
      // Update user's status to online
      const user = await User.findOneAndUpdate({ clerkId: userId }, {
        isOnline: true,
        lastSeen: new Date(),
      });

      lastSeen = user.lastSeen;
      // find user friends
      const friends = await User.find({ _id: { $in: user.friends } });
      // console.log(friends)
      // send online status to friends
      friends.forEach((friend) => {
        // fetch the friend is online
        const friendOnline = onlineUsers.find((user) => new mongoose.Types.ObjectId(user._id).equals(friend._id))?.socketId;
        if (friendOnline) {
          io.to(friendOnline).emit('userStatusUpdate');
        }
      });
    } catch {
      console.log('Error updating user status');
    }
  });

  // Send friend request event 
  socket.on('sendFriendRequest', async (data) => {
    // console.log(data)
    try {

      const receiverSocket = onlineUsers.find(
        (user) => user.userId === data.receiverId
      )?.socketId;
      // Check if the sender and receiver are friends
      if (receiverSocket) {
        io.to(receiverSocket).emit('requestUpdate');
      } else {
        console.log('🚫 Receiver Not Online');
      }

    } catch {
      console.log('Error sending friend request');
    }
  });

  // accept request evnt
  socket.on('acceptRequest', async (friendId, userId) => {

    try {
      const receiverSocket = onlineUsers.find(
        (user) => user.userId === friendId
      )?.socketId;
      const senderSocket = onlineUsers.find(
        (user) => user.userId === userId
      )?.socketId;


      io.to(receiverSocket).emit('requestUpdate');
      io.to(senderSocket).emit('requestUpdate');

    } catch {
      console.log('Error accepting friend request');
    }
  });
  // Send message event
  socket.on('sendMessage', async (data) => {
    try {
      dbconnect();
      const { senderId, receiverId } = data;
      console.log('📩 Message Received:', data);
      // Ensure senderId and receiverId are not arrays and are strings
      const senderIdStr = Array.isArray(senderId) ? senderId[0] : senderId;
      const receiverIdStr = Array.isArray(receiverId)
        ? receiverId[0]
        : receiverId;

      const finalmsg = await MessageSchema.find({
        $or: [
          { senderId: senderId, receiverId: receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      })
        .populate('senderId', 'username email') // Populate sender details
        .populate('receiverId', 'username email') // Populate receiver details
        .sort({ createdAt: -1 }) // Sort by creation date in descending order
        .limit(1);

      const senderSocket = onlineUsers.find(
        (user) => user.userId === senderIdStr._id
      )?.socketId;
      const receiverSocket = onlineUsers.find(
        (user) => user.userId === receiverIdStr._id
      )?.socketId;

      if (receiverSocket) {
        console.log('receiverId', receiverSocket);
        console.log('📨 Sending to Receiver:', receiverSocket);
        console.log('Final message:', finalmsg);
        io.to(receiverSocket).emit('receiveMessage', finalmsg);
        io.to(receiverSocket).emit('unreadcount');
      } else {
        console.log('🚫 Receiver Not Online');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  });
  socket.on('markAsRead', async ({ messageId }) => {
    try {
      dbconnect();
      const message = await MessageSchema.findById(messageId);

      if (!message || message.isRead) return;

      message.isRead = true;
      message.isReadAt = new Date();
      await message.save();

      console.log('📨 Marking message as read:', message);

      const senderSocket = onlineUsers.find((user) =>
        new mongoose.Types.ObjectId(user.userId).equals(message.senderId)
      )?.socketId;
      const receiverSocket = onlineUsers.find((user) =>
        new mongoose.Types.ObjectId(user.userId).equals(message.receiverId)
      )?.socketId;

      if (senderSocket) {
        console.log('sender socket', senderSocket);
        io.to(receiverSocket).emit('unreadcount');
        io.to(senderSocket).emit('messageRead', {
          messageId,
          receiverId: message.receiverId._id,
          senderId: message.senderId._id,
          isReadAt: message.isReadAt,
        });
      }
    } catch (error) {
      console.error('❌ Error marking message as read:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('🔴 User Disconnected:', socket.id);
    const userid = onlineUsers.find((user) => user.socketId == socket.id);
    if (userid) {
      // onlineUsers.delete(userId);
      console.log('🔴 User Offline:', userid);
      onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
      console.log('Updated Online Users:', onlineUsers);
      const user = userid.userId;
      try {
        await User.findOneAndUpdate({ clerkId: userid.userId }, {
          isOnline: false,
          lastSeen: new Date(),
        });

        // Notify others that the user is offline
        io.emit(
          'userStatusUpdate'
          // { userId: userid.userId, isOnline: false, lastSeen: new Date() }
        );
      } catch (error) {
        console.error('❌ Error updating last seen:', error);
      }
    }
  });
});

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));