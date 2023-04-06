//const settings = require("../general-settings.json");
import settings from "../../general-settings.json";
import fs from "fs";
//const fs = require('fs');
import http from "http";
//const http = require('http');
import https from "https";
import { Client, GuildChannel, Message, TextChannel, MessageEmbed, Collection } from "discord.js";
import { Canvas } from "canvas";
import Keyv from "keyv";
import Parser from "rss-parser";
import crypto from "crypto";
import { channel } from "diagnostics_channel";
import { error } from "console";
//const https = require('https');


const mailVerification = new RegExp(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/);
const studentEmailVerification = new RegExp(/^[A-Za-z0-9._%+-]+@stud.hs-kempten.de$/gmi)

// xp calculation





export const toLevel = (number: number): number => {
  return (0.01 * number) ^ 0.8;
};

export const validateEmail = (email: string, message: Message): boolean => {
  if (studentEmailVerification.test(email)) {
    return true;
  } else {
    message.channel.send("Please enter a valid email address. \n try using the scheme: `..verify max.mustermann@stud.hs-kempten.de`");
    return false;
  }
}

export const logMessage = async (message: Message, msg: string): Promise<void> => {
  const logChannel = message?.guild?.channels.cache.find(
    channel => channel.name === settings.channels.logs
  ) as TextChannel;
  if (logChannel) {
    await logChannel.send(msg);
  }
}

export const RSS = (client: Client) => {
  //Makin the Code more Readable
  let rssChannels = settings.RSSsettings.rssChannels;
  let RSSURLs = settings.RSSsettings.RSSURLs;


  if(rssChannels.length == RSSURLs.length) {
    if(new Date().getHours() >= settings.RSSsettings.RSSCheckAfterTimeHours) {
      
      for (let i = 0; i < rssChannels.length; i++) {
        let channel = client.channels.cache.get(rssChannels[i]) as TextChannel;
        if(channel) {
          channel.messages.fetch({ limit: 3 }).then(messages => {
              if (channel != undefined) {
                // get rss feed
                if(channel.lastMessage?.embeds[0] && channel.lastMessage.embeds[0].title) {
                  PrepareMessageAndSend(messages, RSSURLs[i], channel);
                  //console.log("\nFirst message(?): " + messages.at(0)?.embeds[0].title + "\nSecond message(?): " + messages.at(1)?.embeds[0].title + "\nThird message(?): " + messages.at(2)?.embeds[0].title);
                } else {
                  PrepareMessageAndSend(messages, RSSURLs[i], channel);
                }
              } 
          }).catch(console.error);
        }
      }
    }
  }
}



async function PrepareMessageAndSend(lastMessages : Collection<String, Message<boolean>>, specificURL: string, desiredChannel: TextChannel) {

  const parser = new Parser();
  const feed = await parser.parseURL(specificURL);
  const currentFeedItems = feed.items?.slice(0, 3);
  let amountOfExistingMessages = Array.from(lastMessages.values()).length;

  console.log("\nAmount of feed items: " +  currentFeedItems.length);

  
  currentFeedItems.forEach(async currentFeedItem => {
    let alradyExists = false;
    if(currentFeedItem) {
      alradyExists = await CheckRSSDB(currentFeedItem, desiredChannel);
    }

    
    if(!alradyExists) { 
      let sameTitle = false;
      let samePubDate = false;

      for(let j = 0; j < amountOfExistingMessages; j++) {
        let embed = new MessageEmbed().setColor(0xb00b69);
        let lastEmbed = lastMessages.at(j)?.embeds[0];
        if(!lastEmbed) {
          continue;
        }
        
        if (currentFeedItem.title) {
          embed.setTitle(currentFeedItem.title);
          if (lastEmbed.title == currentFeedItem.title) {
            console.log("Post titles Match!");
            sameTitle = true;
          }
        }

        if(currentFeedItem.pubDate) {
          // Removes unnecessary chars from timestamp
          var mystring: string = currentFeedItem.pubDate.replace(/\+[0-9]*$/, '');
          if(lastEmbed.footer) {
            // strings won't match, when no regex removal is done
            if(lastEmbed.footer.text.toLowerCase().replace(/(\n*)( *)/g, '') == mystring.toLowerCase().replace(/(\n*)( *)/g, '')) {
              samePubDate = true;
            }
          }
          // embed.setTimestamp won't take pubDate and isoDate isn't gonna cut it
        }

        if(sameTitle) {
          break;
        }
      }

      await sendMessages(currentFeedItem, desiredChannel, sameTitle, samePubDate);

      
    } else {
    console.log("\nRSS Message already exists");
    }
  });
}

