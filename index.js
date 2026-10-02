const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType, 
    PermissionsBitField,
    SlashCommandBuilder,
    REST,
    Routes,
    ActivityType,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Public Abu Ghamdah System Bot is alive and running! 🚀');
});

app.listen(PORT, () => {
    console.log(`Web server is listening on port ${PORT}`);
});

// نظام تخزين الإعدادات بملف JSON لكل سيرفر
const dbPath = path.join(__dirname, 'database.json');

function getGuildConfig(guildId) {
    if (!fs.existsSync(dbPath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        return data[guildId] || null;
    } catch (e) {
        return null;
    }
}

function saveGuildConfig(guildId, newConfig) {
    let data = {};
    if (fs.existsSync(dbPath)) {
        try {
            data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (e) {
            data = {};
        }
    }
    data[guildId] = { ...(data[guildId] || {}), ...newConfig };
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const staffPoints = new Map(); 
const activeTickets = new Map(); 

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح باسم ${client.user.tag}! البوت العام جاهز.`);

    client.user.setPresence({
        activities: [{ name: 'Public System by ابو غمده', type: ActivityType.Watching }],
        status: 'online',
    });

    const commands = [
        new SlashCommandBuilder()
            .setName('set-system')
            .setDescription('إعدادات البوت الأساسية للسيرفر (رتبة الإداريين وروم اللوج)')
            .addRoleOption(option => 
                option.setName('staff-role').setDescription('رتبة الإداريين المسؤولين عن التذاكر').setRequired(true))
            .addChannelOption(option => 
                option.setName('log-channel').setDescription('روم السجلات (Log) لحفظ تذاكر القبول والرفض').setRequired(true))
            .addChannelOption(option => 
                option.setName('category-tickets').setDescription('القسم (Category) اللي تنفتح فيه التذاكر').setRequired(true)),
        new SlashCommandBuilder()
            .setName('setup-verify')
            .setDescription('إرسال بنر فتح تذكرة التفعيل الإداري في الروم الحالي'),
        new SlashCommandBuilder()
            .setName('pointict')
            .setDescription('عرض نقاط الإداريين في تذاكر التفعيل'),
        new SlashCommandBuilder()
            .setName('restpointict')
            .setDescription('تصفير نقاط الإداريين بالكامل في هذا السيرفر')
    ];

    const botToken = process.env.DISCORD_TOKEN || process.env.TOKEN;
    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('تم تسجيل أوامر السلاش (Slash Commands) للبوت العام بنجاح! 🚀');
    } catch (error) {
        console.error('خطأ في تسجيل أوامر السلاش:', error);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const ticketData = activeTickets.get(message.channel.id);
    if (ticketData && message.author.id === ticketData.userId) {
        if (ticketData.timer) {
            clearTimeout(ticketData.timer);
            ticketData.timer = null;
            await message.channel.send("تم الغاء نظام التنبيه ⚠️");
        }

        const step = ticketData.step;

        if (step === 1) {
            ticketData.answers[1] = message.content;
            ticketData.step = 2;
            await message.channel.send(`**السؤال 2/6:** عمرك؟ (اجباري أرقام فقط)`);
        } else if (step === 2) {
            if (isNaN(message.content)) {
                return message.reply("خطأ! عيد أرسل أرقام فقط ❌");
            }
            ticketData.answers[2] = message.content;
            ticketData.step = 3;
            await message.channel.send(`**السؤال 3/6:** يوزرك روبلكس؟ (إنجليزي فقط)`);
        } else if (step === 3) {
            if (!/^[A-Za-z0-9_]+$/.test(message.content)) {
                return message.reply("خطأ! يرجى إدخال أحرف إنجليزية وأرقام فقط ❌");
            }
            ticketData.answers[3] = message.content;
            ticketData.step = 4;
            await message.channel.send(`**السؤال 4/6:** صورة بروفايلك روبلكس؟ (أرسل صورة)`);
        } else if (step === 4) {
            const attachment = message.attachments.first();
            if (!attachment) {
                return message.reply("خطأ! يجب إرسال صورة بروفايلك ❌");
            }
            ticketData.answers[4] = attachment.url;
            ticketData.step = 5;
            await message.channel.send(`**السؤال 5/6:** صورة دخولك القروب؟\nرابط قروبنا (16) 📎 : [اضغط هنا](https://www.roblox.com/share/g/387192545)\n(أرسل صورة إثبات الدخول)`);
        } else if (step === 5) {
            const attachment = message.attachments.first();
            if (!attachment) {
                return message.reply("خطأ! يجب إرسال صورة إثبات دخول القروب ❌");
            }
            ticketData.answers[5] = attachment.url;
            ticketData.step = 6;
            
            const name1 = ticketData.answers[1];
            await message.channel.send(`**السؤال 6/6:** الحلف:\nانا اقر (${name1}) واقسم بالله اني ما اخرب اي رول وما استخدم اي رتبه ل تشويه سمعة السيرفر وما استخدم اي صلاحية لضرر أو لمصالح شخصية\n*(يرجى كتابة الحلف بالنص تماماً مع اسمك)*`);
        } else if (step === 6) {
            const cleanText = (str) => {
                return str
                    .replace(/[إأآٱ]/g, 'ا')
                    .replace(/ة/g, 'ه')
                    .replace(/[()]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            const userClean = cleanText(message.content);
            const expectedClean = cleanText(`انا اقر ${ticketData.answers[1]} واقسم بالله اني ما اخرب اي رول وما استخدم اي رتبه ل تشويه سمعة السيرفر وما استخدم اي صلاحية لضرر أو لمصالح شخصية`);
            
            if (userClean !== expectedClean) {
                return message.reply("خطأ! الحلف غير مطابق تماماً لما طلب منك، يرجى كتابته بالشكل الصحيح ❌");
            }

            ticketData.answers[6] = message.content;
            ticketData.step = 7;

            const reviewEmbed = new EmbedBuilder()
                .setColor(0x00FFFF)
                .setTitle("قبول ✅ أو رفض ❌ طلب التفعيل")
                .setDescription(
                    `١ الإجابة : ${ticketData.answers[1]}\n` +
                    `٢ الإجابة : ${ticketData.answers[2]}\n` +
                    `٣ الإجابة : ${ticketData.answers[3]}\n` +
                    `٤ الإجابة : [صورة](${ticketData.answers[4]})\n` +
                    `٥ الإجابة : [صورة](${ticketData.answers[5]})\n` +
                    `٦ الإجابة : ${ticketData.answers[6]}`
                );

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accept_ticket').setLabel('قبول الطلب ✅️').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('reject_ticket').setLabel('رفض الطلب ❌').setStyle(ButtonStyle.Danger)
            );

            await message.channel.send({
                content: `انتهى العضو من الأسئلة التفاعلية! ينتظر قرار الإدارة:`,
                embeds: [reviewEmbed],
                components: [actionRow]
            });
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, member, guild, channel } = interaction;

        if (commandName === 'set-system') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر لأصحاب الصلاحيات (Administrator) فقط! ❌", ephemeral: true });
            }

            const staffRole = interaction.options.getRole('staff-role');
            const logChannel = interaction.options.getChannel('log-channel');
            const categoryTickets = interaction.options.getChannel('category-tickets');

            saveGuildConfig(guild.id, {
                staffRoleId: staffRole.id,
                logChannelId: logChannel.id,
                categoryTicketsId: categoryTickets.id
            });

            return interaction.reply({ 
                content: `تم حفظ إعدادات السيرفر العامة بنجاح! ✅\n- رتبة الإداريين: <@&${staffRole.id}>\n- روم اللوج: <#${logChannel.id}>\n- كاتيغوري التذاكر: \`${categoryTickets.name}\``, 
                ephemeral: true 
            });
        }

        if (commandName === 'setup-verify') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للأحكام الإدارية فقط! ❌", ephemeral: true });
            }

            const config = getGuildConfig(guild.id);
            if (!config) {
                return interaction.reply({ content: "تنبيه! لم يتم ضبط إعدادات السيرفر بعد. يرجى استخدام أمر `/set-system` أولاً لتحديد الرتب والرومات! ⚠️", ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle("من هنا يمكنكم العب والتفعيل معنا 💞.")
                .setDescription(
                    "فتح تذكرة ل تقديم على رتبة تصريح لعب 🎮\n\n" +
                    "يمكنك من خلالها لعب الرولات معنا 🤝🏼\n\n" +
                    "قم فقط ب الإجابة على الأسئلة التفاعليه 🤍.\n\n" +
                    "وشكرا لكم...💞"
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('فتح تذكرة تفعيل ✅️')
                    .setStyle(ButtonStyle.Success)
            );

            await channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: "تم إرسال بنر التفعيل بنجاح! ✅" });
        }

        if (commandName === 'pointict') {
            const config = getGuildConfig(guild.id);
            if (!config || !member.roles.cache.has(config.staffRoleId)) {
                if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: "عذراً، هذا الأمر للفريق الإداري فقط! ❌", ephemeral: true });
                }
            }
            
            const sortedPoints = [...staffPoints.entries()].sort((a, b) => b[1] - a[1]);
            let desc = sortedPoints.length > 0 
                ? sortedPoints.map(([id, pts], index) => `${index + 1} <@${id}> : ${pts}`).join('\n')
                : 'لا توجد نقاط مسجلة حتى الآن.';

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle("نقاط تذكرة التفعيل")
                .setDescription(desc);

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'restpointict') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للأحكام الإدارية فقط! ❌", ephemeral: true });
            }
            staffPoints.clear();
            return interaction.reply({ content: "تم تصفير جميع نقاط الإداريين بنجاح! 🔄", ephemeral: true });
        }
    }

    if (!interaction.isButton()) return;

    const { customId, channel, guild, member, user } = interaction;
    const config = getGuildConfig(guild.id);

    if (customId === 'open_ticket') {
        if (!config) {
            return interaction.reply({ content: "عذراً، لم يقم صاحب السيرفر بإعداد البوت بعد (استخدموا /set-system) ❌", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const ticketName = `Ticket-${user.username}`;
        const ticketChannel = await guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: config.categoryTicketsId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
                {
                    id: config.staffRoleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                }
            ],
        });

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle("تم فتح تذكرة تفعيل ✅.")
            .setDescription("انت الان بـ الأسئلة التفاعلية لـ التفعيل قم بـ الإجابة عليها 💞.");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_options').setLabel('خيارات التذكرة ⚙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة ❌️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة ✅').setStyle(ButtonStyle.Success)
        );

        await ticketChannel.send({
            content: `<@&${config.staffRoleId}> | <@${user.id}>`,
            embeds: [embed],
            components: [row]
        });

        activeTickets.set(ticketChannel.id, {
            userId: user.id,
            step: 1,
            answers: {},
            claimedBy: null,
            timer: null
        });

        await ticketChannel.send(`<@${user.id}> **السؤال 1/6:** ما هو اسمك؟`);

        return interaction.editReply({ content: `تم فتح تذكرتك بنجاح هنا: <#${ticketChannel.id}> 🎟` });
    }

    if (customId === 'claim_ticket') {
        if (!config || !member.roles.cache.has(config.staffRoleId)) {
            return interaction.reply({ content: "هذا الزر خاص بالفريق الإداري فقط! ❌", ephemeral: true });
        }

        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            return interaction.reply({ content: `تم استلام هذه التذكرة مسبقاً من قِبل الإداري <@${ticketData.claimedBy}>! ⚠️`, ephemeral: true });
        }

        if (ticketData) ticketData.claimedBy = user.id;

        await channel.permissionOverwrites.edit(config.staffRoleId, {
            SendMessages: false,
            ViewChannel: true
        }).catch(() => {});

        await channel.permissionOverwrites.edit(user.id, {
            SendMessages: true,
            ViewChannel: true,
            ReadMessageHistory: true
        }).catch(() => {});

        const currentPoints = staffPoints.get(user.id) || 0;
        staffPoints.set(user.id, currentPoints + 1);

        await channel.send({
            content: `تم استلاستبدال التذكرة / استلامها بنجاح ! ✅️\nالإداري المستلم : <@${user.id}>\nألايدي : (\`${user.id}\`) 👤\nتم منح الإداري نقطة واحدة ( +1 ) ✔\nإجمالي نقاطك الحالية = ${currentPoints + 1} 📊`
        });

        return interaction.reply({ content: "تم استلام التذكرة بنجاح وتسجيل النقطة لك.", ephemeral: true });
    }

    if (customId === 'close_ticket') {
        if (!config || !member.roles.cache.has(config.staffRoleId)) {
            return interaction.reply({ content: "هذا الزر خاص بالفريق الإداري فقط! ❌", ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('delete_ticket_confirm').setLabel('حذف التذكرة 🗑').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('leave_ticket').setLabel('ترك التذكرة 🚫').setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: "اختر إجراء الإغلاق:", components: [row] });
        await interaction.reply({ content: "تم إرسال خيارات الإغلاق.", ephemeral: true });
    }

    if (customId === 'leave_ticket') {
        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy === user.id) {
            ticketData.claimedBy = null;
            const currentPoints = staffPoints.get(user.id) || 1;
            staffPoints.set(user.id, Math.max(0, currentPoints - 1));

            await channel.permissionOverwrites.edit(config.staffRoleId, {
                SendMessages: true,
                ViewChannel: true
            }).catch(() => {});

            await channel.permissionOverwrites.delete(user.id).catch(() => {});

            await channel.send(`**ترك التذكرة 🚫**\nالإداري المستلم ترك التذكرة <@${user.id}>\nتم خصم نقطة واحدة منك، وتم مسح صلاحيتك الخاصة وإعادة فتح الكتابة للإداريين.`);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة ✅').setStyle(ButtonStyle.Success)
            );
            await channel.send({ content: `<@&${config.staffRoleId}>\nالرجاء الإستلام`, components: [row] });
        }
        return interaction.reply({ content: "تم ترك التذكرة.", ephemeral: true });
    }

    if (customId === 'delete_ticket_confirm') {
        await channel.send("حذف التذكرة 🗑\nسيتم حذف التذكرة...");
        setTimeout(() => channel.delete().catch(() => {}), 3000);
    }

    if (customId === 'ticket_options') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('opt_warn').setLabel('تنبيه العضو ⚠️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('opt_summon').setLabel('استدعاء الاداري ☑').setStyle(ButtonStyle.Success)
        );
        return interaction.reply({ content: "خيارات التذكرة ⚙️", components: [row], ephemeral: true });
    }

    if (customId === 'opt_warn') {
        const ticketData = activeTickets.get(channel.id);
        if (!ticketData) return;

        await channel.send(`تم تفعيل وضع التنبيه ⚠️\nلـ العضو <@${ticketData.userId}>\nاذا لم يتم الرد في ٥ دقائق سيتم إغلاق التذكرة تلقائيا.`);
        
        const timer = setTimeout(async () => {
            await channel.send("انتهت المدة ولم يتم الرد، سيتم حذف التذكرة تلقائياً.");
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }, 5 * 60 * 1000);

        ticketData.timer = timer;
        return interaction.reply({ content: "تم تفعيل التنبيه.", ephemeral: true });
    }

    if (customId === 'opt_summon') {
        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            await channel.send(`استدعاء الاداري ☑️\nتم استدعاء الاداري المسؤول <@${ticketData.claimedBy}>`);
        } else {
            await channel.send(`استدعاء الاداري ☑️\n<@&${config.staffRoleId}> الرجاء الرد على التذكرة!`);
        }
        return interaction.reply({ content: "تم الاستدعاء.", ephemeral: true });
    }

    if (customId === 'accept_ticket') {
        if (!config || !member.roles.cache.has(config.staffRoleId)) {
            return interaction.reply({ content: "عذراً، أزرار القبول والرفض خاصة بالفريق الإداري فقط! ❌", ephemeral: true });
        }

        const ticketData = activeTickets.get(channel.id);
        if (!ticketData) return;

        await channel.send("تم قبول الطلب ✅. سيتم إغلاق التذكرة خلال لحظات...");
        
        if (config.logChannelId) {
            const logChan = guild.channels.cache.get(config.logChannelId);
            if (logChan) {
                const fetchMessages = async (ch) => {
                    let sumMessages = [];
                    let lastId;
                    while (true) {
                        const options = { limit: 100 };
                        if (lastId) options.before = lastId;
                        const messages = await ch.messages.fetch(options);
                        if (messages.size === 0) break;
                        sumMessages.push(...messages.values());
                        lastId = messages.lastKey();
                        if (messages.size < 100) break;
                    }
                    return sumMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                };

                const allMsgs = await fetchMessages(channel);
                
                let htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سجل تذكرة - ${channel.name}</title>
    <style>
        body { background-color: #313338; color: #dbdee1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; }
        .header { background: #2b2d31; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-right: 5px solid #23a55a; }
        .message { display: flex; margin-bottom: 20px; align-items: flex-start; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-left: 15px; background-color: #5865f2; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; overflow: hidden; flex-shrink: 0; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .content { flex-grow: 1; }
        .username { font-weight: 600; color: #f2f3f5; margin-left: 8px; }
        .timestamp { font-size: 11px; color: #949ba4; }
        .text { margin-top: 4px; color: #dbdee1; white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
        .embed { background: #2b2d31; border-radius: 4px; border-right: 4px solid #5865f2; padding: 10px; margin-top: 8px; max-width: 520px; border-top: 1px solid #3f4147; border-left: 1px solid #3f4147; border-bottom: 1px solid #3f4147; }
        .embed-title { font-weight: bold; color: white; margin-bottom: 5px; }
        .embed-desc { font-size: 13px; color: #dbdee1; }
        .attachment img { max-width: 300px; border-radius: 8px; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>📂 سجل محادثة التذكرة (مقبولة)</h2>
        <p><strong>اسم الروم:</strong> ${channel.name} | <strong>صاحب التذكرة ID:</strong> ${ticketData.userId} | <strong>الإداري المسؤول:</strong> ${user.tag}</p>
    </div>
    <div class="chat-container">`;

                for (const msg of allMsgs) {
                    const time = new Date(msg.createdTimestamp).toLocaleString();
                    const authorName = msg.author.username;
                    const avatarUrl = msg.author.displayAvatarURL({ extension: 'png' });
                    let text = msg.content || "";

                    htmlContent += `
        <div class="message">
            <div class="avatar"><img src="${avatarUrl}" alt="AV"></div>
            <div class="content">
                <div>
                    <span class="username">${authorName}</span>
                    <span class="timestamp">${time}</span>
                </div>
                <div class="text">${text}</div>`;

                    if (msg.embeds && msg.embeds.length > 0) {
                        for (const embed of msg.embeds) {
                            htmlContent += `<div class="embed">`;
                            if (embed.title) htmlContent += `<div class="embed-title">${embed.title}</div>`;
                            if (embed.description) htmlContent += `<div class="embed-desc">${embed.description.replace(/\n/g, '<br>')}</div>`;
                            htmlContent += `</div>`;
                        }
                    }

                    if (msg.attachments && msg.attachments.size > 0) {
                        msg.attachments.forEach(att => {
                            htmlContent += `<div class="attachment"><a href="${att.url}" target="_blank"><img src="${att.url}" alt="Attachment"></a></div>`;
                        });
                    }

                    htmlContent += `</div></div>`;
                }

                htmlContent += `</div></body></html>`;

                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle("سجل قبول تفعيل جديد ✅")
                    .setDescription(
                        `**الإداري المسؤول:** <@${user.id}> (أيدي: \`${user.id}\`)\n` +
                        `**العضو صاحب التذكرة:** <@${ticketData.userId}>\n` +
                        `**التاريخ والوقت:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        `١ الإجابة : ${ticketData.answers[1]}\n` +
                        `٢ الإجابة : ${ticketData.answers[2]}\n` +
                        `٣ الإجابة : ${ticketData.answers[3]}\n` +
                        `٤ الإجابة : [صورة](${ticketData.answers[4]})\n` +
                        `٥ الإجابة : [صورة](${ticketData.answers[5]})\n` +
                        `٦ الإجابة : ${ticketData.answers[6]}`
                    );

                const attachment = new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `transcript-${ticketData.userId}.html` });

                await logChan.send({ embeds: [logEmbed], files: [attachment] });
            }
        }

        setTimeout(() => channel.delete().catch(() => {}), 15000);
        return interaction.reply({ content: "تم قبول التفعيل بنجاح.", ephemeral: true });
    }

    if (customId === 'reject_ticket') {
        if (!config || !member.roles.cache.has(config.staffRoleId)) {
            return interaction.reply({ content: "عذراً، أزرار القبول والرفض خاصة بالفريق الإداري فقط! ❌", ephemeral: true });
        }

        const ticketData = activeTickets.get(channel.id);
        if (!ticketData) return;

        await channel.send("تم رفض الطلب ❌. سيتم إغلاق التذكرة...");

        if (config.logChannelId) {
            const logChan = guild.channels.cache.get(config.logChannelId);
            if (logChan) {
                const fetchMessages = async (ch) => {
                    let sumMessages = [];
                    let lastId;
                    while (true) {
                        const options = { limit: 100 };
                        if (lastId) options.before = lastId;
                        const messages = await ch.messages.fetch(options);
                        if (messages.size === 0) break;
                        sumMessages.push(...messages.values());
                        lastId = messages.lastKey();
                        if (messages.size < 100) break;
                    }
                    return sumMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                };

                const allMsgs = await fetchMessages(channel);
                
                let htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>سجل تذكرة - ${channel.name}</title>
    <style>
        body { background-color: #313338; color: #dbdee1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; }
        .header { background: #2b2d31; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-right: 5px solid #f23f43; }
        .message { display: flex; margin-bottom: 20px; align-items: flex-start; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-left: 15px; background-color: #5865f2; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; overflow: hidden; flex-shrink: 0; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .content { flex-grow: 1; }
        .username { font-weight: 600; color: #f2f3f5; margin-left: 8px; }
        .timestamp { font-size: 11px; color: #949ba4; }
        .text { margin-top: 4px; color: #dbdee1; white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
        .embed { background: #2b2d31; border-radius: 4px; border-right: 4px solid #f23f43; padding: 10px; margin-top: 8px; max-width: 520px; border-top: 1px solid #3f4147; border-left: 1px solid #3f4147; border-bottom: 1px solid #3f4147; }
        .embed-title { font-weight: bold; color: white; margin-bottom: 5px; }
        .embed-desc { font-size: 13px; color: #dbdee1; }
        .attachment img { max-width: 300px; border-radius: 8px; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>📂 سجل محادثة التذكرة (مرفوضة)</h2>
        <p><strong>اسم الروم:</strong> ${channel.name} | <strong>صاحب التذكرة ID:</strong> ${ticketData.userId} | <strong>الإداري المسؤول:</strong> ${user.tag}</p>
    </div>
    <div class="chat-container">`;

                for (const msg of allMsgs) {
                    const time = new Date(msg.createdTimestamp).toLocaleString();
                    const authorName = msg.author.username;
                    const avatarUrl = msg.author.displayAvatarURL({ extension: 'png' });
                    let text = msg.content || "";

                    htmlContent += `
        <div class="message">
            <div class="avatar"><img src="${avatarUrl}" alt="AV"></div>
            <div class="content">
                <div>
                    <span class="username">${authorName}</span>
                    <span class="timestamp">${time}</span>
                </div>
                <div class="text">${text}</div>`;

                    if (msg.embeds && msg.embeds.length > 0) {
                        for (const embed of msg.embeds) {
                            htmlContent += `<div class="embed">`;
                            if (embed.title) htmlContent += `<div class="embed-title">${embed.title}</div>`;
                            if (embed.description) htmlContent += `<div class="embed-desc">${embed.description.replace(/\n/g, '<br>')}</div>`;
                            htmlContent += `</div>`;
                        }
                    }

                    if (msg.attachments && msg.attachments.size > 0) {
                        msg.attachments.forEach(att => {
                            htmlContent += `<div class="attachment"><a href="${att.url}" target="_blank"><img src="${att.url}" alt="Attachment"></a></div>`;
                        });
                    }

                    htmlContent += `</div></div>`;
                }

                htmlContent += `</div></body></html>`;

                const logEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle("سجل رفض تفعيل ❌")
                    .setDescription(
                        `**الإداري المسؤول:** <@${user.id}> (أيدي: \`${user.id}\`)\n` +
                        `**العضو صاحب التذكرة:** <@${ticketData.userId}>\n` +
                        `**التاريخ والوقت:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        `١ الإجابة : ${ticketData.answers[1]}\n` +
                        `٢ الإجابة : ${ticketData.answers[2]}\n` +
                        `٣ الإجابة : ${ticketData.answers[3]}\n` +
                        `٤ الإجابة : [صورة](${ticketData.answers[4]})\n` +
                        `٥ الإجابة : [صورة](${ticketData.answers[5]})\n` +
                        `٦ الإجابة : ${ticketData.answers[6]}`
                    );

                const attachment = new AttachmentBuilder(Buffer.from(htmlContent, 'utf-8'), { name: `transcript-rejected-${ticketData.userId}.html` });

                await logChan.send({ embeds: [logEmbed], files: [attachment] });
            }
        }

        setTimeout(() => channel.delete().catch(() => {}), 10000);
        return interaction.reply({ content: "تم رفض الطلب.", ephemeral: true });
    }
});

const finalBotToken = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!finalBotToken) {
    console.error("خطأ حرج: لم يتم العثور على توكن البوت في متغيرات البيئة (DISCORD_TOKEN أو TOKEN)!");
} else {
    client.login(finalBotToken).then(() => {
        console.log("تم إرسال أمر تسجيل الدخول للبوت العام بنجاح تام!");
    }).catch(err => {
        console.error("خطأ قاتل أثناء محاولة تسجيل دخول البوت العام من ديسكورد:", err);
    });
}