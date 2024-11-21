const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const socketIo = require('socket.io');
const sharedSession = require('express-socket.io-session');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const PUBLIC_ROOM_ID = '0000';  // Default room ID for the public room

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Session Middleware
const sessionMiddleware = session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri })
});

app.use(sessionMiddleware);

// Share session with Socket.io
io.use(sharedSession(sessionMiddleware, {
    autoSave: true
}));

// Define the User schema
const userSchema = new mongoose.Schema({
    password: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    role: { type: String, enum: ['User', 'DMAT'], default: 'User' },
    email: { type: String, unique: true, sparse: true }  // Add sparse index to allow nulls but still ensure uniqueness
});

const User = mongoose.model('User', userSchema);

// Define the Message schema
const messageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    roomId: { type: String, required: true }
});

const Message = mongoose.model('Message', messageSchema);

// Define the Chat Room schema
const roomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);

// Account creation endpoint
app.post('/register', async (req, res) => {
    const { password, username, role, email, adminPassword } = req.body;

    // Check if password and username are provided
    if (!password || !username) {
        return res.status(400).send('Username and password are required');
    }

    // If email is provided, make sure it's not null
    const userEmail = email || undefined;

    // If the role is DMAT, check the admin password
    if (role === 'DMAT' && adminPassword !== 'Jiu142857kuang') {
        return res.status(403).send('Invalid admin password');
    }

    // Check if the username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.status(400).send('Username is already taken');
    }

    try {
        // Check for duplicate email, if it's not undefined (null or empty email won't count as a duplicate)
        if (userEmail) {
            const existingEmail = await User.findOne({ email: userEmail });
            if (existingEmail) {
                return res.status(400).send('Email is already in use');
            }
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the new user
        const user = new User({
            username,
            password: hashedPassword,
            role: role || 'User',  // Default to 'User' if no role provided
            email: userEmail, // Include email field
        });

        await user.save();
        res.status(201).send('Account created. You can now log in.');
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).send(`Error creating account: ${error.message}`);
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;
        res.status(200).send('Login successful');
    } else {
        res.status(400).send('Invalid credentials');
    }
});

// Middleware to check if user is DMAT
const isDMAT = (req, res, next) => {
    if (req.session.role !== 'DMAT') {
        return res.status(403).send('Permission denied');
    }
    next();
};

// Endpoint to create a new chat room
app.post('/create-room', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('You need to be logged in to create a room');
    }
    const roomId = uuidv4();
    const room = new Room({ roomId, creator: req.session.userId });
    try {
        await room.save();
        res.status(201).send({ roomId });
    } catch (error) {
        res.status(400).send(`Error creating room: ${error.message}`);
    }
});

// Endpoint to join a chat room
app.get('/room/:roomId', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(__dirname + '/public/chat.html'); // Serve the chat HTML file for the room
});

// Serve the chat HTML file for the default chat room
app.get('/chat', (req, res) => {
    if (req.session.userId) {
        res.sendFile(__dirname + '/public/chat.html');
    } else {
        res.redirect('/');
    }
});

// Function to get the file path for a room's chat history
const getChatHistoryFilePath = (roomId) => {
    return path.join(__dirname, 'data', 'chat_history', `${roomId}.json`);
};

// Function to load chat history from a file
const loadChatHistory = (roomId) => {
    const filePath = getChatHistoryFilePath(roomId);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }
    return [];
};

// Function to save chat history to a file
const saveChatHistory = (roomId, messages) => {
    const filePath = getChatHistoryFilePath(roomId);

    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf8');
};

// Socket.io for real-time chat
io.on('connection', async (socket) => {
    console.log('A user connected');
    
    // Log the username of the connected user
    const username = socket.handshake.session.username;
    if (username) {
        console.log(`${username} is connected`);
    } else {
        console.log('A user with no username is connected');
    }

    // When joining a room
    socket.on('join room', async (roomId) => {
        const roomToJoin = roomId || PUBLIC_ROOM_ID;
        socket.join(roomToJoin);  // Join the specified room or the public room

        // Load chat history from file
        const messages = loadChatHistory(roomToJoin);
        messages.forEach(msg => {
            const formattedTime = moment(msg.timestamp).tz('America/Toronto').format('h:mm A');
            socket.emit('chat message', {
                username: msg.username,
                content: msg.content,
                timestamp: formattedTime,
                roomId: msg.roomId
            });
        });
    });

    // When a message is sent
    socket.on('chat message', async (data) => {
        const { roomId = PUBLIC_ROOM_ID, msg } = data;  // Default to the public room if no roomId is provided
        const username = socket.handshake.session.username;
        const timestamp = new Date();

        // Ensure msg is not empty before saving
        if (!msg.trim()) {
            return;
        }

        // Save the message to the database
        const message = new Message({ username, content: msg, timestamp, roomId });
        await message.save();

        // Broadcast the message to the room
        io.to(roomId).emit('chat message', {
            username,
            content: msg,
            timestamp: moment(timestamp).tz('America/Toronto').format('h:mm A'),
            roomId
        });

        // Save the message to chat history file
        const chatHistory = loadChatHistory(roomId);
        chatHistory.push({ username, content: msg, timestamp, roomId });
        saveChatHistory(roomId, chatHistory);
    });

    // When a user disconnects
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
