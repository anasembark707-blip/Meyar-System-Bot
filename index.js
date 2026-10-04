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
    res.send('Abu Ghamdah Unified System Bot is alive and running! 🚀');
});

app.listen(PORT, () => {
    console.log(`Web server is listening on port ${PORT}`);
});

const dbPath = path.join(__dirname, 'database.json');

const defaultQuestions = {
    1: "ما هو اسمك؟",
    2: "عمرك؟ (اجباري أرقام فقط)",
    3: "يوزرك روبلوكس؟ (إنجليزي فقط - سيتم ربطه بزخرفة السيرفر)",
    4: "صورة بروفايلك روبلوكس؟ (أرسل صورة)",
    5: "صورة دخولك القروب؟\nرابط قروبنا (16) 📎 : [اضغط هنا](https://www.roblox.com/share/g/387192545)\n(أرسل صورة إثبات الدخول)",
    6: "الحلف:\nانا اقر (الاسم) واقسم بالله اني ما اخرب اي رول وما استخدم اي رتبه ل تشويه سمعة السيرفر وما استخدم اي صلاحية لضرر أو لمصالح شخصية\n*(يرجى كتابة الحلف بالنص تماماً مع وضع اسمك بين أقواس)*"
};

function getGuildConfig(guildId) {
    if (!fs.existsSync(dbPath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const config = data[guildId] || null;
        if (config && !config.questions) {
            config.questions = { ...defaultQuestions };
        }
        return config;
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
        questions: newConfig.questions || (data[guildId] && data[guildId].questions) || { ...defaultQuestions },
        generalButtons: newConfig.generalButtons || (data[guildId] && data[guildId].generalButtons) || []
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
const activeGeneralTickets = new Map();

process.on('uncaughtException', error => {
    console.error('An uncaught exception occurred:', error);
});

process.on('unhandledRejection', error => {
    console.error('An unhandled promise rejection occurred:', error);
});

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح باسم ${client.user.tag}! البوت الموحد جاهز.`);

    client.user.setPresence({
        activities: [{ name: 'Unified System by ابو غمده', type: ActivityType.Watching }],
        status: 'online',
    });

    const commands = [
        // أوامر التفعيل والأسئلة
        new SlashCommandBuilder()
            .setName('set-system')
            .setDescription('إعدادات بوت التفعيل الأساسية للسيرفر')
            .addRoleOption(option => option.setName('staff-role').setDescription('رتبة الفريق الإداري لتذاكر التفعيل').setRequired(true))
            .addRoleOption(option => option.setName('supervisor-role').setDescription('رتبة الإشراف العامة').setRequired(true))
            .addRoleOption(option => option.setName('verified-role').setDescription('رتبة التفعيل الممنوحة عند القبول').setRequired(true))
            .addRoleOption(option => option.setName('unverified-role').setDescription('رتبة الانتظار المُزالة عند القبول').setRequired(true))
            .addChannelOption(option => option.setName('log-channel').setDescription('روم سجلات التفعيل').setRequired(true))
            .addChannelOption(option => option.setName('category-tickets').setDescription('قسم تذاكر التفعيل').setRequired(true))
            .addStringOption(option => option.setName('server-decoration').setDescription('زخرفة السيرفر (مثال: MR)').setRequired(true)),
        new SlashCommandBuilder()
            .setName('setup-verify')
            .setDescription('إرسال بنر تذكرة التفعيل التفاعلي في الروم الحالي'),
        new SlashCommandBuilder()
            .setName('set-banner')
            .setDescription('تخصيص عنوان ووصف بنر التفعيل')
            .addStringOption(option => option.setName('title').setDescription('عنوان البنر الجديد').setRequired(true))
            .addStringOption(option => option.setName('description').setDescription('وصف البنر الجديد').setRequired(true)),
        new SlashCommandBuilder()
            .setName('set-ticket-embed')
            .setDescription('تخصيص رسالة الإمبد داخل تذكرة التفعيل')
            .addStringOption(option => option.setName('text').setDescription('النص الجديد').setRequired(true)),
        new SlashCommandBuilder()
            .setName('set-button-text')
            .setDescription('تخصيص نص زر فتح تذكرة التفعيل')
            .addStringOption(option => option.setName('text').setDescription('نص الزر الجديد').setRequired(true)),
        new SlashCommandBuilder()
            .setName('set-question')
            .setDescription('تعديل نص أحد الأسئلة الستة للتفعيل')
            .addIntegerOption(option => option.setName('number').setDescription('رقم السؤال (1 إلى 6)').setRequired(true).setMinValue(1).setMaxValue(6))
            .addStringOption(option => option.setName('text').setDescription('نص السؤال الجديد').setRequired(true)),
        new SlashCommandBuilder()
            .setName('pointict')
            .setDescription('عرض نقاط الفريق الإداري لتذاكر التفعيل'),
        new SlashCommandBuilder()
            .setName('restpointict')
            .setDescription('تصفير نقاط الفريق الإداري لتذاكر التفعيل'),

        // أوامر التذاكر العامة الجديدة كلياً
        new SlashCommandBuilder()
            .setName('set-general-system')
            .setDescription('إعدادات نظام التذاكر العامة الجديد')
            .addRoleOption(option => option.setName('general-staff').setDescription('رتبة الفريق الإداري المسؤول عن التذاكر العامة').setRequired(true))
            .addChannelOption(option => option.setName('general-category').setDescription('قسم (Category) التذاكر العامة').setRequired(true))
            .addChannelOption(option => option.setName('general-log').setDescription('روم سجلات (Log) التذاكر العامة').setRequired(true)),
        new SlashCommandBuilder()
            .setName('add-general-button')
            .setDescription('إضافة زر جديد لقائمة التذاكر العامة')
            .addStringOption(option => option.setName('id').setDescription('معرف فريد للزر بالإنجليزية (مثال: support)').setRequired(true))
            .addStringOption(option => option.setName('label').setDescription('نص الزر الظاهر (مثال: الدعم الفني 🛠️️)').setRequired(true))
            .addStringOption(option => option.setName('title').setDescription('عنوان الإمبد عند فتح هذه التذكرة').setRequired(true)),
        new SlashCommandBuilder()
            .setName('setup-general-tickets')
            .setDescription('إرسال بنر التذاكر العامة مع الأزرار المضافة في الروم الحالي')
            .addStringOption(option => option.setName('banner-title').setDescription('عنوان بنر التذاكر العامة').setRequired(true))
            .addStringOption(option => option.setName('banner-desc').setDescription('وصف بنر التذاكر العامة').setRequired(true))
    ];

    const botToken = process.env.DISCORD_TOKEN || process.env.TOKEN;
    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('تم تسجيل أوامر السلاش الموحدة بنجاح! 🚀');
    } catch (error) {
        console.error('خطأ في تسجيل أوامر السلاش:', error);
    }
});

// استقبال رسائل التفعيل التفاعلية
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const ticketData = activeTickets.get(message.channel.id);
    if (ticketData && message.author.id === ticketData.userId) {
        if (ticketData.timer) {
            clearTimeout(ticketData.timer);
            ticketData.timer = null;
            await message.channel.send("تم الغاء نظام التنبيه ⚠");
        }

        const step = ticketData.step;
        const config = getGuildConfig(message.guild.id);
        if (!config) return;
        const questions = config.questions || defaultQuestions;

        if (step === 1) {
            ticketData.answers[1] = message.content;
            ticketData.step = 2;
            await message.channel.send(`**السؤال 2/6:** ${questions[2]}`);
        } else if (step === 2) {
            if (isNaN(message.content)) {
                return message.reply("خطأ! عيد أرسل أرقام فقط ❌");
            }
            ticketData.answers[2] = message.content;
            ticketData.step = 3;
            await message.channel.send(`**السؤال 3/6:** ${questions[3]}`);
        } else if (step === 3) {
            if (!/^[A-Za-z0-9_]+$/.test(message.content)) {
                return message.reply("خطأ! يرجى إدخال أحرف إنجليزية وأرقام فقط ❌");
            }
            ticketData.answers[3] = message.content;
            ticketData.step = 4;
            await message.channel.send(`**السؤال 4/6:** ${questions[4]}`);
        } else if (step === 4) {
            const attachment = message.attachments.first();
            if (!attachment) {
                return message.reply("خطأ! يجب إرسال صورة بروفايلك ❌");
            }
            ticketData.answers[4] = attachment.url;
            ticketData.step = 5;
            await message.channel.send(`**السؤال 5/6:** ${questions[5]}`);
        } else if (step === 5) {
            const attachment = message.attachments.first();
            if (!attachment) {
                return message.reply("خطأ! يجب إرسال صورة إثبات دخول القروب ❌");
            }
            ticketData.answers[5] = attachment.url;
            ticketData.step = 6;
            
            const name1 = ticketData.answers[1];
            let q6Text = questions[6]
                .replace(/الاسم/g, name1)
                .replace(/\(الاسم\)/g, name1)
                .replace(/\[الاسم\]/g, name1);
            await message.channel.send(`**السؤال 6/6:**\n${q6Text}`);
        } else if (step === 6) {
            const name1 = ticketData.answers[1];
            let template = questions[6];

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
                return message.reply("خطأ! يرجى كتابة نص الحلف بشكل صحيح مع وضع اسمك تماماً كما طلب منك ❌");
            }

            ticketData.answers[6] = message.content;
            ticketData.step = 7;

            const decoration = config.serverDecoration ? `[ ${config.serverDecoration} ]` : "";
            const reviewEmbed = new EmbedBuilder()
                .setColor(0x00FFFF)
                .setTitle(`قبول ✅ أو رفض ❌ طلب التفعيل - ${decoration} | يوزر روبلوكس: ${ticketData.answers[3]}`)
                .setDescription(
                    `١ الإجابة : ${ticketData.answers[1]}\n` +
                    `٢ الإجابة : ${ticketData.answers[2]}\n` +
                    `٣ الإجابة (روبلوكس): ${ticketData.answers[3]}\n` +
                    `٤ الإجابة : [صورة بروفايل](${ticketData.answers[4]})\n` +
                    `٥ الإجابة : [صورة القروب](${ticketData.answers[5]})\n` +
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
    if (!interaction.guild) return;

    if (interaction.isChatInputCommand()) {
        const { commandName, member, guild, channel } = interaction;

        // إعدادات نظام التفعيل
        if (commandName === 'set-system') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "عذراً، هذا الأمر للأصحاب الصلاحيات (Administrator) فقط! ❌", ephemeral: true });
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
                content: `تم حفظ إعدادات التفعيل بنجاح! ✅\n- زخرفة السيرفر (MR): **${serverDecoration}**`, 
                ephemeral: true 
            });
        }

        if (commandName === 'set-banner') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            saveGuildConfig(guild.id, { bannerTitle: interaction.options.getString('title'), bannerDesc: interaction.options.getString('description') });
            return interaction.reply({ content: "تم تحديث بنر التفعيل بنجاح! ✅", ephemeral: true });
        }

        if (commandName === 'set-ticket-embed') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            saveGuildConfig(guild.id, { ticketEmbedText: interaction.options.getString('text') });
            return interaction.reply({ content: "تم تحديث إمبد تذكرة التفعيل بنجاح! ✅", ephemeral: true });
        }

        if (commandName === 'set-button-text') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            saveGuildConfig(guild.id, { verifyButtonText: interaction.options.getString('text') });
            return interaction.reply({ content: "تم تحديث زر تذكرة التفعيل بنجاح! ✅", ephemeral: true });
        }

        if (commandName === 'set-question') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            const qNum = interaction.options.getInteger('number');
            const config = getGuildConfig(guild.id) || {};
            const questions = config.questions || { ...defaultQuestions };
            questions[qNum] = interaction.options.getString('text');
            saveGuildConfig(guild.id, { questions });
            return interaction.reply({ content: `تم تحديث السؤال (${qNum}) بنجاح! ✅`, ephemeral: true });
        }

        if (commandName === 'setup-verify') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            const config = getGuildConfig(guild.id);
            if (!config || !config.staffRoleId) return interaction.reply({ content: "يرجى استخدام `/set-system` أولاً ⚠️", ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            const decoration = config.serverDecoration ? `[ ${config.serverDecoration} ]` : "";
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(config.bannerTitle || `من هنا يمكنكم التفعيل معنا 💞 ${decoration}`)
                .setDescription(config.bannerDesc || "اضغط على الزر أدناه لبدء تذكرة التفعيل التفاعلية.");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket').setLabel(config.verifyButtonText || 'فتح تذكرة تفعيل ✅️').setStyle(ButtonStyle.Success)
            );
            await channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: "تم إرسال بنر التفعيل بنجاح! ✅" });
        }

        // إعدادات نظام التذاكر العامة الجديد كلياً
        if (commandName === 'set-general-system') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            const generalStaff = interaction.options.getRole('general-staff');
            const generalCategory = interaction.options.getChannel('general-category');
            const generalLog = interaction.options.getChannel('general-log');

            saveGuildConfig(guild.id, {
                generalStaffRoleId: generalStaff.id,
                generalCategoryId: generalCategory.id,
                generalLogId: generalLog.id
            });

            return interaction.reply({ content: `تم إعداد نظام التذاكر العامة بنجاح! ✅\n- فريق الإدارة العام: <@&${generalStaff.id}>\n- روم اللوج العام: <#${generalLog.id}>`, ephemeral: true });
        }

        if (commandName === 'add-general-button') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            const btnId = interaction.options.getString('id');
            const label = interaction.options.getString('label');
            const title = interaction.options.getString('title');

            const config = getGuildConfig(guild.id) || {};
            const buttons = config.generalButtons || [];
            buttons.push({ id: btnId, label, title });
            saveGuildConfig(guild.id, { generalButtons: buttons });

            return interaction.reply({ content: `تم إضافة زر التذكرة العامة (${label}) بنجاح! ✅`, ephemeral: true });
        }

        if (commandName === 'setup-general-tickets') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            const config = getGuildConfig(guild.id);
            if (!config || !config.generalCategoryId) return interaction.reply({ content: "يرجى استخدام `/set-general-system` أولاً ⚠️", ephemeral: true });

            const buttonsList = config.generalButtons || [];
            if (buttonsList.length === 0) return interaction.reply({ content: "لم تقم بإضافة أي أزرار بعد! استخدم `/add-general-button` أولاً ❌", ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            const bannerTitle = interaction.options.getString('banner-title');
            const bannerDesc = interaction.options.getString('banner-desc');
            const decoration = config.serverDecoration ? `[ ${config.serverDecoration} ]` : "";

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${bannerTitle} - ${decoration}`)
                .setDescription(bannerDesc);

            const row = new ActionRowBuilder();
            buttonsList.forEach(b => {
                row.addComponents(
                    new ButtonBuilder().setCustomId(`gen_ticket_${b.id}`).setLabel(b.label).setStyle(ButtonStyle.Primary)
                );
            });

            await channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: "تم إرسال بنر التذاكر العامة بنجاح! ✅" });
        }

        if (commandName === 'pointict') {
            const config = getGuildConfig(guild.id);
            if (!config) return interaction.reply({ content: "لم يتم الإعداد ❌", ephemeral: true });
            const sortedPoints = [...staffPoints.entries()].sort((a, b) => b[1] - a[1]);
            let desc = sortedPoints.length > 0 ? sortedPoints.map(([id, pts], index) => `${index + 1} <@${id}> : ${pts}`).join('\n') : 'لا توجد نقاط.';
            const embed = new EmbedBuilder().setColor(0x00FF00).setTitle(`نقاط تذاكر التفعيل - ${config.serverDecoration || ''}`).setDescription(desc);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'restpointict') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
            staffPoints.clear();
            return interaction.reply({ content: "تم تصفير النقاط بنجاح! 🔄", ephemeral: true });
        }
    }

    if (!interaction.isButton()) return;

    const { customId, channel, guild, member, user } = interaction;
    const config = getGuildConfig(guild.id);
    if (!config) return interaction.reply({ content: "البوت غير معدّل في السيرفر ❌", ephemeral: true });

    // --- معالجة نظام التذاكر العامة الجديد كلياً ---
    if (customId.startsWith('gen_ticket_')) {
        const btnIdKey = customId.replace('gen_ticket_', '');
        const buttonsList = config.generalButtons || [];
        const btnConfig = buttonsList.find(b => b.id === btnIdKey);
        const btnTitle = btnConfig ? btnConfig.title : "تذكرة جديدة عامة";

        const existingGenTicket = [...activeGeneralTickets.values()].find(t => t.userId === user.id && t.guildId === guild.id);
        if (existingGenTicket) {
            return interaction.reply({ content: "عذراً، لديك تذكرة عامة مفتوحة مسبقاً! ❌", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // عداد تصاعدي تلقائي للتذاكر العامة
        if (!config.generalTicketCounter) config.generalTicketCounter = 0;
        config.generalTicketCounter++;
        saveGuildConfig(guild.id, { generalTicketCounter: config.generalTicketCounter });

        const ticketName = `ticket-${config.generalTicketCounter}`;
        const overwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: config.generalStaffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] }
        ];

        const genChannel = await guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: config.generalCategoryId,
            permissionOverwrites: overwrites
        });

        const decoration = config.serverDecoration ? `[ ${config.serverDecoration} ]` : "";
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`${btnTitle} - ${decoration}`)
            .setDescription(`أهلاً بك <@${user.id}> في تذكرتك العامة. اطرح مشكلتك أو استفسارك وسيتم الرد عليك قريباً.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gen_claim').setLabel('استلام التذكرة ✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('gen_options').setLabel('خيارات التذكرة ⚙️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gen_close').setLabel('إغلاق التذكرة ❌').setStyle(ButtonStyle.Danger)
        );

        await genChannel.send({ content: `<@&${config.generalStaffRoleId}> | <@${user.id}>`, embeds: [embed], components: [row] });

        activeGeneralTickets.set(genChannel.id, {
            guildId: guild.id,
            userId: user.id,
            claimedBy: null,
            createdAt: Math.floor(Date.now() / 1000)
        });

        return interaction.editReply({ content: `تم فتح تذكرتك بنجاح هنا: <#${genChannel.id}> 🎟` });
    }

    if (customId === 'gen_claim') {
        if (!member.roles.cache.has(config.generalStaffRoleId)) {
            return interaction.reply({ content: "هذا الزر خاص بفريق الإدارة العامة فقط! ❌", ephemeral: true });
        }
        const ticketData = activeGeneralTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            return interaction.reply({ content: `تم استلام هذه التذكرة مسبقاً بواسطة <@${ticketData.claimedBy}>! ⚠️`, ephemeral: true });
        }

        if (ticketData) ticketData.claimedBy = user.id;

        await channel.setName(`ticket-claimed-${user.username}`).catch(() => {});
        await channel.permissionOverwrites.edit(config.generalStaffRoleId, { SendMessages: true, ViewChannel: true }).catch(() => {});
        await channel.permissionOverwrites.edit(user.id, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => {});

        await channel.send({ content: `تم استلام التذكرة بنجاح من قِبل الإداري: <@${user.id}> (أيدي: \`${user.id}\`) ✅` });
        return interaction.reply({ content: "تم استلام التذكرة لك.", ephemeral: true });
    }

    if (customId === 'gen_options') {
        if (!member.roles.cache.has(config.generalStaffRoleId)) {
            return interaction.reply({ content: "هذا الزر للإدارة فقط! ❌", ephemeral: true });
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gen_rename').setLabel('تعديل اسم التذكرة ✏️').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ content: "خيارات التذكرة العامة المتقدمة:", components: [row], ephemeral: true });
    }

    if (customId === 'gen_rename') {
        if (!member.roles.cache.has(config.generalStaffRoleId)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
        await channel.setName(`ticket-support-${Date.now().toString().slice(-4)}`).catch(() => {});
        return interaction.reply({ content: "تم تغيير اسم التذكرة بنجاح! ✅", ephemeral: true });
    }

    if (customId === 'gen_close') {
        if (!member.roles.cache.has(config.generalStaffRoleId)) {
            return interaction.reply({ content: "هذا الزر للإدارة فقط! ❌", ephemeral: true });
        }

        const ticketData = activeGeneralTickets.get(channel.id);
        await channel.send("سيتم إغلاق التذكرة وحذفها وحفظ السجلات...");

        if (config.generalLogId) {
            const logChan = guild.channels.cache.get(config.generalLogId);
            if (logChan) {
                const decoration = config.serverDecoration ? `[ ${config.serverDecoration} ]` : "";
                const logEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`سجل إغلاق تذكرة عامة 📂 - ${decoration}`)
                    .setDescription(
                        `**حذفت بواسطة الإداري:** <@${user.id}> (أيدي: \`${user.id}\`)\n` +
                        `**عضو التذكرة:** <@${ticketData ? ticketData.userId : 'غير معروف'}>\n` +
                        `**الإداري المستلم:** ${ticketData && ticketData.claimedBy ? `<@${ticketData.claimedBy}>` : 'لم يتم الاستلام'}\n` +
                        `**تاريخ ووقت الإغلاق:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    );
                await logChan.send({ embeds: [logEmbed] });
            }
        }

        activeGeneralTickets.delete(channel.id);
        setTimeout(() => channel.delete().catch(() => {}), 3000);
        return interaction.reply({ content: "جاري حذف التذكرة.", ephemeral: true });
    }

    // --- معالجة نظام التفعيل القديم (أزرار التفعيل والقبول والرفض) ---
    if (customId === 'open_ticket') {
        const existingTicket = [...activeTickets.values()].find(t => t.userId === user.id && t.guildId === guild.id);
        if (existingTicket) return interaction.reply({ content: "عذراً، لديك تذكرة تفعيل مفتوحة مسبقاً! ❌", ephemeral: true });

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

        const decoration = config.serverDecoration ? `[ ${config.serverDecoration} ]` : "";
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`تم فتح تذكرة تفعيل ✅ - ${decoration}`)
            .setDescription(config.ticketEmbedText || "انت الان بـ الأسئلة التفاعلية لـ التفعيل قم بـ الإجابة عليها 💞.");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_options').setLabel('خيارات التذكرة ⚙').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة ❌️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة ✅').setStyle(ButtonStyle.Success)
        );

        await ticketChannel.send({ content: `<@&${config.staffRoleId}> | <@${user.id}>`, embeds: [embed], components: [row] });

        activeTickets.set(ticketChannel.id, { guildId: guild.id, userId: user.id, step: 1, answers: {}, claimedBy: null, timer: null });

        const questions = config.questions || defaultQuestions;
        await ticketChannel.send(`<@${user.id}> **السؤال 1/6:** ${questions[1]}`);

        return interaction.editReply({ content: `تم فتح تذكرتك بنجاح هنا: <#${ticketChannel.id}> 🎟` });
    }

    if (customId === 'claim_ticket') {
        if (!member.roles.cache.has(config.staffRoleId) && !member.roles.cache.has(config.supervisorRoleId)) {
            return interaction.reply({ content: "هذا الزر خاص بالفريق الإداري والمشرفين فقط! ❌", ephemeral: true });
        }
        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            return interaction.reply({ content: `تم الاستلام مسبقاً من قِبل <@${ticketData.claimedBy}>! ⚠️️`, ephemeral: true });
        }
        if (ticketData) ticketData.claimedBy = user.id;

        await channel.permissionOverwrites.edit(config.staffRoleId, { SendMessages: true, ViewChannel: true }).catch(() => {});
        await channel.permissionOverwrites.edit(user.id, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => {});

        const currentPoints = staffPoints.get(user.id) || 0;
        staffPoints.set(user.id, currentPoints + 1);

        await channel.send({ content: `تم استلام التذكرة بنجاح ! ✅️\nالإداري المستلم : <@${user.id}>\nألايدي : (\`${user.id}\`) 👤\nتم منح الإداري نقطة واحدة ( +1 ) ✔\nإجمالي نقاطك = ${currentPoints + 1} 📊` });
        return interaction.reply({ content: "تم الاستلام وتسجيل النقطة.", ephemeral: true });
    }

    if (customId === 'close_ticket') {
        if (!member.roles.cache.has(config.staffRoleId) && !member.roles.cache.has(config.supervisorRoleId)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
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
            await channel.send(`ترك الإداري <@${user.id}> التذكرة وتم خصم نقطة.`);
        }
        return interaction.reply({ content: "تم ترك التذكرة.", ephemeral: true });
    }

    if (customId === 'delete_ticket_confirm') {
        activeTickets.delete(channel.id);
        await channel.send("حذف التذكرة 🗑...");
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
        await channel.send(`تنبيه ⚠️ للعضو <@${ticketData.userId}>. إذا لم ترد خلال ٥ دقائق سيتم إغلاق التذكرة.`);
        const timer = setTimeout(async () => {
            activeTickets.delete(channel.id);
            await channel.send("انتهت المدة، سيتم حذف التذكرة.");
            setTimeout(() => channel.delete().catch(() => {}), 3000);
        }, 5 * 60 * 1000);
        ticketData.timer = timer;
        return interaction.reply({ content: "تم التفعيل.", ephemeral: true });
    }

    if (customId === 'opt_summon') {
        const ticketData = activeTickets.get(channel.id);
        if (ticketData && ticketData.claimedBy) {
            await channel.send(`استدعاء الاداري ☑️ <@${ticketData.claimedBy}>`);
        } else {
            await channel.send(`استدعاء الاداري ☑️ <@&${config.staffRoleId}> الرجاء الرد!`);
        }
        return interaction.reply({ content: "تم الاستدعاء.", ephemeral: true });
    }

    if (customId === 'accept_ticket') {
        if (!member.roles.cache.has(config.staffRoleId) && !member.roles.cache.has(config.supervisorRoleId)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
        const ticketData = activeTickets.get(channel.id);
        if (!ticketData) return;

        try {
            const targetMember = await guild.members.fetch(ticketData.userId);
            if (targetMember) {
                if (config.verifiedRoleId) await targetMember.roles.add(config.verifiedRoleId).catch(() => {});
                if (config.unverifiedRoleId) await targetMember.roles.remove(config.unverifiedRoleId).catch(() => {});
            }
        } catch (err) {}

        await channel.send("تم قبول الطلب ✅ وتحويل الرتب. سيتم إغلاق التذكرة...");
        activeTickets.delete(channel.id);
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return interaction.reply({ content: "تم القبول.", ephemeral: true });
    }

    if (customId === 'reject_ticket') {
        if (!member.roles.cache.has(config.staffRoleId) && !member.roles.cache.has(config.supervisorRoleId)) return interaction.reply({ content: "إدارة فقط ❌", ephemeral: true });
        const ticketData = activeTickets.get(channel.id);
        if (!ticketData) return;

        await channel.send("تم رفض الطلب ❌. سيتم إغلاق التذكرة...");
        activeTickets.delete(channel.id);
        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return interaction.reply({ content: "تم الرفض.", ephemeral: true });
    }
});

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
client.login(token);
