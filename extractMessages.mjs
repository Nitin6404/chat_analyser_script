import fs from "fs";
import readlineSync from "readline-sync";
import libreConvert from "libreoffice-convert";
import ora from "ora";
import PDFDocument from "pdfkit";
import chalk from "chalk";

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

// Ask for input file dynamically
const inputFile = readlineSync.question(chalk.blue("📂 Enter the input file path: "), { defaultInput: "messages.txt" });

if (!fs.existsSync(inputFile)) {
    console.error(chalk.red("❌ Error: File not found. Please check the file path."));
    process.exit(1);
}

// Get list of senders
const senders = getSenders(inputFile);
if (senders.length === 0) {
    console.error(chalk.red("❌ No senders found in the file."));
    process.exit(1);
}

// Display senders list
console.log(chalk.yellow("\n👥 Available senders in the file:"));
senders.forEach((sender, index) => console.log(chalk.cyan(`${index + 1}. ${sender}`)));

// Ask user to select sender
const senderName = readlineSync.question(chalk.green("\n✍️ Enter the sender's name (copy-paste from list above): "));

if (!senders.includes(senderName)) {
    console.error(chalk.red("❌ Error: Sender not found in the file."));
    process.exit(1);
}

// Loading spinner
const spinner = ora("🔄 Reading and processing the file...").start();

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
                    // Highlight special patterns
                    message = message.replace(/!!/g, chalk.bgYellow.black("!!"));
                    message = message.replace(/\?\?/g, chalk.bgMagenta.black("??"));

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

// Extract messages
const messages = extractMessages(inputFile, senderName);

spinner.succeed(chalk.green("✅ File processing complete!"));

if (messages.length === 0) {
    console.log(chalk.blue(`ℹ️ No messages found for "${senderName}"`));
    process.exit(0);
}

// Display messages
console.log(chalk.yellow(`\n📩 Messages from "${senderName}":`));
messages.forEach((msg, index) => {
    console.log(`${chalk.green(index + 1)}. [${chalk.blue(msg.timestamp)}] ${msg.message}`);
});

// Ask for approval
const approval = readlineSync.question(chalk.cyan("\n✅ Do you approve saving these messages? (yes/no): "));

if (approval.toLowerCase() !== "yes") {
    console.log(chalk.red("❌ Operation canceled."));
    process.exit(0);
}

// Ask for export format
const format = readlineSync.question(chalk.yellow("\n📁 Choose export format (odt/pdf): "), { defaultInput: "odt" }).toLowerCase();

// Ask for custom output filename
const defaultOutputFile = `messages_${senderName.replace(/\s+/g, "_")}.${format}`;
const outputFile = readlineSync.question(chalk.green(`Enter output filename (${defaultOutputFile}): `), { defaultInput: defaultOutputFile });

// Convert text to .odt format
const textContent = messages.map(msg => `[${msg.timestamp}] ${msg.message}`).join("\n\n");

// Function to save as ODT
const convertToOdt = (text, outputPath) => {
    const buffer = Buffer.from(text, "utf-8");
    const spinner = ora("📝 Converting to .odt format...").start();

    libreConvert.convert(buffer, ".odt", undefined, (err, done) => {
        if (err) {
            spinner.fail(chalk.red("❌ Error converting to .odt"));
            console.error(err);
            process.exit(1);
        }
        fs.writeFileSync(outputPath, done);
        spinner.succeed(chalk.green(`✅ Messages saved to ${outputPath}`));
    });
};

// Function to save as PDF
const convertToPdf = (text, outputPath) => {
    const spinner = ora("📄 Generating PDF...").start();
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);
    doc.fontSize(14).text(`Messages from ${senderName}`, { align: "center" }).moveDown();

    messages.forEach(msg => {
        doc.fontSize(12).text(`[${msg.timestamp}] ${msg.message}`).moveDown();
    });

    doc.end();
    stream.on("finish", () => {
        spinner.succeed(chalk.green(`✅ Messages saved to ${outputPath}`));
    });
};

// Save messages in chosen format
if (format === "odt") {
    convertToOdt(textContent, outputFile);
} else if (format === "pdf") {
    convertToPdf(textContent, outputFile);
} else {
    console.error(chalk.red("❌ Invalid format. Only 'odt' or 'pdf' are allowed."));
    process.exit(1);
}
