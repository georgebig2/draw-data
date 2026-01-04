class Random {
    constructor(seed) {
        if (typeof seed === "undefined") {
            this.seed = new Date().getTime()
        } else {
            this.seed = seed
        }
        this.random = this.splitmix32(this.seed);
    }
    splitmix32(a) {
        return function () {
            a |= 0;
            a = a + 0x9e3779b9 | 0;
            let t = a ^ a >>> 16;
            t = Math.imul(t, 0x21f0aaad);
            t = t ^ t >>> 15;
            t = Math.imul(t, 0x735a2d97);
            return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
        }
    }
    next() {
        //return Math.random();
        return this.random();
        //const x = Math.sin(this.seed++) * 10000;
        //return x - Math.floor(x)
    }
}

function cloneImageData(imageData) {
    return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function rgb2lab(rgb) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x, y, z;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}
function lab2rgb(lab) {
    let y = (lab[0] + 16) / 116, x = lab[1] / 500 + y, z = y - lab[2] / 200, r, g, b;
    x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16 / 116) / 7.787);
    y = 1.00000 * ((y * y * y > 0.008856) ? y * y * y : (y - 16 / 116) / 7.787);
    z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16 / 116) / 7.787);
    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b = x * 0.0557 + y * -0.2040 + z * 1.0570;
    r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1 / 2.4) - 0.055) : 12.92 * r;
    g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1 / 2.4) - 0.055) : 12.92 * g;
    b = (b > 0.0031308) ? (1.055 * Math.pow(b, 1 / 2.4) - 0.055) : 12.92 * b;
    return [Math.max(0, Math.min(1, r)) * 255, Math.max(0, Math.min(1, g)) * 255, Math.max(0, Math.min(1, b)) * 255]
}

function loadPaletteCSV(csvText) {
    const palette = [];
    var lines = csvText.split(/\r?\n/);
    if (lines.length > 0) {
        lines.shift();
    }
    for (const line of lines) {
        if (line.trim() === '') continue;
        const values = line.split(',').map(v => v.trim());
        if (values.length > 2) {
            // "$\\color{#FFFFFF}{\\rule{7px}{7px}}$ 600 white"
            // Parse the integer (e.g., 600) after the color block
            const numMatch = values[2].match(/\}\$\s*(\d+)/);
            var number = 0;
            if (numMatch) {
                number = parseInt(numMatch[1], 10);
            }

            const match = values[2].match(/#([A-Fa-f0-9]{6})/);
            if (match) {
                palette.push([parseInt(match[0].replace('#', ''), 16), number]); // push as integer
            }
        }
    }
    return palette;
}

function posterize(levels) {
    var paletteLab = [];
    for (let r = 0; r < levels; r++) {
        for (let g = 0; g < levels; g++) {
            for (let b = 0; b < levels; b++) {
                const rr = Math.floor(r * 255 / (levels - 1));
                const rg = Math.floor(g * 255 / (levels - 1));
                const rb = Math.floor(b * 255 / (levels - 1));
                const rLab = rgb2lab([rr, rg, rb]);
                const rh = (rr << 16) | (rg << 8) | rb;
                paletteLab.push([rLab, rh]);
            }
        }
    }
    return paletteLab
}

function posterizeInLab(levelsL, levelsA, levelsB) {
    var paletteLab = [];
    for (let l = 0; l < levelsL; l++) {
        for (let a = 0; a < levelsA; a++) {
            for (let b = 0; b < levelsB; b++) {
                const ll = Math.floor(l * 100 / (levelsL - 1));
                const aa = Math.floor(a * 255 / (levelsA - 1)) - 128;
                const bb = Math.floor(b * 255 / (levelsB - 1)) - 128;
                const rLab = [ll, aa, bb];
                // Convert back to RGB
                const rgb = lab2rgb(rLab);
                const rr = Math.floor(rgb[0]);
                const rg = Math.floor(rgb[1]);
                const rb = Math.floor(rgb[2]);
                const rh = (rr << 16) | (rg << 8) | rb;
                paletteLab.push([rLab, rh]);
            }
        }
    }
    return paletteLab
}

