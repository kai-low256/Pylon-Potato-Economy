const Potato_embed_color = 0x11111c;

const POTATO_LOTTERY_TIME_MINUTES = 5;
const ALLOW_DAILY = true;
const ALLOW_WEEKLY = true;
const SHOP_ITEMS = {
  'potato farmer': {
    price: 7,
    description: 'gives you the potato farmer role for 24h',
    async onPurchase(user: discord.User) {
      const guild = await discord.getGuild();
      const member = await guild.getMember(user.id);
      const role = await guild
        .getRoles()
        .then((roles) => roles.find((role) => role.name === 'potato farmer'));
      if (!member || !role) throw new Error('invalid role or member');
      await member.addRole(role.id);
    },
    async onExpire(user: discord.User) {
      const guild = await discord.getGuild();
      const member = await guild.getMember(user.id);
      const role = await guild
        .getRoles()
        .then((roles) => roles.find((role) => role.name === 'potato farmer'));
      if (!member || !role || !member.roles.includes(role.id)) return;

      await member.removeRole(role.id);
    },
    enabled: true,
    duration: 24 * 60 * 60 * 1000 // 24 hours, checked in 5 minute intervals
  }
} as {
  [key: string]: {
    price: number;
    duration: number | undefined;
    description: string;
    enabled: boolean;
    onPurchase: Function;
    onExpire: Function;
  };
};

const potatoCommands = new discord.command.CommandGroup({
  defaultPrefix: '%'
});

const potatoKV = new pylon.KVNamespace('potato');

const randomBetween = (min: number, max: number) =>
  Math.round(Math.random() * (max - min) + min);

const randomTimeBetween = (min: number, max: number) =>
  Math.round(Math.random() * (max - min) + min);

const nextDrawText = () => {
  const nextDraw =
    (Math.ceil(Date.now() / 1000 / 60 / POTATO_LOTTERY_TIME_MINUTES) *
      1000 *
      60 *
      POTATO_LOTTERY_TIME_MINUTES -
      Date.now()) /
    1000 /
    60;

  const minutes = Math.floor(nextDraw);
  const seconds = Math.floor((nextDraw % 1) * 60);
  return `next draw is in ${minutes} ${
    minutes === 1 ? 'minute' : 'minutes'
  } and ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
};

const setDefaultReply = (commandGroup: discord.command.CommandGroup) => {
  commandGroup.defaultRaw(
    async (message) =>
      await message.reply(
        `${discord.decor.Emojis.NO_ENTRY} unknown potato command, try \`%potato help\``
      )
  );
};

const MEDALS = [
  discord.decor.Emojis.FIRST_PLACE_MEDAL,
  discord.decor.Emojis.SECOND_PLACE_MEDAL,
  discord.decor.Emojis.THIRD_PLACE_MEDAL
];

