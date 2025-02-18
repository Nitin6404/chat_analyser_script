import fs from "fs";
import readlineSync from "readline-sync";
import libreConvert from "libreoffice-convert";
import ora from "ora";

// Ask for input file dynamically
const inputFile = readlineSync.question("Enter the input file path: ", { defaultInput: "messages.txt" });

if (!fs.existsSync(inputFile)) {
    console.error("❌ Error: File not found. Please check the file path.");
    process.exit(1);
}

// Ask for sender name
const senderName = readlineSync.question("Enter the sender's name: ");

if (!senderName) {
    console.error("❌ Error: Sender's name cannot be empty.");
    process.exit(1);
}

// Loading spinner
const spinner = ora("Reading and processing the file...").start();

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
                const message = match[3];

                if (senderFound === sender) {
                    messages.push({ timestamp, message });
                }
            }
        });

        return messages;
    } catch (error) {
        console.error("❌ Error reading file:", error);
        process.exit(1);
    }
}

// Extract messages
const messages = extractMessages(inputFile, senderName);

spinner.succeed("✅ File processing complete!");

if (messages.length === 0) {
    console.log(`ℹ️ No messages found for "${senderName}"`);
    process.exit(0);
}

// Display messages
console.log(`\n📩 Messages from "${senderName}":`);
messages.forEach((msg, index) => {
    console.log(`${index + 1}. [${msg.timestamp}] ${msg.message}`);
});

// Ask for approval
const approval = readlineSync.question("\nDo you approve saving these messages? (yes/no): ");

if (approval.toLowerCase() !== "yes") {
    console.log("❌ Operation canceled.");
    process.exit(0);
}

// Ask for custom output filename
const defaultOutputFile = `messages_${senderName.replace(/\s+/g, "_")}.odt`;
const outputFile = readlineSync.question(`Enter output filename (${defaultOutputFile}): `, { defaultInput: defaultOutputFile });

// Convert text to .odt format
const textContent = messages.map(msg => `[${msg.timestamp}] ${msg.message}`).join("\n\n");

const convertToOdt = (text, outputPath) => {
    const buffer = Buffer.from(text, "utf-8");
    const spinner = ora("Converting to .odt format...").start();

    libreConvert.convert(buffer, ".odt", undefined, (err, done) => {
        if (err) {
            spinner.fail("❌ Error converting to .odt");
            console.error(err);
            process.exit(1);
        }
        fs.writeFileSync(outputPath, done);
        spinner.succeed(`✅ Messages saved to ${outputPath}`);
    });
};

// Save messages
convertToOdt(textContent, outputFile);
