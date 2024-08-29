CREATE TABLE users (
    userid VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status ENUM('Incomplete', 'Complete') DEFAULT 'Incomplete'
);
