const express = require('express');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2');
const multer = require('multer');
const port = 8000;

const connectDB = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'wpr',
    password: 'fit2023',
    database: 'wpr2023'
}).promise();

const app = express();
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "tmp/")
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname)
    },
})

const upload = multer({ storage: storage});


function readCookie(req, res, next) {
    const encodedUserID = req.cookies.signin;
    if (encodedUserID === undefined || encodedUserID === '') {
        res.status(403)
        return res.render('access_denied');
    }
    const decodedUserID = Buffer.from(encodedUserID, 'base64').toString('utf-8');
    req.userID = parseInt(decodedUserID, 10);
    if (isNaN(req.userID)) {
        res.status(400).send("Invalid user ID!");
        return;
    }
    next();
}

app.get('/', (req, res) => {
    if (req.cookies.signin) {
        res.redirect('/inbox');
    } else {
        res.render('signin');
    }
})

app.post('/', async (req, res) => {
    const { email, password } = req.body;
    let errors = {};
    const [rows] = await connectDB.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
    );
    if (rows.length === 0) {
        errors.email = "User not found! Please re-enter your email."
    } else {
        const user = rows[0];

        if (!user || user.password !== password) {
            errors.password = "Incorrect password! Please try again.";
        }
    }
    if (Object.keys(errors).length > 0) {
        return res.render('signin', { errors });
    }
    const encodedUserID = Buffer.from(rows[0].id.toString()).toString('base64');
    res.cookie('signin', encodedUserID, {
        maxAge: 600000
    });
    res.redirect('/inbox');
})

app.get('/signup', async (req, res) => {
    res.render('signup');
})

app.post('/signup', async (req, res) => {
    const { fullname, email, password, rePassword } = req.body;
    let errors = {};
    const [existEmail] = await connectDB.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
    )
    if (existEmail.length > 0) {
        errors.email = "Email is already exists! Please use a different one!"
    }
    if (password.length < 6) {
        errors.password = "Password is too short (at minimum 6 characters)!"
    }
    if (password != rePassword) {
        errors.rePassword = "Password doesn't match! Please re-enter!"
    }
    if (Object.keys(errors).length > 0) {
        return res.render('signup', { errors });
    }
    const [rows] = await connectDB.query(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [fullname, email, password]
    );
    return res.render('signup', {
        success: "Congratulations! We welcome you to our MailBox!"
    })
})

app.post('/signout', (req, res) => {
    res.clearCookie('signin');
    res.redirect('/');
});

app.get('/inbox', readCookie, async (req, res) => {
    const [rows] = await connectDB.query(
        'SELECT * FROM users WHERE id = ?',
        req.userID
    )

    const page = parseInt(req.query.page) || 1;
    const emailsPerPage = 5;
    const startIndex = (page - 1) * emailsPerPage;

    const [userEmails] = await connectDB.query(
        'SELECT e.id, e.subject, DATE_FORMAT(e.date_sent, "%M %d") AS formatted_date, u.name AS sender_name FROM emails e' +
        ' INNER JOIN users u ON e.sender_id = u.id' +
        ' WHERE e.recipient_id = ? AND e.recipient_deleted = 0' +
        ' ORDER BY e.date_sent DESC' +
        ' LIMIT ? OFFSET ?',
        [req.userID, emailsPerPage, startIndex]
    );

    const [totalEmails] = await connectDB.query(
        'SELECT COUNT(*) as total FROM emails WHERE recipient_id = ?',
        req.userID
    );
    const totalPages = Math.ceil(totalEmails[0].total / emailsPerPage);

    return res.render('inbox', {
        username: rows[0].name,
        userEmails,
        currentPage: page,
        totalPages
    });
})

app.post('/inbox/delete', readCookie, async (req, res) => {
    const { emailID } = req.body;

    if (typeof emailID === 'string') {
        emailID = emailID.split(',').map(id => parseInt(id.trim(), 10));
        emailID = emailID.filter(id => !isNaN(id));
    }

    const [deleted] = await connectDB.query(
        'UPDATE emails SET recipient_deleted = 1 WHERE id IN (?)',
        [emailID, req.userID]
    );

    if (deleted.affectedRows > 0) {
        res.status(200).json({ message: 'Email deleted successfully!' });
    } else {
        res.status(400).json({ error: 'No email was deleted.' });
    }
})

app.get('/inbox/email/:emailID', readCookie, async (req, res) => {
    const [rows] = await connectDB.query(
        'SELECT * FROM users WHERE id = ?',
        req.userID
    )

    const emailID = req.params.emailID;

    const [emailDetails] = await connectDB.query(
        'SELECT e.subject, e.content, DATE_FORMAT(e.date_sent, "%W, %M %e, %Y, %k:%y %p") AS formatted_date, e.attachment, ' +
        'sender.name AS sender_name, recipient.name AS recipient_name, sender.email AS email_addr, recipient.email AS recipient_email ' +
        'FROM emails e' +
        ' INNER JOIN users sender ON e.sender_id = sender.id' +
        ' INNER JOIN users recipient ON e.recipient_id = recipient.id' +
        ' WHERE e.id = ? AND e.recipient_id = ?',
        [emailID, req.userID]
    );

    if (emailDetails.length === 0) {
        return res.status(404).send('Email not found.');
    }

    res.render('detail', {
        username: rows[0].name,
        senderName: emailDetails[0].sender_name,
        senderEmail: emailDetails[0].email_addr,
        recipientName: emailDetails[0].recipient_name,
        recipientEmail: emailDetails[0].recipient_email,
        subject: emailDetails[0].subject,
        dateSent: emailDetails[0].formatted_date,
        content: emailDetails[0].content,
        attach: emailDetails[0].attachment
    });
});

