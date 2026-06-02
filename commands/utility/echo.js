// example code pulled from https://discordjs.guide/legacy/app-creation/creating-commands
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('echo')
		.setDescription('Replies with your input!')
		.addStringOption((option) => 
			option.setName('input')
				.setDescription('The input to echo back')
				.setRequired(true))
		.addChannelOption((option) => 
			option.setName('channel')
				.setDescription('The channel to echo into'))
		.addBooleanOption((option) =>
			option.setName('ephemeral')
				.setDescription('Whether or not the echo should be ephemeral'),
		),
	async execute(interaction) {
		const input = interaction.options.getString('input');
		const channel = interaction.options.getChannel('channel');
		const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

		if (channel) {
			await channel.send(input);
			await interaction.reply({ content: `Echoed to ${channel}`, ephemeral});
		} else {
			await interaction.reply({ content: input, ephemeral });
		}
	},
};