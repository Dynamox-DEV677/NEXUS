require('dotenv').config();require('dotenv').config();require('dotenv').config();const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// In-memory store (use a database like SQLite/MongoDB in production)
const listings = new Map(); // listingId -> listing object
const userListings = new Map(); // userId -> [listingIds]
let listingCounter = 1;

// Category definitions
const CATEGORIES = [
    { id: 'electronics', label: '💻 Electronics', emoji: '💻' },
    { id: 'clothing', label: '👕 Clothing & Apparel', emoji: '👕' },
    { id: 'gaming', label: '🎮 Gaming', emoji: '🎮' },
    { id: 'collectibles', label: '🏆 Collectibles', emoji: '🏆' },
    { id: 'books', label: '📚 Books & Media', emoji: '📚' },
    { id: 'services', label: '🛠️ Services', emoji: '🛠️' },
    { id: 'other', label: '📦 Other', emoji: '📦' },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function generateId() {
    return `#${String(listingCounter++).padStart(4, '0')}`;
}

function getListing(id) {
    return listings.get(id);
}

function getUserListings(userId) {
    const ids = userListings.get(userId) || [];
    return ids.map(id => listings.get(id)).filter(Boolean);
}

function getCategoryLabel(catId) {
    return CATEGORIES.find(c => c.id === catId)?.label || '📦 Other';
}

function buildListingEmbed(listing, showContact = false) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${listing.title}`)
        .setDescription(listing.description)
        .addFields(
            { name: '💰 Price', value: listing.price, inline: true },
            { name: '📂 Category', value: getCategoryLabel(listing.category), inline: true },
            { name: '📍 Condition', value: listing.condition, inline: true },
            { name: '🆔 Listing ID', value: listing.id, inline: true },
            { name: '📅 Posted', value: `<t:${Math.floor(listing.createdAt / 1000)}:R>`, inline: true },
            { name: '🔖 Status', value: listing.sold ? '🔴 Sold' : '🟢 Available', inline: true },
        )
        .setFooter({ text: `Seller: ${listing.sellerTag}` })
        .setTimestamp();

    if (listing.imageUrl) embed.setImage(listing.imageUrl);
    if (showContact) embed.addFields({ name: '📬 Contact Seller', value: `<@${listing.sellerId}>` });

    return embed;
}

// ─── MAIN MARKET PANEL ──────────────────────────────────────────────────────

function buildMarketPanel() {
    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🏪 Marketplace — Welcome!')
        .setDescription(
            '> **Buy and sell anything with your community!**\n\n' +
            '📋 **Browse** listings by category\n' +
            '➕ **Post** your own item for sale\n' +
            '📦 **Manage** your active listings\n' +
            '🔍 **Search** for specific items\n'
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Use the buttons below to get started!' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('market_browse').setLabel('Browse Listings').setEmoji('🛍️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('market_sell').setLabel('Sell an Item').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('market_mylistings').setLabel('My Listings').setEmoji('📦').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('market_search').setLabel('Search').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [row] };
}

// ─── BROWSE PANEL ───────────────────────────────────────────────────────────

function buildBrowsePanel() {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🛍️ Browse by Category')
        .setDescription('Select a category to see listings:');

    const select = new StringSelectMenuBuilder()
        .setCustomId('browse_category')
        .setPlaceholder('Choose a category...')
        .addOptions(
            CATEGORIES.map(c => ({ label: c.label, value: c.id, emoji: c.emoji }))
        );

    const row1 = new ActionRowBuilder().addComponents(select);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('market_home').setLabel('← Back').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

// ─── SELL MODAL ─────────────────────────────────────────────────────────────

function buildSellModal() {
    const modal = new ModalBuilder()
        .setCustomId('sell_modal')
        .setTitle('📦 Post a New Listing');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('sell_title').setLabel('Product Title').setStyle(TextInputStyle.Short).setPlaceholder('e.g. iPhone 14 Pro 256GB').setMaxLength(100).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('sell_description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setPlaceholder('Describe your item in detail...').setMaxLength(1000).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('sell_price').setLabel('Price').setStyle(TextInputStyle.Short).setPlaceholder('e.g. $50 / $50 OBO / Free').setMaxLength(50).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('sell_condition').setLabel('Condition').setStyle(TextInputStyle.Short).setPlaceholder('New / Like New / Good / Fair / Poor').setMaxLength(50).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('sell_image').setLabel('Image URL (optional)').setStyle(TextInputStyle.Short).setPlaceholder('https://...').setRequired(false)
        ),
    );

    return modal;
}

// ─── CATEGORY SELECT ────────────────────────────────────────────────────────

function buildCategorySelectForListing(listingId) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`set_category_${listingId}`)
        .setPlaceholder('Pick a category for your listing...')
        .addOptions(CATEGORIES.map(c => ({ label: c.label, value: c.id, emoji: c.emoji })));

    const row = new ActionRowBuilder().addComponents(select);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📂 Select a Category')
        .setDescription(`Choose the best category for your listing **${listingId}**:`);

    return { embeds: [embed], components: [row], ephemeral: true };
}

// ─── MY LISTINGS ────────────────────────────────────────────────────────────

function buildMyListings(userId) {
    const userItems = getUserListings(userId);

    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📦 Your Listings');

    if (userItems.length === 0) {
        embed.setDescription("You don't have any listings yet.\nPress **Sell an Item** to post your first one!");
    } else {
        embed.setDescription(
            userItems.map(l =>
                `**${l.id}** — ${l.title}\n💰 ${l.price} | ${l.sold ? '🔴 Sold' : '🟢 Available'} | ${getCategoryLabel(l.category)}`
            ).join('\n\n')
        );
    }

    const rows = [];
    if (userItems.length > 0) {
        const selectManage = new StringSelectMenuBuilder()
            .setCustomId('manage_listing_select')
            .setPlaceholder('Select a listing to manage...')
            .addOptions(
                userItems.map(l => ({
                    label: `${l.id} — ${l.title.substring(0, 40)}`,
                    description: `${l.price} | ${l.sold ? 'Sold' : 'Available'}`,
                    value: l.id,
                    emoji: l.sold ? '🔴' : '🟢'
                }))
            );
        rows.push(new ActionRowBuilder().addComponents(selectManage));
    }

    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('market_home').setLabel('← Back').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('market_sell').setLabel('+ New Listing').setStyle(ButtonStyle.Success),
    ));

    return { embeds: [embed], components: rows, ephemeral: true };
}

// ─── MANAGE LISTING ─────────────────────────────────────────────────────────

function buildManageListing(listing) {
    const embed = buildListingEmbed(listing);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`listing_toggle_${listing.id}`)
            .setLabel(listing.sold ? 'Mark as Available' : 'Mark as Sold')
            .setEmoji(listing.sold ? '🟢' : '🔴')
            .setStyle(listing.sold ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`listing_delete_${listing.id}`)
            .setLabel('Delete Listing')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('market_mylistings')
            .setLabel('← My Listings')
            .setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [row], ephemeral: true };
}

// ─── SEARCH MODAL ───────────────────────────────────────────────────────────

function buildSearchModal() {
    const modal = new ModalBuilder()
        .setCustomId('search_modal')
        .setTitle('🔍 Search Listings');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('search_query')
                .setLabel('What are you looking for?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. iPhone, shoes, PS5...')
                .setRequired(true)
        )
    );

    return modal;
}

// ─── EVENT HANDLERS ─────────────────────────────────────────────────────────

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guild(s)`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // !market — post the main panel
    if (message.content === '!market') {
        await message.channel.send(buildMarketPanel());
    }

    // !sell — quick post
    if (message.content === '!sell') {
        const panel = buildMarketPanel();
        await message.reply({ ...panel, ephemeral: false });
    }
});