discord.on(discord.Event.MESSAGE_CREATE, async (message: discord.Message) => {
  if (!message.author || message.author.bot) return;

  if (await potatoKV.get<boolean>('cooldown')) {
    if (message.content === discord.decor.Emojis.POTATO) {
      const [lastChannel, potatoId] =
        (await potatoKV.get<string>('lastPotato'))?.split('-') || [];
      if (lastChannel !== message.channelId) return;

      await message
        .getChannel()
        .then((c) => c.getMessage(potatoId))
        .then((m) => m?.delete())
        .catch(() => {});

      await message.delete().catch(() => {});

      const poisonous = Math.random() < 0.01;

      const oldCount = (await potatoKV.get<number>(message.author.id)) || 0;
      const newCount = Math.max(
        0,
        oldCount +
          (poisonous
            ? -Math.max(
                1,
                Math.min(10, Math.floor((Math.random() * oldCount) / 4))
              )
            : 1)
      );

      await potatoKV.put(message.author.id, newCount);
      await potatoKV.delete('lastPotato');
      await message.reply(
        new discord.Embed({
          title: `${
            poisonous ? discord.decor.Emojis.SKULL : discord.decor.Emojis.POTATO
          } potato claimed ${discord.decor.Emojis.POTATO}`,
          description: `**${message.member?.nick ??
            message.author.username}** ${
            poisonous
              ? `tried to pick up a poisonous potato, poisoning **${oldCount -
                  newCount}** potatos in the process`
              : 'has claimed a potato'
          }, and now holds **${newCount}** potato${
            newCount === 1 ? '' : 's'
          }.\n${discord.decor.Emojis.POTATO.repeat(Math.min(newCount, 125))}`,
          color: Potato_embed_color,
          thumbnail: { url: message.author.getAvatarUrl() },
          footer: {
            text: poisonous
              ? ''
              : "to the rest of you, can't catch em all, right?"
          },
          timestamp: new Date().toISOString()
        })
      );
    }
    return;
  } else {
    const [lastChannel, potatoId] =
      (await potatoKV.get<string>('lastPotato'))?.split('-') || [];

    await discord
      .getGuild()
      .then(
        (g) =>
          g.getChannel(lastChannel) as Promise<
            discord.GuildTextChannel | undefined
          >
      )
      .then((c) => c?.getMessage(potatoId))
      .then((m) => m?.delete())
      .catch(() => {});
  }

  if (Math.random() > 0.3) return;

  const reply = await message.reply(discord.decor.Emojis.POTATO);

  const cooldown = randomTimeBetween(35 * 60 * 1000, 60 * 60 * 1000);

  await potatoKV.put('cooldown', true, { ttl: cooldown });
  await potatoKV.put('lastPotato', `${message.channelId}-${reply.id}`);
});

