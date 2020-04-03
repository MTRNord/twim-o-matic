export default function (body: string) {
    var project: string, section: string, maxScore: Number;
    maxScore = 0;

    const sections = {};
    Object.keys(require("./data/sections.json")).forEach((key) => {
        sections[key] = 0;
    });

    if (body.includes("simplematrixlib")) sections["sdks"]++;
    if (body.includes("py-matrix-utils")) sections["sdks"]++;
    if (/from.*to.*matrix/.exec(body)) sections["bridges"]++;
    if (body.includes("multi arch synapse docker image")) sections["synapse-deployment"]++;
    if (body.includes("synapse docker")) sections["synapse-deployment"]++;
    if (body.includes("image for synapse")) sections["synapse-deployment"]++;
    if (body.includes("docker")) sections["ops"]++;
    if (body.includes("synapse")) sections["servers"]++;
    if (body.includes("notepad")) sections["projects"]++;
    if (body.includes("fluffy")) sections["clients"]++;
    if (body.includes("bot")) sections["bots"]++;
    if (body.includes("gsoc")) sections["status"]++;
    if (body.includes("homeserver")) sections["servers"]++;
    if (body.includes("rooms")) sections["rooms"]++;
    if (body.includes("transcript")) sections["news"]++;
    if (body.includes("client")) sections["clients"]++;
    if (body.includes("scrolling")) sections["clients"]++;
    if (body.includes("kubernetes")) sections["ops"]++;
    if (body.includes("nheko")) sections["clients"]++;
    if (body.includes("thumbnail")) sections["clients"]++;
    
    Object.keys(sections).forEach(key => {
        if (sections[key] > maxScore) {
            maxScore = sections[key];
            section = key;
        }
    });

    var projects = require("./data/projects.json")
    Object.keys(projects).forEach(key => {
        if (body.includes(key)) {
            project = key;
        }
    });

    Object.keys(sections).forEach(key => {
        if (sections[key] === 0 ) {
            delete sections[key];
        }
    });

    return {
        project: project,
        section: section,
        scores: sections
    }
}