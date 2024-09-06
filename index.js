const fs = require("fs");
const nbt = require('nbt');
const idsMap = require("./ids.json");
const { program } = require('commander');

program
    .option('-i, --input <string>', 'input file name (.schematics format)')
    .option('-o, --output <string>', 'output file name (.txt format)', "output.txt")
    .option('--air', 'whether or not to include air blocks')
    .option('-sx, --shiftX <number>', 'Offset X', 0)
    .option('-sy, --shiftY <number>', 'Offset Y', 0)
    .option('-sz, --shiftZ <number>', 'Offset Z', 0)
    // .option('-cx0, --cropX0 <number>', 'Crop X Start', 0)
    // .option('-cy0, --cropY0 <number>', 'Crop Y Start', 0)
    // .option('-cz0, --cropZ0 <number>', 'Crop Z Start', 0)
    // .option('-cx1, --cropX1 <number>', 'Crop X End', 0)
    // .option('-cy1, --cropY1 <number>', 'Crop Y End', 0)
    // .option('-cz1, --cropZ1 <number>', 'Crop Z End', 0)

program.parse();

const options = program.opts();
if (!options.input || !fs.existsSync(options.input)) {
    console.error("Must provide a valid input file name, with a correct relative path to file")
    return;
}

const fileContent = fs.readFileSync(options.input);

nbt.parse(fileContent, function (error, data) {
    if (error) { throw error; }
    main(options.output, data, options.shiftX, options.shiftY, options.shiftZ);
});

function main(output, data, shiftX, shiftY, shiftZ) {
    const schema = data;
    let blocks = schema.value.Blocks.value;
    let blocksData = schema.value.Data.value;
    let t = {};
    let miss = {};
    let c = 0;
    let fullBlockData = blocks.map((a, i) => {
        if (a < 0) {
            let c = ((a) >>> 0).toString(16).substr(6, 2)
            a = parseInt(c, 16);
        }

        let fullCode = (blocksData[i] ? `${a}:${blocksData[i]}` : a);
        let original = fullCode;
        if (!idsMap[fullCode]) fullCode = a;
        if (!idsMap[fullCode]) {
            c++;
            if (!miss[fullCode])
                miss[fullCode] = 0;

            miss[fullCode] += 1;
        }

        if (!t[original])
            t[original] = 0;

        t[original] += 1;
        return idsMap[fullCode]
    })

    console.warn(`${c} blocks couldn't be mapped to their type`);
    console.log('The Following block Ids were not found :', miss);

    // Height: Size along the Y axis.
    let height = schema.value.Height.value;
    let yStart = 0;
    let yEnd = schema.value.Height.value;

    // Length: Size along the Z axis.
    let length = schema.value.Length.value;
    let zStart = 0;
    let zEnd = schema.value.Length.value;
    // Width: Size along the X axis.
    let width = schema.value.Width.value;
    let xStart = 0;
    let xEnd = schema.value.Width.value;


    let threeDMatrix = [];
    //cell index (Y×length + Z)×width + X
    for (let y = yStart; y < yStart + yEnd; y++) {
        threeDMatrix.push([]);
        for (let z = zStart; z < zStart + zEnd; z++) {
            let startOfXRow = (y * length + z) * width + xStart;
            let xRow = fullBlockData.slice(startOfXRow, startOfXRow + xEnd)
            threeDMatrix[y - yStart].push(xRow)
        }
    }

    const allNewCommands = [];
    for (let y = 0; y < yEnd; y++) {
        let layerBlocks = threeDMatrix[y]
        let visited = new Array(width * height).fill(false);
        const rectangles = groupSimilarPixels(layerBlocks, visited);
        const newCmds = rectangles.filter(x => (x.type != "minecraft:air" || options.air) && x.type && x.type != "undefined")
            .map(x => `/fill ${getPos(x.x0, y, x.y0)} ${getPos(x.x1, y, x.y1)} ${x.type}`)
        allNewCommands.push(...newCmds);
    }
    let succesfulBlocksCount = Object.entries(t).map(a => a[1]).reduce((a, b) => a + b, 0);
    console.log(`${succesfulBlocksCount} Block were mapped successfully`)
    console.log(`Writing Commands to ${options.output} file ..`);
    fs.writeFileSync(output, allNewCommands.join('\n'));
    console.log(`Done!`);
}

function groupSimilarPixels(lines, visited) {
    const width = lines.length;
    const height = lines[0].length;

    const rectangles = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!visited[y * width + x]) {
                const blockType = lines[x][y];
                const rect = findRectangle(x, y, blockType, lines,visited);
                rectangles.push(rect);
            }
        }
    }

    return rectangles;
}

function isSimilar(c1, c2) {
    return c1 == c2;
}

function findRectangle(x, y, type, lines, visited) {
    let x0 = x, y0 = y;
    let x1 = x, y1 = y;
    const width = lines.length;
    const height = lines[0].length;
    // Expand the rectangle rightwards
    while (x1 + 1 < width && !visited[(y * width + (x1 + 1))] && isSimilar(type, lines[x1 + 1][y])) {
        x1++;
    }

    // Expand the rectangle downwards
    outer: while (y1 + 1 < height) {
        for (let i = x0; i <= x1; i++) {
            if (visited[((y1 + 1) * width + i)] || !isSimilar(type, lines[i][y1 + 1])) {
                break outer;
            }
        }
        y1++;
    }

    // Mark the rectangle area as visited
    for (let i = x0; i <= x1; i++) {
        for (let j = y0; j <= y1; j++) {
            visited[(j * width + i)] = true;
        }
    }

    return { x0, y0, x1, y1, type };
}

function getPos(x, y, z) {
    return `${x + options.shiftX} ${y + options.shiftY} ${z + options.shiftZ}`
}

// crop(41, 25, 195, 88, 45, 33)
// function crop(x, y, z, x1, y1, z1) {
//     yStart = Math.min(y, y1);
//     yEnd = Math.abs(y1 - y);
//     xStart = Math.min(x, x1);
//     xEnd = Math.abs(x1 - x);
//     zStart = Math.min(z, z1);
//     zEnd = Math.abs(z1 - z);
// }