app.get('/outbox', readCookie, async (req, res) => {
    const [rows] = await connectDB.query(
        'SELECT * FROM users WHERE id = ?',
        req.userID
    )

    const page = parseInt(req.query.page) || 1;
    const emailsPerPage = 5;
    const startIndex = (page - 1) * emailsPerPage;

    const [userEmails] = await connectDB.query(
        'SELECT e.id, e.subject, DATE_FORMAT(e.date_sent, "%M %d") AS formatted_date, u.name AS recipient_name FROM emails e' +
        ' INNER JOIN users u ON e.recipient_id = u.id' +
        ' WHERE e.sender_id = ? AND e.sender_deleted = 0' +
        ' ORDER BY e.date_sent DESC' +
        ' LIMIT ? OFFSET ?',
        [req.userID, emailsPerPage, startIndex]
    );

    const [totalEmails] = await connectDB.query(
        'SELECT COUNT(*) as total FROM emails WHERE sender_id = ?',
        req.userID
    );
    const totalPages = Math.ceil(totalEmails[0].total / emailsPerPage);

    return res.render('outbox', {
        username: rows[0].name,
        userEmails,
        currentPage: page,
        totalPages
    });
})

app.post('/outbox/delete', readCookie, async (req, res) => {
    const { emailID } = req.body;

    if (typeof emailID === 'string') {
        emailID = emailID.split(',').map(id => parseInt(id.trim(), 10));
        emailID = emailID.filter(id => !isNaN(id));
    }

    console.log(emailID);
    const [deleted] = await connectDB.query(
        'UPDATE emails SET sender_deleted = 1 WHERE id IN (?)',
        [emailID, req.userID]
    );

    if (deleted.affectedRows > 0) {
        res.status(200).json({ message: 'Email deleted successfully!' });
    } else {
        res.status(400).json({ error: 'No email was deleted.' });
    }
})

app.get('/outbox/email/:emailID', readCookie, async (req, res) => {
    const [rows] = await connectDB.query(
        'SELECT * FROM users WHERE id = ?',
        req.userID
    )

    const emailID = req.params.emailID;

    const [emailDetails] = await connectDB.query(
        'SELECT e.subject, e.content, DATE_FORMAT(e.date_sent, "%W, %M %e, %Y, %k:%y %p") AS formatted_date, e.attachment, ' +
        'sender.name AS sender_name, recipient.name AS recipient_name, sender.email AS email_addr, recipient.email AS recipient_email ' +
        'FROM emails e' +
        ' INNER JOIN users sender ON e.sender_id = sender.id' +
        ' INNER JOIN users recipient ON e.recipient_id = recipient.id' +
        ' WHERE e.id = ? AND e.sender_id = ?',
        [emailID, req.userID]
    );

    if (emailDetails.length === 0) {
        return res.status(404).send('Email not found.');
    }

    res.render('detail', {
        username: rows[0].name,
        senderName: emailDetails[0].sender_name,
        senderEmail: emailDetails[0].email_addr,
        recipientName: emailDetails[0].recipient_name,
        recipientEmail: emailDetails[0].recipient_email,
        subject: emailDetails[0].subject,
        dateSent: emailDetails[0].formatted_date,
        content: emailDetails[0].content,
        attach: emailDetails[0].attachment
    });
});

app.get('/compose', readCookie, async(req, res) => {
    const [rows] = await connectDB.query(
        'SELECT * FROM users WHERE id = ?',
        req.userID
    )

    const [otherUsers] = await connectDB.query(
        'SELECT id, name FROM users WHERE id != ?',
        req.userID
    );

    res.render('compose', {
        username: rows[0].name,
        otherUsers
    })
})

app.post('/compose', readCookie, upload.single('attachment'), async (req, res) => {
    const { recipient, subject, body } = req.body;

    const [rows] = await connectDB.query(
        'SELECT * FROM users WHERE id = ?',
        req.userID
    )

    const [otherUsers] = await connectDB.query(
        'SELECT id, name FROM users WHERE id != ?',
        req.userID
    );

    console.log(recipient);
    const [upload] = await connectDB.query(
        'INSERT INTO emails (sender_id, recipient_id, subject, content) VALUES (?, ?, ?, ?)',
        [req.userID, recipient, subject, body]
    );

    res.render('compose', {
        username: rows[0].name,
        otherUsers,
        success: 'Message is successfully sent!',
        error: 'Failed to send the message! Something has occured!'
    })
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