async function createHash(payload: string) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function buildEmbed(feedItem: Parser.Item): Promise<MessageEmbed> {
  let embed = new MessageEmbed()
  .setColor(0xb00b69);
  if (feedItem.title) {
    embed.setTitle(feedItem.title);
  }

  if(feedItem.pubDate) {
    // Removes unnecessary chars from timestamp
    var mystring: string = feedItem.pubDate.replace(/\+[0-9]*$/, '');

    // embed.setTimestamp won't take pubDate and isoDate isn't gonna cut it
    // and I don't care WHO the IRS sends, I'm not reading the documentation
    embed.setFooter({text: mystring});
  }

  if (feedItem.link) {
    embed.setURL(feedItem.link);
  }

  if (feedItem.content) {
    // Last line of conten is always Tags (HSKE Specific)
    embed.setDescription(feedItem.content.replace(/\n(\w+ ?)+$/g, ''));
    //console.log("\nEmbed desc: \n" + embed.description);
  } 

  return embed;
}

async function sendMessages(feedItem: Parser.Item, desiredChannel: TextChannel, sameTitle: boolean, samePubDate: boolean) {
  //if(!nothingFound){
    // New Message
    if (desiredChannel && !sameTitle) {
      let embed = await buildEmbed(feedItem);
      desiredChannel.send({
        content: "Neue Nachricht im Planungsportal:",
        embeds: [embed]
      });
      console.log("\nNeue Nachricht, fuer channel: \n" + desiredChannel.id + "\nEmbed: " + embed);

    } else if (desiredChannel && sameTitle && !samePubDate) // There's been an update to a existing Post
    {

      let embed = await buildEmbed(feedItem);
      desiredChannel.send({
        content: "Der letzte Post im Planungsportal wurde aktualisiert",
        embeds: [embed]
      });
      console.log("\nAktualiserte Nachricht:\n" + desiredChannel.id + "\nEmbed: " + embed);

    } else {
      // Nothing new
      console.log("Keine neuen Pfosten im Planungsportal");

    }
  /*} else {

    //console.log("\nNo Embeds to compare to found! ChannelD: " + desiredChannel.id);
    desiredChannel.send({
      content: "Variante 3 BOTTOM TEXT",
      embeds: [buildEmbed(feedItem)]
    });

  }*/
}

/**
 * Searches the RSS Database for the message  
 * 
 * @param feeditem - the Item form the RSS feed
 * @param desiredChannel - the channel the message is supposed to land in
 * @returns true, if the message already has been posted
 */ 
async function CheckRSSDB(feeditem: Parser.Item, desiredChannel: TextChannel): Promise<boolean> {
  const dbrss = new Keyv("sqlite://RSS.sqlite");
  dbrss.on("error", (err) =>
    console.error("Keyv connection error:", err)
  );
  try{
    let hash = await createHash(feeditem.toString() + desiredChannel);
    // MessageID als Key
    let channelID = await dbrss.get(hash);
    if(channelID && channelID == desiredChannel) {
      console.log("\n\n\n\nHERE");
      return true;
    } else {
      await dbrss.set(hash, desiredChannel);
      return false; // Nothing found in db
    }
  } catch(error) {
    console.error("Some error in the RSS DB function");
  }
  return false;
}


