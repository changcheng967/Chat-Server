const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const socketIo = require('socket.io');
const sharedSession = require('express-socket.io-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/account-system');

// Session Middleware
const sessionMiddleware = session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/account-system' })
});

app.use(sessionMiddleware);

// Share session with Socket.io
io.use(sharedSession(sessionMiddleware, {
    autoSave: true
}));

// Define the User schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true, unique: true }
});

const User = mongoose.model('User', userSchema);

// Account creation endpoint
app.post('/register', async (req, res) => {
    const { email, password, username } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
        email,
        password: hashedPassword,
        username
    });

    try {
        await user.save();
        res.status(201).send('Account created');
    } catch (error) {
        res.status(400).send('Error creating account');
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user._id;
        req.session.username = user.username;
        res.status(200).send('Login successful');
    } else {
        res.status(400).send('Invalid credentials');
    }
});

// Serve the chat HTML file
app.get('/chat', (req, res) => {
    if (req.session.userId) {
        res.sendFile(__dirname + '/public/chat.html');
    } else {
        res.redirect('/');
    }
});

// Socket.io for real-time chat
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('chat message', (msg) => {
        const username = socket.handshake.session.username;
        io.emit('chat message', `${username}: ${msg}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
