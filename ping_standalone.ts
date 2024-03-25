import ping from "./ping.js";
import ping_rooms from "./data/ping_rooms.json" with { type: "json" };

async function main() {
    let output = "";

    output += `## Dept of Ping 🏓\n\n`;
    output += `Here we reveal, rank, and applaud the homeservers with the lowest ping, as measured by [pingbot](https://github.com/maubot/echo), a [maubot](https://github.com/maubot/maubot) that you can host on your own server.\n\n`;

    for (const ping_room of ping_rooms.rooms) {
        const ping_url = `https://maubot.xyz/_matrix/maubot/plugin/pingstat/${ping_room.room_id}/stats.json`
        output += await ping(ping_url, ping_room.alias);
    }

    console.log(output)
}

main();