function makePaletteLab(palette, guangNa, lanGuo) {
    var paletteLab = [];
    for (let p = 0; p < palette.length; p++) {
        if (!guangNa && palette[p][1] > 0) continue;
        if (!lanGuo && palette[p][1] < 0) continue;
        const pr = (palette[p][0] >> 16) & 0xff;
        const pg = (palette[p][0] >> 8) & 0xff;
        const pb = (palette[p][0]) & 0xff;
        const prLab = rgb2lab([pr, pg, pb]);
        //const prLab = rgbToHsl(pr, pg, pb);
        paletteLab.push([prLab, palette[p][0]]);
    }
    return paletteLab;
}

function convertToPalette(imgData, paletteLab, random, rndFactor, one2one) {
    let pixels = new Map();
    const data = imgData.data;
    const dataLen = data.length;
    for (let idx = 0; idx < dataLen; idx += 4) {
        const h = (data[idx] << 16) | (data[idx + 1] << 8) | data[idx + 2];
        const entry = pixels.get(h);
        if (entry) {
            entry.num++;
        } else {
            pixels.set(h, { num: 1 });
        }
    }
    const sortedPixels = Array.from(pixels.entries())
        .filter((a) => a[1].num > 10 && a[0] < 0xfafafa)
        .sort((a, b) => b[1].num - a[1].num);

    const usedPalette = new Set();
    for (let i = 0; i < sortedPixels.length; i++) {
        const h = sortedPixels[i][0];
        const r = (h >> 16) & 0xff;
        const g = (h >> 8) & 0xff;
        const b = h & 0xff;
        const rLab = rgb2lab([r, g, b]);

        let minDistance = Number.MAX_VALUE;
        let closestColor = null;
        let closestIdx = -1;
        for (let p = 0; p < paletteLab.length; p++) {
            if (one2one && usedPalette.size < paletteLab.length && usedPalette.has(p)) continue;
            const prLab = paletteLab[p][0];
            const distance = (random.next() * rndFactor - rndFactor / 2) +
                (rLab[0] - prLab[0]) * (rLab[0] - prLab[0]) +
                (rLab[1] - prLab[1]) * (rLab[1] - prLab[1]) +
                (rLab[2] - prLab[2]) * (rLab[2] - prLab[2]);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = paletteLab[p][1];
                closestIdx = p;
            }
        }
        usedPalette.add(closestIdx);
        pixels.get(h).newHex = closestColor;
    }

    for (let idx = 0; idx < dataLen; idx += 4) {
        const h = (data[idx] << 16) | (data[idx + 1] << 8) | data[idx + 2];
        const pixelData = pixels.get(h);
        const H = pixelData.newHex;
        if (H == null) continue;
        const R = (H >> 16) & 0xff;
        const G = (H >> 8) & 0xff;
        const B = H & 0xff;
        if (pixelData.num > 10) {
            data[idx] = R;
            data[idx + 1] = G;
            data[idx + 2] = B;
        }
    }
}

