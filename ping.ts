import fetch from 'node-fetch';

interface Response {
    disclaimer: string;
    pings: {
        [key: string]: Ping;
    };
    mean: number;
    pongservers: string[];
}

interface Ping {
    pongs?: Map<string, Pong>;
    pings: string[];
    mean: number;
    median: number;
    gmean: number;
}

interface Pong {
    diffs?: Map<string, number>;
    mean: number;
    median: number;
    gmean: number;
}

export default async function (url: string, alias: string) {
    var result = "";
    try {
        const response = await fetch(url);
        if (response.status !== 200) {
            console.log('statusCode:', response.status);
            process.exit(1);
        }
        const json = await response.json() as Response;
        const pings_entries = Object.entries(json.pings);

        result += `### [${alias}](https://matrix.to/#/${alias})\n`
        result += `Join [${alias}](https://matrix.to/#/${alias}) to experience the fun live, and to find out how to add YOUR server to the game.\n\n`
        result += `|Rank|Hostname|Median MS|\n`;
        result += `|:---:|:---:|:---:|\n`;
        const pings = new Map([...pings_entries].sort((a, b) => a[1].median - b[1].median));
        [...pings.entries()].slice(0, 10).forEach(([server, ping], i) => {
            result += `|${i + 1}|${server}|${ping?.median}|\n`;
        });
        result += `\n`;
    } catch (error) {
        console.log('error:', error);
        process.exit(1);
    }
    return result;
}