potatoCommands.subcommand('potato', (potatoSubcommands) => {
  setDefaultReply(potatoSubcommands);

  potatoSubcommands.raw(
    { name: 'help', description: 'potato help' },
    async (message) => {
      await message.reply(
        new discord.Embed({
          title: `${discord.decor.Emojis.POTATO} Potato Help ${discord.decor.Emojis.POTATO}`,
          color: Potato_embed_color,
          description: [
            `When a ${discord.decor.Emojis.POTATO} is dropped, be the first to pick it up by posting a ${discord.decor.Emojis.POTATO} too.`,
            '',
            '**Commands:**',
            `- \`%potato claim\` - when a ${discord.decor.Emojis.POTATO} is dropped, be the first to pick it up by executing this command`,
            '- `%potato daily` - claim your daily potato(s) (receive 0 - 2 randomly)',
            '- `%potato weely` - claim your weekly potatoes (receive 3 - 5 randomly)',
            '',
            '- `%potato help` - shows this help message',
            '- `%potato` - show off your potato balance',
            '- `%potato inspect <user>` - inspect another [user]s potato balance',
            '- `%potato top` - top 10 potato collectors',
            '- `%potato gamble <count>` - gamble <count> potatos (`50`% chance of winning)',
            '- `%potato rob <who> <count>` - rob potatos from other people',
            "- `%potato give <who> <count>` - give your potatos to other people - if you're feeling kind.",
            '- `%potato drop` - drop one of your potatos. the fastest to pick it up gets it'
            // '',
            // '- `%potato shop list` - list all available shop items',
            // '- `%potato shop buy <item>` - buy <item> from the shop'
          ].join('\n'),
          fields: [
            {
              name: 'NOTE!',
              value:
                'Poisonous potatos have a `1%` chance of spawning\nRobbing has a `25%` chance of succeeding\nGambling has a `50%` chance on winning',
              inline: false
            }
          ],
          thumbnail: {
            url: 'https://images.emojiterra.com/twitter/v13.0/512px/1f954.png'
          }
        })
      );
    }
  );

  potatoSubcommands.on(
    {
      name: 'modify',
      description: 'modify a users potatos',
      aliases: ['mod']
    },
    (args) => ({ who: args.guildMember(), count: args.string() }),
    async (message, { who, count }) => {
      if (
        !(await discord.command.filters
          .isUserId('502746300224241664')
          .filter(message))
      )
        return await message.reply('missing permissions');
      if (who.user.bot)
        return await message.reply(
          'thats a.. bot. you wanna modify a bots potatos??'
        );
      const oldCount = (await potatoKV.get<number>(who.user.id)) || 0;

      let newCount = oldCount;
      if (count.startsWith('+')) newCount += parseInt(count.replace('+', ''));
      else if (count.startsWith('-'))
        newCount -= parseInt(count.replace('-', ''));
      else newCount = parseInt(count);

      if (isNaN(newCount as number))
        return await message.reply('invalid count');

      await potatoKV.put(who.user.id, newCount as number);
      await message.reply(
        `Ok, updated **${who.nick}**'s potatoes to **${newCount}**`
      );
    }
  );

  potatoSubcommands.raw(
    { name: 'claim', description: 'potato claiming' },
    async (message) => {
      if (!message.author || message.author.bot) return;

      if (await potatoKV.get<boolean>('cooldown')) {
        const [lastChannel, potatoId] =
          (await potatoKV.get<string>('lastPotato'))?.split('-') || [];
        if (lastChannel !== message.channelId) return;

        await message
          .getChannel()
          .then((c) => c.getMessage(potatoId))
          .then((m) => m?.delete())
          .catch(() => {});

        const poisonous = Math.random() < 0.01;

        const oldCount = (await potatoKV.get<number>(message.author.id)) || 0;
        const newCount = Math.max(
          0,
          oldCount +
            (poisonous
              ? -Math.max(
                  1,
                  Math.min(10, Math.floor((Math.random() * oldCount) / 4))
                )
              : 1)
        );

        await potatoKV.put(message.author.id, newCount);
        await potatoKV.delete('lastPotato');
        await message.reply(
          new discord.Embed({
            title: `${
              poisonous
                ? discord.decor.Emojis.SKULL
                : discord.decor.Emojis.POTATO
            } potato claimed ${discord.decor.Emojis.POTATO}`,
            description: `**${message.member?.nick ??
              message.author.username}** ${
              poisonous
                ? `tried to pick up a poisonous potato, poisoning **${oldCount -
                    newCount}** potatos in the process`
                : 'has claimed a potato'
            }, and now holds **${newCount}** potato${
              newCount === 1 ? '' : 's'
            }.\n${discord.decor.Emojis.POTATO.repeat(Math.min(newCount, 125))}`,
            color: Potato_embed_color,
            thumbnail: { url: message.author.getAvatarUrl() },
            footer: {
              text: poisonous
                ? ''
                : "to the rest of you, can't catch em all, right?"
            },
            timestamp: new Date().toISOString()
          })
        );

        return;
      } else {
        const [lastChannel, potatoId] =
          (await potatoKV.get<string>('lastPotato'))?.split('-') || [];

        await discord
          .getGuild()
          .then(
            (g) =>
              g.getChannel(lastChannel) as Promise<
                discord.GuildTextChannel | undefined
              >
          )
          .then((c) => c?.getMessage(potatoId))
          .then((m) => m?.delete())
          .catch(() => {});
      }

      if (Math.random() > 0.3) return;

      const reply = await message.reply(discord.decor.Emojis.POTATO);

      const cooldown = randomTimeBetween(3 * 60 * 1000, 20 * 60 * 1000);

      await potatoKV.put('cooldown', true, { ttl: cooldown });
      await potatoKV.put('lastPotato', `${message.channelId}-${reply.id}`);
    }
  );

  potatoSubcommands.raw(
    { name: '', description: 'potato count' },
    async (message) => {
      const target = message.author;

      const currentCount = (await potatoKV.get<number>(target.id)) || 0;
      await message.reply(
        new discord.Embed({
          title: `${discord.decor.Emojis.POTATO} potato count ${discord.decor.Emojis.POTATO}`,
          description: `**${message.member?.nick ??
            message.author.username}** has **${currentCount}** potato${
            currentCount === 1 ? '' : 's'
          }.\n${discord.decor.Emojis.POTATO.repeat(
            Math.min(currentCount, 125)
          )}`,
          color: Potato_embed_color,
          thumbnail: { url: message.author.getAvatarUrl() },
          footer: {
            text: `%potato help`
          },
          timestamp: new Date().toISOString()
        })
      );
    }
  );

  potatoSubcommands.on(
    { name: 'inspect', description: 'potato count' },
    (args) => ({ who: args.guildMember() }),
    async (message, { who }) => {
      const currentCount = (await potatoKV.get<number>(who?.user.id)) || 0;
      await message.reply(
        new discord.Embed({
          title: `${discord.decor.Emojis.POTATO} potato count ${discord.decor.Emojis.POTATO}`,
          description: `**${who?.nick ??
            who?.user.username}** has **${currentCount}** potato${
            currentCount === 1 ? '' : 's'
          }.\n${discord.decor.Emojis.POTATO.repeat(
            Math.min(currentCount, 125)
          )}`,
          color: Potato_embed_color,
          thumbnail: { url: who?.user.getAvatarUrl() },
          footer: {
            text: `%potato help`
          },
          timestamp: new Date().toISOString()
        })
      );
    }
  );

  potatoSubcommands.on(
    {
      name: 'gamble',
      description: 'gamble potatos'
    },
    (args) => ({ count: args.integer() }),
    async (message, { count }) => {
      if (await potatoKV.get<boolean>(`gamble-${message.author?.id}`))
        return await message.reply(
          `${discord.decor.Emojis.NO_ENTRY_SIGN} ${discord.decor.Emojis.POTATO} gambling addiction is a serious problem. Regulations require a wait.`
        );

      const currentCount =
        (await potatoKV.get<number>(message.author?.id)) || 0;

      if (count > currentCount)
        return await message.reply(
          'You can only gamble as many potatos as you have!'
        );

      await potatoKV.put(`gamble-${message.author?.id}`, true, {
        ttl: randomTimeBetween(2 * 60 * 1000, 5 * 60 * 1000)
      });

      const won = Math.random() > 0.5;
      const newCount = currentCount + count * (won ? 1 : -1);
      await potatoKV.put(message.author?.id, newCount);

      await message.reply(
        new discord.Embed({
          title: `${discord.decor.Emojis.GAME_DIE} Gambling ${count} ${discord.decor.Emojis.POTATO}`,
          description: `Your gambling ${
            won ? '**paid off**' : '**sucked**'
          }, you ${won ? 'won' : 'lost'} **${count}** potato${
            count === 1 ? '' : 's'
          }, ${
            won ? 'giving you' : 'leaving you with'
          } a total of **${newCount}** potato${
            newCount === 1 ? '' : 's'
          }. \n${discord.decor.Emojis.POTATO.repeat(newCount)} \n${
            won
              ? discord.decor.Emojis.CHART_WITH_UPWARDS_TREND
              : discord.decor.Emojis.CHART_WITH_DOWNWARDS_TREND
          }`,
          color: Potato_embed_color,
          footer: {
            text: `${won ? 'Gambled' : 'Gambling'} by ${message.member.nick ??
              message.author.username}`,
            iconUrl: message.author.getAvatarUrl()
          },
          timestamp: new Date().toISOString()
        })
      );
    }
  );

  potatoSubcommands.on(
    { name: 'rob', description: 'rob potatos' },
    (args) => ({ who: args.guildMember(), count: args.integer() }),
    async (message, { who, count }) => {
      if (
        message.author?.id === who?.user.id
      )
        return await message.reply("You can't rob yourself!");
      if (await potatoKV.get<boolean>(`steal-${message.author?.id}`))
        return await message.reply(
          `${discord.decor.Emojis.POLICE_OFFICER} Your potato thief actions are being currently scrutinized. Lay low for a while.`
        );
      const success = Math.random() < 0.25;
      const userPotatos = (await potatoKV.get<number>(message.author?.id)) || 0;
      const targetPotatos = (await potatoKV.get<number>(who?.user.id)) || 0;

      if (count > userPotatos)
        return await message.reply(
          'You can only rob as many potatos as you have!'
        );

      if (count > targetPotatos)
        return await message.reply('That user doesnt have that many potatos!');

      if (count < 1)
        return await message.reply('You need to rob at least one potato.');

      await potatoKV.put(`steal-${message.author?.id}`, true, {
        ttl: randomTimeBetween(3 * 60 * 1000, 10 * 60 * 1000)
      });

      const newUserPotatos = userPotatos + count * (success ? 1 : -1);
      const newTargetPotatos = targetPotatos + count * (success ? -1 : 1);

      await potatoKV.put(message.author?.id, newUserPotatos);
      await potatoKV.put(who?.user.id, newTargetPotatos);

      await message.reply(
        new discord.Embed({
          title: `${discord.decor.Emojis.GLOVES} ${
            discord.decor.Emojis.POTATO
          } Robbing ${who?.nick ?? who?.user.username}`,
          description: `Your thievery ${success ? 'paid off' : 'sucked'}, you ${
            success ? 'stole' : 'gave'
          } **${count}** potato${count === 1 ? '' : 's'} ${
            success ? 'from' : 'to'
          } ${who?.nick ?? who?.user.username}, ${
            success ? 'giving you a total of' : 'leaving you with'
          } **${newUserPotatos}** potato${
            newUserPotatos === 1 ? '' : 's'
          }. \n${discord.decor.Emojis.POTATO.repeat(newUserPotatos)} \n${
            success
              ? discord.decor.Emojis.CHART_WITH_UPWARDS_TREND
              : discord.decor.Emojis.CHART_WITH_DOWNWARDS_TREND
          }`,
          color: Potato_embed_color,
          footer: {
            text: `${success ? 'Robbed' : 'Robbery'} by ${message.member.nick ??
              message.author.username}`,
            iconUrl: message.author.getAvatarUrl()
          },
          timestamp: new Date().toISOString()
        })
      );
    }
  );

  potatoSubcommands.on(
    { name: 'give', description: 'give potatos to other people' },
    (args) => ({ who: args.guildMember(), count: args.integerOptional() }),
    async (message, { who, count }) => {
      if (message.author?.id === who?.user.id)
        return await message.reply("You can't give potatos to yourself!");
      if (who?.user.bot)
        return await message.reply("You can't give potatos to bots!");
      const userPotatos = (await potatoKV.get<number>(message.author?.id)) || 0;
      const targetPotatos = (await potatoKV.get<number>(who?.user.id)) || 0;

      if (!count && count !== 0) count = 1;

      if (count > userPotatos)
        return await message.reply(
          'You can only give as many potatos as you have!'
        );

      if (count < 1)
        return await message.reply('You need to send at least one potato.');

      const newUserPotatos = userPotatos - count;
      const newTargetPotatos = targetPotatos + count;

      await potatoKV.put(message.author?.id, newUserPotatos);
      await potatoKV.put(who?.user.id, newTargetPotatos);

      await message.reply(
        `you gave **${count}** potato${count === 1 ? '' : 's'} to **${
          who?.user.username
        }**#${who?.user.discriminator}, how nice of you.`
      );
    }
  );

  potatoSubcommands.raw(
    { name: 'toptop', description: 'top potatos' },
    async (message) => {
      const items = await potatoKV.items();
      const sorted = items
        .filter((entry) => !isNaN((entry.key as unknown) as number))
        .sort((a, b) => (b.value as number) - (a.value as number));
      const top = sorted.slice(0, 10);
      const userMap = await Promise.all(
        top.map((entry) =>
          discord
            .getUser(entry.key)
            .then((user) => ({ user, potatos: entry.value }))
        )
      );

      await message.reply(
        new discord.Embed({
          title: `Top ${userMap.length} ${discord.decor.Emojis.POTATO} collectors`,
          color: Potato_embed_color,
          description: userMap
            .map(
              (entry) => `\`${entry.user?.getTag()}\`: ${entry.potatos} potatos`
            )
            .join('\n'),
          footer: {
            text: `%potato help`
          },
          timestamp: new Date().toISOString()
        })
      );
    }
  );

  potatoSubcommands.on(
    { name: 'top', description: 'top potatos' },
    (args) => ({ count: args.integerOptional() }),
    async (message, { count }) => {
      count = Math.min(Math.max(3, count || 10), 20);
      const items = await potatoKV.items();
      const filtered = items.filter(
        (entry) =>
          !isNaN((entry.key as unknown) as number) &&
          ((entry.value as unknown) as number) > 0
      );
      const sorted = filtered.sort(
        (a, b) => (b.value as number) - (a.value as number)
      );
      const top = sorted.slice(0, count);
      count = top.length;
      const userMap = await Promise.all(
        top.map((entry) =>
          discord
            .getUser(entry.key)
            .then((user) => ({ user, potatos: entry.value as number }))
        )
      );

      let description = `${discord.decor.Emojis.POTATO} **${filtered
        .reduce((a, b) => a + (b.value as number), 0)
        .toLocaleString()}**\n`;
      description += `${discord.decor.Emojis.MAN_FARMER} **${filtered.length}**\n\n`;
      description += `${discord.decor.Emojis.CHART_WITH_UPWARDS_TREND} **Ranks** ${discord.decor.Emojis.MUSCLE}\n`;

      for (const entry of userMap.slice(0, Math.max(3, count - 1))) {
        const { user, potatos } = entry;
        const place = userMap.indexOf(entry);
        description += `\` ${MEDALS[place] ||
          `${(place + 1).toString().padStart(2, ' ')} `} \` **${
          user?.username
        }**#${user?.discriminator} - ${potatos.toLocaleString()} potatos\n`;
      }

      const ownIndex = sorted.findIndex(
        (item) => item.key === message.author.id
      );

      if (ownIndex >= count) {
        description += `\` ... \` *${ownIndex - count + 1}* other farmers\n`;
        description += `\` ${(ownIndex + 1).toString().padStart(2, ' ')} \` **${
          message.author.username
        }**#${message.author.discriminator} - ${sorted[ownIndex].value} potato${
          sorted[ownIndex].value === 1 ? '' : 's'
        }`;
      } else if (count > 3) {
        const { user, potatos } = userMap[count - 1];
        description += `\` ${count.toString().padStart(2, ' ')}  \` **${
          user?.username
        }**#${user?.discriminator} - ${potatos.toLocaleString()} potatos\n`;
      }

      await message.reply(
        new discord.Embed({
          title: `${discord.decor.Emojis.TROPHY} Leaderboard​ ${discord.decor.Emojis.CROWN}`,
          description,
          footer: {
            text: `%potato help`
          },
          timestamp: new Date().toISOString()
        })
      );
    }
  );

  if (ALLOW_DAILY)
    potatoSubcommands.raw(
      { name: 'daily2', description: 'daily potato' },
      async (message) => {
        if (await potatoKV.get<boolean>(`daily-${message.author.id}`))
          return await message.reply(
            `${discord.decor.Emojis.NO_ENTRY} you already claimed your **daily** potato!`
          );

        await potatoKV.put(`daily-${message.author.id}`, true, {
          ttl:
            Math.ceil(Date.now() / 1000 / 60 / 60 / 12) * 12 * 60 * 60 * 1000 -
            Date.now()
        });
        const newCount = await potatoKV.transact(
          message.author.id,
          (prev: number | undefined) => (prev || 0) + 1
        );
        await message.reply(
          `you claimed your daily potato, and now holds **${newCount}** potatos.`
        );
      }
    );

  if (ALLOW_DAILY)
    potatoSubcommands.raw(
      {
        name: 'daily',
        description: 'daily potato'
      },
      async (message) => {
        if (await potatoKV.get<boolean>(`daily-2-${message.author.id}`))
          return await message.reply(
            `${discord.decor.Emojis.NO_ENTRY} you already claimed your **daily** potato! (${Test_Message})`
          );

        await potatoKV.put(`daily-2-${message.author.id}`, true, {
          ttl: 1000 * 60 * 60 * 24 * 7
        });
        const Random_Amount = randomBetween(0, 2);
        const newCount = await potatoKV.transact(
          message.author.id,
          (prev: number | undefined) => (prev || 0) + Random_Amount
        );

        if (Random_Amount === 0) {
          await message.reply(
            `LMFAO you suck, You claimed your daily potato and recieved **no** potatos, you remain with **${newCount}** potatos. (${Test_Message})`
          );
        } else {
          await message.reply(
            `You claimed your daily potato and recieved **${Random_Amount}** potatos, you now have **${newCount}** potatos. (${Test_Message})`
          );
        }
      }
    );

  if (ALLOW_WEEKLY)
    potatoSubcommands.raw(
      {
        name: 'weekly',
        description: 'weekly potato'
      },
      async (message) => {
        if (await potatoKV.get<boolean>(`weekly-${message.author.id}`))
          return await message.reply(
            `${discord.decor.Emojis.NO_ENTRY} you already claimed your **weekly** potato! (${Test_Message})`
          );

        await potatoKV.put(`weekly-${message.author.id}`, true, {
          ttl:
            Math.ceil(Date.now() / 1000 / 60 / 60 / 24 / 7) *
              7 *
              24 *
              60 *
              60 *
              1000 -
            Date.now()
        });
        const Random_Amount = randomBetween(3, 5);
        const newCount = await potatoKV.transact(
          message.author.id,
          (prev: number | undefined) => (prev || 0) + Random_Amount
        );
        await message.reply(
          `You claimed your weekly potato and recieved **${Random_Amount}** potatos, you now have **${newCount}** potatos. (${Test_Message})`
        );
      }
    );

  potatoSubcommands.raw(
    { name: 'drop', description: 'drop a potato in the chat' },
    async (message) => {
      const userPotatos = (await potatoKV.get<number>(message.author?.id)) || 0;

      if (!userPotatos)
        return await message.reply("you don't have any potatos!");

      const lastPotato = await potatoKV.get<string>('lastPotato');
      if (lastPotato)
        return await message.reply(
          `there is already an active potato waiting to be picked up in <#${
            lastPotato.split('-')[0]
          }>!`
        );

      await potatoKV.put(message.author?.id, userPotatos - 1);

      const reply = await message.reply(discord.decor.Emojis.POTATO);

      const cooldown = randomTimeBetween(3 * 60 * 1000, 20 * 60 * 1000);

      await potatoKV.put('cooldown', true, { ttl: cooldown });
      await potatoKV.put('lastPotato', `${message.channelId}-${reply.id}`, {
        ttl: cooldown
      });
    }
  );

  const shop = potatoSubcommands.subcommandGroup({
    name: 'shop',
    description: 'potato shop commands'
  });

  setDefaultReply(shop);

  shop.on(
    { name: 'list', description: 'list all potato shop items' },
    () => ({}),
    async (message) => {
      if (!Object.keys(SHOP_ITEMS).length)
        return await message.reply('no items currently available, sorry!');

      const fields = await Promise.all(
        Object.entries(SHOP_ITEMS)
          .filter(([, item]) => item.enabled)
          .map(async ([name, item]) => ({
            name: `${name} - ${item.price} ${discord.decor.Emojis.POTATO}`,
            value: item.description,
            inline: true
          }))
      );

      await message.reply(
        new discord.Embed({
          title: 'Potato Shop',
          description: `**Available Items**\nuse \`%potato shop buy <item>\` to purchase an item listed here`,
          fields
        })
      );
    }
  );

  shop.on(
    {
      name: 'buy',
      aliases: ['purchase'],
      description: 'purchase a potato shop item'
    },
    (args) => ({ item: args.text() }),
    async (message, { item }) => {
      const itemObj = SHOP_ITEMS[item];
      if (!itemObj || !itemObj.enabled)
        return await message.reply(
          `invalid potato item. use \`%potato shop list\` to get a list of all available items`
        );

      const purchases = ((await potatoKV.get<pylon.JsonArray>('shop')) ||
        []) as { user: string; item: string; expiresAt: number | undefined }[];
      const purchase = purchases.find(
        (purchase) =>
          purchase.user === message.author.id && purchase.item === item
      );
      if (purchase)
        return message.reply(
          `You already bought this item!${
            purchase.expiresAt
              ? ` You can buy it again on ${new Date(
                  purchase.expiresAt
                ).toUTCString()}`
              : ''
          }`
        );

      const userPotatos = (await potatoKV.get<number>(message.author.id)) || 0;
      if (userPotatos < itemObj.price)
        return await message.reply(
          "you don't have enough potatos for that item!"
        );

      try {
        await itemObj.onPurchase(message.author);
      } catch (err) {
        return await message.reply(
          `There was an error processing your order: ${err.message}`
        );
      }

      await potatoKV.transact(
        message.author.id,
        (prev: number | undefined) => (prev || 0) - itemObj.price
      );

      await potatoKV.transact(
        'shop',
        (prev: pylon.JsonArray | undefined) =>
          [
            ...(prev || []),
            {
              user: message.author.id,
              item,
              expiresAt: itemObj.duration
                ? Date.now() + itemObj.duration
                : undefined
            }
          ] as pylon.JsonArray
      );

      await message.reply(`You successfully bought \`${item}\`!`);
    }
  );
});