client.on('interactionCreate', async (interaction) => {

    // ── BUTTONS ──────────────────────────────────────────────────────────
    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id === 'market_home') {
            return interaction.update(buildMarketPanel());
        }

        if (id === 'market_browse') {
            return interaction.reply({ ...buildBrowsePanel(), ephemeral: true });
        }

        if (id === 'market_sell') {
            return interaction.showModal(buildSellModal());
        }

        if (id === 'market_mylistings') {
            return interaction.reply({ ...buildMyListings(interaction.user.id), ephemeral: true });
        }

        if (id === 'market_search') {
            return interaction.showModal(buildSearchModal());
        }

        if (id.startsWith('listing_toggle_')) {
            const listingId = id.replace('listing_toggle_', '');
            const listing = getListing(listingId);
            if (!listing || listing.sellerId !== interaction.user.id) {
                return interaction.reply({ content: '❌ You can only manage your own listings.', ephemeral: true });
            }
            listing.sold = !listing.sold;
            return interaction.update(buildManageListing(listing));
        }

        if (id.startsWith('listing_delete_')) {
            const listingId = id.replace('listing_delete_', '');
            const listing = getListing(listingId);
            if (!listing || listing.sellerId !== interaction.user.id) {
                return interaction.reply({ content: '❌ You can only delete your own listings.', ephemeral: true });
            }
            listings.delete(listingId);
            const userIds = userListings.get(interaction.user.id) || [];
            userListings.set(interaction.user.id, userIds.filter(i => i !== listingId));
            return interaction.update({
                embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('🗑️ Listing Deleted').setDescription(`Listing **${listingId}** has been removed.`)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('market_mylistings').setLabel('← My Listings').setStyle(ButtonStyle.Secondary)
                )]
            });
        }

        if (id.startsWith('view_listing_')) {
            const listingId = id.replace('view_listing_', '');
            const listing = getListing(listingId);
            if (!listing) return interaction.reply({ content: '❌ Listing not found.', ephemeral: true });
            const embed = buildListingEmbed(listing, true);
            return interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('market_browse').setLabel('← Browse').setStyle(ButtonStyle.Secondary)
                )],
                ephemeral: true
            });
        }
    }

    // ── SELECT MENUS ─────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;

        // Browse by category
        if (id === 'browse_category') {
            const cat = interaction.values[0];
            const results = [...listings.values()].filter(l => l.category === cat && !l.sold);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`${getCategoryLabel(cat)} — Listings`)
                .setDescription(results.length === 0 ? '😔 No listings in this category yet.' : `Found **${results.length}** listing(s):`);

            const rows = [];
            if (results.length > 0) {
                // Show up to 5 listings as buttons
                const chunk = results.slice(0, 5);
                const btnRow = new ActionRowBuilder().addComponents(
                    chunk.map(l =>
                        new ButtonBuilder()
                            .setCustomId(`view_listing_${l.id}`)
                            .setLabel(`${l.id} — ${l.title.substring(0, 25)}`)
                            .setStyle(ButtonStyle.Primary)
                    )
                );
                rows.push(btnRow);

                embed.addFields(
                    results.slice(0, 10).map(l => ({
                        name: `${l.id} — ${l.title}`,
                        value: `💰 ${l.price} | 📋 ${l.condition} | <t:${Math.floor(l.createdAt / 1000)}:R>`,
                        inline: false
                    }))
                );
            }

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('market_browse').setLabel('← Categories').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('market_home').setLabel('🏠 Home').setStyle(ButtonStyle.Secondary),
            ));

            return interaction.update({ embeds: [embed], components: rows });
        }

        // Set category after posting
        if (id.startsWith('set_category_')) {
            const listingId = id.replace('set_category_', '');
            const listing = getListing(listingId);
            if (!listing) return interaction.reply({ content: '❌ Listing not found.', ephemeral: true });
            listing.category = interaction.values[0];

            const embed = buildListingEmbed(listing, false);
            embed.setTitle('✅ Listing Posted! ' + listing.title);
            embed.setDescription(`Your listing is now live in **${getCategoryLabel(listing.category)}**!\n\n${listing.description}`);

            return interaction.update({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('market_mylistings').setLabel('My Listings').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('market_home').setLabel('🏠 Home').setStyle(ButtonStyle.Secondary),
                )]
            });
        }

        // Manage listing select
        if (id === 'manage_listing_select') {
            const listingId = interaction.values[0];
            const listing = getListing(listingId);
            if (!listing) return interaction.reply({ content: '❌ Listing not found.', ephemeral: true });
            return interaction.update(buildManageListing(listing));
        }
    }

    // ── MODALS ───────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {

        if (interaction.customId === 'sell_modal') {
            const title = interaction.fields.getTextInputValue('sell_title');
            const description = interaction.fields.getTextInputValue('sell_description');
            const price = interaction.fields.getTextInputValue('sell_price');
            const condition = interaction.fields.getTextInputValue('sell_condition');
            const imageUrl = interaction.fields.getTextInputValue('sell_image') || null;

            const listingId = generateId();
            const listing = {
                id: listingId,
                title,
                description,
                price,
                condition,
                imageUrl,
                category: 'other', // Will be set in next step
                sellerId: interaction.user.id,
                sellerTag: interaction.user.tag,
                createdAt: Date.now(),
                sold: false,
            };

            listings.set(listingId, listing);
            const current = userListings.get(interaction.user.id) || [];
            userListings.set(interaction.user.id, [...current, listingId]);

            // Next: ask for category
            return interaction.reply(buildCategorySelectForListing(listingId));
        }

        if (interaction.customId === 'search_modal') {
            const query = interaction.fields.getTextInputValue('search_query').toLowerCase();
            const results = [...listings.values()].filter(l =>
                !l.sold && (
                    l.title.toLowerCase().includes(query) ||
                    l.description.toLowerCase().includes(query)
                )
            );

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🔍 Search: "${query}"`)
                .setDescription(results.length === 0
                    ? `😔 No results found for **"${query}"**`
                    : `Found **${results.length}** listing(s):`
                );

            if (results.length > 0) {
                embed.addFields(
                    results.slice(0, 8).map(l => ({
                        name: `${l.id} — ${l.title}`,
                        value: `💰 ${l.price} | ${getCategoryLabel(l.category)} | 📋 ${l.condition}`,
                        inline: false
                    }))
                );
            }

            const rows = [];
            if (results.length > 0) {
                const chunk = results.slice(0, 5);
                rows.push(new ActionRowBuilder().addComponents(
                    chunk.map(l =>
                        new ButtonBuilder()
                            .setCustomId(`view_listing_${l.id}`)
                            .setLabel(`View ${l.id}`)
                            .setStyle(ButtonStyle.Primary)
                    )
                ));
            }

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('market_home').setLabel('🏠 Home').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('market_search').setLabel('🔍 Search Again').setStyle(ButtonStyle.Secondary),
            ));

            return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
        }
    }
});

// ─── LOGIN ──────────────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error('❌ Missing DISCORD_TOKEN in environment variables!');
    console.error('   Set it in your .env file: DISCORD_TOKEN=your_bot_token_here');
    process.exit(1);
}

client.login(TOKEN);


