const settings = require('../general-settings.json')
const discord = require("discord.js");

module.exports =
{
    name: 'rupdate',
    description: 'updates the ruleset',
    args: true,
    usage: '<new ruleset>',
    guildOnly: false,
    async execute(message, args) {

        if (!message.member.roles.cache.has(settings.roles.staffrole)) return message.reply(`:x: You do not have permission to execute this command.`)

        if(settings.channels.rules && settings.messages.rules)
            (await message.guild.channels.cache.find(channel => channel.id == settings.channels.rules).fetch()).fetchMessage(settings.messages.rules).edit(args[0])
        else
            message.reply('wrong arguments supplied')

        return;
    }
}