export const download = (url: string, filepath: string) => {
  const proto = !url.charAt(4).localeCompare('s') ? https : http;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    let fileInfo: any = null;

    const request = proto.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length'] as string, 10)
      };

      response.pipe(file);
    });

    // The destination stream is ended by the time it's called
    file.on('finish', () => resolve(fileInfo));

    request.on('error', err => {
      fs.unlink(filepath, () => reject(err));
    });

    file.on('error', err => {
      fs.unlink(filepath, () => reject(err));
    });

    request.end();
  });
};


export const add4WeeksToDate = (date: Date): number => {
  const in4Wks = new Date()
  return in4Wks.setDate((date.getDate() as number) + 28);
}

export const adsdbloop = async (client: Client, adsdb: Keyv) => {
  console.log("scanning for old ads...");
  let adsChn = await client.channels.cache.get(settings.channels.ads)?.fetch() as TextChannel;
  let ads = await adsChn.messages.fetch();
  ads.forEach(async (msg) => {
    console.log(msg.id);
  })
  


}


// Pass the entire Canvas object because you'll need to access its width, as well its context
export const applyText = (canvas: Canvas, text: string): string => {
  const ctx = canvas.getContext("2d");

  // Declare a base size of the font
  let fontSize = 70;

  do {
    // Assign the font to the context and decrement it so it can be measured again
    ctx.font = `${(fontSize -= 10)}px sans-serif`;
    // Compare pixel width of the text to the canvas minus the approximate avatar size
  } while (ctx.measureText(text).width > canvas.width - 300);

  // Return the result to use in the actual canvas
  return ctx.font;
};

export const toHHMMSS = (time: string): string => {
  var sec_num = parseInt(time, 10); // don't forget the second param
  var hours = Math.floor(sec_num / 3600) as unknown as string;
  var minutes = Math.floor((sec_num - Number(hours) * 3600) / 60) as unknown as string;
  var seconds = (sec_num - Number(hours) * 3600 - Number(minutes) * 60) as unknown as string ;

  if (Number(hours) < 10) {
    hours = "0" + hours as string;
  }
  if (Number(minutes) < 10) {
    minutes = "0" + minutes;
  }
  if (Number(seconds) < 10) {
    seconds = "0" + seconds;
  }
  return hours + "h " + minutes + "min " + seconds + "sec";
};

/* module.exports = {
  toLevel(number) {
    return (0.01 * number) ^ 0.8;
  },

  ValidateEmail(mail: any, message: any) {
    if (
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(
        mail
      )
    ) {
      return true;
    }
    message.reply("You have entered an invalid email address! try using the scheme: ..verify max.mustermann@stud.hs-kempten.de");
    logMessage(message, `${message.author.username} entered a wrong email.`);
    return false;
  },
  // logs a message in the logs channel of the guild it was sent in
  async logMessage(message, msg) {
    (
      await message.guild.channels.cache
        .find((channel) => channel.name == settings.channels.logs)
        .fetch()
    ).send(msg);
    console.log(msg);
  },

  /**
   * Downloads file from remote HTTP[S] host and puts its contents to the
   * specified location.
   */
/*   async download(url, filePath) {
    const proto = !url.charAt(4).localeCompare('s') ? https : http;

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      let fileInfo = null;

      const request = proto.get(url, response => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
          return;
        }

        fileInfo = {
          mime: response.headers['content-type'],
          size: parseInt(response.headers['content-length'], 10),
        };

        response.pipe(file);
      });

      // The destination stream is ended by the time it's called
      file.on('finish', () => resolve(fileInfo));

      request.on('error', err => {
        fs.unlink(filePath, () => reject(err));
      });

      file.on('error', err => {
        fs.unlink(filePath, () => reject(err));
      });

      request.end();
    });
  }
};
 */