function findRects(imgDataOrig, palYOffset) {
    const width = imgDataOrig.width;
    const height = imgDataOrig.height;
    //const data = imgDataOrig.data;

    let detect = cv.matFromImageData(imgDataOrig);//src.clone();
    let ddata = detect.data;

    // add vertical white delimeters between colors
    for (let y = palYOffset; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
            const dx0 = (y * width + x) * 4;
            const dxl = (y * width + x + 1) * 4;
            rl = ddata[dxl + 0];
            gl = ddata[dxl + 1];
            bl = ddata[dxl + 2];
            r0 = ddata[dx0 + 0];
            g0 = ddata[dx0 + 1];
            b0 = ddata[dx0 + 2];
            if (r0 != rl || g0 != gl || b0 != bl) {
                ddata[dx0 + 0] = 255;
                ddata[dx0 + 1] = 255;
                ddata[dx0 + 2] = 255;
            }
        }
    }

    for (let y = palYOffset; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx0 = (y * width + x) * 4;
            r0 = ddata[dx0 + 0];
            g0 = ddata[dx0 + 1];
            b0 = ddata[dx0 + 2];
            if (r0 >= 250 && g0 >= 250 && b0 >= 250) {
                //detect.data[dx0 + 0] = 0;
                //detect.data[dx0 + 1] = 0;
                //detect.data[dx0 + 2] = 0;
            }
        }
    }

    let gray = new cv.Mat();
    cv.cvtColor(detect, gray, cv.COLOR_RGBA2GRAY);

    const brightness = -100;
    const alpha_b = (255 + brightness) / 255.0;
    const gamma_b = 0;
    //cv.addWeighted(gray, alpha_b, gray, 0, gamma_b, gray);

    const contrast = -50;
    const f = 131.0 * (contrast + 127) / (127 * (131 - contrast));
    const alpha_c = f;
    const gamma_c = 127 * (1 - f);
    //cv.addWeighted(gray, alpha_c, gray, 0, gamma_c, gray);
    //cv.bitwise_not(gray, gray);

    //let bw = new cv.Mat();
    // cv.cvtColor(src, src, cv.COLOR_RGBA2RGB, 0);
    //cv.bilateralFilter(src, gray, 1, 75, 75, cv.BORDER_DEFAULT);
    cv.adaptiveThreshold(gray, gray, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 3, 0);

    let canny = gray;//new cv.Mat();
    //cv.Canny(gray, canny, 0, 0, 3, false);

    let rects = [];
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(canny, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    let approx = new cv.Mat();
    for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        //const peri = cv.arcLength(cnt, true);
        cv.approxPolyDP(cnt, approx, 100., true);
        const v = approx.size();
        if (approx.size().height <= 4) {
            const rect = cv.boundingRect(approx);
            if (rect.width < 300 && rect.width > 50 && rect.height < 350 && rect.height > 50 && rect.y > palYOffset) {
                rects.push(rect);
            }
        }
    }
    const sortedRects = rects.sort((a, b) => a.x - b.x);
    outRects = [];
    for (let i = 0; i < sortedRects.length; ++i) {
        if (i > 0 && Math.abs(sortedRects[i].x - sortedRects[i - 1].x) < sortedRects[i - 1].width / 3)
            continue;
        outRects.push(sortedRects[i]);
    }

    let dbg = gray;
    if (0) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = dbg.ucharPtr(y, x)[0];
                data[idx + 1] = dbg.ucharPtr(y, x)[1];
                data[idx + 2] = dbg.ucharPtr(y, x)[2];
            }
        }
        //ctx.putImageData(imgData, 0, 0);
    }
    //src.delete();
    return outRects;
}

function getClosestColorLabel(palette, r, g, b) {
    var paletteLab = [];
    for (let p = 0; p < palette.length; p++) {
        const pr = (palette[p][0] >> 16) & 0xff;
        const pg = (palette[p][0] >> 8) & 0xff;
        const pb = (palette[p][0]) & 0xff;
        const prLab = rgb2lab([pr, pg, pb]);
        paletteLab[p] = prLab;
    }

    const rLab = rgb2lab([r, g, b]);
    let minDistance = Number.MAX_VALUE;
    let closestIdx = -1;
    for (let p = 0; p < palette.length; p++) {
        const prLab = paletteLab[p];
        const distance = //(random.next() * 10 - 5) +
            (rLab[0] - prLab[0]) * (rLab[0] - prLab[0]) +
            (rLab[1] - prLab[1]) * (rLab[1] - prLab[1]) +
            (rLab[2] - prLab[2]) * (rLab[2] - prLab[2]);
        if (distance < minDistance) {
            minDistance = distance;
            closestIdx = p;
        }
    }
    //pixels.get(h).newHex = closestColor;
    return [palette[closestIdx][1], palette[closestIdx][0]];
}

function findRectColors(rect, imgData) {
    const width = imgData.width;
    const data = imgData.data;
    let pixels = new Map();
    for (let y = rect.y; y < rect.y + rect.height; y++) {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
            const idx = (y * width + x) * 4;
            let r = data[idx];
            let g = data[idx + 1];
            let b = data[idx + 2];
            const H = (r << 16) | (g << 8) | b;
            //if (H == 0)
            //    continue;
            if (!pixels.has(H)) {
                pixels.set(H, { num: 1 });
            } else {
                pixels.get(H).num++;
            }
        }
    }
    const sortedPixels = Array.from(pixels.entries()).sort((a, b) => b[1].num - a[1].num);
    return sortedPixels;
}

