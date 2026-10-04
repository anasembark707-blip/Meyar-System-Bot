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
    res.send('Meyar System Bot is alive and running! 🚀');
});

app.listen(PORT, () => {
    console.log(`Web server is listening on port ${PORT}`);
});

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
    data[guildId] = { 
        ...(data[guildId] || {}), 
        ...newConfig,
        questions: newConfig.questions || (data[guildId] && data[guildId].questions) || {}
    };
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
const buttonCooldowns = new Map(); // لمنع السبام والضغط المتكرر على الأزرار

process.on('uncaughtException', error => {
    console.error('An uncaught exception occurred:', error);
});

process.on('unhandledRejection', error => {
    console.error('An unhandled promise rejection occurred:', error);
});

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح باسم ${client.user.tag}! البوت جاهز.`);

    client.user.setPresence({
        activities: [{ name: 'Meyar System Bot', type: ActivityType.Watching }],
        status: 'online',
    });

    const commands = [
        new SlashCommandBuilder()
            .setName('set-system')
            .setDescription('إعدادات البوت الأساسية للسيرفر')
            .addRoleOption(option => 
                option.setName('staff-role').setDescription('رتبة الفريق الإداري (المسؤولون عن التذاكر)').setRequired(true))
            .addRoleOption(option => 
                option.setName('supervisor-role').setDescription('رتبة الإشراف العامة التنفيذية').setRequired(true))
            .addRoleOption(option => 
                option.setName('verified-role').setDescription('رتبة التفعيل التي ستُمنح للعضو عند القبول').setRequired(true))
            .addRoleOption(option => 
                option.setName('unverified-role').setDescription('رتبة الانتظار/المؤقتة التي ستُزال عن العضو عند القبول').setRequired(true))
            .addChannelOption(option => 
                option.setName('log-channel').setDescription('روم السجلات (Log)').setRequired(true))
            .addChannelOption(option => 
                option.setName('category-tickets').setDescription('قسم (Category) التذاكر').setRequired(true))
            .addStringOption(option => 
                option.setName('server-decoration').setDescription('زخرفة أو اسم السيرفر لتخصيص البنر والرسائل').setRequired(true)),
        new SlashCommandBuilder()
            .setName('setup-verify')
            .setDescription('إرسال بنر فتح تذكرة التفعيل الإداري في الروم الحالي'),
        new SlashCommandBuilder()
            .setName('set-banner')
            .setDescription('تخصيص عنوان ووصف بنر التفعيل الخاص بسيرفرك')
            .addStringOption(option => option.setName('title').setDescription('عنوان البنر الجديد').setRequired(true))
            .addStringOption(option => option.setName('description').setDescription('وصف البنر الجديد').setRequired(true)),
        new SlashCommandBuilder()
            .setName('set-ticket-embed')
            .setDescription('تخصيص رسالة الإمبد التي تظهر داخل التذكرة عند فتحها')
            .addStringOption(option => option.setName('text').setDescription('النص الجديد داخل إمبد التذكرة').setRequired(true)),
        new SlashCommandBuilder()
            .setName('set-button-text')
            .setDescription('تخصيص نص زر فتح التذكرة في البنر الأساسي')
            .addStringOption(option => option.setName('text').setDescription('نص الزر الجديد').setRequired(true)),
        new SlashCommandBuilder()
            .setName('set-question')
            .setDescription('إضافة أو تعديل أحد الأسئلة (من 1 إلى 10)')
            .addIntegerOption(option => 
                option.setName('number').setDescription('رقم السؤال (من 1 إلى 10)').setRequired(true).setMinValue(1).setMaxValue(10))
            .addStringOption(option => 
                option.setName('text').setDescription('نص السؤال').setRequired(true))
            .addStringOption(option => 
                option.setName('condition')
                .setDescription('شرط السؤال')
                .setRequired(true)
                .addChoices(
                    { name: 'عربي فقط', value: 'arabic' },
                    { name: 'إنجليزي فقط', value: 'english' },
                    { name: 'أرقام فقط', value: 'numbers' },
                    { name: 'صورة فقط', value: 'image' },
                    { name: 'مطابقة الحلف', value: 'oath' }
                )),
        new SlashCommandBuilder()
            .setName('pointict')
            .setDescription('عرض نقاط الفريق الإداري في تذاكر التفعيل'),
        new SlashCommandBuilder()
            .setName('restpointict')
            .setDescription('تصفير نقاط الفريق الإداري بالكامل في هذا السيرفر')
    ];

    const botToken = process.env.DISCORD_TOKEN || process.env.TOKEN;
    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('تم تسجيل أوامر السلاش بنجاح! 🚀');
    } catch (error) {
        console.error('خطأ في تسجيل أوامر السلاش:', error);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const ticketData = activeTickets.get(message.channel.id);
    if (ticketData && message.author.id === ticketData.userId) {
        if (ticketData.timer) {
            clearTimeout(ticketData.timer);
            ticketData.timer = null;
            await message.channel.send("تم الغاء نظام التنبيه ⚠");
        }

        const config = getGuildConfig(message.guild.id);
        if (!config || !config.questions) return;
        const questions = config.questions;

        const questionKeys = Object.keys(questions).map(Number).sort((a, b) => a - b);
        if (questionKeys.length === 0) return;

        const currentStepIndex = questionKeys.indexOf(ticketData.currentStepNumber);
        if (currentStepIndex === -1) return;

        const currentQNum = questionKeys[currentStepIndex];
        const currentQData = questions[currentQNum];

        // التحقق من الشروط بناءً على ما حدده المشرف
        if (currentQData.condition === 'arabic') {
            if (!/^[\u0600-\u06FF0-9\s\p{P}]+$/u.test(message.content)) {
                return message.reply("خطأ! يرجى إدخال أحرف عربية فقط ❌");
            }
        } else if (currentQData.condition === 'english') {
            if (!/^[A-Za-z0-9_\s\p{P}]+$/.test(message.content)) {
                return message.reply("خطأ! يرجى إدخال أحرف إنجليزية فقط ❌");
            }
        } else if (currentQData.condition === 'numbers') {
            if (isNaN(message.content)) {
                return message.reply("خطأ! يرجى إرسال أرقام فقط ❌");
            }
        } else if (currentQData.condition === 'image') {
            const attachment = message.attachments.first();
            if (!attachment) {
                return message.reply("خطأ! يجب إرسال صورة حصرياً ❌");
            }
            ticketData.answers[currentQNum] = attachment.url;
        } else if (currentQData.condition === 'oath') {
            const name1 = ticketData.answers[questionKeys[0]]; // السؤال الأول هو المرجع للاسم
            let template = currentQData.text;

            let expectedRaw = template
                .replace(/الاسم/g, name1)
                .replace(/\(الاسم\)/g, name1)
                .replace(/\[الاسم\]/g, name1);

            const cleanText = (str) => {
                return str
                    .replace(/[إأآٱ]/g, 'ا')
                    .replace(/ة/g, 'ه')
                    .replace(/[()\[\]{}""''«»]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            const userClean = cleanText(message.content);
            const expectedClean = cleanText(expectedRaw);
            
            if (userClean !== expectedClean) {
                return message.reply("خطأ! يرجى كتابة نص الحلف بشكل صحيح مع وضع اسمك تماماً بين الأقواس كما طلب منك ❌");
            }
            ticketData.answers[currentQNum] = message.content;
        }

        if (currentQData.condition !== 'image' && currentQData.condition !== 'oath') {
            ticketData.answers[currentQNum] = message.content;
        }

        // الانتقال للسؤال التالي أو إنهاء الأسئلة
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < questionKeys.length) {
            const nextQNum = questionKeys[nextIndex];
            ticketData.currentStepNumber = nextQNum;
            const nextQData = questions[nextQNum];
            
            let qText = nextQData.text;
            if (nextQData.condition === 'oath') {
                const name1 = ticketData.answers[questionKeys[0]];
                qText = qText.replace(/الاسم/g, name1).replace(/\(الاسم\)/g, name1).replace(/\[الاسم\]/g, name1);
            }
            await message.channel.send(`**السؤال ${nextIndex + 1}/${questionKeys.length}:**\n${qText}`);
        } else {
            ticketData.currentStepNumber = null;

            let reviewDesc = "";
            for (const qNum of questionKeys) {
                const ans = ticketData.answers[qNum];
                const isImg = questions[qNum].condition === 'image';
                reviewDesc += `سؤال ${qNum} : ${isImg ? `[صورة](${ans})` : ans}\n`;
            }

            const reviewEmbed = new EmbedBuilder()
                .setColor(0x00FFFF)
                .setTitle(`قبول ✅ أو رفض ❌ طلب التفعيل - ${config.serverDecoration || ''}`)
                .setDescription(reviewDesc);

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accept_ticket').setLabel('قبول الطلب ✅️').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('reject_ticket').setLabel('رفض الطلب ❌').setStyle(ButtonStyle.Danger)
            );

            await message.channel.send({
                content: `انتهى العضو من كافة الأسئلة التفاعلية! ينتظر قرار الإدارة:`,
                embeds: [reviewEmbed],
                components: [actionRow]
            });
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;

    if (interaction.isChatInputCommand()) {
        const { commandName, member, guild, channel } = interaction;

        if (commandName === 'set-system') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر لأصحاب الصلاحيات (Administrator) فقط! ❌", ephemeral: true });
            }

            const staffRole = interaction.options.getRole('staff-role');
            const supervisorRole = interaction.options.getRole('supervisor-role');
            const verifiedRole = interaction.options.getRole('verified-role');
            const unverifiedRole = interaction.options.getRole('unverified-role');
            const logChannel = interaction.options.getChannel('log-channel');
            const categoryTickets = interaction.options.getChannel('category-tickets');
            const serverDecoration = interaction.options.getString('server-decoration');

            saveGuildConfig(guild.id, {
                staffRoleId: staffRole.id,
                supervisorRoleId: supervisorRole.id,
                verifiedRoleId: verifiedRole.id,
                unverifiedRoleId: unverifiedRole.id,
                logChannelId: logChannel.id,
                categoryTicketsId: categoryTickets.id,
                serverDecoration: serverDecoration
            });

            return interaction.reply({ 
                content: `تم حفظ إعدادات السيرفر العامة بنجاح! ✅\n- زخرفة السيرفر: **${serverDecoration}**`, 
                ephemeral: true 
            });
        }

        if (commandName === 'set-banner') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للإدارة فقط! ❌", ephemeral: true });
            }

            saveGuildConfig(guild.id, {
                bannerTitle: interaction.options.getString('title'),
                bannerDesc: interaction.options.getString('description')
            });

            return interaction.reply({ content: "تم تحديث بنر التفعيل بنجاح! ✅", ephemeral: true });
        }

        if (commandName === 'set-ticket-embed') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للإدارة فقط! ❌", ephemeral: true });
            }
            saveGuildConfig(guild.id, { ticketEmbedText: interaction.options.getString('text') });
            return interaction.reply({ content: "تم تحديث نص إمبد فتح التذكرة بنجاح! ✅", ephemeral: true });
        }

        if (commandName === 'set-button-text') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للإدارة فقط! ❌", ephemeral: true });
            }
            saveGuildConfig(guild.id, { verifyButtonText: interaction.options.getString('text') });
            return interaction.reply({ content: "تم تحديث نص زر فتح التذكرة بنجاح! ✅", ephemeral: true });
        }

        if (commandName === 'set-question') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للإدارة فقط! ❌", ephemeral: true });
            }

            const qNum = interaction.options.getInteger('number');
            const qText = interaction.options.getString('text');
            const qCond = interaction.options.getString('condition');

            const config = getGuildConfig(guild.id) || {};
            const currentQuestions = config.questions || {};
            currentQuestions[qNum] = { text: qText, condition: qCond };

            saveGuildConfig(guild.id, { questions: currentQuestions });

            return interaction.reply({ content: `تم حفظ السؤال رقم (${qNum}) بنجاح مع شرط (${qCond})! ✅`, ephemeral: true });
        }

        if (commandName === 'setup-verify') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للإدارة فقط! ❌", ephemeral: true });
            }

            const config = getGuildConfig(guild.id);
            if (!config || !config.staffRoleId) {
                return interaction.reply({ content: "تنبيه! لم يتم ضبط إعدادات السيرفر بعد. يرجى استخدام أمر `/set-system` أولاً ⚠️", ephemeral: true });
            }

            if (!config.questions || Object.keys(config.questions).length === 0) {
                return interaction.reply({ content: "خطأ! لا توجد أي أسئلة مضافة. يرجى إضافة الأسئلة أولاً عبر أمر `/set-question` قبل إرسال البنر ❌", ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const decoration = config.serverDecoration ? `[ ${config.serverDecoration} ]` : "";
            const embedTitle = config.bannerTitle || `من هنا يمكنكم التفعيل معنا 💞 ${decoration}`;
            const embedDesc = config.bannerDesc || "فتح تذكرة لتقديم على رتبة التفعيل 🎮";

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(embedTitle)
                .setDescription(embedDesc);

            const buttonLabel = config.verifyButtonText || 'فتح تذكرة تفعيل ✅️';
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Success)
            );

            await channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: "تم إرسال بنر التفعيل بنجاح! ✅" });
        }

        if (commandName === 'pointict') {
            const config = getGuildConfig(guild.id);
            if (!config || !config.staffRoleId) {
                return interaction.reply({ content: "عذراً، لم يتم إعداد البوت في هذا السيرفر ❌", ephemeral: true });
            }
            
            const sortedPoints = [...staffPoints.entries()].sort((a, b) => b[1] - a[1]);
            let desc = sortedPoints.length > 0 
                ? sortedPoints.map(([id, pts], index) => `${index + 1} <@${id}> : ${pts}`).join('\n')
                : 'لا توجد نقاط مسجلة حتى الآن.';

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`نقاط تذكرة التفعيل - ${config.serverDecoration || ''}`)
                .setDescription(desc);

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'restpointict') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للإدارة فقط! ❌", ephemeral: true });
            }
            staffPoints.clear();
            return interaction.reply({ content: "تم تصفير جميع نقاط الفريق الإداري بنجاح! 🔄", ephemeral: true });
        }
    }

    if (!interaction.isButton()) return;

    const { customId, channel, guild, member, user } = interaction;
    const config = getGuildConfig(guild.id);

    if (!config || !config.staffRoleId) {
        return interaction.reply({ content: "عذراً، لم يقم صاحب السيرفر بإعداد البوت بعد ❌", ephemeral: true });
    }

    // نظام حماية السبام للأزرار (Cooldown)
    const cooldownKey = `${user.id}_${customId}`;
    const now = Date.now();
    if (buttonCooldowns.has(cooldownKey)) {
        const expirationTime = buttonCooldowns.get(cooldownKey);
        if (now < expirationTime) {
            const timeLeft = Math.ceil((expirationTime - now) / 1000);
            return interaction.reply({ content: `الرجاء الانتظار ${timeLeft} ثانية قبل استخدام هذا الزر مرة أخرى لتجنب السبام ⚠️`, ephemeral: true });
        }
    }
    buttonCooldowns.set(cooldownKey, now + 15000); // 15 ثانية كوداون

    if (customId === 'open_ticket') {
        if (!config.questions || Object.keys(config.questions).length === 0) {
            return interaction.reply({ content: "عذراً، لم تقم الإدارة بإضافة أسئلة التفعيل بعد! ❌", ephemeral: true });
        }

        const existingTicket = [...activeTickets.values()].find(t => t.userId === user.id && t.guildId === guild.id);
        if (existingTicket) {
            return interaction.reply({ content: "عذراً، لديك تذكرة تفعيل مفتوحة مسبقاً! ❌", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const ticketName = `ticket-${user.username}`;
        
        const overwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: config.staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] },
            { id: config.supervisorRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ];

        const ticketChannel = await guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: config.categoryTicketsId,
            permissionOverwrites: overwrites,
        });

        const ticketMsgText = config.ticketEmbedText || "انت الان بـ الأسئلة التفاعلية لـ التفعيل قم بـ الإجابة عليها 💞.";
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`تم فتح تذكرة تفعيل ✅ - ${config.serverDecoration || ''}`)
            .setDescription(ticketMsgText);

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

        const questionKeys = Object.keys(config.questions).map(Number).sort((a, b) => a - b);

        activeTickets.set(ticketChannel.id, {
            guildId: guild.id,
            userId: user.id,
            currentStepNumber: questionKeys[0],
            answers: {},
            claimedBy: null,
            timer: null
        });

        const firstQ = config.questions[questionKeys[0]];
        await ticketChannel.send(`<@${user.id}> **السؤال 1/${questionKeys.length}:**\n${firstQ.text}`);

        return interaction.editReply({ content: `تم فتح تذكرتك بنجاح هنا: <#${ticketChannel.id}> 🎟` });
    }

    if (customId === 'claim_ticket') {
        if (!member.roles.cache.has(config.staffRoleId) && !member.roles.cache.has(config.supervisorRoleId)) {
            return interaction.reply({ content: "هذا الزر خاص بالفريق الإداري والمشرفين فقط! ❌", ephemeral: true });
        }

        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            return interaction.reply({ content: `تم استلام هذه التذكرة مسبقاً من قِبل الإداري <@${ticketData.claimedBy}>! ⚠️`, ephemeral: true });
        }

        if (ticketData) ticketData.claimedBy = user.id;

        await channel.permissionOverwrites.edit(config.staffRoleId, { SendMessages: true, ViewChannel: true }).catch(() => {});
        await channel.permissionOverwrites.edit(user.id, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => {});

        const currentPoints = staffPoints.get(user.id) || 0;
        staffPoints.set(user.id, currentPoints + 1);

        await channel.send({
            content: `تم استلام التذكرة بنجاح ! ✅️\nالإداري المستلم : <@${user.id}> (يوزر: \`${user.tag}\`, أيدي: \`${user.id}\`)\nتم منح الإداري نقطة واحدة ( +1 ) ✔\nإجمالي نقاطك الحالية = ${currentPoints + 1} 📊`
        });

        return interaction.reply({ content: "تم استلام التذكرة بنجاح وتسجيل النقطة لك.", ephemeral: true });
    }

    if (customId === 'close_ticket') {
        if (!member.roles.cache.has(config.staffRoleId) && !member.roles.cache.has(config.supervisorRoleId)) {
            return interaction.reply({ content: "هذا الزر خاص بالفريق الإداري والمشرفين فقط! ❌", ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('delete_ticket_confirm').setLabel('حذف التذكرة 🗑').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('leave_ticket').setLabel('ترك التذكرة 🚫').setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ content: "اختر إجراء الإغلاق:", components: [row] });
        return interaction.reply({ content: "تم إرسال خيارات الإغلاق.", ephemeral: true });
    }

    if (customId === 'leave_ticket') {
        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy === user.id) {
            ticketData.claimedBy = null;
            const currentPoints = staffPoints.get(user.id) || 1;
            staffPoints.set(user.id, Math.max(0, currentPoints - 1));

            await channel.permissionOverwrites.edit(config.staffRoleId, { SendMessages: false, ViewChannel: true }).catch(() => {});
            await channel.permissionOverwrites.delete(user.id).catch(() => {});

            await channel.send(`**ترك التذكرة 🚫**\nالإداري المستلم ترك التذكرة <@${user.id}>\nتم خصم نقطة واحدة منك.`);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة ✅️').setStyle(ButtonStyle.Success)
            );
            await channel.send({ content: `<@&${config.staffRoleId}>\nالرجاء الاستلام`, components: [row] });
        }
        return interaction.reply({ content: "تم ترك التذكرة.", ephemeral: true });
    }

    if (customId === 'delete_ticket_confirm') {
        const ticketData = activeTickets.get(channel.id);
        const ownerId = ticketData ? ticketData.userId : 'غير معروف';
        
        activeTickets.delete(channel.id);
        await channel.send(`حذف التذكرة 🗑\nحذفت التذكرة بواسطة: <@${user.id}> (يوزر: \`${user.tag}\`, أيدي: \`${user.id}\`) | صاحب التذكرة الأساسي ID: \`${ownerId}\`\nسيتم حذف الروم...`);
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
            activeTickets.delete(channel.id);
            await channel.send("انتهت المدة ولم يتم الرد، سيتم حذف التذكرة تلقائياً.");
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }, 5 * 60 * 1000);

        ticketData.timer = timer;
        return interaction.reply({ content: "تم تفعيل التنبيه.", ephemeral: true });
    }

    if (customId === 'opt_summon') {
        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            await channel.send(`استدعاء الاداري ☑\nتم استدعاء الإداري المسؤول <@${ticketData.claimedBy}>`);
        } else {
            await channel.send(`استدعاء الاداري ☑️\n<@&${config.staffRoleId}> الرجاء الرد على التذكرة!`);
        }
        return interaction.reply({ content: "تم الاستدعاء بنجاح.", ephemeral: true });
    }

    if (customId === 'accept_ticket' || customId === 'reject_ticket') {
        if (!member.roles.cache.has(config.staffRoleId) && !member.roles.cache.has(config.supervisorRoleId)) {
            return interaction.reply({ content: "عذراً، أزرار القبول والرفض خاصة بالفريق الإداري والمشرفين فقط! ❌", ephemeral: true });
        }

        const ticketData = activeTickets.get(channel.id);
        if (!ticketData) return;

        const isAccepted = customId === 'accept_ticket';

        if (isAccepted) {
            try {
                const targetMember = await guild.members.fetch(ticketData.userId);
                if (targetMember) {
                    if (config.verifiedRoleId) await targetMember.roles.add(config.verifiedRoleId).catch(() => {});
                    if (config.unverifiedRoleId) await targetMember.roles.remove(config.unverifiedRoleId).catch(() => {});
                }
            } catch (err) {
                console.log("Role update error:", err);
            }
            await channel.send("تم قبول الطلب ✅ وتحويل الرتب بنجاح. سيتم إغلاق التذكرة خلال لحظات...");
        } else {
            await channel.send("تم رفض الطلب ❌. سيتم إغلاق التذكرة...");
        }

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
                
                let answersText = "";
                for (const [qNum, ans]  of Object.entries(ticketData.answers)) {
                    answersText += `السؤال ${qNum} : ${ans.startsWith('http') ? `[صورة](${ans})` : ans}\n`;
                }

                const logEmbed = new EmbedBuilder()
                    .setColor(isAccepted ? 0x00FF00 : 0xFF0000)
                    .setTitle(`سجل ${isAccepted ? 'قبول' : 'رفض'} تفعيل - ${config.serverDecoration || ''}`)
                    .setDescription(
                        `**الإداري المسؤول:** <@${user.id}> (يوزر: \`${user.tag}\`, أيدي: \`${user.id}\`)\n` +
                        `**العضو صاحب التذكرة:** <@${ticketData.userId}> (أيدي: \`${ticketData.userId}\`)\n` +
                        `**حذفت أو أغلقت بواسطة:** <@${user.id}> (\`${user.tag}\`)\n` +
                        `**التاريخ والوقت:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        `**الإجابات:**\n${answersText}`
                    );

                await logChan.send({ embeds: [logEmbed] });
            }
        }

        activeTickets.delete(channel.id);
        setTimeout(() => channel.delete().catch(() => {}), 10000);
        return interaction.reply({ content: `تم ${isAccepted ? 'قبول' : 'رفض'} التفعيل بنجاح.`, ephemeral: true });
    }
});

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
client.login(token);
