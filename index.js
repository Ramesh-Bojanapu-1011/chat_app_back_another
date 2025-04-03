const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const MessageSchema = require("./models/message");
const GroupSchema = require("./models/group");
const User = require("./models/user");

const { dbconnect } = require("./database/mangodb");
const dotenv = require("dotenv");

dotenv.config();

const siteurl =
  process.env.NODE_ENV == "production"
    ? process.env.SITE_URL
    : "http://localhost:3000";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: siteurl,
    methods: ["GET", "POST"],
  },
});

const PORT = 5000;
dbconnect();
let onlineUsers = [];
// Real-time messaging
io.on("connection", (socket) => {
  console.log("🔵 User Connected:", socket.id);

  // Register user as online
  socket.on("userOnline", async (userId) => {
    if (!onlineUsers.find((user) => user.userId === userId)) {
      onlineUsers.push({ userId, socketId: socket.id });
    }
    console.log("✅ Online Users:", onlineUsers);
    try {
      dbconnect();
      // Update user's status to online
      const user = await User.findOneAndUpdate(
        { clerkId: userId },
        {
          isOnline: true,
          lastSeen: new Date(),
        },
      );

      lastSeen = user.lastSeen;
      console.log("🟢 User Online:", userId);
      // find user friends
      const friends = await User.find({ _id: { $in: user.friends } });
      // console.log("👥 Friends:", friends);
      // send online status to friends
      friends.forEach((friend) => {
        // fetch the friend is online
        const friendOnline = onlineUsers.find((user) => {
          return user.userId == friend.clerkId;
        })?.socketId;

        if (friendOnline) {
          console.log("🟢 Friend Online:", friendOnline);
          io.to(friendOnline).emit("userStatusUpdate");
        } else {
          console.log("🚫 Friend Not Online");
        }
      });
    } catch (error) {
      console.log("Error updating user status", error);
    }
  });

  // Send friend request event
  socket.on("sendFriendRequest", async (data) => {
    // console.log(data)
    try {
      const receiverSocket = onlineUsers.find(
        (user) => user.userId === data.receiverId,
      )?.socketId;
      // Check if the sender and receiver are friends
      if (receiverSocket) {
        io.to(receiverSocket).emit("requestUpdate");
      } else {
        console.log("🚫 Receiver Not Online");
      }
    } catch {
      console.log("Error sending friend request");
    }
  });

  // accept request evnt
  socket.on("acceptRequest", async (data) => {
    try {
      const receiverSocket = onlineUsers.find(
        (user) => user.userId === data.friend,
      )?.socketId;
      const senderSocket = onlineUsers.find(
        (user) => user.userId === data.user,
      )?.socketId;

      io.to(receiverSocket).emit("requestUpdate");
      io.to(senderSocket).emit("requestUpdate");
    } catch {
      console.log("Error accepting friend request");
    }
  });

  // Send message event
  socket.on("sendMessage", async (data) => {
    try {
      dbconnect();
      console.log("📩 Message Received:", data);

      const finalmsg = await MessageSchema.findById(data.data[0]._id)
        .populate("senderId", "username image_url clerkId email") // Populate sender details
        .populate("receiverId", "username image_url clerkId email"); // Populate receiver details

      const receiverSocket = onlineUsers.find(
        (user) => user.userId === data.data[0].receiverId.clerkId,
      )?.socketId;

      if (receiverSocket) {
        console.log("receiverId", receiverSocket);
        // console.log("📨 Sending to Receiver:", receiverSocket);
        // console.log("Final message:", finalmsg);
        io.to(receiverSocket).emit("receiveMessage", finalmsg);
        io.to(receiverSocket).emit("unreadcount");
      } else {
        console.log("🚫 Receiver Not Online");
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
    }
  });

  // create group event
  socket.on("createGroup", async (data) => {
    try {
      console.log(data.newGroup._id);
      const newGroup = await GroupSchema.findById(data.newGroup._id).populate(
        "users_in_grp",
        "clerkId",
      );

      console.log(newGroup);

      // find socketId for newGroup.users_in_grp
      const sockets = onlineUsers.filter((user) =>
        newGroup.users_in_grp.map((grpuser) => grpuser.clerkId == user.userId),
      );

      sockets.forEach((socket) => {
        io.to(socket.socketId).emit("newGroup", data);
      });
    } catch (error) {
      console.error("❌ Error creating group:", error);
    }
  });

  socket.on("markAsRead", async ({ messageId }) => {
    try {
      dbconnect();
      const message = await MessageSchema.findById(messageId)
        .populate("receiverId")
        .populate("senderId");

      console.log("📝 Marking as read:", message);

      if (!message || message.isRead) return;

      message.isRead = true;
      message.isReadAt = new Date();
      await message.save();

      console.log("📨 Marking message as read:", message);

      const senderSocket = onlineUsers.find((user) => {
        return user.userId == message.senderId.clerkId;
      })?.socketId;
      const receiverSocket = onlineUsers.find((user) => {
        return user.userId == message.receiverId.clerkId;
      })?.socketId;

      if (senderSocket) {
        console.log("sender socket", senderSocket);
        io.to(receiverSocket).emit("unreadcount");
        io.to(senderSocket).emit("messageRead", {
          messageId,
          receiverId: message.receiverId._id,
          senderId: message.senderId._id,
          isReadAt: message.isReadAt,
        });
      }
    } catch (error) {
      console.error("❌ Error marking message as read:", error);
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    console.log("🔴 User Disconnected:", socket.id);
    const userid = onlineUsers.find((user) => user.socketId == socket.id);
    if (userid) {
      // onlineUsers.delete(userId);
      console.log("🔴 User Offline:", userid);
      onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
      console.log("Updated Online Users:", onlineUsers);
      const user = userid.userId;
      try {
        await User.findOneAndUpdate(
          { clerkId: user },
          {
            isOnline: false,
            lastSeen: new Date(),
          },
        );

        // Notify others that the user is offline
        io.emit("userStatusUpdate");
      } catch (error) {
        console.error("❌ Error updating last seen:", error);
      }
    }
  });
});

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
