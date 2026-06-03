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

                // placeholder for creating query embedding
                const sampleQueryVector = Array(1536).fill(0.0);

                // query db for only for documents that belong to the user
                // limit to 5 rows for now, introduce option for user to set number in command in the future
                const contextRes = await db.query(
                    `SELECT dc.content, dc.embedding <=> $1::vector AS distance 
                    FROM document_chunks dc 
                    JOIN documents d ON dc.document_id = d.id 
                    WHERE d.user_id = $2 
                    ORDER BY distance ASC 
                    LIMIT 5`,
                    [JSON.stringify(sampleQueryVector), threadData.user_id]
                );

                const contextChunks = contextRes.rows.map(row => row.content);

                if (contextChunks.length === 0) {
                    await message.reply("No processed documents for your user id found. Please upload files.");
                    return;
                }

                await message.reply(`*Found ${contextChunks.length} context match(es). Synthesizing answer...*`);
            } catch (error) {
                console.error('Error executing RAG search pipeline:', error);
                await message.reply('An internal error occurred while processing the knowledge base.');
            }
        }
    },
};