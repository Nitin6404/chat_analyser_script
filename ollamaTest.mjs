import ollama from 'ollama'

async function main() {
    const response = await ollama.generate({
        model: 'deepseek-r1',
        prompt: "Analyze the chat data and provide a personality and behavior analysis.",
    })

    // const response = await ollama.generate({
    //     model: 'llama3.2:3b-instruct-q4_K_M', // or 'deepseek-r1' for testing
    //     prompt: "Analyze the chat data and provide a personality and behavior analysis.",
    //     // stream: true,
    // });

    // const prompt = "Analyze the chat data and provide a personality and behavior analysis."
    // const response = await ollama.generate({ model: 'deepseek-r1', prompt: prompt })
    // for await (const part of response) {
    //     process.stdout.write(part.message.content)
    // }

    console.log(response.response);
}

main().catch(console.error)