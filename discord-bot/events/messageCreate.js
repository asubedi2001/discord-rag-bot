const { Events, MessageFlags, Collection } = require('discord.js');
const db = require('../db');
const RAG_API_URL = process.env.RAG_API_URL;

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        if (!message.channel.isThread()) return;

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
                await message.reply({ content: "User not authorized to query this thread", flags: MessageFlags.Ephemeral })
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
                        const response = await fetch(`${RAG_API_URL}/ingest`, {
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
                const response = await fetch(`${RAG_API_URL}/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discord_id: message.author.id,
                        query: message.content,
                        k: 5 // top k chunk setting
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error. Status: ${response.status}`);
                }

                const data = await response.json();
                const botResponse = data.response;

                if (!botResponse) {
                    await message.reply("Model provided an empty response, please try again.");
                    return;
                }

                if (botResponse.length > 2000) {
                    // split string into messages of size 1999, to bypass discord message length limitation
                    // using 10 messages as a maximum in case of issues
                    const chunks = botResponse.match(/[\s\S]{1,1999}/g) || [];

                    for (let i = 0; i < chunks.length && i < 10; i++) {
                        if (i === 0) {
                            await message.reply(chunks[i]); // Reply to the initial user prompt
                        } else {
                            await message.channel.send(chunks[i]); // Send the rest as follow-up messages
                        }
                    }
                } else {
                    await message.reply(botResponse);
                }


            } catch (error) {
                console.error("Failed to contact Python query backend:", error);
                await message.reply("Failed to perform vector search. Ensure the Python engine is running.");
            }

        } catch (error) {
            console.error('Error executing RAG search pipeline:', error);
            await message.reply('An internal error occurred while processing the knowledge base.');
        }

    },
};