const mysql = require('mysql2');

const dbConnect = async () => {
    try {
        const trueDBconnect = mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'wpr',
            password: 'fit2023',
        }).promise();

        await trueDBconnect.query('CREATE DATABASE IF NOT EXISTS wpr2023');
        console.log("Database 'wpr2023' is created successfully!");

        await trueDBconnect.query('USE wpr2023');

        const usersTable = (`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(36) NOT NULL,
                email VARCHAR(24) NOT NULL UNIQUE,
                password VARCHAR(18) NOT NULL,
                avatar VARCHAR(72),
                signupTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );
        await trueDBconnect.query(usersTable);
        console.log("Table 'users' is set up successfully!");

        const usersInsertValue = `
            INSERT INTO users (name, email, password)
            VALUES ("admin", "a@a.com", "12345678"),
            ("Trần Duy Hoài Nam", "hoainam12345@gmail.com", "hoainam12345"),
            ("Nguyễn Kiên Nam", "mysteriouswanderer@gmail.com", "akasha6666")
        `;
        await trueDBconnect.query(usersInsertValue);

        const emailsTable = (`
            CREATE TABLE IF NOT EXISTS emails (
                id INT PRIMARY KEY AUTO_INCREMENT,
                sender_id INT NOT NULL,
                recipient_id INT NOT NULL,
                subject VARCHAR(100),
                content TEXT NOT NULL,
                attachment VARCHAR(255),
                date_sent TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sender_deleted BOOLEAN DEFAULT false,
                recipient_deleted BOOLEAN DEFAULT false,
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (recipient_id) REFERENCES users(id)
            )`
        );
        await trueDBconnect.query(emailsTable);
        console.log("Table 'emails' is set up successfully!");

        const emailsInsertValue = `
            INSERT INTO emails (sender_id, recipient_id, subject, content)
            VALUES (2, 3, "Anime", "Have you seen the new anime, Jujutsu Kaisen?"),
            (3, 2, "Anime-2", "Yes, I have. What's your thought on it?"),
            (2, 3, "Anime-3", "Unfiltered. Dead resides everywhere. Love it!"),
            (3, 2, "Gibberish-1", "Anyway, how's your day?"),
            (2, 3, "Gibberish-2", "I'm fine, thank you. Have spagetti with ketchup yesterday, it was very delicious. How about you?"),
            (3, 2, "Gibberish-3", "I'm also fine. Have normal rice and pickle yesterday"),
            (2, 3, "Project-1", "Did you finishing coding that Signup page?"),
            (3, 2, "Project-2", "Already did, including the logic as well. Did you finish the Signin page?"),
            (2, 3, "Project-3", "Done. I'm currently moving on to the Inbox page. I assumed you'll be doing the Outbox?"),
            (3, 2, "Project-4", "I think you should do both the Inbox and Outbox, since they're almost the same. I'll implement the Compose page."),
            (2, 3, "Project-5", "Alright. Tell me if there's any problems."),
            (3, 2, "Project-6", "Oh yeah, about the Detail page, let's wait until us both finish, since we need it to test out the page, whether it working or not."),
            (2, 3, "Project-6", "Good ideas, and I add wrong subject, remember to read my DMs."),
            (3, 2, "Project-7", "I've trouble with the upload file, it's not working in my favor, should we talk in gg meet?"),
            (2, 3, "Project-8", "Let's do the upload later, for now, we need to implement the Detail page."),
            (3, 2, "Project-9", "Alright, done with the Detail page, now let's fix the Upload function."),
            (1, 2, "Welcome message", "Congratulation on successfully creating your account!"),
            (1, 3, "Welcome message", "Congratulation on successfully creating your account!"),
            (2, 1, "Reply", "Pending"),
            (3, 1, "Reply", "Pending")
        `;
        await trueDBconnect.query(emailsInsertValue);

        trueDBconnect.end();
    } catch (error) {
        console.error("There were some problems while creating the database. Please re-check the system!");
    }
}

dbConnect();




