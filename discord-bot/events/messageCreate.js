const { Events, MessageFlags, Collection } = require('discord.js');
const db = require('../db');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;
        
        if(message.channel.isThread()) {
            try {
            
                console.log("content: " + message.content)

                const threadRes = await db.query(
                    `SELECT t.thread_id, t.user_id, u.discord_id
                    FROM discord_threads t
                    JOIN users u ON t.user_id = u.id
                    WHERE t.thread_id = $1`,
                    [message.channel.id]
                );

                console.log("threadResLength: " + threadRes.rows.length)

                // case where thread message not one created by bot
                if (threadRes.rows.length === 0) return;
                
                const threadData = threadRes.rows[0];
                
                if (message.author.id !== threadData.discord_id.toString()) {
                    await message.reply({content: "User not authorized to query this thread", flags: MessageFlags.Ephemeral})
                    return;
                }
                
                // display that bot is typing to user
                await message.channel.sendTyping();


                // logic for accepting pdf's
                if (message.attachments.size > 0) {
                    const attachment = message.attachments.first();
                    
                    // verify it is a pdf
                    if (attachment.contentType === 'application/pdf' || attachment.name.endsWith('.pdf')) {
                        await message.reply(`PDF received: ${attachment.url}. Processing.`)

                        const fileUrl = attachment.url;

                        try {
                            // send pdf url to python microservice via REST api
                            const response = await fetch('http://localhost:5000/ingest', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    discord_id: message.author.id,
                                    file_url: fileUrl,
                                    filename: attachment.name
                                })
                            });

                            if (response.ok) {
                                await message.channel.send("Successfully vectorized document and added to your knowledge base.");
                            } else {
                                await message.channel.send("Failed to ingest the document.");
                            }
                        } catch (error) {
                            console.error("Failed to contact Python backend:", error);
                            await message.channel.send("Document Ingestion failed, please try again.");
                        }
                        return;
                    }
                }

                try {
                    const response = await fetch('http://localhost:5000/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            discord_id: message.author.id,
                            query: message.content,
                            k: 4 // top k chunk setting -> look in main.py
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error. Status: ${response.status}`);
                    }

                    const data = await response.json();
                    const results = data.results || [];

                    if (results.length === 0) {
                        await message.reply("No processed documents for your user id found. Please upload files.");
                        return;
                    }

                    // map text chunks returned by LangChain
                    const contextChunks = results.map(res => res.content);

                    // format bot response to show user the closest matched contextual snippet
                    let processedChunk = contextChunks[0].substring(0, 1500).trim()
                    processedChunk = processedChunk.replace(/\n/g, '\n> ');

                    let directAnswer = `**Found ${contextChunks.length} context match(es) from your files:**\n\n`;
                    directAnswer += `> ... ${processedChunk} ...\n\n`;
                    directAnswer += `*Source Document: \`${results[0].metadata.filename || 'Unknown'}\`*`;

                    await message.reply(directAnswer);
                } catch (error) {
                    console.error("Failed to contact Python query backend:", error);
                    await message.reply("Failed to perform vector search. Ensure the Python engine is running.");
                }

                // placeholder for creating query embedding
                const sampleQueryVector = Array(1536).fill(0.0);

            } catch (error) {
                console.error('Error executing RAG search pipeline:', error);
                await message.reply('An internal error occurred while processing the knowledge base.');
            }
        }
    },
};