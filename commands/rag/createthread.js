const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('createthread')
		.setDescription('Starts a new thread with the user who calls it'),
	async execute(interaction) {
		try {
			const thread = await interaction.channel.threads.create({
				name: `thread-${interaction.user.username}`,
				autoArchiveDuration: 60,
				type: ChannelType.PrivateThread,
				reason: 'User requested a thread via slash command',
			});

			await thread.members.add(interaction.user.id);

			console.log(`Thread ID: ${thread.id}, User ID: ${interaction.user.id}`);

			await interaction.reply({ content: `Created a thread for you: ${thread}`, ephemeral: true });
		} catch (error) {
			console.error('Error creating thread:', error);
			await interaction.reply({ content: 'Failed to create the thread. Ensure I have the correct permissions.', ephemeral: true });
		}
	},
};
