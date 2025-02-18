import fs from "fs";
import readlineSync from "readline-sync";
import libreConvert from "libreoffice-convert";
import ora from "ora";
import PDFDocument from "pdfkit";
import chalk from "chalk";
import axios from "axios"; // For making HTTP requests to Ollama API
import dotenv from "dotenv";

dotenv.config();

// Ensure UTF-8 encoding
process.stdout.write("\u001b[0m");

// Load environment variables
const SENDER_NAME = process.env.SENDER_NAME;
const INPUT_FILE = process.env.INPUT_FILE;
const OUTPUT_FILE = process.env.OUTPUT_FILE || `messages_${SENDER_NAME}`;
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b-instruct-q4_K_M";

// Validate environment variables
if (!SENDER_NAME || !INPUT_FILE || !OUTPUT_FILE) {
    console.error(chalk.red("❌ Missing environment variables. Check your .env file."));
    process.exit(1);
}

// Function to get all unique senders from file
function getSenders(filePath) {
    const data = fs.readFileSync(filePath, "utf-8");
    const senders = new Set();

    const lines = data.split("\n");
    lines.forEach((line) => {
        const match = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2} ?[APM]*) - (.+?): (.+)$/);
        if (match) {
            senders.add(match[2]); // Extract sender's name
        }
    });

    return Array.from(senders);
}

// Function to extract messages with timestamps
function extractMessages(filePath, sender) {
    try {
        const data = fs.readFileSync(filePath, "utf-8");
        const lines = data.split("\n");
        const messages = [];

        lines.forEach((line) => {
            const match = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2} ?[APM]*) - (.+?): (.+)$/);
            if (match) {
                const timestamp = match[1];
                const senderFound = match[2];
                let message = match[3];

                if (senderFound === sender) {
                    messages.push({ timestamp, message });
                }
            }
        });

        return messages;
    } catch (error) {
        console.error(chalk.red("❌ Error reading file:"), error);
        process.exit(1);
    }
}

// AI Analysis Function using Ollama API
async function analyzeMessagesWithOllama(text, modelName, apiUrl) {
    const aiSpinner = ora("🧠 Analyzing messages with Ollama...").start();

    try {
        console.log("Sending request to Ollama API...");
        const response = await axios.post(apiUrl, {
            model: modelName,
            prompt: `Analyze this chat data and provide a personality and behavior analysis of the sender. Include chat style, emotional tone, repeated words, and any unique patterns.\n\n${text}`,
        });

        const result = response.data;
        aiSpinner.succeed(chalk.green("✅ AI Analysis Complete!"));
        return result.response || "No analysis provided.";
    } catch (error) {
        aiSpinner.fail(chalk.red("❌ AI Analysis Failed!"));
        console.error(error.response?.data || error.message);
        return "Analysis could not be performed.";
    }
}

// Main Execution
(async () => {
    // Loading spinner
    const spinner = ora("🔄 Reading and processing the file...").start();

    // Get list of senders
    const senders = getSenders(INPUT_FILE);
    if (senders.length === 0) {
        console.error(chalk.red("❌ No senders found in the file."));
        process.exit(1);
    }

    // Validate sender name
    if (!senders.includes(SENDER_NAME)) {
        console.error(chalk.red(`❌ Error: Sender "${SENDER_NAME}" not found in the file.`));
        process.exit(1);
    }

    // Extract messages
    const messages = extractMessages(INPUT_FILE, SENDER_NAME);

    spinner.succeed(chalk.green("✅ File processing complete!"));

    if (messages.length === 0) {
        console.log(chalk.blue(`ℹ️ No messages found for "${SENDER_NAME}"`));
        process.exit(0);
    }

    // Convert messages to plain text for AI analysis
    const messagesText = messages.map(msg => msg.message).join("\n");

    // Perform AI Analysis
    const aiAnalysis = await analyzeMessagesWithOllama(messagesText, OLLAMA_MODEL, OLLAMA_API_URL);

    console.log(chalk.yellow("\n🧠 AI Personality Analysis:"));
    console.log(chalk.cyan(aiAnalysis));

    // Ask for approval
    const approval = readlineSync.question(chalk.cyan("\n✅ Do you approve saving these messages? (yes/no): "));

    if (approval.toLowerCase() !== "yes") {
        console.log(chalk.red("❌ Operation canceled."));
        process.exit(0);
    }

    // Save analysis in file
    const fullContent = `🧠 AI Personality Analysis:\n\n${aiAnalysis}\n\n📩 Messages:\n\n${messagesText}`;

    if (OUTPUT_FILE.endsWith(".odt")) {
        const buffer = Buffer.from(fullContent, "utf-8");
        libreConvert.convert(buffer, ".odt", undefined, (err, done) => {
            if (err) {
                console.error(chalk.red("❌ Error converting to .odt"), err);
                process.exit(1);
            }
            fs.writeFileSync(OUTPUT_FILE, done);
            console.log(chalk.green(`✅ Messages & AI Analysis saved to ${OUTPUT_FILE}`));
        });
    } else if (OUTPUT_FILE.endsWith(".pdf")) {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(OUTPUT_FILE);
        doc.pipe(stream);
        doc.fontSize(14).text(`🧠 AI Personality Analysis:\n`, { underline: true }).moveDown();
        doc.fontSize(12).text(aiAnalysis).moveDown();
        doc.fontSize(14).text(`📩 Messages:\n`, { underline: true }).moveDown();
        doc.fontSize(12).text(messagesText).moveDown();
        doc.end();
        stream.on("finish", () => {
            console.log(chalk.green(`✅ Messages & AI Analysis saved to ${OUTPUT_FILE}`));
        });
    } else {
        console.error(chalk.red("❌ Invalid format. Only 'odt' or 'pdf' are allowed."));
        process.exit(1);
    }
})();