pylon.tasks.cron(
  'lottery',
  `0 0/${POTATO_LOTTERY_TIME_MINUTES} * * * * *`,
  async () => {
    const channel = await discord.getGuildTextChannel('757915785262792704');
    if (!channel) return;

    let lotteryData = (await potatoKV.get('lottery')) as
      | { [key: string]: number }
      | undefined;
    if (!lotteryData || Object.keys(lotteryData).length < 2) return;

    const msg = await channel.sendMessage(
      `the potato gods are choosing a lottery winner...`
    );
    await sleep(Math.random() * 10000 + 5000);
    await msg.delete().catch(() => {});

    lotteryData = (await potatoKV.get('lottery')) as
      | { [key: string]: number }
      | undefined;
    if (!lotteryData || Object.keys(lotteryData).length < 2) return;

    const idList = [] as string[];
    for (const [key, value] of Object.entries(lotteryData))
      idList.push(...(new Array(value).fill(key) as string[]));
    const randomID = idList[Math.floor(Math.random() * idList.length)];

    const newCount = await potatoKV.transact(
      randomID,
      (prev: number | undefined) => (prev || 0) + idList.length
    );
    await potatoKV.delete('lottery');
    await channel.sendMessage(
      `the potato gods have chosen <@${randomID}> as a lottery winner (${Math.floor(
        (lotteryData[randomID] / idList.length) * 1000
      ) / 10}% chance)! they won ${
        idList.length
      } potatos, giving them a total of ${newCount}.`
    );
  }
);

pylon.tasks.cron('shop', '0 0/5 * * * * *', async () => {
  const purchases = ((await potatoKV.get<pylon.JsonArray>('shop')) || []) as {
    user: string;
    item: string;
    expiresAt: number | undefined;
  }[];

  const newPurchases = [];

  for (const purchase of purchases) {
    if (purchase.expiresAt && purchase.expiresAt <= Date.now()) {
      const item = SHOP_ITEMS[purchase.item];
      if (!item) continue;

      discord
        .getUser(purchase.user)
        .then((user) => item.onExpire(user))
        .catch((err) => console.error(err));
    } else newPurchases.push(purchase);
  }

  await potatoKV.put('shop', newPurchases as pylon.JsonArray);
});
