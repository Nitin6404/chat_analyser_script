require("dotenv").config();
const fs = require("fs");
const readlineSync = require("readline-sync");
const libreConvert = require("libreoffice-convert");

// Load environment variables
const SENDER_NAME = process.env.SENDER_NAME;
const INPUT_FILE = process.env.INPUT_FILE;
const OUTPUT_FILE = process.env.OUTPUT_FILE;

if (!SENDER_NAME || !INPUT_FILE || !OUTPUT_FILE) {
    console.error("Missing environment variables. Check your .env file.");
    process.exit(1);
}

// Function to read and extract messages
function extractMessages(filePath, sender) {
    try {
        const data = fs.readFileSync(filePath, "utf-8");
        const lines = data.split("\n");
        const messages = [];

        lines.forEach((line) => {
            if (line.includes(` - ${sender}:`)) {
                const message = line.split(`${sender}:`)[1].trim();
                messages.push(message);
            }
        });

        return messages;
    } catch (error) {
        console.error("Error reading file:", error);
        process.exit(1);
    }
}

// Extract messages
const messages = extractMessages(INPUT_FILE, SENDER_NAME);

if (messages.length === 0) {
    console.log(`No messages found for ${SENDER_NAME}`);
    process.exit(0);
}

// Display messages for approval
console.log(`Messages from ${SENDER_NAME}:`);
messages.forEach((msg, index) => console.log(`${index + 1}. ${msg}`));

const approval = readlineSync.question("\nDo you approve saving these messages? (yes/no): ");

if (approval.toLowerCase() !== "yes") {
    console.log("Operation canceled.");
    process.exit(0);
}

// Create text content for .odt file
const textContent = messages.join("\n\n");

// Convert text to .odt format
const convertToOdt = (text, outputPath) => {
    const buffer = Buffer.from(text, "utf-8");

    libreConvert.convert(buffer, ".odt", undefined, (err, done) => {
        if (err) {
            console.error("Error converting to .odt:", err);
            process.exit(1);
        }
        fs.writeFileSync(outputPath, done);
        console.log(`Messages saved to ${outputPath}`);
    });
};

// Save messages to an ODT file
convertToOdt(textContent, OUTPUT_FILE);
