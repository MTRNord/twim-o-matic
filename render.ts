import {
    MatrixClient,
    SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import {
    readdirSync,
    readFileSync,
    writeFileSync,
    createWriteStream
} from "fs";
import ping from "./ping";
import getProjectInfo from "./getProjectInfo";
const axios = require('axios').default;
const { program } = require('commander');
program
  .option('-d, --debug', 'output all the json blocks, suppress header')
  .option('-s, --summary', 'highlight missing summary blocks')
  .option('-m, --media', 'download and process media')
  .option('-p, --pings', 'get ping-room data');
program.parse(process.argv);
import moment = require('moment');

const homeserverUrl = require("./config/access_token.json").homeserver;
const accessToken = require("./config/access_token.json").accessToken;
const userId = require("./config/access_token.json").userId;
const senders = require("./data/senders.json");
const sections = require("./data/sections.json");
const storage = new SimpleFsStorageProvider("config/twim-o-matic.json");

const client = new MatrixClient(homeserverUrl, accessToken, storage);

//client.start().then(() => console.log("Client started!"));

const twimRoomId = "!xYvNcQPhnkrdUmYczI:matrix.org";


function getSaidBookism() {
    const saidBookisms = ["said", "announced", "told us", "reported", "offered"];
    return saidBookisms[Math.floor(Math.random() * saidBookisms.length)];
}

function ds() {
    return (new Date()).toISOString().substring(0, 10);
}

function generateSignOff() {
    var title:string = "## That's all I know 🏁";
    const messages = [
        "See you next week, and be sure to stop by [#twim:matrix.org] with your updates!",
        "So that's all I have to say to you right now! See you next week, and be sure to stop by [#twim:matrix.org] with your updates!"
    ];
    const urls = `[#TWIM:matrix.org]: https://matrix.to/#/#TWIM:matrix.org`;
    return `${title}\n\n${messages[0]}\n\n${urls}\n`;
}

function getSectionFromIcon(icon:string) {
    for (let s of Object.keys(sections)) {
        if (sections[s].icon === icon) {
            return s;
        }
    }
}

var output = {};
var pings = "";
var prevSection = "";
var prevSender = "";
var prevEventId = "";

async function getEvent(eventId) {
    var event = await client.getEvent(twimRoomId, eventId);
    return event;
}

function handleEvent(event, title, mode, sectionOverride) {
    var written = false;

    // first extract the body content
    var body = event.content.body;
    // remove the various TWIM markers
    body = body.replace("TWIM: ", "");
    body = body.replace("TWIM:", "");
    body = body.replace("@twim:cadair.com: ", "");
    body = body.replace("@twim:cadair.com:", "");
    body = body.replace("@twim:cadair.com", "");
    body = body.replace(/^TWIM /gm, "");
    body = body.replace(/^TWIM\n/gm, "");
    body = body.trim();

    // get project info
    var section = 'todo';
    var bodyLower = body.toLowerCase();
    var projectInfo = getProjectInfo(bodyLower);

    // get section
    if (sectionOverride) {
        section = sectionOverride;
    }
    else if (! ["👀", "🧹"].includes(mode)) {
        section = getSectionFromIcon(mode);
        projectInfo.sectionSet = "Section set by mode";
    }
    else if (projectInfo.section) {
        section = projectInfo.section;
    } else {
        // do nothing, leave it as 'todo'
    }
    section = sections[section].title;
    
    // find the score (sum of all reactions)
    const reducer = (accumulator, currentValue) => accumulator + currentValue;
    var reactions = event.unsigned['m.relations']['m.annotation'].chunk;
    const score = reactions.map(r => r.count).reduce(reducer);

    // set the title line
    var titleLine:string = "";
    if (body[0] === '#') {
        const bodyLines = body.split('\n');
        titleLine = `### ${bodyLines[0].replace(/\#/g, "").trim()}\n\n`
        bodyLines.shift();
        body = bodyLines.join('\n');
        body = body.trim();
    }
    else if ([sections.thoughts.title, sections.spec.title].includes(section)) {
        titleLine = "";
    }
    else if (projectInfo.project) {
        title = projectInfo.project;
        titleLine = `### ${title}\n\n`;
    } else {
        titleLine = `### ${title} ${score}\n\n`;
    }

    // quoteMode means we give credit and prepend
    var quoteMode = true;
    if (event.sender === userId) {
        quoteMode = false;
    }

    // senderLine depends on the quoteMode
    var senderLine:String = "";
    if (quoteMode) {
        var sender = senders[event.sender];
        if (sender) {
            senderLine = `[${sender.name}]`;
            if (sender.url) {
                senderLine += `(${sender.url})`;
            } else {
                senderLine += `(https://matrix.to/#/${event.sender})`;
            }
        } else {
            senderLine = `TODO MISSING NAME [${event.sender}](https://matrix.to/#/${event.sender})`;
        }
        senderLine += ` ${getSaidBookism()}:\n\n`;
    }

    // massage the body text where needed
    if (quoteMode) {
        // prepend each line with a `>`, no space if it's a blank line
        body = body.replace(/^/gm, `> `);
        body = body.replace(/^> *$/gm, ">");
    }

    // * for lists, not -, get over it
    body = body.replace(/^>(( )+)-/gm, ">$1*");

    // fix some missing linebreaks
    body = body.replace(/(^> [^\*](.)+\n)> \*/mg, `$1>\n> *`);

    // add warning to malformed header
    body = body.replace(/(^> )(#+) (.*)/mg, `$1#### $3`);

    // insert missing gapped `>` after quoted headers
    body = body.replace(/(^> #*.*)\n>[^\n]/gm, `$1\n>\n> `);

    // insert matrix.to links for rooms
    const regex = /(#([a-z.-]+):([a-z.-]+)\b)/g;
    const subst = `[$1](https://matrix.to/#/$1)`;
    body = body.replace(regex, subst);

    // trim the lot
    body = body.trim();

    if (["m.video", "m.image"].includes(event.content.msgtype)) {
        if (! program.media) return;

        titleLine = "### TODO GET IMAGE\n\n";
        var url = "https://matrix.org/_matrix/media/r0/download/" + event.content.url.replace('mxc://', '');
        var filename = body.replace('> ', '').replace(/ /g, "");
        filename = `${ds()}-${event.event_id.substring(1,6)}-${filename}`;
        downloadImage(url, `blog/img/${filename}`);
        body = `![${filename}](blog/img/${filename})`;
        if (prevSender === event.sender) {
            output[prevSection][output[prevSection].length-1].content += `\n${body}\n`;
            written = true;
        }
    } else {
        prevSection = section;
        prevSender = event.sender;
        prevEventId = event.event_id;
    }

    if (written) return;

    if (!output[section]) output[section] = [];

    var debugText = "";
    if (program.debug) {
        debugText = event.event_id + `\n` + JSON.stringify(projectInfo) + `\n\n`;
    }

    var projectLine:string = "";
    if (projectInfo.summary) {
            projectLine = projectInfo.summary + `\n\n`;
        }
    else if (program.summary) {
        if (! ["status", "synapse-deployment", "projects"].includes(projectInfo.section)) {
            projectLine = `TODO MISSING SUMMARY LINE\n\n`;
        }
    }

    output[section].push({
        score: score,
        content:`${titleLine}${debugText}${projectLine}${senderLine}${body}\n`,
        event_id: event.event_id
    });
}

async function downloadImage (url, path) {  
    const writer = createWriteStream(path);
  
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    })
  
    response.data.pipe(writer)
  
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
}

function generateHeader() {
    if (program.debug) return "";

    return `---
date: '${ds()}'
title: 'This Week in Matrix ${ds()}'
categories:
  - This Week in Matrix
author: Ben Parsons
image: TODO
---\n\n`;
}

function outputAll() {
    var result:string = "";
    result += generateHeader();
    result += `## Matrix Live 🎙\n\n`;
    result += generateSection(sections.todo);
    result += generateSection(sections.status);
    result += generateSection(sections.spec);
    result += generateSection(sections.gsoc);
    result += generateSection(sections.p2p);
    result += generateSection(sections.servers);
    result += generateSection(sections["synapse-deployment"]);
    result += generateSection(sections.bridges);
    result += generateSection(sections.clients);
    result += generateSection(sections.encryption);
    result += generateSection(sections.sdks);
    result += generateSection(sections.ops);
    result += generateSection(sections.services);
    result += generateSection(sections.blockchain);
    result += generateSection(sections.iot);
    result += generateSection(sections.bots);
    result += generateSection(sections.eventvideos);
    result += generateSection(sections.talks);
    result += generateSection(sections.projects);
    result += generateSection(sections.guides);
    result += generateSection(sections.hackathons);
    result += generateSection(sections.jobs);
    result += generateSection(sections.news);
    result += generateSection(sections.rooms);
    result += generateSection(sections.welcome);
    result += generateSection(sections.thoughts);
    result += pings;
    result += generateSignOff();

    // wrap bare urls
    const regex = /([^(])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))/mg;
    const subst = `$1<$2>`;
    result = result.replace(regex, subst);
    //console.log(result);
    writeFileSync("out.md", result);
}

function generateSection(section) {
    if (! output[section.title]) return "";

    var result:string = "";
    result += `## ${section.title}\n\n`;
    output[section.title].sort(( a, b ) => a.score > b.score ? -1 : 1 );
    output[section.title].forEach(part => {
        result += `${part.content}\n`;
    });
    return result;
}

async function main() {
    const friday = 5;
    let dateSince = moment().add(-1, 'weeks').isoWeekday(friday); // last friday
    var eventsFiles = readdirSync('./events').filter(fn => {
        return fn.substring(7,17) > dateSince.format('YYYY-MM-DD')
    });
    console.log("Events files:");
    console.log(eventsFiles);
    var eventsToHandle = [];
    eventsFiles.forEach(fn => {
        var fileContentsArr = readFileSync(`events/${fn}`, 'utf-8').split('\n');
        eventsToHandle = eventsToHandle.concat(fileContentsArr);
    })
    for(var line of eventsToHandle) {
        if (line.length === 0) continue;

        line = line.split(",");
        try {
            handleEvent(await getEvent(line[0]), "TODO", line[1], line[2])
        } catch (ex) {
            console.log(ex.body);
            console.log(line);
        }
    }
    if (program.pings) {
        pings = await ping();
    }
    
    outputAll();
}

main();
