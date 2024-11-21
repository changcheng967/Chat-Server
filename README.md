# Chat Server

A simple chat server that allows users to register and log in. This application includes a registration form where users can choose between a regular "User" or an "Admin" role, with the latter requiring an additional admin password. Once registered, users can log in to access the chat.

## Features
- **User Registration**: Allows users to register with a username, password, email, and role selection.
- **Admin Role**: Admin users have an additional admin password field that appears when selecting "Doulet Media Admin Team" as their role.
- **User Login**: Users can log in using their credentials.
- **Responsive Design**: The interface is designed to be usable on both desktop and mobile devices.

## Prerequisites

Before running this application, make sure you have the following installed:

- [Node.js](https://nodejs.org/en/) (for backend functionality)
- A compatible database (if applicable to your back-end logic)

## Installation

### Clone the Repository

Start by cloning the repository to your local machine:

```bash
git clone https://github.com/changcheng967/Chat-Server.git
cd Chat-Server
```

## Install Dependencies
If you're using a backend server with Node.js, you'll need to install dependencies. Run the following command in the project directory:

```bash
npm install
```
If you're using a different backend setup (like Python, etc.), adjust the instructions accordingly.

## Set Up Your Backend
If you're using Node.js or another backend framework, ensure that your backend server is set up and running. If the application uses a database, make sure your database is set up as well.

## Run the Application
To run the application locally, start the server:

```bash
node server.js
```
By default, the server will be hosted at http://localhost:3000. You can now navigate to this URL in your browser to access the chat server.

## How to Use
### Register a New Account:

Open the registration form and fill in the fields for username, password, email, and role.
If you are registering as an admin, make sure to enter the correct admin password.
Click on "Register" to create your account.
### Login:

After registering, log in by providing your username and password in the login form.
If the login is successful, you will be redirected to the chat interface.
## Project Structure
### The project is structured as follows:

```graphql
/Chat-Server
│
├── index.html           # HTML file containing the registration and login forms
├── styles.css           # CSS file for styling the forms and layout
├── app.js               # JavaScript for handling the registration and login forms
└── README.md            # This readme file
```
## Contributing
If you'd like to contribute to this project, please fork the repository and create a pull request with your changes. Make sure to follow the coding conventions used in the project.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