function addMarkersLabels(rect, idx, imgData, ctx, palette) {
    //const cPaletteChars = "1234567890ABCdEFGhiKmnPQRSTuWXYZ*";
    const colors = findRectColors(rect, imgData);
    const h = colors[0][0];
    const r = (h >> 16) & 0xff;
    const g = (h >> 8) & 0xff;
    const b = h & 0xff;

    const label = getClosestColorLabel(palette, r, g, b);
    const R = (label[1] >> 16) & 0xff;
    const G = (label[1] >> 8) & 0xff;
    const B = label[1] & 0xff;

    //ctx.antialias = 0 ? 'none' : 'default';
    ctx.fillStyle = `rgb(${R},${G},${B})`;
    ctx.fillRect(rect.x - 0, rect.y + rect.height * 3 / 4, rect.width + 0, rect.height / 5);
    //ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    ctx.fillStyle = (R + G + B) < 300 ? "white" : "black"; //'rgba(51, 51, 51, 1)';
    //const fSize = 50 / 1.5;//Math.min(300, palH * 0.5);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    //ctx.fillText(i + "", palX + palW/2, palY + palH/2);
    //ctx.font = 100 + "px bold 'Courier New'";
    //ctx.fillText((idx < cPaletteChars.length ? cPaletteChars[idx] : "?") + "", rect.x + rect.width / 2, rect.y + rect.height / 3);
    //ctx.font = "50px bold 'Courier New'";
    ctx.font = "bold 32px 'Courier New'";
    ctx.fillText(Math.abs(label[0]) + (label[0] > 0 ? "G" : "L"), rect.x + rect.width / 2, rect.y + rect.height * 4 / 5);
    return h;
}


function loadOpenCV() {
    importScripts('./opencv.js');
    cv.onRuntimeInitialized = () => {
        console.log("OpenCV.js runtime initialized in worker.");
        self.postMessage("OpenCV ready");
    };
}
loadOpenCV();

let allPalettes = [];
self.onmessage = async function (event) {
    const { type, data } = event.data;

    if (type === 'init') {
        self.postMessage({ type: 'ready' });
    } else if (type === 'loadPalette') {
        const palette = loadPaletteCSV(data);
        allPalettes = allPalettes.concat(palette);
        //self.postMessage({ type: 'paletteLoaded', data: palette });
    } else if (type === 'generatePalette') {
        const { imageData, batch, paletteSize = 6, rndFactor = 3 } = data;

        try {
            const random = new Random(Date.now() & 0x0fffffff);

            let rects = findRects(imageData, 4005);

            //const levels = 6;//Math.floor(random.next() * 4) + 4;//paletteSize;//Math.max(2, Math.round(Math.cbrt(paletteSize)));
            //const paletteLab2 = random.next() < 0.5 ?
            //    posterize(levels) : posterizeInLab(levels, levels, levels);

            const paletteLab = makePaletteLab(allPalettes, true, true);

            const canvas = new OffscreenCanvas(imageData.width, imageData.height);
            const ctx = canvas.getContext('2d');
            //ctx.antialias = 0 ? 'none' : 'default';

            for (let i = 0; i < batch; i++) {

                let imageData2 = cloneImageData(imageData);
                convertToPalette(imageData2, paletteLab, random, rndFactor * 300, true);

                if (1) {
                    ctx.putImageData(imageData2, 0, 0);
                    for (let i = 0; i < rects.length; ++i) {
                        addMarkersLabels(rects[i], i, imageData2, ctx, allPalettes);
                    }
                    imageData2 = ctx.getImageData(0, 0, imageData2.width, imageData2.height);
                }

                self.postMessage({
                    type: 'paletteResult',
                    data: {
                        imageData: imageData2,
                    }
                });
            }
        } catch (error) {
            self.postMessage({
                type: 'error',
                error: error.message
            });
        }
    }
};

