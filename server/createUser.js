const readline = require('readline');
const bcrypt = require('bcrypt');
const db = require('./db');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createUser() {
  console.log('--- Recipe Book: Create New User ---');
  
  try {
    const username = await question('Enter username: ');
    if (!username) {
      console.error('Username is required.');
      process.exit(1);
    }

    const password = await question('Enter password: ');
    if (!password) {
      console.error('Password is required.');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = 'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username';
    const values = [username, hashedPassword];

    const result = await db.query(query, values);
    
    console.log(`\nUser created successfully!`);
    console.log(`ID: ${result.rows[0].id}`);
    console.log(`Username: ${result.rows[0].username}`);

  } catch (err) {
    if (err.code === '23505') {
      console.error('\nError: Username already exists.');
    } else {
      console.error('\nError creating user:', err.message);
    }
  } finally {
    rl.close();
    process.exit();
  }
}

createUser();

