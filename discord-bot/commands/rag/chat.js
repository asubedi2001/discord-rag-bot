const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('chat')
		.setDescription('Starts a new thread with the user who calls it'),
	async execute(interaction) {
		try {

			console.log(
				"attempting to insert" +
				[interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL()]
			)
			// ensure user exists in db
			const userRes = await db.query(
				`INSERT INTO users (discord_id, username, avatar_url) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (discord_id) 
                 DO UPDATE SET username = $2, avatar_url = $3 
                 RETURNING id`,
				[interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL()]
			);
			const dbUserId = userRes.rows[0].id;

			// create private thread in current channel
			const thread = await interaction.channel.threads.create({
				name: `thread-${interaction.user.username}`,
				autoArchiveDuration: 60,
				type: ChannelType.PrivateThread,
				reason: 'User requested a thread via slash command',
			});

			await db.query(
				'INSERT INTO discord_threads (thread_id, user_id) VALUES ($1, $2)',
				[thread.id, dbUserId]
			);

			await thread.members.add(interaction.user.id);

			console.log(`Thread ID: ${thread.id}, User ID: ${interaction.user.id}`);

			await interaction.reply({ 
				content: `Created a thread for you: ${thread}`, 
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			console.error('Error creating thread:', error);
			await interaction.reply({ 
				content: 'Failed to create the thread. Ensure I have the correct permissions.', 
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
